#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  CopyObjectCommand,
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

function resolveSupabaseUrl() {
  const configured = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(configured)) return configured;
  const database = new URL(process.env.DATABASE_URL);
  const username = decodeURIComponent(database.username);
  const fromUser = username.match(/^postgres\.([a-z0-9]+)$/i)?.[1];
  const fromHost = database.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1];
  const projectRef = fromUser || fromHost;
  if (!projectRef) throw new Error("Could not derive Supabase project URL");
  return `https://${projectRef}.supabase.co`;
}

const supabaseUrl = resolveSupabaseUrl();

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

async function exists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

const objects = JSON.parse(
  sql(`
    select coalesce(json_agg(row_to_json(item)), '[]'::json)::text
    from (
      select name, coalesce(metadata->>'mimetype', 'application/octet-stream') as content_type
      from storage.objects
      where bucket_id = 'bvsradio-audio'
      order by name
    ) item
  `) || "[]",
);

let copied = 0;
let downloaded = 0;
let skipped = 0;
for (const object of objects) {
  const key = String(object.name || "").replace(/^\/+/, "");
  if (!key) continue;
  if (await exists(key)) {
    skipped += 1;
    continue;
  }
  const legacyKey = `legacy/${key}`;
  if (await exists(legacyKey)) {
    if (!dryRun) {
      await client.send(
        new CopyObjectCommand({
          Bucket: process.env.R2_BUCKET,
          CopySource: `${process.env.R2_BUCKET}/${legacyKey}`,
          Key: key,
          ContentType: object.content_type,
          CacheControl: "private, max-age=3600",
          MetadataDirective: "REPLACE",
        }),
      );
    }
    copied += 1;
    continue;
  }
  const source = `${supabaseUrl}/storage/v1/object/public/bvsradio-audio/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  if (!dryRun) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Source download failed (${response.status}) for ${key}`);
    const body = new Uint8Array(await response.arrayBuffer());
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: response.headers.get("content-type") || object.content_type,
        CacheControl: "private, max-age=3600",
      }),
    );
  }
  downloaded += 1;
}

if (!dryRun) {
  const marker = `${supabaseUrl}/storage/v1/object/public/bvsradio-audio/`;
  const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
  sql(`
    begin;
    update public.tracks
      set file_url = replace(file_url, ${q(marker)}, '/api/media/'),
          artwork_url = replace(artwork_url, ${q(marker)}, '/api/media/'),
          updated_at = now()
      where file_url like ${q(`${marker}%`)} or artwork_url like ${q(`${marker}%`)};
    update public.profiles
      set avatar_url = replace(avatar_url, ${q(marker)}, '/api/media/'),
          updated_at = now()
      where avatar_url like ${q(`${marker}%`)};
    update public.releases
      set cover_url = replace(cover_url, ${q(marker)}, '/api/media/'),
          updated_at = now()
      where cover_url like ${q(`${marker}%`)};
    update public.release_tracks
      set file_url = replace(file_url, ${q(marker)}, '/api/media/')
      where file_url like ${q(`${marker}%`)};
    update public.show_creator_profiles
      set artwork_url = replace(artwork_url, ${q(marker)}, '/api/media/'),
          updated_at = now()
      where artwork_url like ${q(`${marker}%`)};
    commit;
  `);
}

console.log(JSON.stringify({
  mode: dryRun ? "dry-run" : "applied",
  objects: objects.length,
  copiedInsideR2: copied,
  downloadedFromSupabase: downloaded,
  alreadyInR2: skipped,
}));
