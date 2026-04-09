#!/bin/bash
# Commercial Ops — Salesteq Agent Team (HoneyBadger Structure)
# Usage: bash start-agents.sh
# Connect from Mac (iTerm2): ssh -i ~/.ssh/id_experiment root@89.167.77.26 -t tmux -CC attach -t commercial-ops

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION="commercial-ops"
CLAUDE_BIN=/usr/local/bin/claude
CLAUDE_MODEL="claude-sonnet-4-20250514"
DATA_DIR="/tmp/commercial-ops"

# Ensure claude is available
if ! command -v "$CLAUDE_BIN" &>/dev/null; then
  CLAUDE_BIN=$(which claude 2>/dev/null)
  if [ -z "$CLAUDE_BIN" ]; then
    echo "ERROR: Claude CLI not found"
    exit 1
  fi
fi

# Create data directory and clear old data
mkdir -p "$DATA_DIR"
rm -f "$DATA_DIR"/*.jsonl "$DATA_DIR"/.qa-reviewed 2>/dev/null
touch "$DATA_DIR/prospects.jsonl" "$DATA_DIR/outreach-draft.jsonl" "$DATA_DIR/outreach-approved.jsonl" "$DATA_DIR/assets.jsonl" "$DATA_DIR/qa-reviews.jsonl" "$DATA_DIR/qa-feedback.jsonl"

# Kill existing session
tmux kill-session -t "$SESSION" 2>/dev/null
fuser -k 3001/tcp 2>/dev/null
sleep 1

# ── Launch function for Claude Code agents ──
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

# ── Launch Manager (Window 0) — your planning partner ──
echo "Launching Manager..."
launch_agent 0 "Manager" "$REPO_DIR/.prompts/manager.txt"
sleep 8

# ── Generate numbered operator prompts ──
for i in 1 2 3; do
  cp "$REPO_DIR/.prompts/operator.txt" "$REPO_DIR/.prompts/operator-${i}.txt"
  sed -i "s/operator-N/operator-${i}/g" "$REPO_DIR/.prompts/operator-${i}.txt"
done

# ── Launch Operators (Windows 1-3) — identical, full-capability ──
echo "Launching Operator-1..."
launch_agent 1 "Operator-1" "$REPO_DIR/.prompts/operator-1.txt"
sleep 8

echo "Launching Operator-2..."
launch_agent 2 "Operator-2" "$REPO_DIR/.prompts/operator-2.txt"
sleep 8

echo "Launching Operator-3..."
launch_agent 3 "Operator-3" "$REPO_DIR/.prompts/operator-3.txt"

# ── Launch QA (Window 4) — bash script, not Claude Code ──
echo "Launching QA..."
tmux new-window -t "$SESSION" -n "QA" -c "$REPO_DIR"
tmux send-keys -t "$SESSION:4" "bash $REPO_DIR/qa-reviewer.sh" Enter

# ── Dashboard (Window 5) ──
tmux new-window -t "$SESSION" -n "Dashboard" -c "$REPO_DIR"
tmux send-keys -t "$SESSION:5" "cd $REPO_DIR && npx tsx dashboard/server.ts" Enter

# Select Manager window (where the founder works)
tmux select-window -t "$SESSION:0"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Commercial Ops — Salesteq Agent Team             ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  3 operators + 1 manager + 1 QA reviewer             ║"
echo "║  Manager plans, operators execute, QA checks         ║"
echo "║                                                      ║"
echo "║  Connect from Mac (iTerm2):                          ║"
echo "║  ssh -i ~/.ssh/id_experiment root@89.167.77.26 \\    ║"
echo "║    -t tmux -CC attach -t commercial-ops              ║"
echo "║                                                      ║"
echo "║  TABS:                                               ║"
echo "║  0: Manager     — YOUR tab (plan + approve)          ║"
echo "║  1: Operator-1  — Full commercial operator           ║"
echo "║  2: Operator-2  — Full commercial operator           ║"
echo "║  3: Operator-3  — Full commercial operator           ║"
echo "║  4: QA          — Reviews drafts (Haiku, auto)       ║"
echo "║  5: Dashboard   — Control panel                      ║"
echo "║                                                      ║"
echo "║  Dashboard: https://automotive.salesteq.com          ║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
