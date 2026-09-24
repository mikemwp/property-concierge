import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { vaultStorageKey } from "../../src/domain/vault";
import {
  createVaultStorage,
  getVaultStorage,
  LocalVaultStorage,
  readS3VaultConfig,
  S3VaultStorage,
  setVaultStorageForTests,
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
