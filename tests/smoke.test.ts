import { describe, it, expect } from "vitest";

describe("scaffold", () => {
  it("loads the domain package path alias", async () => {
    const mod = await import("../src/domain/types");
    expect(mod).toBeTruthy();
  });
});
