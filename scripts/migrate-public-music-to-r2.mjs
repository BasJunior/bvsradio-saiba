import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const root = process.cwd();
const musicDir = path.join(root, "public", "music");
const required = [
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.R2_BUCKET;

async function exists(key) {
  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return Number(result.ContentLength || 0) > 0;
  } catch {
    return false;
  }
}

async function upload(key, file) {
  if (await exists(key)) return "existing";
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: await fs.readFile(file),
      ContentType: "audio/mpeg",
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );
  if (!(await exists(key))) throw new Error(`Upload verification failed: ${key}`);
  return "uploaded";
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => {
      error += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${code}): ${error.slice(-1000)}`));
    });
  });
}

const files = (await fs.readdir(musicDir))
  .filter((file) => file.toLowerCase().endsWith(".mp3"))
  .sort((a, b) => a.localeCompare(b));
if (files.length === 0) {
  throw new Error(
    "No source MP3s found. This one-time migration expects a restored pre-evacuation public/music tree.",
  );
}
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "bvs-previews-"));
let masters = 0;
let previews = 0;

try {
  for (const [index, filename] of files.entries()) {
    const source = path.join(musicDir, filename);
    const masterKey = `legacy/masters/${filename}`;
    const previewKey = `legacy/previews/${filename}`;
    const masterResult = await upload(masterKey, source);
    if (masterResult === "uploaded") masters += 1;

    if (!(await exists(previewKey))) {
      const preview = path.join(temporary, `${index}.mp3`);
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        source,
        "-t",
        "30",
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "96k",
        preview,
      ]);
      await upload(previewKey, preview);
      previews += 1;
    }
    process.stdout.write(
      `${index + 1}/${files.length} ${filename} (${masterResult})\n`,
    );
  }
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}

process.stdout.write(
  `Verified ${files.length} private masters and previews; uploaded ${masters} masters and ${previews} previews.\n`,
);
