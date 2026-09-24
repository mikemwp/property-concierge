import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(path.resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const seed = readFileSync(path.resolve(process.cwd(), "prisma/seed.ts"), "utf8");
const store = readFileSync(path.resolve(process.cwd(), "src/server/thread-store.ts"), "utf8");

describe("CaseMessage is the append-only audit trail", () => {
  it("declares the brief columns, cascades from Case, and has no mutation columns", () => {
    expect(schema).toMatch(/model CaseMessage \{[\s\S]*caseId\s+String/);
    expect(schema).toMatch(/authorUserId\s+String/);
    expect(schema).toMatch(/authorRole\s+String/);
    expect(schema).toMatch(/body\s+String/);
    expect(schema).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(schema).toMatch(/messages\s+CaseMessage\[\]/);
    expect(schema).toMatch(/onDelete:\s*Cascade/);
    expect(schema).not.toMatch(/model CaseMessage \{[\s\S]*updatedAt/);
    expect(schema).not.toMatch(/model CaseMessage \{[\s\S]*deletedAt/);
  });

  it("wipes messages in seed and never updates or deletes from the store", () => {
    expect(seed).toMatch(/caseMessage\.deleteMany/);
    expect(seed).toMatch(/Welcome to the Bloggs case thread/);
    expect(store).not.toMatch(/caseMessage\.(update|updateMany|delete|deleteMany)/);
  });
});
