import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canSubmitWriterArticle, editableArticleStatuses, publishedArticleSlug, validWriterCoverPath, safeWriterPortfolio } from "../src/lib/writer-workflow.ts";

test("only approved writers or editorial staff can submit", () => {
  assert.equal(canSubmitWriterArticle("submitted"), false);
  assert.equal(canSubmitWriterArticle("rejected"), false);
  assert.equal(canSubmitWriterArticle("approved"), true);
  assert.equal(canSubmitWriterArticle(null, true), true);
  assert.deepEqual([...editableArticleStatuses], ["draft", "changes_requested"]);
});

test("cover paths must belong to this writer", () => {
  const alice = "11111111-1111-4111-8111-111111111111", bob = "22222222-2222-4222-8222-222222222222";
  const path = `writer-covers/${alice}/33333333-3333-4333-8333-333333333333.webp`;
  assert.equal(validWriterCoverPath(path, alice), true);
  assert.equal(validWriterCoverPath(path, bob), false);
  assert.equal(validWriterCoverPath(`writer-covers/${alice}/../../foo.webp`, alice), false);
});

test("publish slugs are stable and URL safe", () => {
  assert.equal(publishedArticleSlug("BVS: The New Sound!", "abcdef00-0000-0000-0000-000000000000"), "bvs-the-new-sound-abcdef00");
  assert.equal(safeWriterPortfolio("javascript:alert(1)"), null);
});

test("migration removes browser status escalation", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261105143000_writer_journal_pipeline.sql", import.meta.url), "utf8");
  assert.match(sql, /drop policy if exists "writers own articles"/);
  assert.match(sql, /revoke insert, update, delete on public.editorial_articles/);
});
