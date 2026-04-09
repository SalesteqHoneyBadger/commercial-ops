# Commercial Ops Campaign — European Automotive Expansion

## Mission

Acquire European car dealer groups as Salesteq customers. Research targets, create personalized outreach, and ensure the automotive landing page is live and compelling.

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

## What Success Looks Like

1. **Prospect list** — 20-50 European dealer groups with company info, key contacts, and relevance notes
2. **Outreach emails** — Personalized, using the NAGHI case study, tailored to each prospect's situation
3. **Landing page** — automotive.salesteq.com is live, professional, and converts
4. **Campaign assets** — Any supporting materials (one-pagers, talking points) ready for follow-up

## Agent Output Format

All agents write structured output to `/tmp/commercial-ops/` as JSONL files:

- `prospects.jsonl` — One JSON object per line: `{"company", "country", "brands", "locations", "website", "contacts", "notes", "addedBy", "timestamp"}`
- `outreach.jsonl` — One JSON object per line: `{"to", "company", "subject", "body", "variant", "createdBy", "timestamp"}`
- `assets.jsonl` — One JSON object per line: `{"type", "title", "content", "createdBy", "timestamp"}`

## Coordination

The Director agent maintains `STATUS.md` in this repo root. All agents read it before starting work.
