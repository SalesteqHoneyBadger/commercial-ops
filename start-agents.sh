#!/bin/bash
# Commercial Ops — Salesteq Agent Team (HoneyBadger Structure)
# Usage: bash start-agents.sh
# Connect: ssh -t root@89.167.77.26 tmux attach -t commercial-ops

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION="commercial-ops"
CLAUDE_BIN=/usr/local/bin/claude
CLAUDE_MODEL="claude-sonnet-4-20250514"
DATA_DIR="/tmp/commercial-ops"

# Ensure claude is available
if [ ! -f "$CLAUDE_BIN" ]; then
  echo "ERROR: Claude CLI not found at $CLAUDE_BIN"
  exit 1
fi

# Create data directory
mkdir -p "$DATA_DIR"

# Kill existing session
tmux kill-session -t "$SESSION" 2>/dev/null
fuser -k 3001/tcp 2>/dev/null
sleep 1

# Write agent prompts
mkdir -p "$REPO_DIR/.prompts"

# ── Manager Agent (Window 0) ──
cat > "$REPO_DIR/.prompts/manager.txt" <<'PROMPT'
Read CLAUDE.md thoroughly. You are the Manager agent for this commercial operations campaign.

YOUR JOB: Coordinate the campaign. You NEVER do the work yourself.

You write STATUS.md — that is your only output. The Operators read it to know what to do.

WORKFLOW:
1. Read CLAUDE.md to understand the mission, products, target market, and team structure
2. Write STATUS.md with the campaign plan, priorities, and what's been done
3. Monitor output files in /tmp/commercial-ops/ for progress (prospects.jsonl, outreach-draft.jsonl, assets.jsonl, qa-reviews.jsonl)
4. Update STATUS.md every 15-20 minutes with progress and new priorities
5. The user will give you the goal and adjust priorities through conversation

