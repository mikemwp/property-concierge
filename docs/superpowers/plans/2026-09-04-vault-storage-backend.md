# Vault Storage Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `VaultStorageBackend` interface in front of vault bytes: `LocalVaultStorage` preserves today’s `VAULT_ROOT` filesystem behaviour; `S3VaultStorage` is a stub that throws unless S3 env is configured and still does not talk to AWS; a factory picks the backend. CI stays on local disk. No real AWS account or SDK is required.

**Architecture:** Extract the byte I/O that already lives in `src/server/vault-store.ts`. Prisma metadata (`VaultDocument`) does not move. Domain ACL / one-time upload does not move.

1. **Port** (`VaultStorageBackend`) — `kind`, sync `write` / `read` of `storageKey` → bytes.
2. **Local adapter** — current `writeVaultBytes` / `readVaultBytes` / `vaultRoot` behaviour.
3. **S3 stub** — constructs with optional config; `write` / `read` throw `S3_NOT_CONFIGURED` when env is missing, or `S3_NOT_IMPLEMENTED` when env is present. No `@aws-sdk/client-s3` dependency.
4. **Factory** — `createVaultStorage(env)` returns local unless `VAULT_STORAGE=s3`.

**The invariant that makes this a backend and not an S3 product:** production CI and default `npm test` never set `VAULT_STORAGE=s3`. Download and upload keep calling `writeVaultBytes` / `readVaultBytes`, which become facades over `getVaultStorage()`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript ~5.8, Prisma 6 + SQLite, Node `fs` / `path`, Vitest 3. No AWS SDK.

**Spec:** `docs/superpowers/specs/2026-09-04-property-concierge-design.md` (§8 document vault). Plan 8 locked “no S3 in this plan”; this plan adds the seam only.

**Builds on (already shipped, do not rebuild):**
- Plan 8 — `src/domain/vault.ts` (`vaultStorageKey`, `assertSafeStorageKey`), `src/server/vault-store.ts`, `src/server/vault.ts`, `GET /api/vault/[documentId]`.
- Plan 13 — `document_vault` on for `ew` + four corridor packs. Leave those flags untouched.

**Follow-on plans (not this plan):** a real S3 client, presigned URLs, bucket IAM, enabling `VAULT_STORAGE=s3` in production.

**Current main:** `c2437b7` was Plan 9. This plan assumes Plans 10–13 are merged.

## Global Constraints

Copied from the spec and the Plan 14 brief. Every task’s requirements implicitly include this section.

- **No real AWS in CI.** Do not add `@aws-sdk/*`, `aws-sdk`, or network calls. Tests must pass with unset S3 env.
- **Local remains the default.** `VAULT_STORAGE` unset or `local` → `LocalVaultStorage`. `VAULT_ROOT` still defaults to `var/vault`.
- **S3 stub throws.** Missing `VAULT_S3_BUCKET` or `VAULT_S3_REGION` → `S3_NOT_CONFIGURED`. Both present → `S3_NOT_IMPLEMENTED` on `write` / `read`. Never silently no-op.
- **Do not move metadata.** `insertVaultDocument` / `findActiveVaultDocument` stay in `vault-store.ts` and keep using Prisma.
- **Do not change ACL, MIME rules, or one-time upload.** `assertSafeStorageKey` still wraps every path.
- **Country-agnostic:** no jurisdiction literals in `src/server/vault-storage.ts`.
- **Leave module flags alone.** This plan does not edit `MarketFlags`.
- **Engineering:** TDD per task; `npm test` stays green after each task’s own files; `npm test` + `npm run build` pass at the end; DRY, YAGNI.

## Locked design decisions

**Interface (locked):**

