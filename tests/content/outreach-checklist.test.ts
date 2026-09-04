import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isDiasporaLead, parseAttribution } from "../../src/domain/attribution";
import { FORBIDDEN_CLAIM_PATTERNS } from "../../src/content/marketing";

const checklist = readFileSync(
  path.resolve(__dirname, "../../docs/playbooks/diaspora-outreach-checklist.md"),
  "utf8",
);

describe("diaspora outreach checklist", () => {
  it("covers the sections a founder needs to run outreach", () => {
    for (const heading of [
      "## Who we are talking to",
      "## Weekly rhythm",
      "## Tracking links",
      "## Message templates",
      "## What we never say",
      "## Definition of done",
    ]) {
      expect(checklist).toContain(heading);
    }
  });

  it("only uses tracking tags the app resolves to diaspora leads", () => {
    const tags = [...checklist.matchAll(/utm_source=([a-z0-9-]+)/g)].map(
      (match) => match[1],
    );
    expect(tags.length).toBeGreaterThanOrEqual(3);

    for (const tag of tags) {
      const parsed = parseAttribution({ utm_source: tag });
      expect(
        isDiasporaLead(parsed.leadSource),
        `utm_source=${tag} resolved to ${parsed.leadSource}`,
      ).toBe(true);
    }
  });

  it("makes no forbidden claims", () => {
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      const match = checklist.match(pattern);
      expect(match?.[0] ?? null, `checklist matches ${pattern}`).toBeNull();
    }
  });

  it("names the two v1 validation goals", () => {
    expect(checklist).toMatch(/10[–-]20 households/);
    expect(checklist).toMatch(/1[–-]2 (diaspora )?communities/i);
  });
});
