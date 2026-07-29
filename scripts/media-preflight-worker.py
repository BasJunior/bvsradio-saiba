#!/usr/bin/env python3
"""Process private BVS release audio on the VPS; never exposes source masters."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import boto3
import psycopg2
from botocore.config import Config


def run(command: list[str], timeout: int = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, text=True, capture_output=True, timeout=timeout, check=True)


def s3_client():
    endpoint = os.environ["R2_ENDPOINT"]
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name="auto",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
    )


def claim(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            select id, release_id, release_track_id, source_path
            from public.media_processing_jobs
            where status in ('queued','failed') and attempts < 3
            order by created_at for update skip locked limit 1
            """
        )
        row = cur.fetchone()
        if not row:
            conn.commit()
            return None
        cur.execute(
            """update public.media_processing_jobs
               set status='processing',attempts=attempts+1,claimed_at=now(),
                   error_code=null,error_detail=null,updated_at=now()
               where id=%s""",
            (row[0],),
        )
        conn.commit()
        return row


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path: Path) -> dict:
    result = run([
        "ffprobe", "-v", "error", "-show_format", "-show_streams",
        "-of", "json", str(path),
    ])
    payload = json.loads(result.stdout)
    audio = next((stream for stream in payload.get("streams", []) if stream.get("codec_type") == "audio"), None)
    if not audio:
        raise ValueError("NO_AUDIO_STREAM")
    fmt = payload.get("format", {})
    return {
        "format_name": str(fmt.get("format_name") or "")[:160],
        "codec_name": str(audio.get("codec_name") or "")[:80],
        "duration_seconds": float(audio.get("duration") or fmt.get("duration") or 0),
        "sample_rate": int(audio.get("sample_rate") or 0),
        "channels": int(audio.get("channels") or 0),
        "bitrate": int(audio.get("bit_rate") or fmt.get("bit_rate") or 0),
    }


def loudness(path: Path) -> tuple[float | None, float | None]:
    proc = subprocess.run(
        ["ffmpeg", "-nostdin", "-hide_banner", "-i", str(path), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
        text=True, capture_output=True, timeout=900,
    )
    matches = re.findall(r"\{\s*\"input_i\".*?\}", proc.stderr, re.S)
    if not matches:
        return None, None
    data = json.loads(matches[-1])
    return float(data["input_i"]), float(data["input_tp"])


def malware(path: Path) -> str:
    scanner = shutil.which("clamscan")
    if not scanner:
        return "not_available"
    result = subprocess.run([scanner, "--no-summary", str(path)], capture_output=True, timeout=600)
    if result.returncode == 0:
        return "clean"
    if result.returncode == 1:
        return "infected"
    return "error"


def process(conn, client, bucket: str, job) -> None:
    job_id, _release_id, _release_track_id, source_path = job
    with tempfile.TemporaryDirectory(prefix="bvs-media-preflight-") as temp:
        root = Path(temp)
        source = root / "source"
        waveform = root / "waveform.png"
        preview = root / "preview.mp3"
        client.download_file(bucket, source_path, str(source))
        checksum = sha256(source)
        metadata = probe(source)
        lufs, peak = loudness(source)
        scan = malware(source)

        with conn.cursor() as cur:
            cur.execute(
                """select id from public.media_processing_jobs
                   where checksum_sha256=%s and status='ready' and id<>%s
                   order by completed_at limit 1""",
                (checksum, job_id),
            )
            duplicate = cur.fetchone()

        blockers: list[str] = []
        if metadata["duration_seconds"] < 10:
            blockers.append("AUDIO_TOO_SHORT")
        if metadata["duration_seconds"] > 60 * 60:
            blockers.append("AUDIO_TOO_LONG")
        if metadata["sample_rate"] < 22050:
            blockers.append("SAMPLE_RATE_TOO_LOW")
        if metadata["channels"] < 1:
            blockers.append("INVALID_CHANNEL_LAYOUT")
        if peak is not None and peak > 0:
            blockers.append("TRUE_PEAK_CLIPPING")
        if duplicate:
            blockers.append("EXACT_AUDIO_DUPLICATE")
        if scan == "infected":
            blockers.append("MALWARE_DETECTED")
        if scan == "error":
            blockers.append("MALWARE_SCAN_ERROR")

        waveform_key = f"derivatives/release-tracks/{job_id}/waveform.png"
        preview_key = f"derivatives/release-tracks/{job_id}/preview-64k.mp3"
        run([
            "ffmpeg", "-y", "-nostdin", "-hide_banner", "-loglevel", "error",
            "-i", str(source), "-filter_complex", "showwavespic=s=1200x240:colors=d4af37",
            "-frames:v", "1", str(waveform),
        ])
        run([
            "ffmpeg", "-y", "-nostdin", "-hide_banner", "-loglevel", "error",
            "-i", str(source), "-t", "30", "-vn", "-ac", "2", "-ar", "44100",
            "-b:a", "64k", str(preview),
        ])
        client.upload_file(str(waveform), bucket, waveform_key, ExtraArgs={"ContentType": "image/png", "CacheControl": "private, max-age=3600"})
        client.upload_file(str(preview), bucket, preview_key, ExtraArgs={"ContentType": "audio/mpeg", "CacheControl": "private, max-age=3600"})

        status = "blocked" if blockers else "ready"
        with conn.cursor() as cur:
            cur.execute(
                """
                update public.media_processing_jobs set
                  status=%s,checksum_sha256=%s,source_bytes=%s,format_name=%s,codec_name=%s,
                  duration_seconds=%s,sample_rate=%s,channels=%s,bitrate=%s,loudness_lufs=%s,
                  true_peak_db=%s,duplicate_of_job_id=%s,waveform_path=%s,preview_path=%s,
                  malware_status=%s,blockers=%s::jsonb,completed_at=now(),updated_at=now()
                where id=%s
                """,
                (
                    status, checksum, source.stat().st_size, metadata["format_name"], metadata["codec_name"],
                    metadata["duration_seconds"], metadata["sample_rate"], metadata["channels"], metadata["bitrate"],
                    lufs, peak, duplicate[0] if duplicate else None, waveform_key, preview_key,
                    scan, json.dumps(blockers), job_id,
                ),
            )
        conn.commit()


def fail(conn, job_id, error: Exception) -> None:
    code = str(error).splitlines()[0][:120] or type(error).__name__
    with conn.cursor() as cur:
        cur.execute(
            """update public.media_processing_jobs set status='failed',error_code=%s,
               error_detail=%s,updated_at=now() where id=%s""",
            (type(error).__name__[:80], code, job_id),
        )
    conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=3)
    args = parser.parse_args()
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL is required")
    conn = psycopg2.connect(db_url, connect_timeout=30)
    client = s3_client()
    bucket = os.environ.get("R2_BUCKET", "bvsradio-media")
    processed = 0
    try:
        while processed < max(1, args.limit):
            job = claim(conn)
            if not job:
                break
            try:
                process(conn, client, bucket, job)
            except Exception as error:  # noqa: BLE001
                fail(conn, job[0], error)
            processed += 1
    finally:
        conn.close()
    print(json.dumps({"processed": processed}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

