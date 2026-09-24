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
