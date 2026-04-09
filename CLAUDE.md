# Commercial Ops Campaign — European Automotive Expansion

## Mission

Acquire European car dealer groups as Salesteq customers. Research targets, create personalized outreach, and ensure the automotive landing page is live and compelling.

## Team Structure

This campaign runs on a 5-agent team (HoneyBadger pattern):

| Window | Role | What They Do |
|--------|------|-------------|
| 0 | **Manager** | Writes STATUS.md with priorities. Never does the work. User talks to this agent. |
| 1-3 | **Operator 1-3** | Identical full-capability agents. Read STATUS.md, pick the most impactful task, do it end-to-end. |
| 4 | **QA** | Reviews every draft before it goes out. Approves or flags issues. |

**How it works:**
- Manager writes STATUS.md with priorities and progress
- Operators read STATUS.md, self-organize, and pick work
- All Operators are identical — no specialization
- Each Operator does end-to-end work — no handoffs
- QA reviews everything with status "draft" before it's final
- No agent depends on another to finish their task

## About Salesteq

Salesteq is an AI Commercial Operations platform built by Elyon GmbH (Zug, Switzerland). One platform replaces sales, marketing, and customer service teams with AI agents.

**Website:** salesteq.com
**Product:** agent.salesteq.com

### Products

| Product | What It Does |
|---------|-------------|
| **Badger** | AI agents that execute sales, marketing, and service tasks autonomously. They plan, act, learn. |
| **Index** | Commercial intelligence engine. 6.8M+ companies, 14M+ contacts. Sub-100ms search. Powers targeting and enrichment. |
| **Kol** | Voice and chat engine. Handles inbound/outbound calls, WhatsApp, web chat. Multilingual (Arabic, English, German, French). |
| **Yeda** | Self-building knowledge base. Agents learn from every interaction and build institutional knowledge automatically. |
| **Zera** | Autonomous deployment. Agents deploy themselves — new channels, new markets, new languages — without engineering. |

## The NAGHI Case Study (Proof Point)

**NAGHI Motors** is the exclusive BMW dealer in the Kingdom of Saudi Arabia and one of the largest automotive groups in the Middle East.

- **11+ brands** including BMW, MINI, Rolls-Royce, Geely, Jetour, GAC, Bestune
- **250,000+ vehicles per year** across sales and service
- **Challenge:** Multilingual customer engagement (Arabic/English), high service volume, inconsistent follow-up
- **Salesteq solution:** AI sales advisor on website and WhatsApp, automated service booking, intelligent lead qualification
- **Results:** 24/7 multilingual engagement, reduced response time from hours to seconds, automated service scheduling

This is the anchor case study for European outreach. European dealer groups face the same challenges at similar scale.

## Target Market

**European automotive dealer groups** — specifically:
- Multi-brand dealer groups (BMW, Mercedes, Audi, VW, Porsche, etc.)
- Groups with 10+ locations
- Countries: Germany, Switzerland, Austria, UK, France, Netherlands, Nordics, Spain, Italy
- Decision makers: CEO, CDO, Head of Digital, Head of Sales/Aftersales

### Why They Need Salesteq
1. **Customer expectations are rising** — buyers expect instant, personalized responses
2. **Staff shortages** — hard to hire and retain skilled sales/service advisors
3. **Multilingual markets** — Switzerland (4 languages), Belgium (3), border regions
4. **Digital transformation pressure** — OEMs pushing dealers to digitize
5. **Service revenue** — aftersales is the profit center, but booking friction loses revenue

## Output File Formats

All output goes to `/tmp/commercial-ops/` as JSONL files (one JSON object per line).

### prospects.jsonl
```json
{"company":"Emil Frey Group","country":"Switzerland","brands":["BMW","Mercedes","Audi"],"locations":200,"website":"https://emilfrey.ch","contacts":[{"name":"...","title":"CEO"}],"notes":"Largest European dealer group","addedBy":"operator-1","timestamp":"2025-01-01T00:00:00Z"}
```

### outreach-draft.jsonl
```json
{"to":"ceo@emilfrey.ch","company":"Emil Frey Group","subject":"How NAGHI Motors runs 11 brands with one AI platform","body":"Dear Mr. Frey, ...","variant":"A","createdBy":"operator-1","timestamp":"2025-01-01T00:00:00Z","status":"draft"}
```

### outreach-approved.jsonl
Same format as outreach-draft.jsonl but with `"status":"approved"` — written by QA after review.

### assets.jsonl
```json
{"type":"one-pager","title":"Salesteq Automotive One-Pager","content":"...","createdBy":"operator-2","timestamp":"2025-01-01T00:00:00Z","status":"draft"}
```
Types: `landing-page`, `one-pager`, `presentation`, `linkedin-post`

### qa-reviews.jsonl
```json
{"item":"outreach|asset","verdict":"PASS|NEEDS_ATTENTION","feedback":"...","timestamp":"..."}
```

### qa-feedback.jsonl
```json
{"item":"outreach|asset","company":"...","issue":"...","severity":"minor|major","timestamp":"..."}
```

## Quality Standards (QA Checklist)

Every piece of output must pass these before it goes out:

1. **Voice:** Direct and confident. No hedging ("we believe", "perhaps", "might").
2. **Specificity:** Numbers over adjectives. "250,000 vehicles/year" not "massive scale".
3. **NAGHI reference:** Every outreach email must reference the NAGHI case study specifically.
4. **NAGHI accuracy:** 11+ brands, BMW/MINI/Rolls-Royce/Geely/Jetour/GAC/Bestune, 250K vehicles/year, exclusive BMW dealer in Saudi Arabia.
5. **No buzzwords:** No "synergy", "leverage", "cutting-edge", "revolutionary", "game-changing".
6. **Personalization:** Every email must reference the specific prospect's situation — not a template.
7. **Professionalism:** Correct spelling, grammar, formatting.
8. **CTA:** Clear call to action — "Book a 20-minute demo" or link to automotive.salesteq.com.

## What Success Looks Like

1. **Prospect list** — 20-50 European dealer groups with company info, key contacts, and relevance notes
2. **Outreach emails** — Personalized, using the NAGHI case study, QA-approved, ready to send
3. **Landing page** — automotive.salesteq.com is live, professional, and converts
4. **Campaign assets** — One-pagers, LinkedIn posts, talking points — all QA-approved
5. **Quality** — Every output passes QA review. Zero buzzwords. Zero generic templates.

## Coordination

The Manager agent maintains `STATUS.md` in this repo root. All agents read it before starting work. STATUS.md is the single source of truth for what to do next.
