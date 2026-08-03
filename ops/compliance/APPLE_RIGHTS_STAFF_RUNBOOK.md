# Staff runbook — rights attestation, clearance, copyright complaints, repeat infringer

**Audience:** BVS editorial / administrators
**Scope:** Documents **implemented software behaviour** only.
**Lawyer review:** Thresholds, statutory notice wording, and formal agent designation are placeholders until counsel signs off.

---

## 1. Goals

| Capability | What the product does |
|------------|------------------------|
| Versioned rights attestation | Immutable row per release + agreement version; blocks publish if missing |
| Clearance evidence | Structured items for cover/remix/sample/leased_beat/third_party; preflight blocks publish |
| Copyright complaints | Public form → docket → staff status workflow → optional hold (unpublish) |
| Repeat infringer | Strikes on upheld complaints; configurable thresholds; upload/publish restrictions; staff override |
| Non-goals | **No auto-delete** of content or accounts; no invented legal claims |

---

## 2. SQL pack

Apply (agent path, non-production first if possible):

```bash
python3 scripts/apply-supabase-packs.py --pack apple-rights-compliance --yes
```

File: `supabase-apple-rights-compliance.sql`
Depends on: releases, rights-passport, editorial.

---

## 3. Publish preflight blockers (new)

| Code | Meaning |
|------|---------|
| `VERSIONED_RIGHTS_ATTESTATION_REQUIRED` | No full attestation for active agreement version |
| `CLEARANCE_*_EVIDENCE_REQUIRED` | Declared material type lacks submitted evidence |
| `CONTENT_HOLD_ACTIVE` | Staff hold on release |
| `ACCOUNT_PUBLISH_RESTRICTED` | Repeat-infringer / staff publish restriction |

`assert_release_publishable` is called on editorial publish. Legacy `passport_version=0` + `legacy_approved` still short-circuits for old rows only.

---

## 4. Handling a complaint

1. Open `/admin/editorial` (complaints list) or `GET /api/admin/copyright` with staff bearer token.
2. Statuses: `received` → `under_review` → `hold_applied` / `resolved_upheld` / `resolved_rejected` / `withdrawn` / `counter_notice_received`.
3. **Hold:** unpublishes release/tracks and sets `content_hold` (does **not** delete files or rows).
4. **Upheld:** records a strike; may auto-restrict uploads/publish at threshold (default 3).
5. Always leave `staff_notes` / resolution summary for audit.

### API examples

```http
PATCH /api/admin/copyright
Authorization: Bearer <staff>
Content-Type: application/json

{
  "action": "update_complaint",
  "complaintId": "<uuid>",
  "status": "hold_applied",
  "applyHold": true,
  "staffNotes": "Matched catalogue URL; holding pending review"
}
```

```http
PATCH /api/admin/copyright
{
  "action": "update_complaint",
  "complaintId": "<uuid>",
  "status": "resolved_upheld",
  "issueStrike": true,
  "resolutionSummary": "Rights holder claim substantiated"
}
```

```http
PATCH /api/admin/copyright
{
  "action": "override_restriction",
  "userId": "<uuid>",
  "reason": "False positive after counter-notice; clear upload hold",
  "clearUpload": true,
  "clearPublish": true
}
```

Administrator-only: `update_policy` for thresholds.

---

## 5. Artist counter-response

- Artist notices: `artist_rights_notices`
- Submit: `POST /api/copyright/counter-notice` (signed-in artist, linked docket)
- Sets status `counter_notice_received`; does not auto-restore content

---

## 6. Clearance staff review

`PATCH /api/admin/editorial` action `review_clearance_item` with `itemId` + `status` (`accepted` | `rejected` | `waived_by_staff`).

---

## 7. Security & privacy notes for staff

- Public complaint API returns **customer-safe** errors only; full details stay in DB.
- IP / user-agent stored on attestations and complaints for audit — treat as personal data.
- Do not paste secrets or claimant PII into public tickets or chat.
- Service-role paths only from Next.js server; RLS limits self-read.

---

## 8. Lawyer-review checklist (not implemented as legal conclusions)

- [ ] Final attestation wording per jurisdiction
- [ ] Formal notice-and-takedown agent / contact on public pages
- [ ] Whether strike thresholds match counsel policy
- [ ] Counter-notice statutory form (if any)
- [ ] Retention period for complaint PII

Until then, product copy must keep **“Lawyer review”** markers.
