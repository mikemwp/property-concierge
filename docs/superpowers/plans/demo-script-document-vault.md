# Document vault demo script

Founder validation script for spec §8: a case-scoped document vault with role ACL and a one-time upload principle. Binaries live on disk under `var/vault/`; metadata lives in Prisma. The module is on for paid England & Wales and the four live corridor packs.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`. Use any small PDF or PNG (under 10 MB).

---

## 1. Vault on ew and live corridors; free stays file-free

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault`, `hard_client_sla`, `case_threads` **on**. `corridor_inbound`, `corridor_outbound` **off**.
3. Select **`au_uk`** and confirm `document_vault` is **on**. Repeat for `uk_au`, `us_uk`, `uk_us`. The disabled `au` stub stays **off**.
4. Sign out. Sign in as **`client@example.com`** → open **Smith DIY journey**. There is no file input and no Document vault panel. Free attestation is still the Submit button.

## 2. Paid client: upload once, cannot replace

1. Still as the client, open **Bloggs return (paid)** (`ew`, `PAID_DWY`).
2. Focus stage `purchase_profile` shows **Tasks and documents** with a file input and **Upload and submit**.
3. Attach a PDF named something obvious (`profile.pdf`) and submit `profile_complete`.
4. The row moves to **submitted, awaiting advisor acceptance**. The vault panel lists `profile.pdf` with a Download link.
5. Refresh. There is no file input for `profile_complete`. Copy on the attached row says the file cannot be replaced.
6. Download `/api/vault/<id>` while logged in as the client — the PDF downloads. The JSON body never includes a disk path.

## 3. Advisor sees everything and can reset

1. Sign in as **`advisor@example.com`** → Bloggs case.
2. **Document vault** lists the client file. Download works.
3. Enter a reset reason of at least 8 characters (e.g. `Wrong file uploaded`) → **Reset**. Status becomes `RESET`. The file remains downloadable as history.
4. Accept nothing yet. Sign back in as the client — `profile_complete` again shows a file input. Upload a replacement, then submit.
5. As the advisor, accept `profile_complete` and advance as in the core portal script.

## 4. Partner upload is scoped; adapters cannot skip the file

1. Advance Bloggs to `mortgage_path` (accept money-readiness evidence, including `fx_plan` on this overseas case, then advance twice).
2. Warm-intro Priya if needed. Sign in as **`mortgage@example.com`**.
3. Required evidence `dip_aip` now needs a file. Upload + submit.
4. The partner vault panel shows only mortgage-stage documents. It does not list the client's `profile.pdf`.
5. Advisor accepts `dip_aip`. The stage does **not** advance until the advisor advances it — same adapter-authority rule as Plan 5.
6. Cross-reference `tests/server/adapter-authority.test.ts` and `tests/server/vault-submit.test.ts`: a stub adapter that calls `submitPartnerEvidence` with an empty vault lookup is rejected.

## 5. Corridor paid cases use the same vault

1. Advisor opens **Chen AU→UK return (paid)** (`au_uk`).
2. **Document vault** is present. Client submit on that case is **Upload and submit**, not metadata-only.
3. Attach a PDF for `profile_complete` and submit. Download works for the client who uploaded it.
4. The disabled `au` stub still cannot back a case, so it never receives a vault.

---

## What is real and what is absent

| Layer | Status after this plan |
|-------|--------|
| **Real** | `VaultStorageBackend`; `LocalVaultStorage` under `var/vault/` or `VAULT_ROOT`; factory; Prisma metadata unchanged |
| **Stubbed** | `S3VaultStorage` throws `S3_NOT_CONFIGURED` or `S3_NOT_IMPLEMENTED` |
| **Absent** | `@aws-sdk/client-s3`, presigned URLs, production `VAULT_STORAGE=s3` |

## 6. Storage backend (local default)

1. Default upload still lands under `var/vault/` (or `VAULT_ROOT` in tests).
2. Setting `VAULT_STORAGE=s3` without `VAULT_S3_BUCKET` / `VAULT_S3_REGION` makes the next write throw. Do not set this in CI.
3. There is no AWS package in `package.json`.

## Automated verification

```bash
npm test -- tests/domain/vault.test.ts tests/server/vault-schema.test.ts tests/server/vault-store.test.ts tests/server/vault-policy.test.ts tests/server/vault-submit.test.ts tests/server/vault-actions.test.ts tests/server/vault-download.test.ts tests/server/vault-ui.test.ts tests/server/adapter-authority.test.ts tests/domain/market-pack-flags.test.ts tests/domain/engine-country-agnostic.test.ts
```