STATUS.md FORMAT (scannable in 30 seconds):
  # Campaign Status — [timestamp]
  ## Mission
  [One line]
  ## Current Priorities
  1. [Most important thing right now]
  2. [Second priority]
  3. [Third priority]
  ## Done
  - [What's been completed, with counts]
  ## Gaps
  - [What's missing or needs attention]
  ## Blockers
  - [Anything blocking progress]

RULES:
- You do NOT write emails, research prospects, or create assets — Operators do that
- You ONLY write STATUS.md
- Monitor /tmp/commercial-ops/prospects.jsonl for research progress
- Monitor /tmp/commercial-ops/outreach-draft.jsonl for outreach progress
- Monitor /tmp/commercial-ops/assets.jsonl for marketing assets
- Monitor /tmp/commercial-ops/qa-reviews.jsonl for QA results
- Keep STATUS.md scannable in 30 seconds
- Commit and push STATUS.md after each update

Start now: read CLAUDE.md and write the initial STATUS.md campaign plan.
PROMPT

# ── Operator Agent (identical for all 3, Windows 1-3) ──
cat > "$REPO_DIR/.prompts/operator.txt" <<'PROMPT'
Read CLAUDE.md thoroughly — this is your mission.
Read STATUS.md for current priorities.

You are a full-capability commercial operator. You can do anything that achieves the goal:
- Research companies (web search, data gathering)
- Write outreach emails
- Build landing pages (HTML/CSS)
- Create presentations and content
- Analyze markets
- Whatever achieves the goal

WORKFLOW:
1. Read STATUS.md — see what the Manager says is the priority
2. Check what's already been done (read the JSONL files in /tmp/commercial-ops/)
3. Pick the next most impactful task that hasn't been done
4. Do the work end-to-end — don't leave partial work for others
5. Write results to the appropriate JSONL file
6. Make a small commit after each piece of work
7. Read STATUS.md again before starting new work

OUTPUT FILES (all in /tmp/commercial-ops/):
- prospects.jsonl — one JSON per line:
  {"company":"...","country":"...","brands":[...],"locations":N,"website":"...","contacts":[{"name":"...","title":"..."}],"notes":"...","addedBy":"operator-N","timestamp":"..."}
- outreach-draft.jsonl — one JSON per line:
  {"to":"...","company":"...","subject":"...","body":"...","variant":"...","createdBy":"operator-N","timestamp":"...","status":"draft"}
- assets.jsonl — one JSON per line:
  {"type":"landing-page|one-pager|presentation|linkedin-post","title":"...","content":"...","createdBy":"operator-N","timestamp":"...","status":"draft"}

HOW TO WRITE OUTPUT:
Use bash to append: echo '{"company":"Emil Frey","country":"Switzerland",...}' >> /tmp/commercial-ops/prospects.jsonl

RULES:
- Every email must reference the NAGHI case study
- Personalize based on the prospect's actual situation
- Direct confident voice — no hedging, no buzzwords
- Numbers over adjectives
- Check what others have done before starting — avoid duplicate work
- If STATUS.md says something is priority 1, do that first

Start now: read CLAUDE.md, read STATUS.md, check existing JSONL files, then pick the most impactful task and do it.
PROMPT

# ── QA Agent (Window 4) ──
cat > "$REPO_DIR/.prompts/qa.txt" <<'PROMPT'
Read CLAUDE.md for brand voice and quality standards. You are the QA agent.

YOUR JOB: Review every output before it goes out. Nothing leaves without your approval.

WORKFLOW:
1. Poll /tmp/commercial-ops/outreach-draft.jsonl every 60 seconds
2. Poll /tmp/commercial-ops/assets.jsonl every 60 seconds
3. For each item with status "draft":
   - Review for: accuracy, tone, personalization, spelling, NAGHI facts correct, no buzzwords, professionalism
   - If PASS: copy the item to /tmp/commercial-ops/outreach-approved.jsonl with status "approved"
   - If NEEDS_ATTENTION: write feedback to /tmp/commercial-ops/qa-feedback.jsonl
4. Log ALL reviews to /tmp/commercial-ops/qa-reviews.jsonl

REVIEW STANDARDS:
- Direct confident voice — no hedging ("we believe", "perhaps", "might")
- Numbers over adjectives — "250,000 vehicles/year" not "massive scale"
- Every outreach email MUST reference NAGHI Motors specifically
- NAGHI facts must be correct: 11+ brands, BMW/MINI/Rolls-Royce/Geely/Jetour/GAC/Bestune, 250K vehicles/year, exclusive BMW dealer in Saudi Arabia
- No generic marketing buzzwords ("synergy", "leverage", "cutting-edge", "revolutionary")
- Emails must be personalized to the specific prospect — not templates
- Assets must be professional and factually accurate

OUTPUT FILES:
- /tmp/commercial-ops/outreach-approved.jsonl — approved emails (same format as outreach-draft.jsonl but status:"approved")
- /tmp/commercial-ops/qa-feedback.jsonl — items that need work:
  {"item":"outreach|asset","company":"...","issue":"...","severity":"minor|major","timestamp":"..."}
- /tmp/commercial-ops/qa-reviews.jsonl — log of all reviews:
  {"item":"...","verdict":"PASS|NEEDS_ATTENTION","feedback":"...","timestamp":"..."}

HOW TO REVIEW:
1. Read outreach-draft.jsonl — find items with status "draft"
2. For each: check against the standards above
3. Write your verdict to qa-reviews.jsonl
4. If PASS: append to outreach-approved.jsonl
5. If NEEDS_ATTENTION: append to qa-feedback.jsonl
6. Wait 60 seconds, repeat

Start now: read CLAUDE.md, then begin polling for drafts to review.
PROMPT

# ── Launch function ──
launch_agent() {
  local win_idx=$1
  local win_name=$2
  local prompt_file=$3

  if [ "$win_idx" -eq 0 ]; then
    tmux rename-window -t "$SESSION:0" "$win_name"
  else
    tmux new-window -t "$SESSION" -n "$win_name" -c "$REPO_DIR"
  fi

  tmux send-keys -t "$SESSION:${win_idx}" "cd ${REPO_DIR}" Enter
  sleep 1
  tmux send-keys -t "$SESSION:${win_idx}" "unset CLAUDECODE && $CLAUDE_BIN --model $CLAUDE_MODEL" Enter
  sleep 6
  # Accept trust prompt
  tmux send-keys -t "$SESSION:${win_idx}" Enter
  sleep 2
  # Load and paste prompt
  tmux load-buffer "$prompt_file"
  tmux paste-buffer -t "$SESSION:${win_idx}"
  tmux send-keys -t "$SESSION:${win_idx}" Enter
  echo "  $win_name launched."
}

# ── Create session ──
tmux new-session -d -s "$SESSION" -c "$REPO_DIR" -x 200 -y 50

# ── Launch agents (staggered 8-second launches) ──
echo "Launching Manager..."
launch_agent 0 "Manager" "$REPO_DIR/.prompts/manager.txt"
sleep 8

echo "Launching Operator-1..."
launch_agent 1 "Operator-1" "$REPO_DIR/.prompts/operator.txt"
sleep 8

echo "Launching Operator-2..."
launch_agent 2 "Operator-2" "$REPO_DIR/.prompts/operator.txt"
sleep 8

echo "Launching Operator-3..."
launch_agent 3 "Operator-3" "$REPO_DIR/.prompts/operator.txt"
sleep 8

echo "Launching QA..."
launch_agent 4 "QA" "$REPO_DIR/.prompts/qa.txt"

# ── Dashboard ──
tmux new-window -t "$SESSION" -n "Dashboard" -c "$REPO_DIR"
tmux send-keys -t "$SESSION:5" "cd $REPO_DIR && npx tsx dashboard/server.ts" Enter

# Select Manager window
tmux select-window -t "$SESSION:0"

echo ""
echo "================================================================"
echo "  Commercial Ops — Salesteq Agent Team (HoneyBadger Structure)"
echo "================================================================"
echo ""
echo "  5 agents + dashboard launched in tmux session: $SESSION"
echo ""
echo "  TABS:"
echo "  0: Manager     — Coordinates via STATUS.md (talk to this one)"
echo "  1: Operator-1  — Full-capability commercial operator"
echo "  2: Operator-2  — Full-capability commercial operator"
echo "  3: Operator-3  — Full-capability commercial operator"
echo "  4: QA          — Reviews all output before it's final"
echo "  5: Dashboard   — Control panel :3001"
echo ""
echo "  Dashboard:  http://89.167.77.26:3001"
echo "  Landing:    landing/index.html (deploy to nginx)"
echo ""
echo "  Connect:    tmux attach -t $SESSION"
echo ""
echo "================================================================"
