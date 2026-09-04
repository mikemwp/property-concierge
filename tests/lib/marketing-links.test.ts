import { describe, it, expect } from "vitest";
import { attributionParamsFrom, startHref } from "../../src/lib/marketing-links";

describe("startHref", () => {
  it("always carries the chosen plan", () => {
    expect(startHref({ plan: "paid" })).toBe("/start?plan=paid");
    expect(startHref({ plan: "free" })).toBe("/start?plan=free");
  });

  it("carries entry context and attribution params through the funnel", () => {
    expect(
      startHref({
        plan: "paid",
        entryContext: "RETURNER_OVERSEAS",
        params: { utm_source: "poms-in-oz", utm_campaign: "sept", ref: "sarah" },
      }),
    ).toBe(
      "/start?plan=paid&entry=RETURNER_OVERSEAS&utm_source=poms-in-oz&utm_campaign=sept&ref=sarah",
    );
  });

  it("omits blank params", () => {
    expect(
      startHref({ plan: "free", params: { utm_source: "  ", ref: null } }),
    ).toBe("/start?plan=free");
  });
});

describe("attributionParamsFrom", () => {
  it("takes the first value of repeated params and nulls the rest", () => {
    expect(
      attributionParamsFrom({
        utm_source: ["au-uk", "ignored"],
        utm_campaign: "sept",
        plan: "paid",
      }),
    ).toEqual({
      utm_source: "au-uk",
      utm_medium: null,
      utm_campaign: "sept",
      ref: null,
    });
  });
});