```ts
export type VaultStorageKind = "local" | "s3";

export type VaultStorageBackend = {
  readonly kind: VaultStorageKind;
  write(storageKey: string, bytes: Uint8Array): void;
  read(storageKey: string): Uint8Array;
};

export type VaultStorageErrorCode = "S3_NOT_CONFIGURED" | "S3_NOT_IMPLEMENTED" | "UNKNOWN_DRIVER";

export type S3VaultConfig = {
  bucket: string;
  region: string;
  prefix: string;
};
```

**Env (locked):**

| Variable | Default | Meaning |
|---|---|---|
| `VAULT_STORAGE` | `local` | `local` or `s3` |
| `VAULT_ROOT` | `{cwd}/var/vault` | local root (existing) |
| `VAULT_S3_BUCKET` | unset | required for configured S3 stub |
| `VAULT_S3_REGION` | unset | required for configured S3 stub |
| `VAULT_S3_PREFIX` | `vault` | key prefix only; unused until a real client exists |

`readS3VaultConfig(env)` returns `null` unless **both** bucket and region are non-empty strings.

**Factory (locked):**

```ts
export function createVaultStorage(env: NodeJS.ProcessEnv = process.env): VaultStorageBackend
```

- `VAULT_STORAGE` unset / `local` / empty → `new LocalVaultStorage(env.VAULT_ROOT ?? defaultRoot())`
- `VAULT_STORAGE=s3` → `new S3VaultStorage(readS3VaultConfig(env))`
- any other driver → throw `VaultStorageError("UNKNOWN_DRIVER", ...)`

**Process singleton for production wiring:**

```ts
export function getVaultStorage(): VaultStorageBackend
export function setVaultStorageForTests(backend: VaultStorageBackend | null): void
```

`getVaultStorage()` lazy-inits via `createVaultStorage()`. Tests call `setVaultStorageForTests(null)` to reset.

**Facades stay:** `writeVaultBytes` / `readVaultBytes` / `vaultRoot` remain exported from `vault-store.ts` so `src/server/vault.ts` and the download route do not need a wide rewrite. They delegate to the backend. `vaultRoot()` keeps returning the local path (used by tests and `.gitignore`); it does not throw on the S3 stub.

## File structure (locked)

```
src/server/
  vault-storage.ts                             # NEW (Tasks 1–4)
  vault-store.ts                               # MODIFY (Task 5): facades
  vault.ts                                     # UNCHANGED callers if facades hold
src/app/api/vault/[documentId]/route.ts        # UNCHANGED if it still imports readVaultBytes
tests/server/
  vault-storage.test.ts                        # NEW (Tasks 1–4)
  vault-store.test.ts                          # MODIFY (Task 5) only if vaultRoot / write path changes
  vault-download.test.ts                       # UNCHANGED unless import path breaks
docs/superpowers/plans/
  demo-script-document-vault.md                # MODIFY (Task 6)
README.md                                      # MODIFY (Task 6)
```

**Layering rule:** `vault-storage.ts` may import `assertSafeStorageKey` from `src/domain/vault.ts` and Node `fs` / `path`. It must not import Prisma, Next, market packs, or AWS SDKs. `vault-store.ts` is the only module that imports both Prisma and `getVaultStorage`.

---

### Task 1: `VaultStorageBackend` + `LocalVaultStorage`

**Files:**
- Create: `src/server/vault-storage.ts` (Local + error + types; S3 and factory come in later tasks — include type stubs only if needed to compile). For this task, export Local + error + types only.
- Create: `tests/server/vault-storage.test.ts`
- Modify: `tests/domain/engine-country-agnostic.test.ts` — add `"src/server/vault-storage.ts"` to `ENGINE_GLOBAL_FILES`

**Interfaces:**
- Consumes: `assertSafeStorageKey` from `src/domain/vault.ts`.
- Produces: `VaultStorageKind`, `VaultStorageBackend`, `VaultStorageError`, `VaultStorageErrorCode`, `S3VaultConfig`, `LocalVaultStorage`, `defaultVaultRoot()`.

- [ ] **Step 1: Write the failing local-backend tests**

