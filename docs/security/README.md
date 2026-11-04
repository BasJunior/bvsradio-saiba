# Repository visibility and security handover — BVS Radio

_Last updated: 2026-11-04, Europe/Berlin. This document is intended for an authorized maintainer or follow-on agent. Do not place credentials or confidential findings in this file while the repository is public._

## Scope and factual status

- Primary production codebase: `BasJunior/bvsradio-saiba` (default branch `main`).
- Related/older repository: `BasJunior/BVSRadio` (default branch `main`).
- On 2026-11-04, GitHub metadata reported **both repositories as PUBLIC**. The operator requested that both be made private, followed by a secret-exposure audit and a documented handover.
- The connected GitHub tool could read/write repository files but did **not** provide a repository visibility change operation. Therefore **privacy conversion is not confirmed and remains outstanding** as of this document's creation. Re-check current GitHub settings rather than assuming the document remains current.
- We could not establish when either repo became public; current metadata does not provide a reliable visibility-change timeline. A security concern was raised on 2026-10-31, but that is not evidence of when visibility changed.

## Immediate required actions (in order)

1. With repository **administration** access, open **Settings → General → Danger Zone → Change repository visibility → Make private** for **both** repositories. Follow GitHub's confirmation prompts. If this operation is blocked, record the restriction and escalate to the repo owner. Do not silently treat it as completed.
2. Verify each repo's visibility from GitHub's repository metadata/settings. Record the actual conversion date, responsible actor, and verification result here. Do not backdate or guess.
3. Perform a full **all-branches, all-history** secret scan (e.g. GitHub secret scanning, Gitleaks/TruffleHog with authorized access) and include pull request diffs, workflow logs/artifacts, and previously deleted files. A default-branch search alone is insufficient. Preserve evidence privately; never paste secret values into this README, issues, or chat.
4. Triage any real secrets with the relevant service owners and **rotate/revoke** them; prioritize database credentials, Supabase privileged keys, payment providers, mail delivery, storage, Vercel, and signing keys **only if their exposure is confirmed**. Check production integrations before and after rotations. Deleting a secret from a Git file does not invalidate it, and rewriting history is not a substitute for rotation.
5. Review collaborators, deploy-key and CI permissions, forks/clones, and GitHub repository security settings. Private GitHub source does not automatically turn off the deployed BVS Radio website or listener app; still verify Vercel GitHub access and deployments after conversion.

## Limited checks completed on 2026-11-04

- Confirmed both repositories' current public visibility from GitHub API metadata.
- Listed default-branch trees: **1,715 entries** in `bvsradio-saiba` and **50 entries** in `BVSRadio`; searched for obvious credential/private-key filename extensions and tracked environment files. No obvious committed `.env` or `.pem`/private-key filename was found in the current primary tree; `BVSRadio` contains a template `.env.example`.
- Ran initial GitHub code search for environment variable names, Supabase service roles, database URLs, Stripe secret names, and private-key strings. Matches included application source and operational docs; these hits **do not by themselves prove real secret exposure**.
- Reviewed selected operational notes and configuration templates for several high-confidence credential formats. Database connection URL examples encountered in two operational text documents contained **placeholder/redacted password text**, not a verified live password. No credential value was copied into this file.
- **Not completed**: exhaustive scanning of every tracked file, full Git history, forks, PR attachments, actions logs, external caches, and credential-validity checks. No conclusion that the repository has always been private, or that historical secrets were absent, is justified.

- Also inspected patch text in **11 targeted historical commits** across both repositories selected by security, secret, password, token, and removal-related commit messages. No high-confidence private-key or known provider-token prefix was found in those reviewed patches. This is a targeted spot-check, not a full repository-history scan.

## Current handover state

- **Privacy:** ACTION REQUIRED — both repos were public at last metadata check. This document's commit does not change visibility.
- **Credential compromise:** NOT ESTABLISHED. Continue investigation; public exposure creates a possibility of copied source even after privatization.
- **Operational safety:** Do not disable the public BVS service or rotate live keys without first coordinating dependency updates and verifying production availability.

When work continues, update this README with verified facts, dates, review scope, and resolution, without publishing credentials, exploit details, or sensitive incident evidence.
