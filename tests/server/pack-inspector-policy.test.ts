import { describe, it, expect } from "vitest";
import {
  assertPackInspectorVisible,
  CockpitPolicyError,
} from "../../src/server/cockpit-policy";

describe("pack inspector visibility", () => {
  it("is advisor-only operating IP", () => {
    expect(() => assertPackInspectorVisible("ADVISOR")).not.toThrow();
    for (const role of ["CLIENT", "MORTGAGE_PARTNER", "CONVEYANCER", "MOVE_PARTNER"] as const) {
      expect(() => assertPackInspectorVisible(role)).toThrow(CockpitPolicyError);
    }
    expect(() => assertPackInspectorVisible("CLIENT")).toThrow(/advisor-only/i);
  });
});