Create `tests/server/vault-storage.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { vaultStorageKey } from "../../src/domain/vault";
import {
  LocalVaultStorage,
  VaultStorageError,
} from "../../src/server/vault-storage";

let root = "";

afterEach(() => {
  if (root) {
    rmSync(root, { recursive: true, force: true });
    root = "";
  }
});

describe("LocalVaultStorage", () => {
  it("writes and reads bytes under the given root using a safe storage key", () => {
    root = mkdtempSync(path.join(tmpdir(), "vault-local-"));
    const backend = new LocalVaultStorage(root);
    expect(backend.kind).toBe("local");
    const key = vaultStorageKey("caseA", "docA");
    const bytes = new Uint8Array([37, 80, 68, 70]);
    backend.write(key, bytes);
    expect(Array.from(backend.read(key))).toEqual([37, 80, 68, 70]);
  });

  it("rejects an unsafe storage key before touching disk", () => {
    root = mkdtempSync(path.join(tmpdir(), "vault-local-"));
    const backend = new LocalVaultStorage(root);
    expect(() => backend.write("../etc/passwd", new Uint8Array([1]))).toThrow();
  });
});

describe("VaultStorageError", () => {
  it("is a typed error", () => {
    const err = new VaultStorageError("S3_NOT_CONFIGURED", "missing bucket");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("VaultStorageError");
    expect(err.code).toBe("S3_NOT_CONFIGURED");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/vault-storage.test.ts`

Expected: FAIL with `Cannot find module '../../src/server/vault-storage'`.

- [ ] **Step 3: Implement Local + error**

Create `src/server/vault-storage.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertSafeStorageKey } from "../domain/vault";

export type VaultStorageKind = "local" | "s3";

export type VaultStorageBackend = {
  readonly kind: VaultStorageKind;
  write(storageKey: string, bytes: Uint8Array): void;
  read(storageKey: string): Uint8Array;
};

export type VaultStorageErrorCode = "S3_NOT_CONFIGURED" | "S3_NOT_IMPLEMENTED" | "UNKNOWN_DRIVER";

export class VaultStorageError extends Error {
  constructor(
    public code: VaultStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VaultStorageError";
  }
}

export type S3VaultConfig = {
  bucket: string;
  region: string;
  prefix: string;
};

export function defaultVaultRoot(cwd: string = process.cwd()): string {
  return path.join(cwd, "var", "vault");
}

export class LocalVaultStorage implements VaultStorageBackend {
  readonly kind = "local" as const;

  constructor(private readonly root: string) {}

  write(storageKey: string, bytes: Uint8Array): void {
    const full = this.absolutePath(storageKey);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  }

  read(storageKey: string): Uint8Array {
    return new Uint8Array(readFileSync(this.absolutePath(storageKey)));
  }

  private absolutePath(storageKey: string): string {
    assertSafeStorageKey(storageKey);
    return path.join(this.root, ...storageKey.split("/"));
  }
}
```

Add `"src/server/vault-storage.ts"` to `ENGINE_GLOBAL_FILES`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/vault-storage.test.ts tests/domain/engine-country-agnostic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/vault-storage.ts tests/server/vault-storage.test.ts tests/domain/engine-country-agnostic.test.ts
git commit -m "feat: extract LocalVaultStorage behind a vault storage port"
```

---

### Task 2: `S3VaultStorage` stub

**Files:**
- Modify: `src/server/vault-storage.ts`
- Modify: `tests/server/vault-storage.test.ts`

**Interfaces:**
- Consumes: `S3VaultConfig`, `VaultStorageError`.
- Produces: `readS3VaultConfig(env?: NodeJS.ProcessEnv): S3VaultConfig | null`, `S3VaultStorage`.

- [ ] **Step 1: Write the failing S3 tests**

Append to `tests/server/vault-storage.test.ts`:

```ts
import { readS3VaultConfig, S3VaultStorage } from "../../src/server/vault-storage";

