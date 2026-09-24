# Document Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a case-scoped document vault for England & Wales paid cases: role ACL, one-time upload per evidence kind per stage, filesystem binaries under `var/vault/`, Prisma metadata, vault-required submit when the flag is on, and an authenticated download route — without rebuilding the stage engine or turning the vault on for corridor packs.

**Architecture:** Four layers, no cycles.

1. **Pure domain** (`src/domain/vault.ts`) — statuses, ACL, one-time invariant, file validation, submit-requires-document, event payload encode/decode. No Prisma, no Next, no `fs`, no jurisdiction literals.
2. **Persistence** (`VaultDocument` in Prisma + `src/server/vault-store.ts`) — metadata in SQLite, bytes on the local filesystem under `var/vault/` (gitignored). Never base64 in the database. Never S3.
3. **Policy + port** (`src/server/vault.ts`, a minimal `submitEvidence` / `submitPartnerEvidence` optional `vault` argument, `ManualPartnerPort` presence lookup) — fail closed when `document_vault` is off; adapters cannot write, reset, or skip the check.
4. **Surfaces** — portal / partner upload-and-submit, advisor list + reset, `GET /api/vault/[documentId]`.

**The invariant that makes this a vault and not a second evidence engine:** `Evidence` stays metadata (`kind` / `note` / `accepted`). A vault file is a separate `VaultDocument` attached to `(caseId, stageKey, evidenceKind)`. Once `ACTIVE`, it cannot be replaced until an advisor `RESET`. When the pack flag is on, PAID_DWY submit (client or partner, including adapters) requires that `ACTIVE` row. When the flag is off, today's submit-without-file path is unchanged.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Auth.js (NextAuth v5) credentials, Tailwind CSS v4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§5 freemium / IP behind paid, §6 client portal "tasks/docs" + partner "upload evidence", §8 document vault role ACL and one-time upload, country-agnostic engine).

**Builds on (already shipped, do not rebuild):**
- Plan 1 — `src/domain/stage-engine.ts` (`submitEvidence`, `submitPartnerEvidence`, `attestEvidence`, `acceptEvidence`). Evidence is metadata only.
- Plan 2 — intake, portal, playbooks.
- Plan 3 — panel, scorecards, referrals, `listReferralsForCase` / `activeReferralForRole`.
- Plan 4 — `MarketModuleKey` already includes `document_vault`; `isModuleEnabled`; `tests/domain/market-pack-flags.test.ts` currently gates it off everywhere.
- Plan 5 — `PartnerPort.submitPartnerEvidence`, stub adapters, `tests/server/adapter-authority.test.ts`.
- Plan 6 — `chain_free_inventory` on for `ew` only.
- Plan 7 — corridor packs; `document_vault` stays off on `au_uk` / `uk_au` / `us_uk` / `uk_us` and the `au` stub.

**Follow-on plans (not this plan):** hard client-facing SLAs, S3 / cloud object storage, threads, seller views, open marketplace, turning `document_vault` on for corridor packs.

## Global Constraints

Copied from the spec and the Plan 8 brief. Every task's requirements implicitly include this section.

- **Country-agnostic engine:** no jurisdiction literals (`£`, `GBP`, `en-GB`, `england`, `wales`) in `src/domain/vault.ts`, `src/server/vault.ts`, or `src/server/vault-store.ts`. Local names stay in market packs.
- **Fail closed when `document_vault` is off:** existing submit-without-file flow is unchanged. Unknown or disabled packs still throw `MarketPackError` at `casePack`; policy treats that as off.
- **`document_vault` on for `ew` only.** Corridor packs and the `au` stub stay off until a later proof plan.
- **`hard_client_sla` stays off everywhere.**
- **Freemium (explicit, locked):** `FREE_DIY` may not upload, may not download binaries, and does not see vault UI. Free attestation stays note-only via `attestEvidence`. The vault is paid operating IP.
- **IP / ACL (locked):** advisor reads every document on the case and may reset/reject; paid client reads only documents they uploaded; assigned/referred partner reads only documents on stages they own or were referred on. Partners upload only for partner-owned evidence on a stage they are assigned to. Clients upload only for client-owned stage evidence.
- **One-time upload:** at most one `ACTIVE` document per `(caseId, stageKey, evidenceKind)`. Replace requires advisor reset. Reset does **not** un-submit or un-accept evidence.
- **Binary storage:** local filesystem under `var/vault/` (gitignored, overridable with `VAULT_ROOT`). Metadata in Prisma. Not base64 in SQLite. No S3 in this plan.
- **Do not rebuild the stage engine.** Extend `submitEvidence` / `submitPartnerEvidence` with an optional `vault` argument only.
- **Adapters must not bypass vault ACL.** The port performs the presence check. Adapters must not write files, reset documents, or call `submitPartnerEvidence` without going through that check. Extend `tests/server/adapter-authority.test.ts`.
- **Server actions keep existing result shapes:** `{ ok: true } | { ok: false; error: string }` (upload actions may add `documentId` on success only).
- **Engineering:** TDD per task; `npm test` stays green after each task's own files; `npm test` + `npm run build` pass at the end; DRY, YAGNI, frequent commits.

## Locked design decisions

**Flag matrix (final, after Task 8):**

| Pack | enabled | fx_deposit | corridor_inbound | corridor_outbound | partner_speed_rails | chain_free_inventory | hard_client_sla | document_vault |
|---|---|---|---|---|---|---|---|---|
| `au` | false | off | off | off | off | off | off | off |
| `ew` | true | on | off | off | on | on | off | **on** |
| `au_uk` | true | on | on | on | off | off | off | off |
| `uk_au` | true | on | on | on | off | off | off | off |
| `us_uk` | true | on | on | on | off | off | off | off |
| `uk_us` | true | on | on | on | off | off | off | off |

**One-time upload:** application invariant, not a Prisma unique constraint (RESET rows stay as history). `findActiveVaultDocument` returns the single `ACTIVE` row or `null`.

**Reset vs reject:** one status, `RESET`. Advisor supplies a written reason (`MIN_VAULT_RESET_REASON_LENGTH = 8`). Ledger event `VAULT_DOCUMENT_RESET`. The previous file stays on disk for audit; it is no longer attached.

**Submit when vault is on (PAID_DWY only):**
- Client: `submitEvidence` requires an `ACTIVE` document for that kind. Portal uses `uploadAndSubmitEvidenceAction` (upload then submit in one action). `submitEvidenceAction` still enforces the check so the UI cannot be bypassed.
- Partner / adapter / webhook: `submitPartnerEvidence` on the engine receives the same optional `vault` argument. `ManualPartnerPort` (and therefore every stub adapter) loads presence through `VaultPresenceLookup` and refuses `VAULT_REQUIRED` when the flag is on and no `ACTIVE` row exists. Adapters never write bytes.

**Submit when vault is off:** do not pass `vault` (or pass `{ enabled: false, hasActiveDocument: false }`). Behaviour matches main @ `816dbdf`.

**Allowed files:** PDF, JPEG, PNG, WEBP, DOCX. Max 10 MiB. Filename sanitised (no path separators, max 200 chars). MIME is allowlisted, not magic-sniffed.

**Download:** `GET /api/vault/[documentId]`. Auth in the route (`auth()`), not middleware (matcher stays portal/cockpit/partner). 401 if no session, 404 if missing, 403 if the session exists but ACL denies. Stream the file; never return `storageKey` or the absolute path.

**`next.config.mjs`:** `serverActions.bodySizeLimit = "12mb"` so a 10 MiB upload is not rejected by Next.

## File structure (locked)

```
src/
  domain/
    vault.ts                                   # NEW (Task 1): types, ACL, one-time, file rules, submit assert
    stage-engine.ts                            # MODIFY (Task 4): optional input.vault on submit functions
    market-packs/
      ew-config.ts                             # MODIFY (Task 8): document_vault: true
  server/
    vault.ts                                   # NEW (Task 3): canUse / assert / list / perform upload+reset
    vault-store.ts                             # NEW (Task 3): Prisma metadata + filesystem bytes
  lib/
    partner-port.ts                            # MODIFY (Task 4): VaultPresenceLookup on submit
    partner-adapters/
      stub-adapter.ts                          # MODIFY (Task 4): forward vaultLookup
      registry.ts                              # MODIFY (Task 4): forward vaultLookup
  app/
    actions/
      portal.ts                                # MODIFY (Task 4): vault check on submitEvidenceAction
      partner.ts                               # MODIFY (Task 4): vault check already on the port
      vault.ts                                 # NEW (Task 5): upload, upload+submit, reset
    api/vault/[documentId]/route.ts            # NEW (Task 6): authenticated download
    portal/cases/[caseId]/page.tsx             # MODIFY (Task 7): VaultUploadForm + VaultPanel
    partner/cases/[caseId]/page.tsx            # MODIFY (Task 7): VaultUploadForm + scoped VaultPanel
    cockpit/cases/[caseId]/page.tsx            # MODIFY (Task 7): VaultPanel + reset
  components/
    VaultUploadForm.tsx                        # NEW (Task 7)
    VaultPanel.tsx                             # NEW (Task 7)
prisma/schema.prisma                           # MODIFY (Task 2): VaultDocument
prisma/seed.ts                                 # MODIFY (Task 2): deleteMany vault documents first
.gitignore                                     # MODIFY (Task 2): var/vault/
next.config.mjs                                # MODIFY (Task 5): 12mb server action body
tests/
  domain/vault.test.ts                         # NEW (Task 1)
  domain/engine-country-agnostic.test.ts       # MODIFY (Task 1): add vault.ts
  domain/stage-engine.test.ts                  # MODIFY (Task 4): optional vault argument
  domain/market-pack-flags.test.ts             # MODIFY (Task 8)
  domain/ew-pack.test.ts                       # MODIFY (Task 8)
  domain/market-pack-inspector.test.ts         # MODIFY (Task 8)
  server/vault-policy.test.ts                  # NEW (Task 3)
  server/vault-store.test.ts                   # NEW (Task 3)
  server/vault-submit.test.ts                  # NEW (Task 4)
  server/vault-actions.test.ts                 # NEW (Task 5)
  server/vault-download.test.ts                # NEW (Task 6)
  server/adapter-authority.test.ts             # MODIFY (Task 4)
  lib/partner-port.test.ts                     # MODIFY (Task 8): inject allow-all lookup
docs/superpowers/plans/
  demo-script-document-vault.md                # NEW (Task 9)
  demo-script-market-packs.md                  # MODIFY (Task 9)
  demo-script-corridor-packs.md                # MODIFY (Task 9)
  demo-script-core-portal.md                   # MODIFY (Task 9)
  demo-script-speed-rails.md                   # MODIFY (Task 9)
README.md                                      # MODIFY (Task 9)
```

**Layering rule:** `src/domain/vault.ts` imports only `./types` (`ActorRole`, `Tier`, `isPartnerActorRole`). It must not import stage-engine, market packs, Prisma, Next, or `fs`. `src/server/vault.ts` is the only module that combines `casePack` / flag / referrals / store. `src/server/vault-store.ts` is the only module that touches `fs` and `prisma.vaultDocument`. Actions never write files except by calling `performVaultUpload` / `performVaultReset`. Adapters never import `vault-store`.

---

### Task 1: Vault vocabulary, ACL, one-time invariant, file rules

**Files:**
- Create: `src/domain/vault.ts`
- Create: `tests/domain/vault.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/domain/vault.ts"` to `ENGINE_GLOBAL_FILES`

**Interfaces:**
- Consumes: `ActorRole`, `Tier`, `isPartnerActorRole` from `src/domain/types.ts`.
- Produces: `VaultDocumentStatus`, `VAULT_DOCUMENT_STATUSES`, `isVaultDocumentStatus`, `VaultError`, `VaultErrorCode`, `VaultDocumentRecord`, `VaultActor`, `VaultPermission`, `VaultSubmitContext`, `VaultEventPayload`, `VAULT_EVENT_TYPES`, `MIN_VAULT_RESET_REASON_LENGTH`, `VAULT_MAX_BYTES`, `VAULT_ALLOWED_MIME_TYPES`, `assertOneTimeUpload`, `assertVaultAttachedForSubmit`, `assertValidVaultFile`, `sanitizeVaultFilename`, `vaultStorageKey`, `assertSafeStorageKey`, `canUploadVaultDocument`, `canResetVaultDocument`, `documentVisibleTo`, `partnerReadStageKeys`, `vaultPermission`, `assertResetReason`, `encodeVaultEventPayload`, `decodeVaultEventPayload`.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/vault.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  assertOneTimeUpload,
  assertResetReason,
  assertSafeStorageKey,
  assertValidVaultFile,
  assertVaultAttachedForSubmit,
  canResetVaultDocument,
  canUploadVaultDocument,
  decodeVaultEventPayload,
  documentVisibleTo,
  encodeVaultEventPayload,
  MIN_VAULT_RESET_REASON_LENGTH,
  partnerReadStageKeys,
  sanitizeVaultFilename,
  VAULT_ALLOWED_MIME_TYPES,
  VAULT_MAX_BYTES,
  vaultPermission,
  vaultStorageKey,
  VaultError,
  type VaultDocumentRecord,
} from "../../src/domain/vault";

function doc(overrides: Partial<VaultDocumentRecord> = {}): VaultDocumentRecord {
  return {
    id: "doc_1",
    caseId: "case_1",
    stageKey: "purchase_profile",
    evidenceKind: "profile_complete",
    uploadedByRole: "CLIENT",
    uploadedByUserId: "user_client",
    originalFilename: "profile.pdf",
    mimeType: "application/pdf",
    byteSize: 128,
    storageKey: "case_1/doc_1",
    status: "ACTIVE",
    createdAt: "2026-09-04T10:00:00.000Z",
    ...overrides,
  };
}

const STAGES = [
  { key: "purchase_profile", ownerRole: "CLIENT" as const },
  { key: "mortgage_path", ownerRole: "MORTGAGE_PARTNER" as const },
  { key: "diligence", ownerRole: "CONVEYANCER" as const },
];

