# Demo script — acquisition funnel and ops playbook

Assumes `npm run db:push && npm run db:seed && npm run dev`.

## 1. The tracked visit (2 min)

1. Open `http://localhost:3000/?utm_source=poms-in-oz&utm_medium=community`.
2. Point out: paid CTA is primary and appears first; the free CTA is secondary.
3. Open an entry story from the nav (`AU → UK`) or a homepage story card — the
   URL keeps `utm_source` and `utm_medium`. Pricing in the nav does the same.
   The paid CTA then carries both the entry context and the campaign tag into
   `/start`.

## 2. Self-serve signup (3 min)

1. Click **Start Done-With-You**. The form is pre-set to paid and to the entry
   context from the story.
2. Sign up as `demo-returner@example.com` / `returning2026`, region `Bristol`.
3. You land in the client portal on a real case at `purchase_profile`.
4. Show the free path too: `/start?plan=free&utm_source=brits-in-america` — the
   copy explicitly says what free withholds and links back to paid.

## 3. Advisor operating IP (3 min)

1. Sign in as `advisor@example.com` / `password`, open the new case.
2. The **Advisor playbook** panel shows the objective, dated actions, evidence
   standard, escalation ladder and partner script — branched for a returner who
   is still overseas.
3. Sign back in as the client: none of that text appears anywhere in the portal.

## 4. Upgrade and re-context (2 min)

1. As the advisor, open the seeded free case **Smith DIY journey**.
2. **Upgrade to Done-With-You** → the client portal immediately shows named
   owners, day counters and evidence submission.
3. Change the entry context to *Returner — still overseas* → the money stage now
   requires an FX plan and the move stage requires a vehicle path.

## 5. The scoreboard (2 min)

1. Open `/cockpit/funnel`.
2. Paid households against the 10-household validation target, paid conversion,
   diaspora-sourced count, and the breakdown by community and entry context.
3. Tie it back to `docs/playbooks/diaspora-outreach-checklist.md`: every tracked
   link in that doc lands in this table.
