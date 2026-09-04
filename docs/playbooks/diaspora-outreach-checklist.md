# Diaspora outreach checklist

Founder-facing operating content. This is a checklist, not a CRM — the case
ledger in the cockpit is the system of record, and `/cockpit/funnel` is the
scoreboard.

## Who we are talking to

Two communities, deliberately narrow. Depth beats spread: we want to be the
name that gets repeated in a thread, not a link seen once in five groups.

| Community | Where they gather | The moment they need us |
|---|---|---|
| Brits and dual nationals in Australia | Expat Facebook groups, city-based WhatsApp groups, shipping and visa forums, alumni networks | Six to eighteen months before flying, when the deposit is still in AUD and nobody has mentioned the UK credit file |
| Brits and dual nationals in the United States | Expat subreddits, city meetups, employer relocation networks, school-year parent groups | When the return date is set by a school term or a job end date and the purchase has to fit around it |

Pick one primary community and one secondary. Do not add a third until the
primary has produced repeat referrals without prompting.

## Weekly rhythm

- [ ] **Monday — listen.** Read the two communities. Note every purchase or
      move question. Do not reply yet.
- [ ] **Tuesday — answer three.** Write three genuinely useful replies with no
      link. Answer the actual question. Sign off with who you are.
- [ ] **Wednesday — one long-form post.** One community, one post, one tracked
      link. Rotate communities weekly so you are never the person who only posts.
- [ ] **Thursday — one warm conversation.** A group admin, a returner who has
      just landed, or a partner who serves the same community.
- [ ] **Friday — close the loop.** Debrief any case that completed a stage this
      week and ask the household directly whether they would name us in their
      community. Log the answer in the case thread.
- [ ] **Friday — check the scoreboard.** Open `/cockpit/funnel`. Paid households
      versus target, and how many came from each community.

## Tracking links

Every link you post carries a tag. Untracked links make the validation metric
worthless. Only these tags are recognised by the app.

| Placement | Link |
|---|---|
| AU community post | `https://<host>/stories/returning-from-australia?utm_source=poms-in-oz&utm_medium=community` |
| AU general / newsletter | `https://<host>/?utm_source=au-uk&utm_medium=community` |
| US community post | `https://<host>/stories/returning-from-the-usa?utm_source=brits-in-america&utm_medium=community` |
| US general / newsletter | `https://<host>/?utm_source=us-uk&utm_medium=community` |
| Personal referral from a past client | `https://<host>/?utm_source=community&ref=<their-name>` |

A tag that is not in this table lands as `ORGANIC` and disappears from the
diaspora count. If you need a new tag, add it to `SOURCE_MAP` in
`src/domain/attribution.ts` in the same change.

## Message templates

**1. Group reply (no link, builds standing)**

> The bit that catches most people coming back is the UK credit file, not the
> mortgage itself. If you have been away five years you are close to invisible
> to a UK lender, and that takes months to fix, not weeks. Happy to explain what
> the fix looks like if it is useful — I run purchase logistics for returning
> households.

**2. Long-form community post (one tracked link)**

> **What actually goes wrong when you buy from overseas**
>
> Three things, in this order: the deposit is in the wrong currency at the wrong
> time; nobody instructs the conveyancer until a week after the offer is
> accepted; and the container gets booked against a completion date that was
> never real.
>
> We run the purchase as nine stages with one owner at a time, and we chase the
> party who is late. If you want to see the stage map for free, it is here:
> `https://<host>/stories/returning-from-australia?utm_source=poms-in-oz&utm_medium=community`

**3. Group admin conversation**

> I work with households moving back to England and Wales, mostly from your side
> of the world. I would rather be useful in the group than advertise in it. Would
> you be open to me answering purchase questions when they come up, and doing one
> longer post a month if members find it useful? Happy to run anything past you
> first.

**4. Debrief ask (the referral engine)**

> Now you are in: was there a point where you would have paid twice as much to
> have somebody just handle it? And is there anyone in the group you would
> mention us to? No pressure either way — the honest answer is more useful to me
> than a yes.

## What we never say

- No completion date promises and no promised service outcomes. We have planning
  targets from our own ledger and nothing more.
- No mortgage recommendations. We introduce you to an authorised firm; the
  recommendation comes from them.
- No claim to cover Scotland or Northern Ireland. England and Wales only.
- No "we are cheaper than an agent" framing. We are buyer-side; agents work for
  the seller. Different job.
- Never post the advisor playbooks, the evidence standards, or screenshots of
  the cockpit. That is the product.
- Always disclose that we may earn a referral fee, before the introduction, not
  after.

## Definition of done

This checklist has done its job when:

- [ ] 10–20 households have run through the real paid workflow
- [ ] Two or more paid cases in one community arrived without a post from us —
      somebody else named us
- [ ] At least half of all cases carry a diaspora lead source in
      `/cockpit/funnel`
- [ ] 1–2 communities show repeat referrals rather than one-off clicks

When those are true, stop optimising outreach and start on partner scorecards.