describe("one-time upload", () => {
  it("refuses a second ACTIVE file for the same kind and allows upload after RESET", () => {
    expect(() => assertOneTimeUpload(doc())).toThrow(VaultError);
    try {
      assertOneTimeUpload(doc());
    } catch (err) {
      expect((err as VaultError).code).toBe("ONE_TIME_UPLOAD");
    }
    expect(() => assertOneTimeUpload(null)).not.toThrow();
    expect(() => assertOneTimeUpload(doc({ status: "RESET" }))).not.toThrow();
  });
});

describe("submit requires an attached file only when the vault is on", () => {
  it("is a no-op when the module is off, even with no document", () => {
    expect(() =>
      assertVaultAttachedForSubmit({
        vaultEnabled: false,
        hasActiveDocument: false,
        kind: "profile_complete",
      }),
    ).not.toThrow();
  });

  it("throws VAULT_REQUIRED when the module is on and no ACTIVE document exists", () => {
    try {
      assertVaultAttachedForSubmit({
        vaultEnabled: true,
        hasActiveDocument: false,
        kind: "profile_complete",
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VaultError);
      expect((err as VaultError).code).toBe("VAULT_REQUIRED");
      expect((err as Error).message).toMatch(/profile_complete/);
    }
  });

  it("allows submit when the module is on and an ACTIVE document exists", () => {
    expect(() =>
      assertVaultAttachedForSubmit({
        vaultEnabled: true,
        hasActiveDocument: true,
        kind: "profile_complete",
      }),
    ).not.toThrow();
  });
});

describe("role ACL", () => {
  it("gives advisors RESET (which includes read) on every paid or free case", () => {
    expect(vaultPermission({ role: "ADVISOR", tier: "PAID_DWY" })).toBe("RESET");
    expect(vaultPermission({ role: "ADVISOR", tier: "FREE_DIY" })).toBe("RESET");
    expect(canResetVaultDocument("ADVISOR")).toBe(true);
    expect(canResetVaultDocument("CLIENT")).toBe(false);
    expect(canResetVaultDocument("CONVEYANCER")).toBe(false);
  });

  it("hides the vault from FREE_DIY clients and partners — attestation stays note-only", () => {
    expect(vaultPermission({ role: "CLIENT", tier: "FREE_DIY" })).toBe("NONE");
    expect(vaultPermission({ role: "MORTGAGE_PARTNER", tier: "FREE_DIY" })).toBe("NONE");
    expect(
      canUploadVaultDocument({
        role: "CLIENT",
        tier: "FREE_DIY",
        stageOwnerRole: "CLIENT",
        assigned: true,
        evidenceKind: "profile_complete",
        requiredKinds: ["profile_complete"],
      }),
    ).toBe(false);
    expect(
      documentVisibleTo(doc(), {
        role: "CLIENT",
        userId: "user_client",
        tier: "FREE_DIY",
        readStageKeys: ["purchase_profile"],
      }),
    ).toBe(false);
  });

  it("lets a paid client upload on a client-owned required kind and read only their own files", () => {
    expect(vaultPermission({ role: "CLIENT", tier: "PAID_DWY" })).toBe("UPLOAD");
    expect(
      canUploadVaultDocument({
        role: "CLIENT",
        tier: "PAID_DWY",
        stageOwnerRole: "CLIENT",
        assigned: true,
        evidenceKind: "profile_complete",
        requiredKinds: ["profile_complete"],
      }),
    ).toBe(true);
    expect(
      canUploadVaultDocument({
        role: "CLIENT",
        tier: "PAID_DWY",
        stageOwnerRole: "MORTGAGE_PARTNER",
        assigned: true,
        evidenceKind: "dip_aip",
        requiredKinds: ["dip_aip"],
      }),
    ).toBe(false);
    expect(
      documentVisibleTo(doc(), {
        role: "CLIENT",
        userId: "user_client",
        tier: "PAID_DWY",
        readStageKeys: ["purchase_profile"],
      }),
    ).toBe(true);
    expect(
      documentVisibleTo(doc({ uploadedByUserId: "other_client" }), {
        role: "CLIENT",
        userId: "user_client",
        tier: "PAID_DWY",
        readStageKeys: ["purchase_profile"],
      }),
    ).toBe(false);
  });

  it("scopes partners to stages they own or were referred on", () => {
    expect(
      partnerReadStageKeys({
        stages: STAGES,
        partnerRole: "MORTGAGE_PARTNER",
        assigned: true,
        hasActiveReferral: false,
      }),
    ).toEqual(["mortgage_path"]);
    expect(
      partnerReadStageKeys({
        stages: STAGES,
        partnerRole: "CONVEYANCER",
        assigned: false,
        hasActiveReferral: true,
      }),
    ).toEqual(["diligence"]);
    expect(
      partnerReadStageKeys({
        stages: STAGES,
        partnerRole: "MOVE_PARTNER",
        assigned: false,
        hasActiveReferral: false,
      }),
    ).toEqual([]);

    const partnerDoc = doc({
      stageKey: "mortgage_path",
      evidenceKind: "dip_aip",
      uploadedByRole: "MORTGAGE_PARTNER",
      uploadedByUserId: "user_mortgage",
    });
    expect(
      documentVisibleTo(partnerDoc, {
        role: "MORTGAGE_PARTNER",
        userId: "user_mortgage",
        tier: "PAID_DWY",
        readStageKeys: ["mortgage_path"],
      }),
    ).toBe(true);
    expect(
      documentVisibleTo(partnerDoc, {
        role: "CONVEYANCER",
        userId: "user_conveyancer",
        tier: "PAID_DWY",
        readStageKeys: ["diligence"],
      }),
    ).toBe(false);
    expect(
      canUploadVaultDocument({
        role: "MORTGAGE_PARTNER",
        tier: "PAID_DWY",
        stageOwnerRole: "MORTGAGE_PARTNER",
        assigned: true,
        evidenceKind: "dip_aip",
        requiredKinds: ["dip_aip"],
      }),
    ).toBe(true);
    expect(
      canUploadVaultDocument({
        role: "MORTGAGE_PARTNER",
        tier: "PAID_DWY",
        stageOwnerRole: "MORTGAGE_PARTNER",
        assigned: false,
        evidenceKind: "dip_aip",
        requiredKinds: ["dip_aip"],
      }),
    ).toBe(false);
  });

  it("lets the advisor read every document including RESET history", () => {
    const reset = doc({ status: "RESET" });
    expect(
      documentVisibleTo(reset, {
        role: "ADVISOR",
        userId: "user_advisor",
        tier: "PAID_DWY",
        readStageKeys: [],
      }),
    ).toBe(true);
  });
});

describe("file rules", () => {
  it("accepts an allowlisted PDF under the size cap and rejects everything else", () => {
    expect(() =>
      assertValidVaultFile({
        originalFilename: "offer.pdf",
        mimeType: "application/pdf",
        byteSize: 1024,
      }),
    ).not.toThrow();
    expect(VAULT_ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(VAULT_ALLOWED_MIME_TYPES).toContain("image/png");
    expect(VAULT_ALLOWED_MIME_TYPES).toContain("image/webp");
    expect(VAULT_ALLOWED_MIME_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    try {
      assertValidVaultFile({
        originalFilename: "notes.exe",
        mimeType: "application/x-msdownload",
        byteSize: 10,
      });
      expect.unreachable();
    } catch (err) {
      expect((err as VaultError).code).toBe("INVALID_FILE");
    }
    try {
      assertValidVaultFile({
        originalFilename: "huge.pdf",
        mimeType: "application/pdf",
        byteSize: VAULT_MAX_BYTES + 1,
      });
      expect.unreachable();
    } catch (err) {
      expect((err as VaultError).code).toBe("INVALID_FILE");
    }
  });

  it("strips path separators from filenames and refuses empty or dot names", () => {
    expect(sanitizeVaultFilename("C:\\\\tmp\\\\a/b.pdf")).toBe("C:tmpab.pdf");
    expect(sanitizeVaultFilename(`  ${"x".repeat(250)}.pdf  `).length).toBe(200);
    expect(() => sanitizeVaultFilename("..")).toThrow(VaultError);
    expect(() => sanitizeVaultFilename("")).toThrow(VaultError);
  });

  it("builds a storage key from ids and rejects traversal", () => {
    expect(vaultStorageKey("case_1", "doc_1")).toBe("case_1/doc_1");
    expect(() => assertSafeStorageKey("case_1/doc_1")).not.toThrow();
    expect(() => assertSafeStorageKey("../etc/passwd")).toThrow(VaultError);
    expect(() => assertSafeStorageKey("case_1/../doc_1")).toThrow(VaultError);
    expect(() => vaultStorageKey("case/1", "doc_1")).toThrow(VaultError);
  });
});

describe("reset reason and event payload", () => {
  it("requires a written reason and round-trips the ledger payload", () => {
    expect(MIN_VAULT_RESET_REASON_LENGTH).toBe(8);
    expect(() => assertResetReason("short")).toThrow(VaultError);
    expect(() => assertResetReason("Wrong file uploaded")).not.toThrow();
    const encoded = encodeVaultEventPayload({
      documentId: "doc_1",
      evidenceKind: "profile_complete",
      stageKey: "purchase_profile",
      filename: "profile.pdf",
      reason: "Wrong file uploaded",
    });
    expect(decodeVaultEventPayload(encoded)).toEqual({
      documentId: "doc_1",
      evidenceKind: "profile_complete",
      stageKey: "purchase_profile",
      filename: "profile.pdf",
      reason: "Wrong file uploaded",
    });
    expect(decodeVaultEventPayload("not-json")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/vault.test.ts`

Expected: FAIL with `Cannot find module '../../src/domain/vault'` (or the first named export is not defined).

- [ ] **Step 3: Write the domain module**

Create `src/domain/vault.ts`:

```ts
import { isPartnerActorRole, type ActorRole, type Tier } from "./types";

export const VAULT_DOCUMENT_STATUSES = ["ACTIVE", "RESET"] as const;
export type VaultDocumentStatus = (typeof VAULT_DOCUMENT_STATUSES)[number];

export function isVaultDocumentStatus(value: string): value is VaultDocumentStatus {
  return (VAULT_DOCUMENT_STATUSES as readonly string[]).includes(value);
}

export type VaultErrorCode =
  | "VAULT_DISABLED"
  | "VAULT_REQUIRED"
  | "ONE_TIME_UPLOAD"
  | "FORBIDDEN"
  | "FREE_TIER"
  | "INVALID_FILE"
  | "NOT_FOUND";

export class VaultError extends Error {
  constructor(
    public code: VaultErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VaultError";
  }
}

export type VaultDocumentRecord = {
  id: string;
  caseId: string;
  stageKey: string;
  evidenceKind: string;
  uploadedByRole: ActorRole;
  uploadedByUserId: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
  status: VaultDocumentStatus;
  createdAt: string;
};

export type VaultActor = {
  role: ActorRole;
  userId: string;
};

export type VaultPermission = "NONE" | "READ" | "UPLOAD" | "RESET";

export type VaultSubmitContext = {
  vaultEnabled: boolean;
  hasActiveDocument: boolean;
  kind: string;
};

export const VAULT_EVENT_TYPES = {
  UPLOADED: "VAULT_DOCUMENT_UPLOADED",
  RESET: "VAULT_DOCUMENT_RESET",
} as const;

export type VaultEventPayload = {
  documentId: string;
  evidenceKind: string;
  stageKey: string;
  filename: string;
  reason?: string;
};

export const MIN_VAULT_RESET_REASON_LENGTH = 8;
export const VAULT_MAX_BYTES = 10 * 1024 * 1024;
export const VAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function vaultPermission(input: { role: ActorRole; tier: Tier }): VaultPermission {
  if (input.role === "ADVISOR") {
    return "RESET";
  }
  if (input.tier !== "PAID_DWY") {
    return "NONE";
  }
  if (input.role === "CLIENT" || isPartnerActorRole(input.role)) {
    return "UPLOAD";
  }
  return "NONE";
}

export function canResetVaultDocument(role: ActorRole): boolean {
  return role === "ADVISOR";
}

export function canUploadVaultDocument(input: {
  role: ActorRole;
  tier: Tier;
  stageOwnerRole: ActorRole;
  assigned: boolean;
  evidenceKind: string;
  requiredKinds: readonly string[];
}): boolean {
  if (input.tier !== "PAID_DWY") {
    return false;
  }
  if (!input.assigned) {
    return false;
  }
  if (!input.requiredKinds.includes(input.evidenceKind)) {
    return false;
  }
  if (input.role === "CLIENT") {
    return input.stageOwnerRole === "CLIENT";
  }
  if (isPartnerActorRole(input.role)) {
    return input.stageOwnerRole === input.role;
  }
  return false;
}

export function partnerReadStageKeys(input: {
  stages: ReadonlyArray<{ key: string; ownerRole: ActorRole }>;
  partnerRole: ActorRole;
  assigned: boolean;
  hasActiveReferral: boolean;
}): string[] {
  if (!isPartnerActorRole(input.partnerRole)) {
    return [];
  }
  if (!input.assigned && !input.hasActiveReferral) {
    return [];
  }
  return input.stages.filter((stage) => stage.ownerRole === input.partnerRole).map((stage) => stage.key);
}

export function documentVisibleTo(
  doc: VaultDocumentRecord,
  viewer: {
    role: ActorRole;
    userId: string;
    tier: Tier;
    readStageKeys: readonly string[];
  },
): boolean {
  if (viewer.role === "ADVISOR") {
    return true;
  }
  if (viewer.tier !== "PAID_DWY") {
    return false;
  }
  if (viewer.role === "CLIENT") {
    return doc.uploadedByUserId === viewer.userId;
  }
  if (isPartnerActorRole(viewer.role)) {
    return viewer.readStageKeys.includes(doc.stageKey);
  }
  return false;
}

export function assertOneTimeUpload(existing: VaultDocumentRecord | null): void {
  if (existing && existing.status === "ACTIVE") {
    throw new VaultError(
      "ONE_TIME_UPLOAD",
      "A vault file is already attached; advisor must reset before replace",
    );
  }
}

export function assertVaultAttachedForSubmit(ctx: VaultSubmitContext): void {
  if (!ctx.vaultEnabled) {
    return;
  }
  if (!ctx.hasActiveDocument) {
    throw new VaultError(
      "VAULT_REQUIRED",
      `Vault document required for evidence kind: ${ctx.kind}`,
    );
  }
}

export function sanitizeVaultFilename(name: string): string {
  const clipped = name.replace(/[/\\]/g, "").replace(/\0/g, "").trim().slice(0, 200);
  if (!clipped || clipped === "." || clipped === "..") {
    throw new VaultError("INVALID_FILE", "Filename is not allowed");
  }
  return clipped;
}

export function assertValidVaultFile(input: {
  originalFilename: string;
  mimeType: string;
  byteSize: number;
}): void {
  sanitizeVaultFilename(input.originalFilename);
  if (!(VAULT_ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    throw new VaultError("INVALID_FILE", `MIME type is not allowed: ${input.mimeType}`);
  }
  if (input.byteSize <= 0 || input.byteSize > VAULT_MAX_BYTES) {
    throw new VaultError("INVALID_FILE", `File size must be between 1 and ${VAULT_MAX_BYTES} bytes`);
  }
}

export function vaultStorageKey(caseId: string, documentId: string): string {
  if (!SAFE_ID.test(caseId) || !SAFE_ID.test(documentId)) {
    throw new VaultError("INVALID_FILE", "Storage key ids must be alphanumeric");
  }
  return `${caseId}/${documentId}`;
}

export function assertSafeStorageKey(storageKey: string): void {
  const parts = storageKey.split("/");
  if (parts.length !== 2 || parts.some((part) => !SAFE_ID.test(part))) {
    throw new VaultError("INVALID_FILE", "Storage key is not safe");
  }
}

export function assertResetReason(reason: string): void {
  if (reason.trim().length < MIN_VAULT_RESET_REASON_LENGTH) {
    throw new VaultError(
      "INVALID_FILE",
      `Reset reason must be at least ${MIN_VAULT_RESET_REASON_LENGTH} characters`,
    );
  }
}

export function encodeVaultEventPayload(payload: VaultEventPayload): string {
  return JSON.stringify(payload);
}

export function decodeVaultEventPayload(raw: string | undefined): VaultEventPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<VaultEventPayload>;
    if (
      typeof parsed.documentId !== "string" ||
      typeof parsed.evidenceKind !== "string" ||
      typeof parsed.stageKey !== "string" ||
      typeof parsed.filename !== "string"
    ) {
      return null;
    }
    return {
      documentId: parsed.documentId,
      evidenceKind: parsed.evidenceKind,
      stageKey: parsed.stageKey,
      filename: parsed.filename,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Add the file to the country-agnostic scan**

In `tests/domain/engine-country-agnostic.test.ts`, add `"src/domain/vault.ts"` to `ENGINE_GLOBAL_FILES` (after `"src/domain/chain-free.ts"`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/domain/vault.test.ts tests/domain/engine-country-agnostic.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/vault.ts tests/domain/vault.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: add document vault domain ACL and one-time upload rules"
```

---

### Task 2: Prisma `VaultDocument` + gitignore + seed cleanup

**Files:**
- Modify: `prisma/schema.prisma` — add `VaultDocument` and `Case.vaultDocuments`
- Modify: `.gitignore` — add `var/vault/`
- Modify: `prisma/seed.ts` — delete vault rows before cases
- Create: `tests/server/vault-schema.test.ts`

**Interfaces:**
- Consumes: none from Task 1 at runtime (schema only).
- Produces: Prisma model `VaultDocument` with fields `id`, `caseId`, `stageKey`, `evidenceKind`, `uploadedByRole`, `uploadedByUserId`, `originalFilename`, `mimeType`, `byteSize`, `storageKey`, `status`, `createdAt`; `onDelete: Cascade` on `Case` so existing `prisma.case.deleteMany()` suites keep working.

- [ ] **Step 1: Write the failing schema test**

Create `tests/server/vault-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const schema = readFileSync(path.resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const gitignore = readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf8");
const seed = readFileSync(path.resolve(process.cwd(), "prisma/seed.ts"), "utf8");

describe("VaultDocument is metadata, not bytes in SQLite", () => {
  it("declares the model with a cascade back to Case and no bytes column", () => {
    expect(schema).toMatch(/model VaultDocument \{[\s\S]*caseId\s+String/);
    expect(schema).toMatch(/storageKey\s+String/);
    expect(schema).toMatch(/evidenceKind\s+String/);
    expect(schema).toMatch(/status\s+String\s+@default\("ACTIVE"\)/);
    expect(schema).toMatch(/onDelete:\s*Cascade/);
    expect(schema).toMatch(/vaultDocuments\s+VaultDocument\[\]/);
    expect(schema).not.toMatch(/base64/i);
    expect(schema).not.toMatch(/bytes\s+Bytes/);
  });

  it("keeps binaries off git and wipes vault rows in seed", () => {
    expect(gitignore).toMatch(/var\/vault\//);
    expect(seed).toMatch(/vaultDocument\.deleteMany/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/server/vault-schema.test.ts`

Expected: FAIL — `schema.prisma` has no `VaultDocument`, `.gitignore` has no `var/vault/`, seed has no `vaultDocument.deleteMany`.

- [ ] **Step 3: Add the model, gitignore, and seed cleanup**

In `prisma/schema.prisma`, add `vaultDocuments VaultDocument[]` to `model Case` (after `referrals Referral[]`).

Append this model after `model Referral`:

```prisma
model VaultDocument {
  id               String   @id @default(cuid())
  caseId           String
  stageKey         String
  evidenceKind     String
  uploadedByRole   String
  uploadedByUserId String
  originalFilename String
  mimeType         String
  byteSize         Int
  storageKey       String
  status           String   @default("ACTIVE")
  createdAt        DateTime @default(now())
  case             Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)

  @@index([caseId, status])
  @@index([caseId, stageKey, evidenceKind, status])
}
```

In `.gitignore`, append:

```
var/vault/
```

In `prisma/seed.ts`, insert this as the first delete (before `prisma.referral.deleteMany()`):

```ts
  await prisma.vaultDocument.deleteMany();
```

- [ ] **Step 4: Push the schema and run the test**

Run:

```bash
npx prisma db push
npx prisma generate
npm test -- tests/server/vault-schema.test.ts
```

Expected: `db push` reports the new model; PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts .gitignore tests/server/vault-schema.test.ts
git commit -m "feat: add VaultDocument metadata model and gitignore vault files"
```

---

### Task 3: Filesystem store and fail-closed policy

**Files:**
- Create: `src/server/vault-store.ts`
- Create: `src/server/vault.ts`
- Create: `tests/server/vault-store.test.ts`
- Create: `tests/server/vault-policy.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/server/vault.ts"` and `"src/server/vault-store.ts"` to `ENGINE_GLOBAL_FILES`

**Interfaces:**
- Consumes: every Task 1 export used below; `CaseState` from `src/domain/stage-engine.ts`; `isModuleEnabled` from `src/domain/market-packs/types.ts`; `casePack` from `src/lib/case-pack.ts`; `prisma` from `src/lib/db.ts`.
- Produces: `VaultPresenceLookup`, `prismaVaultPresenceLookup`, `allowAllVaultLookup`, `emptyVaultLookup`, `vaultRoot`, `toVaultDocumentRecord`, `findActiveVaultDocument`, `listVaultDocuments`, `insertVaultDocument`, `markVaultDocumentReset`, `writeVaultBytes`, `readVaultBytes`, `canUseVault`, `assertVaultEnabled`, `assertVaultSubmitAllowed`, `visibleVaultDocuments`, `partnerScopeForCase`, `performVaultUpload`, `performVaultReset`, `UploadedVaultFile`.

- [ ] **Step 1: Write the failing store and policy tests**

Create `tests/server/vault-store.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db";
import { createCaseRecord } from "../../src/server/cases";
import {
  findActiveVaultDocument,
  insertVaultDocument,
  listVaultDocuments,
  markVaultDocumentReset,
  readVaultBytes,
  vaultRoot,
  writeVaultBytes,
} from "../../src/server/vault-store";
import { vaultStorageKey } from "../../src/domain/vault";

let caseId = "";
let root = "";

describe("vault store writes bytes to disk, not SQLite", () => {
  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "vault-store-"));
    process.env.VAULT_ROOT = root;
    const passwordHash = await bcrypt.hash("password", 10);
    await prisma.vaultDocument.deleteMany();
    await prisma.referral.deleteMany();
    await prisma.partnerPanel.deleteMany();
    await prisma.stageEvent.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.caseParticipant.deleteMany();
    await prisma.case.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.createMany({
      data: [
        { id: "vs_client", email: "vs-client@example.com", role: "CLIENT", passwordHash },
        { id: "vs_advisor", email: "vs-advisor@example.com", role: "ADVISOR", passwordHash },
      ],
    });
    const created = await createCaseRecord({
      title: "Vault store case",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
      clientUserId: "vs_client",
      advisorUserId: "vs_advisor",
    });
    caseId = created.id;
  });

  beforeEach(async () => {
    process.env.VAULT_ROOT = root;
    await prisma.vaultDocument.deleteMany({ where: { caseId } });
  });

  afterAll(async () => {
    rmSync(root, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("stores metadata in Prisma and the file under VAULT_ROOT", async () => {
    const documentId = "docstore1";
    const storageKey = vaultStorageKey(caseId, documentId);
    const bytes = new Uint8Array([37, 80, 68, 70]);
    writeVaultBytes(storageKey, bytes);
    await insertVaultDocument({
      id: documentId,
      caseId,
      stageKey: "purchase_profile",
      evidenceKind: "profile_complete",
      uploadedByRole: "CLIENT",
      uploadedByUserId: "vs_client",
      originalFilename: "profile.pdf",
      mimeType: "application/pdf",
      byteSize: bytes.byteLength,
      storageKey,
    });

    const active = await findActiveVaultDocument(caseId, "purchase_profile", "profile_complete");
    expect(active?.id).toBe(documentId);
    expect(active?.storageKey).toBe(storageKey);
    expect(readVaultBytes(storageKey)).toEqual(bytes);
    expect(vaultRoot()).toBe(root);
    const row = await prisma.vaultDocument.findUniqueOrThrow({ where: { id: documentId } });
    expect(row).not.toHaveProperty("bytes");
    expect(Object.keys(row)).not.toContain("base64");
  });

  it("treats RESET as history so a new ACTIVE row can be attached", async () => {
    const firstId = "docreset1";
    const storageKey = vaultStorageKey(caseId, firstId);
    writeVaultBytes(storageKey, new Uint8Array([1]));
    await insertVaultDocument({
      id: firstId,
      caseId,
      stageKey: "purchase_profile",
      evidenceKind: "profile_complete",
      uploadedByRole: "CLIENT",
      uploadedByUserId: "vs_client",
      originalFilename: "old.pdf",
      mimeType: "application/pdf",
      byteSize: 1,
      storageKey,
    });
    await markVaultDocumentReset(firstId);
    expect(await findActiveVaultDocument(caseId, "purchase_profile", "profile_complete")).toBeNull();
    const listed = await listVaultDocuments(caseId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe("RESET");
  });
});
```

Create `tests/server/vault-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError } from "../../src/domain/vault";
import {
  assertVaultEnabled,
  assertVaultSubmitAllowed,
  canUseVault,
  emptyVaultLookup,
  partnerScopeForCase,
  visibleVaultDocuments,
} from "../../src/server/vault";
import type { VaultDocumentRecord } from "../../src/domain/vault";

function paid(id = "vp1") {
  return createCase({ id, entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

const sample: VaultDocumentRecord = {
  id: "doc_1",
  caseId: "vp1",
  stageKey: "purchase_profile",
  evidenceKind: "profile_complete",
  uploadedByRole: "CLIENT",
  uploadedByUserId: "user_client",
  originalFilename: "profile.pdf",
  mimeType: "application/pdf",
  byteSize: 12,
  storageKey: "vp1/doc_1",
  status: "ACTIVE",
  createdAt: "2026-09-04T10:00:00.000Z",
};

describe("document_vault module gate", () => {
  it("is closed on every pack until Task 8 flips ew, including paid E&W", () => {
    expect(canUseVault(paid())).toBe(false);
    expect(canUseVault({ ...paid(), marketPackId: "au_uk" })).toBe(false);
    expect(canUseVault({ ...paid("vp2"), tier: "FREE_DIY" })).toBe(false);
    expect(() => assertVaultEnabled(paid())).toThrow(VaultError);
  });

  it("does not require a file when the module is off", async () => {
    await expect(
      assertVaultSubmitAllowed(paid(), "purchase_profile", "profile_complete", emptyVaultLookup),
    ).resolves.toBeUndefined();
  });
});

describe("visibility filter", () => {
  it("shows the client their upload, the advisor everything, and a stranger nothing", () => {
    const caseState = paid();
    expect(
      visibleVaultDocuments([sample], {
        role: "CLIENT",
        userId: "user_client",
        tier: "PAID_DWY",
        readStageKeys: ["purchase_profile"],
      }).map((row) => row.id),
    ).toEqual(["doc_1"]);
    expect(
      visibleVaultDocuments([sample], {
        role: "CLIENT",
        userId: "other",
        tier: "PAID_DWY",
        readStageKeys: ["purchase_profile"],
      }),
    ).toEqual([]);
    expect(
      visibleVaultDocuments([sample], {
        role: "ADVISOR",
        userId: "adv",
        tier: "PAID_DWY",
        readStageKeys: [],
      }),
    ).toHaveLength(1);
    expect(
      partnerScopeForCase(caseState, "MORTGAGE_PARTNER", {
        assigned: true,
        hasActiveReferral: false,
      }),
    ).toEqual(["mortgage_path"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server/vault-store.test.ts tests/server/vault-policy.test.ts`

Expected: FAIL with `Cannot find module` for `src/server/vault-store` / `src/server/vault`.

- [ ] **Step 3: Implement the store**

Create `src/server/vault-store.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { VaultDocument } from "@prisma/client";
import type { ActorRole } from "../domain/types";
import {
  assertSafeStorageKey,
  isVaultDocumentStatus,
  type VaultDocumentRecord,
} from "../domain/vault";
import { prisma } from "../lib/db";

export function vaultRoot(): string {
  return process.env.VAULT_ROOT ?? path.join(process.cwd(), "var", "vault");
}

export function toVaultDocumentRecord(row: VaultDocument): VaultDocumentRecord {
  if (!isVaultDocumentStatus(row.status)) {
    throw new Error(`Unknown vault status: ${row.status}`);
  }
  return {
    id: row.id,
    caseId: row.caseId,
    stageKey: row.stageKey,
    evidenceKind: row.evidenceKind,
    uploadedByRole: row.uploadedByRole as ActorRole,
    uploadedByUserId: row.uploadedByUserId,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    storageKey: row.storageKey,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function absolutePath(storageKey: string): string {
  assertSafeStorageKey(storageKey);
  return path.join(vaultRoot(), ...storageKey.split("/"));
}

export function writeVaultBytes(storageKey: string, bytes: Uint8Array): void {
  const full = absolutePath(storageKey);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, bytes);
}

export function readVaultBytes(storageKey: string): Uint8Array {
  return new Uint8Array(readFileSync(absolutePath(storageKey)));
}

export async function findActiveVaultDocument(
  caseId: string,
  stageKey: string,
  evidenceKind: string,
): Promise<VaultDocumentRecord | null> {
  const row = await prisma.vaultDocument.findFirst({
    where: { caseId, stageKey, evidenceKind, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  return row ? toVaultDocumentRecord(row) : null;
}

export async function listVaultDocuments(caseId: string): Promise<VaultDocumentRecord[]> {
  const rows = await prisma.vaultDocument.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toVaultDocumentRecord);
}

export async function insertVaultDocument(input: {
  id: string;
  caseId: string;
  stageKey: string;
  evidenceKind: string;
  uploadedByRole: ActorRole;
  uploadedByUserId: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
}): Promise<VaultDocumentRecord> {
  const row = await prisma.vaultDocument.create({
    data: {
      id: input.id,
      caseId: input.caseId,
      stageKey: input.stageKey,
      evidenceKind: input.evidenceKind,
      uploadedByRole: input.uploadedByRole,
      uploadedByUserId: input.uploadedByUserId,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      storageKey: input.storageKey,
      status: "ACTIVE",
    },
  });
  return toVaultDocumentRecord(row);
}

export async function markVaultDocumentReset(documentId: string): Promise<VaultDocumentRecord> {
  const row = await prisma.vaultDocument.update({
    where: { id: documentId },
    data: { status: "RESET" },
  });
  return toVaultDocumentRecord(row);
}

export async function getVaultDocumentById(documentId: string): Promise<VaultDocumentRecord | null> {
  const row = await prisma.vaultDocument.findUnique({ where: { id: documentId } });
  return row ? toVaultDocumentRecord(row) : null;
}
```

- [ ] **Step 4: Implement policy**

Create `src/server/vault.ts`:

```ts
import { randomUUID } from "node:crypto";
import { isModuleEnabled } from "../domain/market-packs/types";
import type { CaseState } from "../domain/stage-engine";
import { getFocusStage } from "../domain/stage-engine";
import type { ActorRole } from "../domain/types";
import {
  assertOneTimeUpload,
  assertResetReason,
  assertValidVaultFile,
  assertVaultAttachedForSubmit,
  canResetVaultDocument,
  canUploadVaultDocument,
  documentVisibleTo,
  encodeVaultEventPayload,
  partnerReadStageKeys,
  sanitizeVaultFilename,
  VAULT_EVENT_TYPES,
  VaultError,
  vaultStorageKey,
  type VaultActor,
  type VaultDocumentRecord,
} from "../domain/vault";
import { casePack } from "../lib/case-pack";
import {
  findActiveVaultDocument,
  getVaultDocumentById,
  insertVaultDocument,
  listVaultDocuments,
  markVaultDocumentReset,
  writeVaultBytes,
} from "./vault-store";

export type VaultPresenceLookup = {
  hasActiveDocument(caseId: string, stageKey: string, kind: string): Promise<boolean>;
};

export const prismaVaultPresenceLookup: VaultPresenceLookup = {
  async hasActiveDocument(caseId, stageKey, kind) {
    return (await findActiveVaultDocument(caseId, stageKey, kind)) !== null;
  },
};

export const allowAllVaultLookup: VaultPresenceLookup = {
  async hasActiveDocument() {
    return true;
  },
};

export const emptyVaultLookup: VaultPresenceLookup = {
  async hasActiveDocument() {
    return false;
  },
};

export function canUseVault(caseState: CaseState): boolean {
  if (caseState.tier !== "PAID_DWY") {
    return false;
  }
  try {
    return isModuleEnabled(casePack(caseState).flags, "document_vault");
  } catch {
    return false;
  }
}

export function assertVaultEnabled(caseState: CaseState): void {
  if (!canUseVault(caseState)) {
    throw new VaultError(
      "VAULT_DISABLED",
      `Document vault is not enabled for market pack ${caseState.marketPackId}`,
    );
  }
}

export async function assertVaultSubmitAllowed(
  caseState: CaseState,
  stageKey: string,
  kind: string,
  lookup: VaultPresenceLookup = prismaVaultPresenceLookup,
): Promise<void> {
  if (!canUseVault(caseState)) {
    return;
  }
  const hasActiveDocument = await lookup.hasActiveDocument(caseState.id, stageKey, kind);
  assertVaultAttachedForSubmit({ vaultEnabled: true, hasActiveDocument, kind });
}

export function partnerScopeForCase(
  caseState: CaseState,
  partnerRole: ActorRole,
  flags: { assigned: boolean; hasActiveReferral: boolean },
): string[] {
  return partnerReadStageKeys({
    stages: caseState.stages,
    partnerRole,
    assigned: flags.assigned,
    hasActiveReferral: flags.hasActiveReferral,
  });
}

export function visibleVaultDocuments(
  documents: readonly VaultDocumentRecord[],
  viewer: {
    role: ActorRole;
    userId: string;
    tier: CaseState["tier"];
    readStageKeys: readonly string[];
  },
): VaultDocumentRecord[] {
  return documents.filter((doc) => documentVisibleTo(doc, viewer));
}

export type UploadedVaultFile = {
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export async function performVaultUpload(input: {
  caseState: CaseState;
  actor: VaultActor;
  stageKey: string;
  evidenceKind: string;
  file: UploadedVaultFile;
  assigned: boolean;
  now?: Date;
}): Promise<{ caseState: CaseState; document: VaultDocumentRecord }> {
  assertVaultEnabled(input.caseState);
  const stage =
    input.caseState.stages.find((row) => row.key === input.stageKey) ??
    getFocusStage(input.caseState);
  if (!stage || stage.key !== input.stageKey) {
    throw new VaultError("FORBIDDEN", "Unknown stage for vault upload");
  }
  if (
    !canUploadVaultDocument({
      role: input.actor.role,
      tier: input.caseState.tier,
      stageOwnerRole: stage.ownerRole,
      assigned: input.assigned,
      evidenceKind: input.evidenceKind,
      requiredKinds: stage.requiredEvidenceKinds,
    })
  ) {
    throw new VaultError("FORBIDDEN", "Not allowed to upload this vault document");
  }

  const filename = sanitizeVaultFilename(input.file.originalFilename);
  assertValidVaultFile({
    originalFilename: filename,
    mimeType: input.file.mimeType,
    byteSize: input.file.bytes.byteLength,
  });

  const existing = await findActiveVaultDocument(
    input.caseState.id,
    input.stageKey,
    input.evidenceKind,
  );
  assertOneTimeUpload(existing);

  const documentId = randomUUID().replace(/-/g, "").slice(0, 24);
  const storageKey = vaultStorageKey(input.caseState.id, documentId);
  writeVaultBytes(storageKey, input.file.bytes);
  const document = await insertVaultDocument({
    id: documentId,
    caseId: input.caseState.id,
    stageKey: input.stageKey,
    evidenceKind: input.evidenceKind,
    uploadedByRole: input.actor.role,
    uploadedByUserId: input.actor.userId,
    originalFilename: filename,
    mimeType: input.file.mimeType,
    byteSize: input.file.bytes.byteLength,
    storageKey,
  });

  const at = (input.now ?? new Date()).toISOString();
  const caseState: CaseState = {
    ...input.caseState,
    events: [
      ...input.caseState.events,
      {
        type: VAULT_EVENT_TYPES.UPLOADED,
        stageKey: input.stageKey,
        actorRole: input.actor.role,
        at,
        payload: encodeVaultEventPayload({
          documentId: document.id,
          evidenceKind: input.evidenceKind,
          stageKey: input.stageKey,
          filename,
        }),
      },
    ],
  };
  return { caseState, document };
}

export async function performVaultReset(input: {
  caseState: CaseState;
  actor: VaultActor;
  documentId: string;
  reason: string;
  now?: Date;
}): Promise<{ caseState: CaseState; document: VaultDocumentRecord }> {
  assertVaultEnabled(input.caseState);
  if (!canResetVaultDocument(input.actor.role)) {
    throw new VaultError("FORBIDDEN", "Only advisors may reset vault documents");
  }
  assertResetReason(input.reason);
  const existing = await getVaultDocumentById(input.documentId);
  if (!existing || existing.caseId !== input.caseState.id) {
    throw new VaultError("NOT_FOUND", "Vault document not found");
  }
  if (existing.status !== "ACTIVE") {
    throw new VaultError("NOT_FOUND", "Vault document is not active");
  }
  const document = await markVaultDocumentReset(input.documentId);
  const at = (input.now ?? new Date()).toISOString();
  const caseState: CaseState = {
    ...input.caseState,
    events: [
      ...input.caseState.events,
      {
        type: VAULT_EVENT_TYPES.RESET,
        stageKey: existing.stageKey,
        actorRole: input.actor.role,
        at,
        payload: encodeVaultEventPayload({
          documentId: document.id,
          evidenceKind: existing.evidenceKind,
          stageKey: existing.stageKey,
          filename: existing.originalFilename,
          reason: input.reason.trim(),
        }),
      },
    ],
  };
  return { caseState, document };
}

export { listVaultDocuments, findActiveVaultDocument, getVaultDocumentById } from "./vault-store";
```

- [ ] **Step 5: Add the new server files to the country-agnostic scan**

In `tests/domain/engine-country-agnostic.test.ts`, append `"src/server/vault.ts"` and `"src/server/vault-store.ts"` to `ENGINE_GLOBAL_FILES`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/server/vault-store.test.ts tests/server/vault-policy.test.ts tests/domain/engine-country-agnostic.test.ts tests/server/cases.roundtrip.test.ts tests/server/signup.test.ts`

Expected: PASS. The roundtrip / signup suites prove `onDelete: Cascade` did not break `case.deleteMany()`.

- [ ] **Step 7: Commit**

```bash
git add src/server/vault.ts src/server/vault-store.ts tests/server/vault-store.test.ts tests/server/vault-policy.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: store vault files on disk and fail closed when the module is off"
```

---

### Task 4: Vault-required submit (engine + portal + partner port + adapter authority)

**Files:**
- Modify: `src/domain/stage-engine.ts` — optional `vault?: { enabled: boolean; hasActiveDocument: boolean }` on `submitEvidence` and `submitPartnerEvidence`
- Modify: `tests/domain/stage-engine.test.ts` — three new cases at the end of the submit describe
- Modify: `src/app/actions/portal.ts` — call `assertVaultSubmitAllowed` before `submitEvidence`
- Modify: `src/lib/partner-port.ts` — `VaultPresenceLookup` constructor arg; check before `applyPartnerEvidence`
- Modify: `src/lib/partner-adapters/stub-adapter.ts` — forward `vaultLookup`
- Modify: `src/lib/partner-adapters/registry.ts` — forward `vaultLookup`
- Modify: `tests/server/adapter-authority.test.ts` — adapters never write/reset the vault; port performs the lookup
- Create: `tests/server/vault-submit.test.ts`

**Interfaces:**
- Consumes: `assertVaultAttachedForSubmit` from `src/domain/vault.ts`; `assertVaultSubmitAllowed`, `canUseVault`, `prismaVaultPresenceLookup`, `VaultPresenceLookup` from `src/server/vault.ts`.
- Produces: `submitEvidence` / `submitPartnerEvidence` input may include `vault?: { enabled: boolean; hasActiveDocument: boolean }`. `ManualPartnerPort` constructor is `(store?: CaseStore, vaultLookup?: VaultPresenceLookup)`. Existing one-argument `new ManualPartnerPort(store)` callers stay valid.

- [ ] **Step 1: Write the failing engine and policy tests**

Append to `tests/domain/stage-engine.test.ts` inside the existing file (new `describe` at the bottom):

```ts
describe("submitEvidence optional vault argument", () => {
  it("keeps today's behaviour when vault is omitted or disabled", () => {
    let c = createCase({
      id: "vault_off",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    c = submitEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "CLIENT",
    });
    expect(c.stages[0].submittedEvidenceKinds).toEqual(["profile_complete"]);

    let d = createCase({
      id: "vault_disabled_arg",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    d = submitEvidence(d, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "CLIENT",
      vault: { enabled: false, hasActiveDocument: false },
    });
    expect(d.stages[0].submittedEvidenceKinds).toEqual(["profile_complete"]);
  });

  it("refuses PAID_DWY submit when vault is enabled and no file is attached", () => {
    const c = createCase({
      id: "vault_on_missing",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    expect(() =>
      submitEvidence(c, {
        stageKey: "purchase_profile",
        kind: "profile_complete",
        actorRole: "CLIENT",
        vault: { enabled: true, hasActiveDocument: false },
      }),
    ).toThrow(/Vault document required/);
  });

  it("refuses partner submit the same way, and allows it when a file is attached", () => {
    let c = createCase({
      id: "vault_partner",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    // Walk to mortgage_path using the existing helpers already in this file if present;
    // otherwise inline the same accept/advance sequence used by partner tests.
    c = submitEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "CLIENT",
    });
    c = acceptEvidence(c, {
      stageKey: "purchase_profile",
      kind: "profile_complete",
      actorRole: "ADVISOR",
    });
    c = advanceStage(c, { actorRole: "ADVISOR" });
    c = submitEvidence(c, {
      stageKey: "money_readiness",
      kind: "source_of_funds",
      actorRole: "CLIENT",
    });
    c = acceptEvidence(c, {
      stageKey: "money_readiness",
      kind: "source_of_funds",
      actorRole: "ADVISOR",
    });
    c = advanceStage(c, { actorRole: "ADVISOR" });

    expect(() =>
      submitPartnerEvidence(c, {
        stageKey: "mortgage_path",
        kind: "dip_aip",
        actorRole: "MORTGAGE_PARTNER",
        vault: { enabled: true, hasActiveDocument: false },
      }),
    ).toThrow(/Vault document required/);

    const next = submitPartnerEvidence(c, {
      stageKey: "mortgage_path",
      kind: "dip_aip",
      actorRole: "MORTGAGE_PARTNER",
      vault: { enabled: true, hasActiveDocument: true },
    });
    expect(
      next.stages.find((s) => s.key === "mortgage_path")?.submittedEvidenceKinds,
    ).toEqual(["dip_aip"]);
  });
});
```

If `acceptEvidence` / `advanceStage` are not already imported in `tests/domain/stage-engine.test.ts`, add them to the existing import from `../../src/domain/stage-engine`.

Create `tests/server/vault-submit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ManualPartnerPort, PartnerPortError } from "../../src/lib/partner-port";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError } from "../../src/domain/vault";
import { assertVaultSubmitAllowed, emptyVaultLookup } from "../../src/server/vault";
import { atMortgagePath, makeMemoryCaseStore } from "../support/memory-case-store";

describe("submit policy when the module is still off", () => {
  it("lets portal-style submit proceed without a lookup hit", async () => {
    const paid = createCase({
      id: "vsub1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    await expect(
      assertVaultSubmitAllowed(paid, "purchase_profile", "profile_complete", emptyVaultLookup),
    ).resolves.toBeUndefined();
  });
});

describe("partner port cannot skip the vault lookup", () => {
  it("calls the lookup and refuses when the module is forced on via a lookup-aware submit", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store, emptyVaultLookup);
    // Flag is still off in Task 4, so the port must no-op the lookup and succeed.
    await expect(
      port.submitPartnerEvidence({
        caseId: "pp1",
        role: "MORTGAGE_PARTNER",
        panelMemberId: "seed_panel_priya",
        panelMemberName: "Priya Nair",
        stageKey: "mortgage_path",
        kind: "dip_aip",
      }),
    ).resolves.toMatchObject({ eventType: "EVIDENCE_SUBMITTED" });
  });
});
```

The Task 4 port test documents the fail-closed path (flag off → submit still works with `emptyVaultLookup`). Task 8 adds the flag-on refusal.

Extend `tests/server/adapter-authority.test.ts`. Keep the existing `ADAPTER_FILES` and `ADVISOR_ONLY_POWERS`. Add:

```ts
const VAULT_WRITE_POWERS = [
  "performVaultReset",
  "writeVaultBytes",
  "insertVaultDocument",
  "markVaultDocumentReset",
  "resetVaultDocument",
];

it("never writes or resets vault files from an adapter", () => {
  for (const file of ADAPTER_FILES) {
    const source = read(file);
    for (const power of VAULT_WRITE_POWERS) {
      expect(source.includes(power), `${file} references ${power}`).toBe(false);
    }
    expect(source.includes("var/vault"), `${file} hard-codes the vault path`).toBe(false);
  }
});

it("keeps the vault presence check on the port, not on a stub", () => {
  const port = read("src/lib/partner-port.ts");
  expect(port).toMatch(/vaultLookup/);
  expect(port).toMatch(/assertVaultSubmitAllowed/);
  const stub = read("src/lib/partner-adapters/stub-adapter.ts");
  expect(stub.includes("assertVaultSubmitAllowed")).toBe(false);
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- tests/domain/stage-engine.test.ts tests/server/adapter-authority.test.ts tests/server/vault-submit.test.ts`

Expected: FAIL — `submitEvidence` does not accept `vault`; adapter-authority cannot find `vaultLookup` / `assertVaultSubmitAllowed` on the port.

- [ ] **Step 3: Extend the engine**

In `src/domain/stage-engine.ts`, add:

```ts
import { assertVaultAttachedForSubmit } from "./vault";
```

Change `submitEvidence` input to:

```ts
  input: {
    stageKey: string;
    kind: string;
    actorRole: ActorRole;
    now?: Date;
    vault?: { enabled: boolean; hasActiveDocument: boolean };
  },
```

Immediately after the existing `ALREADY_ACCEPTED` checks and **before** updating the stage, add:

```ts
  if (input.vault) {
    assertVaultAttachedForSubmit({
      vaultEnabled: input.vault.enabled,
      hasActiveDocument: input.vault.hasActiveDocument,
      kind: input.kind,
    });
  }
```

Apply the same optional `vault` field and the same three-line check to `submitPartnerEvidence`, in the same position (after the existing role/kind/already-submitted checks, before the stage update).

Do **not** change `attestEvidence` or `acceptEvidence`.

- [ ] **Step 4: Wire the portal action**

In `src/app/actions/portal.ts`, import `assertVaultSubmitAllowed` and `VaultError` and include `VaultError` in the existing error mapper. Inside `submitEvidenceAction`, after `assertPortalSubmit` and **only** on the `PAID_DWY` branch, before `submitEvidence`:

```ts
      await assertVaultSubmitAllowed(caseState, stageKey, kind);
      caseState = submitEvidence(caseState, {
        stageKey,
        kind,
        actorRole: "CLIENT",
        vault: undefined,
      });
```

`assertVaultSubmitAllowed` already no-ops when the flag is off, so do **not** pass `vault: { enabled: true }` from the action — the server function throws `VaultError` itself. Passing `vault: undefined` keeps the engine path identical to today. The engine `vault` argument is for unit tests and for the partner port in Task 8, where the port will pass `{ enabled: true, hasActiveDocument }` once the flag is on.

Update the catch clause:

```ts
      err instanceof PortalPolicyError ||
      err instanceof StageEngineError ||
      err instanceof CaseAccessError ||
      err instanceof VaultError
```

Add the `VaultError` import from `@/domain/vault`.

- [ ] **Step 5: Wire the partner port**

In `src/lib/partner-port.ts`:

1. Import `assertVaultSubmitAllowed`, `prismaVaultPresenceLookup`, and `type VaultPresenceLookup` from `@/server/vault`.
2. Change `ManualPartnerPort`:

```ts
export class ManualPartnerPort implements PartnerPort {
  readonly adapterId: string = "manual";

  constructor(
    protected readonly store: CaseStore = prismaCaseStore,
    protected readonly vaultLookup: VaultPresenceLookup = prismaVaultPresenceLookup,
  ) {}
```

3. In `submitPartnerEvidence`, after the focus-stage key check and before `applyPartnerEvidence`:

```ts
    await assertVaultSubmitAllowed(caseState, input.stageKey, input.kind, this.vaultLookup);
```

4. Keep the `applyPartnerEvidence` call unchanged (no `vault` argument yet — Task 8 will pass it when the flag is on). The policy function is the production gate; the engine argument is the unit-test seam.

In `src/lib/partner-adapters/stub-adapter.ts`, change the constructor to:

```ts
  constructor(
    private readonly profile: AdapterProfile,
    store: CaseStore,
    vaultLookup?: import("@/server/vault").VaultPresenceLookup,
  ) {
    super(store, vaultLookup);
    this.adapterId = profile.adapterId;
  }
```

Use a real import at the top instead of the inline import:

```ts
import type { VaultPresenceLookup } from "@/server/vault";
```

```ts
  constructor(
    private readonly profile: AdapterProfile,
    store: CaseStore,
    vaultLookup?: VaultPresenceLookup,
  ) {
    super(store, vaultLookup);
    this.adapterId = profile.adapterId;
  }
```

In `src/lib/partner-adapters/registry.ts`, import `prismaVaultPresenceLookup` and `type VaultPresenceLookup` from `@/server/vault`. Change both factory functions:

```ts
export function partnerPortForRole(
  role: ActorRole,
  store: CaseStore = prismaCaseStore,
  vaultLookup: VaultPresenceLookup = prismaVaultPresenceLookup,
): PartnerPort {
  const profile = profileForRole(role);
  return profile
    ? new StubPartnerAdapter(profile, store, vaultLookup)
    : new ManualPartnerPort(store, vaultLookup);
}

export function partnerPortForCase(
  caseState: CaseState,
  role: ActorRole,
  store: CaseStore = prismaCaseStore,
  vaultLookup: VaultPresenceLookup = prismaVaultPresenceLookup,
): PartnerPort {
  return railsEnabled(caseState)
    ? partnerPortForRole(role, store, vaultLookup)
    : new ManualPartnerPort(store, vaultLookup);
}
```

`src/app/actions/partner.ts` does not change. It already goes through the port, so the ACL check is inherited.

- [ ] **Step 6: Run Task 4 tests plus the adapter / port suites**

Run: `npm test -- tests/domain/stage-engine.test.ts tests/server/vault-submit.test.ts tests/server/adapter-authority.test.ts tests/lib/partner-port.test.ts tests/lib/partner-adapters.test.ts tests/server/partner-actions.test.ts tests/server/partner-webhook.test.ts`

Expected: PASS. Webhook and port tests still submit without files because `document_vault` is still off.

- [ ] **Step 7: Commit**

```bash
git add src/domain/stage-engine.ts src/app/actions/portal.ts src/lib/partner-port.ts src/lib/partner-adapters/stub-adapter.ts src/lib/partner-adapters/registry.ts tests/domain/stage-engine.test.ts tests/server/vault-submit.test.ts tests/server/adapter-authority.test.ts
git commit -m "feat: require a vault file before submit when the module is on"
```

---

### Task 5: Upload, upload-and-submit, and advisor reset actions

**Files:**
- Create: `src/app/actions/vault.ts`
- Modify: `next.config.mjs` — `serverActions.bodySizeLimit`
- Create: `tests/server/vault-actions.test.ts`
- Modify: `src/app/actions/portal.ts` — no signature change; Task 5 actions call it after upload

**Interfaces:**
- Consumes: `performVaultUpload`, `performVaultReset`, `canUseVault`, `findActiveVaultDocument` from `src/server/vault.ts`; `submitEvidence` / `submitPartnerEvidence` from the engine; `submitEvidenceAction` result type; `loadCaseForUser`, `saveCase`; `listReferralsForCase`, `activeReferralForRole`; `assertPortalSubmit`; `assertPartnerSubmit`; `partnerPortForCase`.
- Produces: `VaultActionResult = { ok: true; documentId: string } | { ok: false; error: string }`; `uploadVaultDocumentAction(caseId, stageKey, kind, formData)`; `uploadAndSubmitEvidenceAction(caseId, stageKey, kind, formData)` returning `SubmitEvidenceResult`; `uploadAndSubmitPartnerEvidenceAction(caseId, stageKey, kind, formData)` returning `PartnerActionResult`; `resetVaultDocumentAction(caseId, documentId, reason)` returning `VaultActionResult`.

- [ ] **Step 1: Write the failing action tests**

Create `tests/server/vault-actions.test.ts`. These test `performVaultUpload` / `performVaultReset` (the functions the actions call). Flag is still off, so the tests assert `VAULT_DISABLED` on `ew` until Task 8. Also assert `next.config.mjs` raises the body limit.

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError } from "../../src/domain/vault";
import { performVaultReset, performVaultUpload } from "../../src/server/vault";

function paid() {
  return createCase({ id: "va1", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("vault actions refuse work while the module is off", () => {
  it("does not upload or reset on ew until the flag flips", async () => {
    await expect(
      performVaultUpload({
        caseState: paid(),
        actor: { role: "CLIENT", userId: "user_client" },
        stageKey: "purchase_profile",
        evidenceKind: "profile_complete",
        assigned: true,
        file: {
          originalFilename: "profile.pdf",
          mimeType: "application/pdf",
          bytes: new Uint8Array([37, 80, 68, 70]),
        },
      }),
    ).rejects.toBeInstanceOf(VaultError);

    await expect(
      performVaultReset({
        caseState: paid(),
        actor: { role: "ADVISOR", userId: "user_advisor" },
        documentId: "missing",
        reason: "Wrong file uploaded",
      }),
    ).rejects.toMatchObject({ code: "VAULT_DISABLED" });
  });
});

describe("server action body limit", () => {
  it("allows a 10 MiB vault upload through Next", () => {
    const config = readFileSync(path.resolve(process.cwd(), "next.config.mjs"), "utf8");
    expect(config).toMatch(/bodySizeLimit:\s*["']12mb["']/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/server/vault-actions.test.ts`

Expected: FAIL on the missing `12mb` config (upload assertions already throw `VAULT_DISABLED` from Task 3, so they pass; the config assertion fails).

- [ ] **Step 3: Raise the Next body limit and add the actions**

Replace `next.config.mjs` with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
```

If `next build` later warns that `serverActions` moved out of `experimental` on this Next 15 patch, move the same `bodySizeLimit` to the top-level `serverActions` key and keep the test regex working.

Create `src/app/actions/vault.ts`:

```ts
"use server";

import { auth } from "@/lib/auth";
import { StageEngineError, submitEvidence } from "@/domain/stage-engine";
import type { ActorRole } from "@/domain/types";
import { VaultError } from "@/domain/vault";
import { partnerPortForCase } from "@/lib/partner-adapters/registry";
import { PartnerPortError } from "@/lib/partner-port";
import { openTicketForRole } from "@/domain/partner-activity";
import {
  CaseAccessError,
  loadCaseForUser,
  saveCase,
} from "@/server/cases";
import { assertPortalSubmit, PortalPolicyError } from "@/server/portal-policy";
import {
  assertPartnerSubmit,
  isPartnerRole,
  PartnerPolicyError,
} from "@/server/partner-policy";
import { performVaultReset, performVaultUpload } from "@/server/vault";
import { revalidatePath } from "next/cache";
import type { SubmitEvidenceResult } from "@/app/actions/portal";
import type { PartnerActionResult } from "@/app/actions/partner";

export type VaultActionResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

function mapError(err: unknown): string {
  if (
    err instanceof VaultError ||
    err instanceof StageEngineError ||
    err instanceof CaseAccessError ||
    err instanceof PortalPolicyError ||
    err instanceof PartnerPolicyError ||
    err instanceof PartnerPortError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Vault action failed";
}

function revalidateCasePaths(caseId: string): void {
  revalidatePath(`/portal/cases/${caseId}`);
  revalidatePath("/portal");
  revalidatePath(`/cockpit/cases/${caseId}`);
  revalidatePath(`/partner/cases/${caseId}`);
  revalidatePath("/partner");
}

async function readFormFile(formData: FormData): Promise<{
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
}> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new VaultError("INVALID_FILE", "Choose a file to upload");
  }
  return {
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export async function uploadVaultDocumentAction(
  caseId: string,
  stageKey: string,
  kind: string,
  formData: FormData,
): Promise<VaultActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Forbidden" };
  }
  const role = session.user.role as ActorRole;
  try {
    const caseState = await loadCaseForUser(session.user.id, role, caseId);
    const assigned = true;
    const file = await readFormFile(formData);
    const result = await performVaultUpload({
      caseState,
      actor: { role, userId: session.user.id },
      stageKey,
      evidenceKind: kind,
      assigned,
      file,
    });
    await saveCase(result.caseState);
    revalidateCasePaths(caseId);
    return { ok: true, documentId: result.document.id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function uploadAndSubmitEvidenceAction(
  caseId: string,
  stageKey: string,
  kind: string,
  formData: FormData,
): Promise<SubmitEvidenceResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return { ok: false, error: "Forbidden" };
  }
  try {
    let caseState = await loadCaseForUser(session.user.id, "CLIENT", caseId);
    assertPortalSubmit(caseState, stageKey);
    const file = await readFormFile(formData);
    const uploaded = await performVaultUpload({
      caseState,
      actor: { role: "CLIENT", userId: session.user.id },
      stageKey,
      evidenceKind: kind,
      assigned: true,
      file,
    });
    caseState = uploaded.caseState;
    caseState = submitEvidence(caseState, {
      stageKey,
      kind,
      actorRole: "CLIENT",
      vault: { enabled: true, hasActiveDocument: true },
    });
    await saveCase(caseState);
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function uploadAndSubmitPartnerEvidenceAction(
  caseId: string,
  stageKey: string,
  kind: string,
  formData: FormData,
): Promise<PartnerActionResult> {
  const session = await auth();
  const role = session?.user?.role as ActorRole | undefined;
  if (!session?.user || !role || !isPartnerRole(role)) {
    return { ok: false, error: "Forbidden" };
  }
  try {
    let caseState = await loadCaseForUser(session.user.id, role, caseId);
    assertPartnerSubmit(caseState, role, stageKey);
    const file = await readFormFile(formData);
    const uploaded = await performVaultUpload({
      caseState,
      actor: { role, userId: session.user.id },
      stageKey,
      evidenceKind: kind,
      assigned: true,
      file,
    });
    await saveCase(uploaded.caseState);
    const ticket = openTicketForRole(uploaded.caseState, role);
    const port = partnerPortForCase(uploaded.caseState, role);
    await port.submitPartnerEvidence({
      caseId,
      role,
      panelMemberId: ticket?.panelMemberId ?? null,
      panelMemberName: ticket?.panelMemberName ?? null,
      stageKey,
      kind,
    });
    revalidateCasePaths(caseId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}

export async function resetVaultDocumentAction(
  caseId: string,
  documentId: string,
  reason: string,
): Promise<VaultActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADVISOR") {
    return { ok: false, error: "Forbidden" };
  }
  try {
    const caseState = await loadCaseForUser(session.user.id, "ADVISOR", caseId);
    const result = await performVaultReset({
      caseState,
      actor: { role: "ADVISOR", userId: session.user.id },
      documentId,
      reason,
    });
    await saveCase(result.caseState);
    revalidateCasePaths(caseId);
    return { ok: true, documentId: result.document.id };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
```

`uploadAndSubmitEvidenceAction` writes the file, then marks evidence submitted in the same action. If submit throws after upload, the `ACTIVE` row remains (one-time lock); the client clicks **Submit** on the already-attached file via `submitEvidenceAction`.

- [ ] **Step 4: Run the Task 5 tests**

Run: `npm test -- tests/server/vault-actions.test.ts tests/server/vault-policy.test.ts tests/app -- tests/domain/stage-engine.test.ts`

If `tests/app` does not exist, run:

`npm test -- tests/server/vault-actions.test.ts tests/server/vault-policy.test.ts tests/domain/stage-engine.test.ts`

Expected: PASS. `performVaultUpload` still throws `VAULT_DISABLED` on `ew` (flag still off). The body-limit assertion passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/vault.ts next.config.mjs tests/server/vault-actions.test.ts
git commit -m "feat: add vault upload, upload-and-submit, and advisor reset actions"
```

---

### Task 6: Authenticated download route with ACL

**Files:**
- Create: `src/app/api/vault/[documentId]/route.ts`
- Create: `src/server/vault-download.ts`
- Create: `tests/server/vault-download.test.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`; `getVaultDocumentById`, `readVaultBytes` from the store; `documentVisibleTo`, `partnerReadStageKeys`, `VaultError` from domain; `loadCaseForUser`; `listReferralsForCase`; `canUseVault`.
- Produces: `authorizeVaultDownload(input): Promise<VaultDocumentRecord>` (throws `VaultError`); `GET` handler returning `401` / `403` / `404` / `200` with the binary, `Content-Type` from the row, `Content-Disposition: attachment; filename="..."`. Never returns `storageKey` or an absolute path.

- [ ] **Step 1: Write the failing download tests**

Create `tests/server/vault-download.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCase } from "../../src/domain/stage-engine";
import { VaultError, type VaultDocumentRecord } from "../../src/domain/vault";
import { authorizeVaultDownload } from "../../src/server/vault-download";

const doc: VaultDocumentRecord = {
  id: "dl_1",
  caseId: "dlcase",
  stageKey: "purchase_profile",
  evidenceKind: "profile_complete",
  uploadedByRole: "CLIENT",
  uploadedByUserId: "user_client",
  originalFilename: "profile.pdf",
  mimeType: "application/pdf",
  byteSize: 4,
  storageKey: "dlcase/dl_1",
  status: "ACTIVE",
  createdAt: "2026-09-04T10:00:00.000Z",
};

function paid() {
  return createCase({ id: "dlcase", entryContext: "UK_RESIDENT_SPEED", tier: "PAID_DWY" });
}

describe("authorizeVaultDownload", () => {
  it("allows the advisor and the uploading paid client, and hides the file from a partner on another stage", () => {
    const caseState = paid();
    expect(
      authorizeVaultDownload({
        caseState,
        document: doc,
        actor: { role: "ADVISOR", userId: "adv" },
        readStageKeys: [],
      }).id,
    ).toBe("dl_1");
    expect(
      authorizeVaultDownload({
        caseState,
        document: doc,
        actor: { role: "CLIENT", userId: "user_client" },
        readStageKeys: ["purchase_profile"],
      }).id,
    ).toBe("dl_1");
    expect(() =>
      authorizeVaultDownload({
        caseState,
        document: doc,
        actor: { role: "CONVEYANCER", userId: "user_conveyancer" },
        readStageKeys: ["diligence"],
      }),
    ).toThrow(VaultError);
    expect(() =>
      authorizeVaultDownload({
        caseState: { ...caseState, tier: "FREE_DIY" },
        document: doc,
        actor: { role: "CLIENT", userId: "user_client" },
        readStageKeys: ["purchase_profile"],
      }),
    ).toThrow(/FREE_TIER|FORBIDDEN|not enabled|not allowed/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/server/vault-download.test.ts`

Expected: FAIL with `Cannot find module '../../src/server/vault-download'`.

- [ ] **Step 3: Implement authorization and the route**

Create `src/server/vault-download.ts`:

```ts
import type { CaseState } from "../domain/stage-engine";
import type { ActorRole } from "../domain/types";
import {
  documentVisibleTo,
  VaultError,
  type VaultActor,
  type VaultDocumentRecord,
} from "../domain/vault";
import { canUseVault } from "./vault";

export function authorizeVaultDownload(input: {
  caseState: CaseState;
  document: VaultDocumentRecord;
  actor: VaultActor;
  readStageKeys: readonly string[];
}): VaultDocumentRecord {
  if (input.document.caseId !== input.caseState.id) {
    throw new VaultError("NOT_FOUND", "Vault document not found");
  }
  if (input.actor.role !== "ADVISOR" && !canUseVault(input.caseState)) {
    throw new VaultError("FORBIDDEN", "Document vault is not available");
  }
  const allowed = documentVisibleTo(input.document, {
    role: input.actor.role,
    userId: input.actor.userId,
    tier: input.caseState.tier,
    readStageKeys: input.readStageKeys,
  });
  if (!allowed) {
    throw new VaultError("FORBIDDEN", "Not allowed to download this vault document");
  }
  return input.document;
}
```

`FREE_DIY` clients fail `documentVisibleTo` (Task 1). Advisors may still download when reviewing a free case that somehow has history, but `canUseVault` is false for free cases — the advisor bypass above is the only exception, and it still goes through `documentVisibleTo` (advisor always true). That is intentional: advisors see everything; free clients never download.

Create `src/app/api/vault/[documentId]/route.ts`:

```ts
import { auth } from "@/lib/auth";
import type { ActorRole } from "@/domain/types";
import { isPartnerActorRole } from "@/domain/types";
import { VaultError } from "@/domain/vault";
import { CaseAccessError, loadCaseForUser } from "@/server/cases";
import { activeReferralForRole } from "@/server/referrals";
import { authorizeVaultDownload } from "@/server/vault-download";
import { partnerScopeForCase } from "@/server/vault";
import { getVaultDocumentById, readVaultBytes } from "@/server/vault-store";

function statusFor(err: unknown): number {
  if (err instanceof VaultError) {
    if (err.code === "NOT_FOUND") return 404;
    if (err.code === "FORBIDDEN" || err.code === "FREE_TIER" || err.code === "VAULT_DISABLED") {
      return 403;
    }
    return 400;
  }
  if (err instanceof CaseAccessError) {
    return 403;
  }
  return 500;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;
  try {
    const document = await getVaultDocumentById(documentId);
    if (!document) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const role = session.user.role as ActorRole;
    const caseState = await loadCaseForUser(session.user.id, role, document.caseId);
    const referral = isPartnerActorRole(role)
      ? await activeReferralForRole(document.caseId, role)
      : null;
    const readStageKeys = isPartnerActorRole(role)
      ? partnerScopeForCase(caseState, role, {
          assigned: true,
          hasActiveReferral: referral !== null,
        })
      : [];

    authorizeVaultDownload({
      caseState,
      document,
      actor: { role, userId: session.user.id },
      readStageKeys,
    });

    const bytes = readVaultBytes(document.storageKey);
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(document.byteSize),
        "Content-Disposition": `attachment; filename="${document.originalFilename.replace(/"/g, "")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    return Response.json({ ok: false, error: message }, { status: statusFor(err) });
  }
}
```

Do **not** add `/api/vault` to `src/middleware.ts`. Auth stays in the route so an unauthenticated request gets `401` JSON instead of a login redirect.

- [ ] **Step 4: Run the download tests plus the webhook route suite**

Run: `npm test -- tests/server/vault-download.test.ts tests/server/partner-webhook.test.ts tests/domain/vault.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/vault-download.ts src/app/api/vault/[documentId]/route.ts tests/server/vault-download.test.ts
git commit -m "feat: add authenticated vault download route with role ACL"
```

---

### Task 7: VaultUploadForm and VaultPanel on portal, partner, and cockpit

**Files:**
- Create: `src/components/VaultUploadForm.tsx`
- Create: `src/components/VaultPanel.tsx`
- Modify: `src/app/portal/cases/[caseId]/page.tsx`
- Modify: `src/app/partner/cases/[caseId]/page.tsx`
- Modify: `src/app/cockpit/cases/[caseId]/page.tsx`
- Create: `tests/server/vault-ui.test.ts`

**Interfaces:**
- Consumes: `canUseVault`, `listVaultDocuments`, `visibleVaultDocuments`, `partnerScopeForCase`, `findActiveVaultDocument` from `src/server/vault.ts`; `uploadAndSubmitEvidenceAction`, `uploadAndSubmitPartnerEvidenceAction`, `resetVaultDocumentAction` from `src/app/actions/vault.ts`; `submitEvidenceAction`; `submitPartnerEvidenceAction`; `activeReferralForRole`.
- Produces: `VaultUploadForm` (client) with rows `{ kind, hasActiveDocument, onUploadAndSubmit, onSubmitOnly }`; `VaultPanel` (server-safe) with `{ documents, canReset, caseId }`. `EvidenceSubmitForm` stays the vault-off / FREE_DIY path and is not rewritten.

- [ ] **Step 1: Write the failing UI wiring test**

Create `tests/server/vault-ui.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), relative), "utf8");
}

describe("vault surfaces", () => {
  it("keeps EvidenceSubmitForm for vault-off and free attestation, and mounts vault UI behind the flag", () => {
    const portal = read("src/app/portal/cases/[caseId]/page.tsx");
    const partner = read("src/app/partner/cases/[caseId]/page.tsx");
    const cockpit = read("src/app/cockpit/cases/[caseId]/page.tsx");
    const upload = read("src/components/VaultUploadForm.tsx");
    const panel = read("src/components/VaultPanel.tsx");

    expect(portal).toContain("canUseVault");
    expect(portal).toContain("VaultUploadForm");
    expect(portal).toContain("VaultPanel");
    expect(portal).toContain("EvidenceSubmitForm");
    expect(portal).toContain("uploadAndSubmitEvidenceAction");
    expect(portal).not.toContain("resetVaultDocumentAction");

    expect(partner).toContain("canUseVault");
    expect(partner).toContain("VaultUploadForm");
    expect(partner).toContain("uploadAndSubmitPartnerEvidenceAction");
    expect(partner).not.toContain("resetVaultDocumentAction");

    expect(cockpit).toContain("VaultPanel");
    expect(cockpit).toContain("resetVaultDocumentAction");
    expect(cockpit).not.toContain("VaultUploadForm");

    expect(upload).toContain('type="file"');
    expect(upload).toContain('name="file"');
    expect(upload).toContain("Upload and submit");
    expect(panel).toContain("/api/vault/");
    expect(panel).toContain("Reset");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/server/vault-ui.test.ts`

Expected: FAIL — the pages do not import `VaultUploadForm` / `VaultPanel`.

- [ ] **Step 3: Add the components**

Create `src/components/VaultUploadForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ActionErrorBanner } from "@/components/ActionErrorBanner";

type Row = {
  kind: string;
  hasActiveDocument: boolean;
  onUploadAndSubmit: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  onSubmitOnly: () => Promise<{ ok: boolean; error?: string }>;
};

function VaultKindRow({ kind, hasActiveDocument, onUploadAndSubmit, onSubmitOnly }: Row) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <ActionErrorBanner error={error} />
      <form
        action={async (formData) => {
          setError(null);
          const result = hasActiveDocument
            ? await onSubmitOnly()
            : await onUploadAndSubmit(formData);
          if (!result.ok) {
            setError(result.error ?? "Upload failed");
          }
        }}
        className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="text-sm font-medium text-slate-700">{kind.replace(/_/g, " ")}</span>
        <div className="flex items-center gap-2">
          {!hasActiveDocument && (
            <input
              type="file"
              name="file"
              required
              className="text-sm text-slate-600"
            />
          )}
          {hasActiveDocument && (
            <span className="text-xs text-slate-500">File attached — cannot replace</span>
          )}
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          >
            {hasActiveDocument ? "Submit" : "Upload and submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function VaultUploadForm({
  rows,
  awaitingKinds = [],
}: {
  rows: Row[];
  awaitingKinds?: string[];
}) {
  if (rows.length === 0 && awaitingKinds.length === 0) {
    return (
      <p className="text-sm text-emerald-700">All required evidence submitted for this stage.</p>
    );
  }

  return (
    <div className="space-y-3">
      {awaitingKinds.map((kind) => (
        <p
          key={kind}
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {kind.replace(/_/g, " ")} — submitted, awaiting advisor acceptance
        </p>
      ))}
      {rows.map((row) => (
        <VaultKindRow key={row.kind} {...row} />
      ))}
    </div>
  );
}
```

Create `src/components/VaultPanel.tsx`:

```tsx
import { resetVaultDocumentAction } from "@/app/actions/vault";
import type { VaultDocumentRecord } from "@/domain/vault";

export function VaultPanel({
  caseId,
  documents,
  canReset,
}: {
  caseId: string;
  documents: VaultDocumentRecord[];
  canReset: boolean;
}) {
  if (documents.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-medium text-slate-900">Document vault</h2>
        <p className="mt-2 text-sm text-slate-600">No documents in the vault for this view.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium text-slate-900">Document vault</h2>
      <p className="mt-1 text-sm text-slate-600">
        One file per evidence kind. Replacement requires an advisor reset.
      </p>
      <ul className="mt-4 space-y-3">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{doc.originalFilename}</p>
                <p className="text-xs text-slate-500">
                  {doc.stageKey.replace(/_/g, " ")} · {doc.evidenceKind.replace(/_/g, " ")} ·{" "}
                  {doc.status} · {doc.uploadedByRole.replace(/_/g, " ")}
                </p>
              </div>
              <a
                href={`/api/vault/${doc.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Download
              </a>
            </div>
            {canReset && doc.status === "ACTIVE" && (
              <form
                action={async (formData) => {
                  const reason = String(formData.get("reason") ?? "");
                  await resetVaultDocumentAction(caseId, doc.id, reason);
                }}
                className="mt-2 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  name="reason"
                  required
                  minLength={8}
                  placeholder="Reason for reset"
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800 hover:bg-slate-100"
                >
                  Reset
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Wire the portal page**

In `src/app/portal/cases/[caseId]/page.tsx`:

1. Import `uploadAndSubmitEvidenceAction` from `@/app/actions/vault`.
2. Import `VaultUploadForm` and `VaultPanel`.
3. Import `canUseVault`, `listVaultDocuments`, `visibleVaultDocuments` from `@/server/vault`.
4. After `canSubmit` is computed, add:

```tsx
  const vaultOn = canUseVault(caseState);
  const vaultDocuments = vaultOn
    ? visibleVaultDocuments(await listVaultDocuments(caseId), {
        role: "CLIENT",
        userId: session.user.id,
        tier: caseState.tier,
        readStageKeys: [],
      })
    : [];
  const activeByKind = new Map(
    vaultDocuments
      .filter((doc) => doc.status === "ACTIVE" && doc.stageKey === focus?.key)
      .map((doc) => [doc.evidenceKind, doc]),
  );
```

5. Keep `evidenceRows` for the vault-off path. Add vault rows:

```tsx
  const vaultRows = pendingSubmitKinds.map((kind) => ({
    kind,
    hasActiveDocument: activeByKind.has(kind),
    onUploadAndSubmit: async (formData: FormData) =>
      uploadAndSubmitEvidenceAction(caseId, focus!.key, kind, formData),
    onSubmitOnly: async () => submitEvidenceAction(caseId, focus!.key, kind),
  }));
```

6. Replace the evidence card so FREE_DIY and vault-off still use `EvidenceSubmitForm`:

```tsx
      {canSubmit && (pendingSubmitKinds.length > 0 || awaitingKinds.length > 0) && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-medium text-slate-900">
            {vaultOn ? "Tasks and documents" : "Submit evidence"}
          </h2>
          {vaultOn ? (
            <VaultUploadForm rows={vaultRows} awaitingKinds={awaitingKinds} />
          ) : (
            <EvidenceSubmitForm rows={evidenceRows} awaitingKinds={awaitingKinds} />
          )}
        </div>
      )}

      {vaultOn && <VaultPanel caseId={caseId} documents={vaultDocuments} canReset={false} />}
```

Do not render `VaultPanel` on `FREE_DIY`. `canUseVault` is already false for free cases.

- [ ] **Step 5: Wire the partner page**

In `src/app/partner/cases/[caseId]/page.tsx`:

1. Import `uploadAndSubmitPartnerEvidenceAction`, `VaultUploadForm`, `VaultPanel`, `canUseVault`, `listVaultDocuments`, `visibleVaultDocuments`, `partnerScopeForCase`, and `activeReferralForRole`.
2. After `canSubmit` / inbox are computed (inside the branch where `focus` exists and is owned by the partner), add:

```tsx
  const vaultOn = canUseVault(caseState);
  const referral = await activeReferralForRole(caseId, role);
  const readStageKeys = partnerScopeForCase(caseState, role, {
    assigned: true,
    hasActiveReferral: referral !== null,
  });
  const vaultDocuments = vaultOn
    ? visibleVaultDocuments(await listVaultDocuments(caseId), {
        role,
        userId: session.user.id,
        tier: caseState.tier,
        readStageKeys,
      })
    : [];
  const activeByKind = new Map(
    vaultDocuments
      .filter((doc) => doc.status === "ACTIVE" && doc.stageKey === focus.key)
      .map((doc) => [doc.evidenceKind, doc]),
  );
  const vaultRows = inbox.toSubmit.map((kind) => ({
    kind,
    hasActiveDocument: activeByKind.has(kind),
    onUploadAndSubmit: async (formData: FormData) =>
      uploadAndSubmitPartnerEvidenceAction(caseId, focus.key, kind, formData),
    onSubmitOnly: async () => submitPartnerEvidenceAction(caseId, focus.key, kind),
  }));
```

3. In the required-evidence card, when `vaultOn` is true render `VaultUploadForm` with `vaultRows` and `inbox.awaitingAcceptance`; otherwise keep `EvidenceSubmitForm`.
4. After that card, render `{vaultOn && <VaultPanel caseId={caseId} documents={vaultDocuments} canReset={false} />}`.

- [ ] **Step 6: Wire the cockpit page**

In `src/app/cockpit/cases/[caseId]/page.tsx`:

1. Import `VaultPanel`, `canUseVault`, `listVaultDocuments`.
2. After `const pack = casePack(caseState);` add:

```tsx
  const vaultOn = canUseVault(caseState);
  const vaultDocuments = vaultOn ? await listVaultDocuments(caseId) : [];
```

Advisors see every document on the case (`documentVisibleTo` is always true for `ADVISOR`); do not filter.

3. Render the panel after `AdvisorStageControls` (before `WarmIntroButton`):

```tsx
      {vaultOn && <VaultPanel caseId={caseId} documents={vaultDocuments} canReset />}
```

- [ ] **Step 7: Run the UI test and the related page-scan suites**

Run: `npm test -- tests/server/vault-ui.test.ts tests/server/chain-free-policy.test.ts tests/server/cockpit-playbook-policy.test.ts`

Expected: PASS. Chain-free / playbook scans still find their panels.

- [ ] **Step 8: Commit**

```bash
git add src/components/VaultUploadForm.tsx src/components/VaultPanel.tsx src/app/portal/cases/[caseId]/page.tsx src/app/partner/cases/[caseId]/page.tsx src/app/cockpit/cases/[caseId]/page.tsx tests/server/vault-ui.test.ts
git commit -m "feat: render document vault upload and advisor reset on case pages"
```

---

### Task 8: Turn `document_vault` on for `ew` only

**Files:**
- Modify: `src/domain/market-packs/ew-config.ts` — add `document_vault: true` to `EW_FLAGS`
- Modify: `tests/domain/market-pack-flags.test.ts`
- Modify: `tests/domain/ew-pack.test.ts`
- Modify: `tests/domain/market-pack-inspector.test.ts`
- Modify: `tests/server/vault-policy.test.ts`
- Modify: `tests/server/vault-actions.test.ts`
- Modify: `tests/server/vault-submit.test.ts`
- Modify: `tests/lib/partner-port.test.ts`
- Modify: `src/lib/partner-port.ts` — pass `vault: { enabled, hasActiveDocument }` into `applyPartnerEvidence` when `canUseVault` is true
- Modify: `src/app/actions/portal.ts` — pass the same `vault` argument into `submitEvidence` when `canUseVault` is true

**Interfaces:**
- Consumes: `EW_FLAGS`, `isModuleEnabled`, `canUseVault`, `emptyVaultLookup`, `allowAllVaultLookup`.
- Produces: `ew.document_vault === true`. Every other registered pack stays `false`. `hard_client_sla` stays `false` everywhere. Partner port tests inject `allowAllVaultLookup` so memory-store submits still work. A new port test with `emptyVaultLookup` proves adapters cannot submit without a file.

- [ ] **Step 1: Write the failing flag-matrix assertions**

In `tests/domain/market-pack-flags.test.ts` replace:

```ts
const GATED_MODULES = ["hard_client_sla", "document_vault"] as const;
```

with:

```ts
const GATED_MODULES = ["hard_client_sla"] as const;
```

Add this test after the chain-free test:

```ts
  it("runs the document vault in England & Wales only", () => {
    const enabled = listMarketPacks()
      .filter((pack) => isModuleEnabled(pack.flags, "document_vault"))
      .map((pack) => pack.id);
    expect(enabled).toEqual(["ew"]);
    expect(isModuleEnabled(listMarketPacks().find((p) => p.id === "au")!.flags, "document_vault")).toBe(
      false,
    );
    expect(
      isModuleEnabled(listMarketPacks().find((p) => p.id === "au_uk")!.flags, "document_vault"),
    ).toBe(false);
    expect(isModuleEnabled(EW_FLAGS, "hard_client_sla")).toBe(false);
  });
```

The first test (`keeps every globally gated module off`) now only asserts `hard_client_sla`. That is required — `document_vault` is no longer globally gated.

In `tests/domain/ew-pack.test.ts`, change the flags object to:

```ts
    expect(ewMarketPack.flags).toEqual({
      fx_deposit: true,
      partner_speed_rails: true,
      chain_free_inventory: true,
      document_vault: true,
    });
```

In `tests/domain/market-pack-inspector.test.ts`, after the `hard_client_sla` assertion, add:

```ts
    expect(summary.modules.find((m) => m.key === "document_vault")?.enabled).toBe(true);
```

and in the corridor summary test (`summarises a corridor pack...`) add:

```ts
    expect(inbound.modules.find((m) => m.key === "document_vault")?.enabled).toBe(false);
```

In `tests/server/vault-policy.test.ts` replace the "closed on every pack" test with:

```ts
describe("document_vault module gate", () => {
  it("is open for paid England & Wales and closed otherwise", async () => {
    expect(canUseVault(paid())).toBe(true);
    expect(canUseVault({ ...paid(), marketPackId: "au_uk" })).toBe(false);
    expect(canUseVault({ ...paid("vp2"), tier: "FREE_DIY" })).toBe(false);
    expect(() => assertVaultEnabled(paid())).not.toThrow();
    expect(() => assertVaultEnabled({ ...paid(), marketPackId: "au_uk" })).toThrow(VaultError);

    await expect(
      assertVaultSubmitAllowed(paid(), "purchase_profile", "profile_complete", emptyVaultLookup),
    ).rejects.toMatchObject({ code: "VAULT_REQUIRED" });
  });
});
```

In `tests/server/vault-actions.test.ts` replace the "refuse work while the module is off" test with a domain-level happy path that still does not need Prisma if you only assert `assertVaultEnabled(paid())` no longer throws. Keep a second test that `FREE_DIY` still throws `VAULT_DISABLED`:

```ts
describe("vault actions honour the ew flag", () => {
  it("enables upload policy on paid ew and keeps free attestation file-free", () => {
    const paidCase = createCase({
      id: "va1",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "PAID_DWY",
    });
    const free = createCase({
      id: "va2",
      entryContext: "UK_RESIDENT_SPEED",
      tier: "FREE_DIY",
    });
    expect(canUseVault(paidCase)).toBe(true);
    expect(canUseVault(free)).toBe(false);
  });
});
```

Add `canUseVault` to the imports. Remove the `performVaultUpload` / `performVaultReset` calls from this file — those stay covered by `vault-store.test.ts` and would need a real case id.

In `tests/server/vault-submit.test.ts` replace the partner-port test with two tests:

```ts
describe("partner port cannot skip the vault lookup once the module is on", () => {
  it("refuses submit when the lookup is empty", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store, emptyVaultLookup);
    await expect(
      port.submitPartnerEvidence({
        caseId: "pp1",
        role: "MORTGAGE_PARTNER",
        panelMemberId: "seed_panel_priya",
        panelMemberName: "Priya Nair",
        stageKey: "mortgage_path",
        kind: "dip_aip",
      }),
    ).rejects.toMatchObject({ code: "VAULT_REQUIRED" });
  });

  it("allows submit when the lookup reports an ACTIVE file", async () => {
    const store = makeMemoryCaseStore(atMortgagePath());
    const port = new ManualPartnerPort(store, allowAllVaultLookup);
    await expect(
      port.submitPartnerEvidence({
        caseId: "pp1",
        role: "MORTGAGE_PARTNER",
        panelMemberId: "seed_panel_priya",
        panelMemberName: "Priya Nair",
        stageKey: "mortgage_path",
        kind: "dip_aip",
      }),
    ).resolves.toMatchObject({ eventType: "EVIDENCE_SUBMITTED" });
  });
});
```

Import `allowAllVaultLookup` from `../../src/server/vault`. Remove the unused `PartnerPortError` import if the new tests do not use it.

In `tests/lib/partner-port.test.ts`, construct the port with `allowAllVaultLookup` on every `new ManualPartnerPort(store)` that calls `submitPartnerEvidence`:

```ts
import { allowAllVaultLookup } from "../../src/server/vault";
```

```ts
    const port = new ManualPartnerPort(store, allowAllVaultLookup);
```

Leave acknowledge / milestone-only tests on `new ManualPartnerPort(store)` — they do not submit evidence.

- [ ] **Step 2: Run the flag tests to verify they fail**

Run: `npm test -- tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/server/vault-policy.test.ts tests/lib/partner-port.test.ts tests/server/vault-submit.test.ts`

Expected: FAIL — `ew` still has `document_vault` off, so `enabled` is `[]` not `["ew"]`; port submit still succeeds with `emptyVaultLookup`.

- [ ] **Step 3: Flip the E&W flag and tighten the port**

In `src/domain/market-packs/ew-config.ts`, update the comment and flags:

```ts
/**
 * Spec §3: FX for the deposit is in v1 scope. Spec §9 Phase 2: speed rails are
 * adapter plumbing. Spec §13 sub-project 6: chain_free_inventory is on as
 * buyer-side certification/matching data — not seller listings and not a
 * client SLA. Spec §8: document_vault is on for ew only. hard_client_sla stays off.
 */
export const EW_FLAGS: MarketFlags = {
  fx_deposit: true,
  partner_speed_rails: true,
  chain_free_inventory: true,
  document_vault: true,
};
```

In `src/lib/partner-port.ts`, import `canUseVault` from `@/server/vault`. Inside `submitPartnerEvidence`, after `assertVaultSubmitAllowed` and before `applyPartnerEvidence`:

```ts
    const vaultEnabled = canUseVault(caseState);
    const hasActiveDocument = vaultEnabled
      ? await this.vaultLookup.hasActiveDocument(input.caseId, input.stageKey, input.kind)
      : false;

    caseState = applyPartnerEvidence(caseState, {
      stageKey: input.stageKey,
      kind: input.kind,
      actorRole: input.role,
      now: input.now,
      vault: vaultEnabled ? { enabled: true, hasActiveDocument } : undefined,
    });
```

`assertVaultSubmitAllowed` already throws when the lookup is empty, so `hasActiveDocument` is `true` on the success path. Passing the engine argument keeps adapters from ever calling `applyPartnerEvidence` with the flag on and no file, even if a future port edit drops the policy call.

In `src/app/actions/portal.ts`, import `canUseVault` and `prismaVaultPresenceLookup`. After `assertVaultSubmitAllowed` on the `PAID_DWY` branch, pass the same engine argument:

```ts
      await assertVaultSubmitAllowed(caseState, stageKey, kind);
      const vaultEnabled = canUseVault(caseState);
      const hasActiveDocument = vaultEnabled
        ? await prismaVaultPresenceLookup.hasActiveDocument(caseId, stageKey, kind)
        : false;
      caseState = submitEvidence(caseState, {
        stageKey,
        kind,
        actorRole: "CLIENT",
        vault: vaultEnabled ? { enabled: true, hasActiveDocument } : undefined,
      });
```

Do **not** set `document_vault` on any corridor config (`au-uk-config.ts`, `uk-au-config.ts`, `us-uk-config.ts`, `uk-us-config.ts`) or `au-stub`.

- [ ] **Step 4: Run the flag, port, webhook, and adapter suites**

Run: `npm test -- tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/domain/au-uk-pack.test.ts tests/domain/uk-au-pack.test.ts tests/domain/us-uk-pack.test.ts tests/domain/uk-us-pack.test.ts tests/server/vault-policy.test.ts tests/server/vault-actions.test.ts tests/server/vault-submit.test.ts tests/lib/partner-port.test.ts tests/lib/partner-adapters.test.ts tests/server/adapter-authority.test.ts tests/server/partner-webhook.test.ts tests/server/partner-actions.test.ts tests/domain/stage-engine.test.ts`

Expected: PASS. Corridor packs still have `document_vault` off. Webhook tests use `IN_PROGRESS` → `NOTE_ONLY` and do not submit evidence, so they stay green. `partner-port` submit tests pass only because they now inject `allowAllVaultLookup`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/market-packs/ew-config.ts src/lib/partner-port.ts src/app/actions/portal.ts tests/domain/market-pack-flags.test.ts tests/domain/ew-pack.test.ts tests/domain/market-pack-inspector.test.ts tests/server/vault-policy.test.ts tests/server/vault-actions.test.ts tests/server/vault-submit.test.ts tests/lib/partner-port.test.ts
git commit -m "feat: enable document vault for England and Wales paid cases"
```

---

### Task 9: Demo script, README, and full verification

**Files:**
- Create: `docs/superpowers/plans/demo-script-document-vault.md`
- Modify: `docs/superpowers/plans/demo-script-market-packs.md`
- Modify: `docs/superpowers/plans/demo-script-corridor-packs.md`
- Modify: `docs/superpowers/plans/demo-script-core-portal.md`
- Modify: `docs/superpowers/plans/demo-script-speed-rails.md`
- Modify: `README.md`
- Do **not** seed binary demo files. The live upload in the script is the proof. `prisma/seed.ts` already deletes vault rows (Task 2).

**Interfaces:**
- Consumes: the shipped vault surfaces and the flag matrix from Task 8.
- Produces: a founder click-script and README section that state what is real (local filesystem vault, role ACL, one-time upload, ew-only flag) and what is absent (S3, corridor vault, hard SLA, threads).

- [ ] **Step 1: Write the demo script**

Create `docs/superpowers/plans/demo-script-document-vault.md`:

```md
# Document vault demo script

Founder validation script for spec §8: a case-scoped document vault with role ACL and a one-time upload principle. Binaries live on disk under `var/vault/`; metadata lives in Prisma. The module is on for paid England & Wales only.

**Prerequisites:** `npm run db:push`, `npm run db:seed`, `npm run dev`. All logins use password `password`. Use any small PDF or PNG (under 10 MB).

---

## 1. The flag is ew-only, and free stays file-free

1. Sign in as **`advisor@example.com`** → `/cockpit/market-packs`.
2. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault` **on**. `hard_client_sla`, `corridor_inbound`, `corridor_outbound` **off**.
3. Select **`au_uk`**. `document_vault` is **off**. Repeat for `uk_au`, `us_uk`, `uk_us`, and the disabled `au` stub.
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

## 5. Corridor cases stay on the old submit-without-file path

1. Advisor opens **Chen AU→UK return (paid)** (`au_uk`).
2. There is no Document vault panel. Client submit on that case is still the metadata-only **Submit** button.
3. That is fail-closed: corridor packs have not proved the vault.

---

## What is real and what is absent

| Layer | Status |
|-------|--------|
| **Real** | `VaultDocument` metadata; files under `var/vault/`; one-time ACTIVE lock; advisor reset; role ACL; vault-required PAID_DWY submit on `ew`; `/api/vault/[documentId]` |
| **Stubbed** | Partner adapters still simulate vendor turnaround; they do not generate files |
| **Absent** | S3 / cloud storage, base64-in-SQLite, corridor vault, hard client SLAs, threads, seller views |

## Automated verification

```bash
npm test -- tests/domain/vault.test.ts tests/server/vault-schema.test.ts tests/server/vault-store.test.ts tests/server/vault-policy.test.ts tests/server/vault-submit.test.ts tests/server/vault-actions.test.ts tests/server/vault-download.test.ts tests/server/vault-ui.test.ts tests/server/adapter-authority.test.ts tests/domain/market-pack-flags.test.ts tests/domain/engine-country-agnostic.test.ts
```
```

- [ ] **Step 2: Point the older demos and README at the new flag**

In `docs/superpowers/plans/demo-script-market-packs.md` section 1 step 4, replace the modules sentence with:

```md
4. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory` and `document_vault` are **on**. `corridor_inbound` and `corridor_outbound` are **on for corridor packs only**; they stay **off** on `ew` and `au`. `hard_client_sla` is **off** in every pack. `chain_free_inventory` is buyer-side overlay data, not seller stock; `document_vault` is the paid E&W file store; `hard_client_sla` staying off is the rest of the spec §9 rule.
```

In `docs/superpowers/plans/demo-script-corridor-packs.md` section 1 step 3, replace the `ew` modules sentence with:

```md
3. Select **`ew`**. Modules: `fx_deposit`, `partner_speed_rails`, `chain_free_inventory`, `document_vault` **on**. `corridor_inbound`, `corridor_outbound`, `hard_client_sla` **off**. Stage table still includes **Chain-free position**.
```

In the same file, section 2 step 2, keep corridor modules as they are and add `document_vault` **off**.

In `docs/superpowers/plans/demo-script-core-portal.md`, in the paid-client submit step, add one sentence: on the **Bloggs** (`ew`) case the client must attach a file and use **Upload and submit**; the Smith DIY case is unchanged.

In `docs/superpowers/plans/demo-script-speed-rails.md`, in the partner evidence step, add: on `ew` paid cases `dip_aip` now requires a vault file before the port will record `EVIDENCE_SUBMITTED`. Adapters still cannot accept or advance.

In `README.md`, replace the module-toggles paragraph with:

```md
**Module toggles are data, not scattered ifs.** `MarketFlags` on the pack are read through
`isModuleEnabled`. The `ew` pack runs `fx_deposit`, `partner_speed_rails`,
`chain_free_inventory` and `document_vault`. The four corridor packs (`au_uk`, `uk_au`,
`us_uk`, `uk_us`) run `fx_deposit`, `corridor_inbound` and `corridor_outbound`.
`hard_client_sla` stays **off** in every pack. `chain_free_inventory`,
`partner_speed_rails` and `document_vault` stay **ew-only**. Enforced by
`tests/domain/market-pack-flags.test.ts`.
```

Add this section immediately after the Chain-free overlay section (before "Advisor operating IP"):

```md
## Document vault (paid E&W, one-time upload)

Spec §8. Paid England & Wales cases store evidence files in a case-scoped vault:

- Metadata in Prisma (`VaultDocument`); bytes on disk under `var/vault/` (gitignored).
- One `ACTIVE` file per evidence kind per stage. Replacement requires an advisor reset.
- Role ACL: advisor sees all; the client sees their own uploads; a partner sees only
  stages they own or were referred on. `FREE_DIY` stays note-only attestation.
- When `document_vault` is on, PAID_DWY `submitEvidence` / partner submit require that
  file. Adapters cannot skip the check (`tests/server/adapter-authority.test.ts`).
- Download: authenticated `GET /api/vault/[documentId]`.

Corridor packs keep the metadata-only submit path until the vault is proved on `ew`.
No S3 in this release. `hard_client_sla` stays off.

Walkthrough: [`docs/superpowers/plans/demo-script-document-vault.md`](docs/superpowers/plans/demo-script-document-vault.md).
```

In the Happy-path demo paid list, change step 1 from "submit profile evidence" to "upload a file and submit profile evidence".

- [ ] **Step 3: Full verification**

Run: `npm test`

Expected: PASS, no failing files. Confirm specifically that `tests/domain/vault.test.ts`, `tests/domain/market-pack-flags.test.ts`, `tests/domain/ew-pack.test.ts`, `tests/domain/engine-country-agnostic.test.ts`, `tests/server/vault-store.test.ts`, `tests/server/vault-policy.test.ts`, `tests/server/vault-submit.test.ts`, `tests/server/adapter-authority.test.ts`, `tests/lib/partner-port.test.ts`, `tests/server/partner-webhook.test.ts`, `tests/server/cases.roundtrip.test.ts` and `tests/domain/stage-engine.test.ts` are green.

Run: `npm run build`

Expected: PASS. If Next 15 rejects `experimental.serverActions`, move `bodySizeLimit` to top-level `serverActions` (keep the test regex) and rebuild.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/demo-script-document-vault.md docs/superpowers/plans/demo-script-market-packs.md docs/superpowers/plans/demo-script-corridor-packs.md docs/superpowers/plans/demo-script-core-portal.md docs/superpowers/plans/demo-script-speed-rails.md README.md
git commit -m "docs: add document vault demo script and flag matrix"
```

---

## Self-review (author)

**Spec coverage**
- §6 client "tasks/docs" → Task 7 portal heading + `VaultUploadForm`.
- §6 partner "upload evidence" → Task 5 partner action + Task 7 partner page.
- §8 vault object, role ACL, one-time upload → Tasks 1–6.
- §5 freemium / IP behind paid → Task 1 `FREE_DIY` → `NONE`; no vault UI.
- §8 country-agnostic engine → Task 1 + Task 3 files on the country-agnostic scan.
- Fail closed / ew-only / `hard_client_sla` off → Tasks 3 and 8.
- Adapters cannot bypass ACL → Tasks 4 and 8 (`adapter-authority`, empty lookup).
- No S3, no base64 column → Tasks 2–3.

**Placeholder scan:** no TBD / later / similar-to-Task-N leftovers in normative steps.

**Type consistency:** `VaultDocumentRecord`, `VaultPresenceLookup`, `VaultActionResult`, `canUseVault`, `assertVaultSubmitAllowed`, `performVaultUpload`, `performVaultReset`, `authorizeVaultDownload`, `allowAllVaultLookup`, `emptyVaultLookup` keep the same names from Task 1 through Task 9.

**Frozen-shape risk:** `submitEvidence` / `submitPartnerEvidence` gain an optional `vault` argument only. Existing callers omit it and stay green until Task 8, when `ew` paid port tests inject `allowAllVaultLookup`. `Evidence` stays metadata. `ManualPartnerPort` constructor gains an optional second argument; one-arg callers still type-check.