describe("S3VaultStorage stub", () => {
  it("reads config only when bucket and region are both set", () => {
    expect(readS3VaultConfig({})).toBeNull();
    expect(readS3VaultConfig({ VAULT_S3_BUCKET: "docs" })).toBeNull();
    expect(readS3VaultConfig({ VAULT_S3_REGION: "eu-west-2" })).toBeNull();
    expect(readS3VaultConfig({ VAULT_S3_BUCKET: "docs", VAULT_S3_REGION: "eu-west-2" })).toEqual({
      bucket: "docs",
      region: "eu-west-2",
      prefix: "vault",
    });
    expect(
      readS3VaultConfig({
        VAULT_S3_BUCKET: "docs",
        VAULT_S3_REGION: "eu-west-2",
        VAULT_S3_PREFIX: "prod",
      }),
    ).toEqual({ bucket: "docs", region: "eu-west-2", prefix: "prod" });
  });

  it("throws S3_NOT_CONFIGURED when env is missing", () => {
    const backend = new S3VaultStorage(null);
    expect(backend.kind).toBe("s3");
    try {
      backend.write("caseA/docA", new Uint8Array([1]));
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(VaultStorageError);
      expect((err as VaultStorageError).code).toBe("S3_NOT_CONFIGURED");
    }
    expect(() => backend.read("caseA/docA")).toThrow(VaultStorageError);
  });

  it("throws S3_NOT_IMPLEMENTED when env is configured — no AWS client", () => {
    const backend = new S3VaultStorage({
      bucket: "docs",
      region: "eu-west-2",
      prefix: "vault",
    });
    try {
      backend.read("caseA/docA");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(VaultStorageError);
      expect((err as VaultStorageError).code).toBe("S3_NOT_IMPLEMENTED");
    }
  });
});
```

Merge the import with the existing `vault-storage` import instead of adding a second import if the file already imports from that module.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/vault-storage.test.ts`

Expected: FAIL — `S3VaultStorage` / `readS3VaultConfig` are not exported.

- [ ] **Step 3: Implement the stub**

Append to `src/server/vault-storage.ts`:

```ts
export function readS3VaultConfig(
  env: NodeJS.ProcessEnv = process.env,
): S3VaultConfig | null {
  const bucket = env.VAULT_S3_BUCKET?.trim();
  const region = env.VAULT_S3_REGION?.trim();
  if (!bucket || !region) {
    return null;
  }
  const prefix = env.VAULT_S3_PREFIX?.trim() || "vault";
  return { bucket, region, prefix };
}

export class S3VaultStorage implements VaultStorageBackend {
  readonly kind = "s3" as const;

  constructor(private readonly config: S3VaultConfig | null) {}

  write(_storageKey: string, _bytes: Uint8Array): void {
    this.assertReady();
    throw new VaultStorageError(
      "S3_NOT_IMPLEMENTED",
      "S3 vault storage is a stub; use local storage in this environment",
    );
  }

  read(_storageKey: string): Uint8Array {
    this.assertReady();
    throw new VaultStorageError(
      "S3_NOT_IMPLEMENTED",
      "S3 vault storage is a stub; use local storage in this environment",
    );
  }

  private assertReady(): void {
    if (!this.config) {
      throw new VaultStorageError(
        "S3_NOT_CONFIGURED",
        "VAULT_S3_BUCKET and VAULT_S3_REGION are required for S3 vault storage",
      );
    }
  }
}
```

