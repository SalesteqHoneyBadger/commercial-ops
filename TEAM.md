# Commercial Ops — AI Team vs Human Team

## The AI Team

5 autonomous AI agents running in parallel on a single server.

| Agent | Role | Human Equivalent |
|-------|------|-----------------|
| **Manager** | Reads the market, sets priorities, coordinates operators via STATUS.md | VP of Sales / Campaign Director |
| **Operator 1** | Prospect research, outreach writing, asset creation | Senior SDR + Copywriter |
| **Operator 2** | Prospect research, outreach writing, asset creation | Senior SDR + Copywriter |
| **Operator 3** | Prospect research, outreach writing, asset creation | Senior SDR + Copywriter |
| **QA** | Reviews every draft for accuracy, tone, compliance | Marketing Editor / QA Analyst |

## What They Built (in ~15 minutes)

| Deliverable | Count | Human Time Estimate |
|-------------|-------|-------------------|
| Prospect profiles researched | 52 | 26 hours (30min each) |
| Personalized outreach emails | 30 | 30 hours (1hr each) |
| QA reviews completed | 12+ | 3 hours (15min each) |
| Marketing assets | 1+ | 2+ hours |
| Code deployments | 29 | Continuous |
| Countries covered | 7 | — |

**Total human equivalent: ~60 hours of skilled work in 15 minutes.**

That's a 240x speedup — or roughly 1.5 human work-weeks compressed into a quarter hour.

## Human Team Comparison

To match this AI team's output, a company would need:

| Role | Headcount | Annual Cost (EUR) |
|------|-----------|------------------|
| Campaign Director | 1 | 120,000 |
| Senior SDRs | 3 | 210,000 |
| Copywriter | 1 | 70,000 |
| QA / Editor | 1 | 65,000 |
| **Total** | **6 people** | **465,000/year** |

The AI team runs 24/7, never takes vacation, and scales instantly.

## How It Works

1. **Manager** writes `STATUS.md` with priorities
2. **Operators** read STATUS.md independently, pick the highest-impact task, execute end-to-end
3. **QA** automatically reviews every draft against quality standards
4. All agents write to shared JSONL files — no handoffs, no meetings, no Slack
5. A live dashboard at automotive.salesteq.com shows everything in real-time

## Architecture

```
                    STATUS.md (priorities)
                         |
                    +-----------+
                    |  Manager  |
                    +-----------+
                   /      |      \
          +--------+  +--------+  +--------+
          | Op-1   |  | Op-2   |  | Op-3   |
          +--------+  +--------+  +--------+
                \         |         /
                 \        |        /
              +-------------------+
              | /tmp/commercial-ops/*.jsonl |
              +-------------------+
                        |
                   +---------+
                   |   QA    |
                   +---------+
                        |
                   +-----------+
                   | Dashboard |
                   +-----------+
```

No dependencies between operators. No blocking. Pure parallel execution.
