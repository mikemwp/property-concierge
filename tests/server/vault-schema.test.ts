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
