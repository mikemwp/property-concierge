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
