import { createHash, timingSafeEqual } from "node:crypto";

export function verifyPaynowHash(values: Record<string, string>, integrationKey: string) {
  const supplied = values.hash || values.Hash || values.HASH || "";
  if (!supplied || !integrationKey) return false;
  const source = Object.entries(values)
    .filter(([key]) => key.toLowerCase() !== "hash")
    .map(([, value]) => String(value))
    .join("") + integrationKey.toLowerCase();
  const expected = createHash("sha512").update(source).digest("hex").toUpperCase();
  const actualBuffer = Buffer.from(supplied.toUpperCase());
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function sameMoney(actual: unknown, expected: number) {
  const parsed = Number(actual);
  return Number.isFinite(parsed) && Math.abs(parsed - expected) < 0.005;
}
