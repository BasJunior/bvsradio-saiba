#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const required = [
  "DATABASE_URL",
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const dryRun = process.argv.includes("--dry-run");
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function sql(query) {
  return execFileSync(
    "psql",
    [process.env.DATABASE_URL, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", query],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  ).trim();
}

const raw = sql(`
  select coalesce(json_agg(row_to_json(t)), '[]'::json)::text
  from (
    select id::text, file_url, artwork_url
    from public.tracks
    where file_url like '%supabase.co/storage/v1/object/public/bvsradio-audio/%'
       or artwork_url like '%supabase.co/storage/v1/object/public/bvsradio-audio/%'
    order by created_at
  ) t
`);
const tracks = JSON.parse(raw || "[]");

function sourceKey(value) {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  const marker = "/storage/v1/object/public/bvsradio-audio/";
  const at = value.indexOf(marker);
  if (at < 0) return null;
  return `legacy/${decodeURIComponent(value.slice(at + marker.length))}`;
}

function mediaUrl(key) {
  return `/api/media/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

async function exists(key) {
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}

const objects = new Map();
for (const track of tracks) {
  for (const field of ["file_url", "artwork_url"]) {
    const key = sourceKey(track[field]);
    if (key) objects.set(track[field], key);
  }
}

console.log(
  `${dryRun ? "Would migrate" : "Migrating"} ${objects.size} unique objects for ${tracks.length} tracks`,
);

for (const [source, key] of objects) {
  if (await exists(key)) {
    console.log(`exists ${key}`);
    continue;
  }
  if (dryRun) {
    console.log(`would upload ${key}`);
    continue;
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Source download failed (${response.status}) for ${key}`);
  }
  const body = new Uint8Array(await response.arrayBuffer());
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: response.headers.get("content-type") || "application/octet-stream",
      CacheControl: "private, max-age=3600",
    }),
  );
  console.log(`uploaded ${key} (${body.byteLength} bytes)`);
}

if (!dryRun && tracks.length) {
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const values = tracks
    .map((track) => {
      const fileKey = sourceKey(track.file_url);
      const artKey = sourceKey(track.artwork_url);
      return `(${quote(track.id)}::uuid, ${
        fileKey ? quote(mediaUrl(fileKey)) : "null"
      }::text, ${artKey ? quote(mediaUrl(artKey)) : "null"}::text)`;
    })
    .join(",\n");
  sql(`
    begin;
    update public.tracks as t
    set file_url = coalesce(v.file_url, t.file_url),
        artwork_url = coalesce(v.artwork_url, t.artwork_url),
        updated_at = now()
    from (values ${values}) as v(id, file_url, artwork_url)
    where t.id = v.id;
    commit;
  `);
}

console.log(dryRun ? "Dry run complete" : "R2 migration complete");
