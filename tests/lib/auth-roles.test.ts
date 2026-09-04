import { describe, it, expect } from "vitest";
import { roleCanAccess } from "../../src/lib/auth-roles";

describe("roleCanAccess", () => {
  it("allows advisor into cockpit", () => {
    expect(roleCanAccess("ADVISOR", "cockpit")).toBe(true);
    expect(roleCanAccess("CLIENT", "cockpit")).toBe(false);
    expect(roleCanAccess("CONVEYANCER", "partner")).toBe(true);
  });
});