Do not import AWS. Do not add packages.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/vault-storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/vault-storage.ts tests/server/vault-storage.test.ts
git commit -m "feat: add S3VaultStorage stub that throws without a real AWS client"
```

---

### Task 3: Factory

**Files:**
- Modify: `src/server/vault-storage.ts`
- Modify: `tests/server/vault-storage.test.ts`

**Interfaces:**
- Consumes: `LocalVaultStorage`, `S3VaultStorage`, `readS3VaultConfig`, `defaultVaultRoot`.
- Produces: `createVaultStorage(env?: NodeJS.ProcessEnv): VaultStorageBackend`.

- [ ] **Step 1: Write the failing factory tests**

Append to `tests/server/vault-storage.test.ts`:

```ts
import { createVaultStorage } from "../../src/server/vault-storage";

describe("createVaultStorage", () => {
  it("defaults to local and honours VAULT_ROOT", () => {
    root = mkdtempSync(path.join(tmpdir(), "vault-factory-"));
    const backend = createVaultStorage({ VAULT_ROOT: root });
    expect(backend.kind).toBe("local");
    backend.write("caseB/docB", new Uint8Array([9]));
    expect(Array.from(backend.read("caseB/docB"))).toEqual([9]);
    expect(createVaultStorage({ VAULT_STORAGE: "local", VAULT_ROOT: root }).kind).toBe("local");
    expect(createVaultStorage({}).kind).toBe("local");
  });

  it("returns the S3 stub when VAULT_STORAGE=s3 and does not require AWS", () => {
    const unconfigured = createVaultStorage({ VAULT_STORAGE: "s3" });
    expect(unconfigured.kind).toBe("s3");
    expect(() => unconfigured.write("caseB/docB", new Uint8Array([1]))).toThrowError(
      /VAULT_S3_BUCKET/,
    );
    const configured = createVaultStorage({
      VAULT_STORAGE: "s3",
      VAULT_S3_BUCKET: "docs",
      VAULT_S3_REGION: "eu-west-2",
    });
    expect(configured.kind).toBe("s3");
    expect(() => configured.read("caseB/docB")).toThrowError(/stub/i);
  });

  it("rejects an unknown driver", () => {
    expect(() => createVaultStorage({ VAULT_STORAGE: "gcs" })).toThrow(VaultStorageError);
    try {
      createVaultStorage({ VAULT_STORAGE: "gcs" });
    } catch (err) {
      expect((err as VaultStorageError).code).toBe("UNKNOWN_DRIVER");
    }
  });
});
```

`root` is already declared in Task 1’s `afterEach`. Reuse it.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/vault-storage.test.ts`

Expected: FAIL — `createVaultStorage` is not exported.

- [ ] **Step 3: Implement the factory**

Append to `src/server/vault-storage.ts`:

```ts
export function createVaultStorage(
  env: NodeJS.ProcessEnv = process.env,
): VaultStorageBackend {
  const driver = (env.VAULT_STORAGE ?? "local").trim() || "local";
  if (driver === "local") {
    return new LocalVaultStorage(env.VAULT_ROOT?.trim() || defaultVaultRoot());
  }
  if (driver === "s3") {
    return new S3VaultStorage(readS3VaultConfig(env));
  }
  throw new VaultStorageError("UNKNOWN_DRIVER", `Unknown vault storage driver: ${driver}`);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/vault-storage.test.ts`

Expected: PASS. Confirm `package.json` still has no `aws-sdk` / `@aws-sdk` dependency.

- [ ] **Step 5: Commit**

```bash
git add src/server/vault-storage.ts tests/server/vault-storage.test.ts
git commit -m "feat: choose local or S3 stub vault storage from env"
```

---

### Task 4: Process singleton for tests and production wiring

**Files:**
- Modify: `src/server/vault-storage.ts`
- Modify: `tests/server/vault-storage.test.ts`

**Interfaces:**
- Produces: `getVaultStorage()`, `setVaultStorageForTests(backend: VaultStorageBackend | null)`.

- [ ] **Step 1: Write the failing singleton tests**

Append:

```ts
import { getVaultStorage, setVaultStorageForTests } from "../../src/server/vault-storage";

describe("getVaultStorage", () => {
  afterEach(() => {
    setVaultStorageForTests(null);
    delete process.env.VAULT_STORAGE;
  });

  it("lazy-inits from process.env and can be replaced in tests", () => {
    setVaultStorageForTests(null);
    const first = getVaultStorage();
    expect(first.kind).toBe("local");
    expect(getVaultStorage()).toBe(first);
    const replacement = new S3VaultStorage(null);
    setVaultStorageForTests(replacement);
    expect(getVaultStorage()).toBe(replacement);
    setVaultStorageForTests(null);
    expect(getVaultStorage().kind).toBe("local");
  });
});
```

Import `afterEach` is already present. Import `getVaultStorage` / `setVaultStorageForTests` from the same module import.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/server/vault-storage.test.ts`

Expected: FAIL — `getVaultStorage` is not exported.

- [ ] **Step 3: Implement the singleton**

Append to `src/server/vault-storage.ts`:

```ts
let current: VaultStorageBackend | null = null;

export function getVaultStorage(): VaultStorageBackend {
  if (!current) {
    current = createVaultStorage();
  }
  return current;
}

export function setVaultStorageForTests(backend: VaultStorageBackend | null): void {
  current = backend;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/server/vault-storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/vault-storage.ts tests/server/vault-storage.test.ts
git commit -m "feat: cache the vault storage backend for process lifetime"
```

---

### Task 5: Wire `vault-store` facades through the backend

**Files:**
- Modify: `src/server/vault-store.ts`
- Modify: `tests/server/vault-store.test.ts` only if `vaultRoot` behaviour needs an extra assertion

**Interfaces:**
- Consumes: `getVaultStorage`, `defaultVaultRoot`, `LocalVaultStorage`.
- Produces: `writeVaultBytes` / `readVaultBytes` delegate to `getVaultStorage()`; `vaultRoot()` still returns `process.env.VAULT_ROOT ?? defaultVaultRoot()`.

- [ ] **Step 1: Write the failing facade assertion**

Add to `tests/server/vault-store.test.ts` (in the existing describe, after the current example):

```ts
  it("delegates byte I/O through getVaultStorage", async () => {
    const storeSource = readFileSync(
      path.resolve(process.cwd(), "src/server/vault-store.ts"),
      "utf8",
    );
    expect(storeSource).toMatch(/getVaultStorage/);
    expect(storeSource).toMatch(/\.write\(/);
    expect(storeSource).toMatch(/\.read\(/);
  });
```

Add `readFileSync` to the `node:fs` import in that file (`mkdtempSync` / `rmSync` are already imported).

- [ ] **Step 2: Run the store tests and confirm the new example fails**

Run: `npx vitest run tests/server/vault-store.test.ts`

Expected: FAIL — `vault-store.ts` does not mention `getVaultStorage`. Existing disk tests still pass.

- [ ] **Step 3: Replace the local helpers with facades**

In `src/server/vault-store.ts`:

1. Import `defaultVaultRoot`, `getVaultStorage` from `./vault-storage`.
2. Keep `import { mkdirSync, readFileSync, writeFileSync }` **only if** something else in the file still needs `fs`. After this change they should be unused — delete the `node:fs` import and the private `absolutePath` function.
3. Replace `vaultRoot` / `writeVaultBytes` / `readVaultBytes` with:

```ts
export function vaultRoot(): string {
  return process.env.VAULT_ROOT ?? defaultVaultRoot();
}

export function writeVaultBytes(storageKey: string, bytes: Uint8Array): void {
  getVaultStorage().write(storageKey, bytes);
}

export function readVaultBytes(storageKey: string): Uint8Array {
  return getVaultStorage().read(storageKey);
}
```

Keep every Prisma function (`insertVaultDocument`, `findActiveVaultDocument`, `listVaultDocuments`, `markVaultDocumentReset`, `getVaultDocumentById`, `toVaultDocumentRecord`) unchanged.

`src/server/vault.ts` and `src/app/api/vault/[documentId]/route.ts` keep importing `writeVaultBytes` / `readVaultBytes` from `vault-store`. Do not change those call sites unless the import path breaks.

- [ ] **Step 4: Run store + download + policy tests**

Run: `npx vitest run tests/server/vault-store.test.ts tests/server/vault-storage.test.ts tests/server/vault-download.test.ts tests/server/vault-policy.test.ts tests/server/vault-submit.test.ts`

Expected: PASS. `vault-store` still writes under `VAULT_ROOT` because the existing `beforeAll` sets `process.env.VAULT_ROOT` **before** the first `writeVaultBytes` call. If a test file imported `vault-store` before setting `VAULT_ROOT` and now reads the singleton, call `setVaultStorageForTests(null)` in that file’s `beforeAll` after assigning `VAULT_ROOT`. Do that only if a test fails for that reason.

- [ ] **Step 5: Commit**

```bash
git add src/server/vault-store.ts tests/server/vault-store.test.ts
git commit -m "refactor: send vault byte I/O through the storage backend"
```

---

### Task 6: README and vault demo script

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/demo-script-document-vault.md`

**Interfaces:**
- Produces: docs that state local is default, S3 is a throwing stub, CI needs no AWS.

- [ ] **Step 1: Update the vault demo Absent / Real table**

In `docs/superpowers/plans/demo-script-document-vault.md` What is real / absent:

| Layer | Status after this plan |
|-------|--------|
| **Real** | `VaultStorageBackend`; `LocalVaultStorage` under `var/vault/` or `VAULT_ROOT`; factory; Prisma metadata unchanged |
| **Stubbed** | `S3VaultStorage` throws `S3_NOT_CONFIGURED` or `S3_NOT_IMPLEMENTED` |
| **Absent** | `@aws-sdk/client-s3`, presigned URLs, production `VAULT_STORAGE=s3` |

Add a short section:

```md
## 6. Storage backend (local default)

1. Default upload still lands under `var/vault/` (or `VAULT_ROOT` in tests).
2. Setting `VAULT_STORAGE=s3` without `VAULT_S3_BUCKET` / `VAULT_S3_REGION` makes the next write throw. Do not set this in CI.
3. There is no AWS package in `package.json`.
```

- [ ] **Step 2: Update README**

In the Document vault section, replace “No S3 in this release.” with:

```md
Bytes go through `VaultStorageBackend`. Default driver is `LocalVaultStorage`
(`VAULT_ROOT`, otherwise `var/vault/`). `VAULT_STORAGE=s3` selects `S3VaultStorage`,
a stub that throws unless `VAULT_S3_BUCKET` and `VAULT_S3_REGION` are set, and
still throws `S3_NOT_IMPLEMENTED` when they are — no AWS SDK and no CI
dependency on a real bucket.
```

- [ ] **Step 3: Full verification**

Run: `npm test` then `npm run build`

Expected: PASS. `npm ls @aws-sdk/client-s3` reports empty / not installed.

- [ ] **Step 4: Grep for accidental AWS imports**

Search `src` and `package.json` for `aws-sdk` and `@aws-sdk`. Expected: no matches except this plan’s docs.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/plans/demo-script-document-vault.md
git commit -m "docs: describe local vault storage and the S3 stub"
```

---

## Self-review

**Spec coverage:**
- §8 vault binaries stay off-SQLite → Local adapter writes files, not base64 columns (Task 1, 5).
- Plan 8 follow-on “S3 / cloud object storage” → seam only, not a live bucket (Tasks 2–3).

**Placeholder scan:** S3 methods have exact throw codes; no “call AWS here later” comments that compile to no-ops.

**Type consistency:** `VaultStorageBackend.write/read` stay synchronous; facades stay synchronous; factory returns the same interface.

**Non-goals honoured:** no AWS SDK, no presigned URLs, no flag edits, no Prisma change, no second vault ACL.
