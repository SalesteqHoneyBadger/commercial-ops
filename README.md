# Commercial Ops — Salesteq HoneyBadger

AI commercial operations team — autonomous agents for sales, marketing, and customer acquisition.

Based on the [HoneyBadger](https://github.com/OpenHoneyBadger/honey-badger) multi-agent pattern.

## Quick Start

```bash
# 1. SSH into the server and launch agents
ssh root@89.167.77.26
cd ~/commercial-ops
bash start-agents.sh

# 2. Connect from your Mac (iTerm2 required — gives native tabs)
ssh -i ~/.ssh/id_experiment root@89.167.77.26 -t tmux -CC attach -t commercial-ops

# 3. Open the control panel
open https://automotive.salesteq.com
```

> SSH key passphrase: `Ationifi20!`

## Mac Setup (first time only)

Install the SSH key on your Mac:

```bash
curl -sL https://raw.githubusercontent.com/SalesteqHoneyBadger/commercial-ops/main/setup-mac.sh | bash
```

Then connect:

```bash
ssh -i ~/.ssh/id_experiment root@89.167.77.26 -t tmux -CC attach -t commercial-ops
```

## Team Structure

| Window | Agent | Role |
|--------|-------|------|
| 0 | **Manager** | You talk to this one. Coordinates via STATUS.md. Never does the work. |
| 1 | **Operator-1** | Full-capability commercial operator — researches, writes, builds |
| 2 | **Operator-2** | Same as Operator-1 |
| 3 | **Operator-3** | Same as Operator-1 |
| 4 | **QA** | Reviews every output before it goes out |
| 5 | **Dashboard** | Control panel server |

## How It Works

1. You give the Manager a goal (e.g., "Acquire European car dealers")
2. Manager writes STATUS.md with the plan and priorities
3. Operators read STATUS.md, pick the most impactful task, execute end-to-end
4. QA reviews all outputs (emails, landing pages, content) before they're final
5. You adjust priorities by talking to the Manager

Same pattern as the dev HoneyBadger team — identical agents, no specialization, no handoffs.

## Control Panel

`https://automotive.salesteq.com` — shows agent status, prospects, outreach emails, QA reviews, activity stream.

## iTerm2 Tabs

When connected via `tmux -CC`, each agent is a native iTerm2 tab:
- Click tabs to switch between agents
- The Manager tab is where you interact
- Other tabs show agents working autonomously

## Stopping

```bash
ssh -i ~/.ssh/id_experiment root@89.167.77.26 "tmux kill-session -t commercial-ops"
```
