import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), relative), "utf8");
}

describe("thread surfaces", () => {
  it("mounts ThreadPanel on the paid portal path and keeps it off the free attestation form", () => {
    const portal = read("src/app/portal/cases/[caseId]/page.tsx");
    const panel = read("src/components/ThreadPanel.tsx");

    expect(portal).toContain("canUseThreads");
    expect(portal).toContain("ThreadPanel");
    expect(portal).toContain("loadVisibleCaseMessages");
    expect(portal).toContain("UpgradeCallout");
    expect(panel).toContain("Case thread");
    expect(panel).toContain("postCaseMessageAction");
    expect(panel).toContain("whitespace-pre-wrap");
    expect(panel).not.toContain("dangerouslySetInnerHTML");
    expect(panel).not.toMatch(/WebSocket|socket\.io|EventSource|Pusher|Ably/i);
    expect(panel).toMatch(/Refresh to see new posts|not a live chat/i);
    expect(panel).toContain('name="body"');
  });
});
