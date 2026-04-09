import express from "express";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

const app = express();
app.use(express.json());

const SESSION = "commercial-ops";
const DATA_DIR = "/tmp/commercial-ops";
const OUTREACH_DRAFT_LOG = `${DATA_DIR}/outreach-draft.jsonl`;
const OUTREACH_APPROVED_LOG = `${DATA_DIR}/outreach-approved.jsonl`;
const PROSPECTS_LOG = `${DATA_DIR}/prospects.jsonl`;
const QA_REVIEWS_LOG = `${DATA_DIR}/qa-reviews.jsonl`;
const QA_FEEDBACK_LOG = `${DATA_DIR}/qa-feedback.jsonl`;
const ASSETS_LOG = `${DATA_DIR}/assets.jsonl`;

const AGENTS = [
  { id: 1, name: "Manager",    window: "Manager",    windowIdx: 0, color: "#e8720c", role: "Campaign Coordinator" },
  { id: 2, name: "Operator-1", window: "Operator-1", windowIdx: 1, color: "#3b82f6", role: "Commercial Operator" },
  { id: 3, name: "Operator-2", window: "Operator-2", windowIdx: 2, color: "#22c55e", role: "Commercial Operator" },
  { id: 4, name: "Operator-3", window: "Operator-3", windowIdx: 3, color: "#8b5cf6", role: "Commercial Operator" },
  { id: 5, name: "QA",         window: "QA",         windowIdx: 4, color: "#06b6d4", role: "Quality Assurance" },
];

// Activity stream — stores last N events from all agents
interface ActivityEvent {
  ts: number;
  agentId: number;
  agentName: string;
  color: string;
  text: string;
}
const activityStream: ActivityEvent[] = [];
const MAX_ACTIVITY = 200;
const previousOutputs: Record<number, string> = {};

function sessionExists(): boolean {
  try { execSync(`tmux has-session -t ${SESSION} 2>/dev/null`); return true; } catch { return false; }
}

function getAgentStatus(windowIdx: number): string {
  try {
    const pane = execSync(
      `tmux list-panes -t ${SESSION}:${windowIdx} -F "#{pane_current_command}" 2>/dev/null`
    ).toString().trim();
    if (pane.includes("claude")) return "running";
    if (pane.includes("node") || pane.includes("tsx")) return "running";
    return "idle";
  } catch { return "offline"; }
}

function getAgentOutput(windowIdx: number, lines = 15): string {
  try {
    return execSync(
      `tmux capture-pane -t ${SESSION}:${windowIdx} -p -S -${lines} 2>/dev/null`
    ).toString().trim();
  } catch { return ""; }
}

// Poll agents for new output and add to activity stream
function pollAgentActivity() {
  if (!sessionExists()) return;
  for (const agent of AGENTS) {
    try {
      const output = getAgentOutput(agent.windowIdx, 30);
      const prev = previousOutputs[agent.id] || "";
      if (output && output !== prev) {
        const prevLines = prev.split("\n");
        const newLines = output.split("\n");
        const diff: string[] = [];
        for (const line of newLines) {
          const trimmed = line.trim();
          if (trimmed && !prevLines.includes(line) && trimmed.length > 2) {
            if (!trimmed.match(/^[$>%#]+$/) && !trimmed.match(/^\d+\.\d+s$/)) {
              diff.push(trimmed);
            }
          }
        }
        for (const line of diff.slice(-5)) {
          activityStream.push({
            ts: Date.now(),
            agentId: agent.id,
            agentName: agent.name,
            color: agent.color,
            text: line.substring(0, 200),
          });
        }
        while (activityStream.length > MAX_ACTIVITY) activityStream.shift();
        previousOutputs[agent.id] = output;
      }
    } catch {}
  }
}

// Poll every 3 seconds
setInterval(pollAgentActivity, 3000);

// Get git log for recent commits (with timestamps)
function getRecentCommits(n = 15): string[] {
  try {
    return execSync(`git log --format="%h|%ai|%s" -${n} 2>/dev/null`, { cwd: process.cwd(), stdio: "pipe" }).toString().trim().split("\n").filter(Boolean);
  } catch { return []; }
}

// Read JSONL file
function readJsonl(filePath: string, n = 20): any[] {
  try {
    if (!existsSync(filePath)) return [];
    const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
    return lines.slice(-n).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
  } catch { return []; }
}

function countLines(filePath: string): number {
  try {
    if (!existsSync(filePath)) return 0;
    return readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean).length;
  } catch { return 0; }
}

// Get campaign pipeline stats
function getPipelineStats(): { prospects: number; drafts: number; approved: number; assets: number; events: any[] } {
  const prospects = readJsonl(PROSPECTS_LOG, 100);
  const drafts = readJsonl(OUTREACH_DRAFT_LOG, 100);
  const approved = readJsonl(OUTREACH_APPROVED_LOG, 100);
  const assets = countLines(ASSETS_LOG);

  // Build pipeline events from sources
  const events: any[] = [];
  for (const p of prospects.slice(0, 10)) {
    events.push({ type: "prospect", company: p.company || p.name || "Unknown", source: p.addedBy || "operator", ts: p.ts || Date.now() / 1000, msg: p.notes || "" });
  }
  for (const e of drafts.slice(0, 5)) {
    events.push({ type: "outreach", company: e.company || e.to || "Unknown", status: e.status || "draft", ts: e.ts || Date.now() / 1000, msg: e.subject || "" });
  }
  for (const e of approved.slice(0, 5)) {
    events.push({ type: "approved", company: e.company || e.to || "Unknown", status: "approved", ts: e.ts || Date.now() / 1000, msg: e.subject || "" });
  }
  events.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return { prospects: prospects.length, drafts: drafts.length, approved: approved.length, assets, events: events.slice(0, 15) };
}

// HTML
app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commercial Ops — Control Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif;
      background: #111; color: #ccc; min-height: 100vh;
    }

    /* Header */
    .header {
      padding: 14px 24px; border-bottom: 1px solid #222;
      display: flex; align-items: center; justify-content: space-between;
      background: #151515;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 15px; font-weight: 600; color: #ddd; letter-spacing: -0.3px; }
    .header .subtitle { font-size: 11px; color: #666; margin-top: 1px; }
    .infra-dots { display: flex; gap: 14px; align-items: center; }
    .infra-dot { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #777; }
    .idot { width: 6px; height: 6px; border-radius: 50%; }
    .idot.on { background: #5a5; }
    .idot.off { background: #a55; }

    /* Layout */
    .layout { display: flex; height: calc(100vh - 52px); }

    /* Agent Grid */
    .agents-section { flex: 1; overflow-y: auto; padding: 20px; }
    .section-title {
      font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase;
      letter-spacing: 1px; margin-bottom: 12px;
    }
    .agents-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .agent-box {
      background: #1a1a1a; border: 1px solid #252525; border-radius: 10px;
      padding: 14px; transition: border-color 0.2s;
    }
    .agent-box:hover { border-color: #333; }
    .agent-box.running { border-top: 2px solid #e8720c; }
    .agent-box.mgr { grid-column: 1 / 2; }
    .agent-box.qa { grid-column: 3 / 4; }

    /* Box header */
    .box-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .box-identity { display: flex; align-items: center; gap: 10px; }
    .box-avatar {
      width: 32px; height: 32px; border-radius: 8px; background: #2a2a2a;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #999;
    }
    .box-name { font-size: 14px; font-weight: 600; color: #ddd; }
    .box-role { font-size: 11px; color: #666; margin-top: 2px; }
    .box-status {
      font-size: 9px; font-weight: 600; padding: 3px 7px; border-radius: 4px;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .box-status.running { background: #2e2210; color: #e8720c; }
    .box-status.idle { background: #2e2a1e; color: #aa8; }
    .box-status.offline { background: #2e1e1e; color: #a77; }

    /* KITT scanner cubes */
    .cubes-row {
      display: flex; gap: 2px; margin-bottom: 10px; height: 10px;
      align-items: center;
    }
    .cube {
      width: 6px; height: 6px; border-radius: 1px;
      background: #222; transition: all 0.15s;
    }
    .cubes-row.scanning .cube {
      animation: kitt-scan 2s ease-in-out infinite;
    }
    .cubes-row.scanning .cube:nth-child(1)  { animation-delay: 0.00s; }
    .cubes-row.scanning .cube:nth-child(2)  { animation-delay: 0.06s; }
    .cubes-row.scanning .cube:nth-child(3)  { animation-delay: 0.12s; }
    .cubes-row.scanning .cube:nth-child(4)  { animation-delay: 0.18s; }
    .cubes-row.scanning .cube:nth-child(5)  { animation-delay: 0.24s; }
    .cubes-row.scanning .cube:nth-child(6)  { animation-delay: 0.30s; }
    .cubes-row.scanning .cube:nth-child(7)  { animation-delay: 0.36s; }
    .cubes-row.scanning .cube:nth-child(8)  { animation-delay: 0.42s; }
    .cubes-row.scanning .cube:nth-child(9)  { animation-delay: 0.48s; }
    .cubes-row.scanning .cube:nth-child(10) { animation-delay: 0.54s; }
    .cubes-row.scanning .cube:nth-child(11) { animation-delay: 0.60s; }
    .cubes-row.scanning .cube:nth-child(12) { animation-delay: 0.66s; }
    .cubes-row.scanning .cube:nth-child(13) { animation-delay: 0.72s; }
    .cubes-row.scanning .cube:nth-child(14) { animation-delay: 0.78s; }
    .cubes-row.scanning .cube:nth-child(15) { animation-delay: 0.84s; }
    .cubes-row.scanning .cube:nth-child(16) { animation-delay: 0.90s; }
    @keyframes kitt-scan {
      0%, 100% { background: #222; box-shadow: none; }
      50% { background: #e8720c; box-shadow: 0 0 8px #e8720c, 0 0 2px #e8720c; }
    }
    .cubes-row.idle .cube { background: #1a1a1a; }
    .cubes-row.offline .cube { background: #1a1a1a; }

    /* Terminal preview */
    .box-terminal {
      background: #131313; border-radius: 6px; padding: 10px 12px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 11px; line-height: 1.6; color: #777;
      height: 80px; overflow: hidden; white-space: pre-wrap; word-break: break-all;
      border: 1px solid #1e1e1e;
    }

    /* Campaign Pipeline */
    .build-section { margin-bottom: 24px; }
    .build-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .build-status-badge {
      display: flex; align-items: center; gap: 8px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 12px; font-weight: 600;
    }
    .build-dot {
      width: 8px; height: 8px; border-radius: 50%;
    }
    .build-dot.pass { background: #5a5; box-shadow: 0 0 6px rgba(90,170,90,0.4); }
    .build-dot.fail { background: #e55; box-shadow: 0 0 6px rgba(230,90,90,0.4); }
    .build-dot.none { background: #555; }
    .build-stats {
      display: flex; gap: 16px; font-size: 11px; color: #666;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }
    .build-stats .stat-val { color: #999; font-weight: 600; }

    .build-events {
      background: #1a1a1a; border: 1px solid #252525; border-radius: 10px;
      overflow: hidden;
    }
    .build-ev {
      padding: 8px 14px; border-bottom: 1px solid #1e1e1e;
      display: flex; align-items: center; gap: 10px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 11px; transition: background 0.15s;
    }
    .build-ev:last-child { border-bottom: none; }
    .build-ev:hover { background: #222; }
    .build-icon { font-size: 13px; width: 20px; text-align: center; }
    .build-sha { color: #e8720c; font-weight: 600; min-width: 56px; }
    .build-msg { color: #999; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .build-time { color: #555; min-width: 50px; text-align: right; }
    .build-ev.prospect .build-icon { color: #3b82f6; }
    .build-ev.outreach .build-icon { color: #22c55e; }
    .build-ev.approved .build-icon { color: #06b6d4; }

    /* Outreach Emails */
    .review-section { margin-bottom: 24px; }
    .review-events {
      background: #1a1a1a; border: 1px solid #252525; border-radius: 10px;
      overflow: hidden;
    }
    .review-ev {
      padding: 10px 14px; border-bottom: 1px solid #1e1e1e;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 11px; transition: background 0.15s; cursor: pointer;
    }
    .review-ev:last-child { border-bottom: none; }
    .review-ev:hover { background: #222; }
    .review-top { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    .review-verdict {
      font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 3px;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .review-verdict.DRAFT { background: #2e2a1a; color: #da5; }
    .review-verdict.APPROVED { background: #1a2e1a; color: #5a5; }
    .review-sha { color: #e8720c; font-weight: 600; }
    .review-msg { color: #999; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .review-time { color: #555; }
    .review-body {
      color: #777; font-size: 11px; line-height: 1.5;
      padding: 6px 0 0 0; display: none; white-space: pre-wrap; word-break: break-word;
    }
    .review-ev.expanded .review-body { display: block; }

    /* QA Reviews */
    .qa-section { margin-bottom: 24px; }
    .qa-events {
      background: #1a1a1a; border: 1px solid #252525; border-radius: 10px;
      overflow: hidden;
    }
    .qa-ev {
      padding: 10px 14px; border-bottom: 1px solid #1e1e1e;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 11px; transition: background 0.15s; cursor: pointer;
    }
    .qa-ev:last-child { border-bottom: none; }
    .qa-ev:hover { background: #222; }
    .qa-top { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    .qa-verdict {
      font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 3px;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .qa-verdict.PASS { background: #1a2e1a; color: #5a5; }
    .qa-verdict.NEEDS_ATTENTION { background: #2e1a1a; color: #e55; }
    .qa-item { color: #06b6d4; font-weight: 600; }
    .qa-feedback { color: #999; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qa-time { color: #555; }
    .qa-body {
      color: #777; font-size: 11px; line-height: 1.5;
      padding: 6px 0 0 0; display: none; white-space: pre-wrap; word-break: break-word;
    }
    .qa-ev.expanded .qa-body { display: block; }

    /* Prospects */
    .alerts-section { margin-bottom: 24px; }
    .alert-events {
      background: #1a1a1a; border: 1px solid #252525; border-radius: 10px;
      overflow: hidden;
    }
    .alert-ev {
      padding: 10px 14px; border-bottom: 1px solid #1e1e1e;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 11px; transition: background 0.15s; cursor: pointer;
    }
    .alert-ev:last-child { border-bottom: none; }
    .alert-ev:hover { background: #222; }
    .alert-top { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    .alert-severity {
      font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 3px;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .alert-severity.HOT { background: #2e1a1a; color: #e55; }
    .alert-severity.WARM { background: #2e2a1a; color: #da5; }
    .alert-severity.COLD { background: #1a2a2e; color: #5ac; }
    .alert-severity.NEW { background: #1a2e1a; color: #5a5; }
    .alert-summary { color: #999; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .alert-count { color: #777; min-width: 50px; }
    .alert-time { color: #555; }
    .alert-body {
      color: #777; font-size: 11px; line-height: 1.5;
      padding: 6px 0 0 0; display: none; white-space: pre-wrap; word-break: break-word;
    }
    .alert-ev.expanded .alert-body { display: block; }

    /* Right panel */
    .right-panel {
      width: 480px; border-left: 1px solid #222;
      display: flex; flex-direction: column; background: #141414;
    }
    .panel-header {
      padding: 14px 16px; border-bottom: 1px solid #222;
      display: flex; align-items: center; justify-content: space-between;
    }
    .panel-header h2 { font-size: 13px; font-weight: 600; color: #ccc; }
    .live-badge {
      display: flex; align-items: center; gap: 5px;
      font-size: 10px; color: #5a5; font-weight: 500;
    }
    .live-dot {
      width: 5px; height: 5px; border-radius: 50%; background: #5a5;
      animation: livePulse 2s infinite;
    }
    @keyframes livePulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Stream */
    .stream-body { flex: 1; overflow-y: auto; min-height: 0; }
    .ev {
      padding: 8px 18px; border-bottom: 1px solid #1c1c1c;
      transition: background 0.15s;
    }
    .ev:hover { background: #1a1a1a; }
    .ev-top { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
    .ev-tag {
      font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px;
      background: #222; color: #999;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }
    .ev-time { font-size: 10px; color: #555; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }
    .ev-msg {
      font-size: 12px; color: #888; line-height: 1.5; word-break: break-word;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }
    .ev-msg.hi { color: #ccc; }

    /* Git */
    .git-panel {
      border-top: 1px solid #222; padding: 14px 16px;
      max-height: 240px; overflow-y: auto; flex-shrink: 0;
    }
    .git-panel h3 {
      font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase;
      letter-spacing: 0.8px; margin-bottom: 10px;
    }
    .gc {
      font-size: 12px; color: #777; padding: 4px 0;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      line-height: 1.4;
    }
    .gc .gh { color: #e8720c; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div>
        <h1><span>Commercial Ops</span> — Control Panel</h1>
        <div class="subtitle">European Automotive Expansion — HoneyBadger Structure</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:20px">
      <div class="infra-dots" id="infraDots"></div>
    </div>
  </div>

  <div class="layout">
    <div class="agents-section">
      <div class="section-title">Agents</div>
      <div class="agents-grid" id="agentGrid"></div>

      <div class="build-section">
        <div class="build-header">
          <div class="section-title" style="margin-bottom:0">Campaign Pipeline</div>
          <div id="buildBadge" class="build-status-badge"></div>
        </div>
        <div class="build-stats" id="buildStats"></div>
        <div class="build-events" id="buildEvents">
          <div class="build-ev" style="color:#555;justify-content:center">No pipeline activity yet</div>
        </div>
      </div>

      <div class="review-section">
        <div class="section-title">Outreach Emails</div>
        <div class="review-events" id="reviewEvents">
          <div class="review-ev" style="color:#555;justify-content:center;cursor:default">No outreach yet</div>
        </div>
      </div>

      <div class="qa-section">
        <div class="section-title">QA Reviews</div>
        <div class="qa-events" id="qaEvents">
          <div class="qa-ev" style="color:#555;justify-content:center;cursor:default">No reviews yet</div>
        </div>
      </div>

      <div class="alerts-section">
        <div class="section-title">Prospects</div>
        <div class="alert-events" id="alertEvents">
          <div class="alert-ev" style="color:#555;justify-content:center;cursor:default">No prospects yet</div>
        </div>
      </div>
    </div>

    <div class="right-panel">
      <div class="panel-header">
        <h2>Activity</h2>
        <div class="live-badge"><div class="live-dot"></div>LIVE</div>
      </div>
      <div class="stream-body" id="streamBody">
        <div style="padding:24px;color:#333;font-size:12px;text-align:center">Waiting for activity...</div>
      </div>
      <div class="git-panel">
        <h3>Recent Commits</h3>
        <div id="gitLog" style="color:#333;font-size:11px">Loading...</div>
      </div>
    </div>
  </div>

  <script>
    var agents = ${JSON.stringify(AGENTS)};
    var lastStreamLength = 0;
    var agentActivity = {};
    agents.forEach(function(a) { agentActivity[a.id] = []; });

    async function fetchStatus() {
      try {
        var res = await fetch('/api/status');
        var data = await res.json();
        renderInfra(data);
        renderAgents(data.agents);
      } catch(e) {}
    }

    async function fetchStream() {
      try {
        var res = await fetch('/api/stream?since=' + lastStreamLength);
        var data = await res.json();
        if (data.events && data.events.length > 0) {
          data.events.forEach(function(ev) {
            if (!agentActivity[ev.agentId]) agentActivity[ev.agentId] = [];
            agentActivity[ev.agentId].push(ev.ts);
            if (agentActivity[ev.agentId].length > 30) agentActivity[ev.agentId].shift();
          });
          renderStream(data.events, data.total);
          lastStreamLength = data.total;
        }
        if (data.commits) renderCommits(data.commits);
      } catch(e) {}
    }

    async function fetchPipeline() {
      try {
        var res = await fetch('/api/pipeline');
        var data = await res.json();
        renderPipeline(data);
      } catch(e) {}
    }

    async function fetchOutreach() {
      try {
        var res = await fetch('/api/outreach');
        var data = await res.json();
        renderOutreach(data);
      } catch(e) {}
    }

    async function fetchQaReviews() {
      try {
        var res = await fetch('/api/qa-reviews');
        var data = await res.json();
        renderQaReviews(data);
      } catch(e) {}
    }

    async function fetchProspects() {
      try {
        var res = await fetch('/api/prospects');
        var data = await res.json();
        renderProspects(data);
      } catch(e) {}
    }

    function renderInfra(data) {
      var running = data.agents.filter(function(a){ return a.status === 'running'; }).length;
      var items = [
        { name: 'tmux', on: data.session },
        { name: 'Prospects: ' + data.prospectCount, on: data.prospectCount > 0 },
        { name: 'Drafts: ' + data.draftCount, on: data.draftCount > 0 },
        { name: 'Approved: ' + data.approvedCount, on: data.approvedCount > 0 },
        { name: 'Assets: ' + data.assetCount, on: data.assetCount > 0 },
      ];
      document.getElementById('infraDots').innerHTML =
        items.map(function(it) {
          return '<div class="infra-dot"><div class="idot ' + (it.on ? 'on' : 'off') + '"></div>' + it.name + '</div>';
        }).join('') +
        '<div class="infra-dot" style="color:#888;font-weight:600">' + running + '/' + data.agents.length + ' agents</div>';
    }

    function makeCubes(status) {
      var cubes = '';
      for (var i = 0; i < 16; i++) {
        cubes += '<div class="cube"></div>';
      }
      return '<div class="cubes-row ' + status + '">' + cubes + '</div>';
    }

    function renderAgents(agentStatuses) {
      var html = '';
      var avatars = { 1: 'M', 2: 'O1', 3: 'O2', 4: 'O3', 5: 'QA' };
      agents.forEach(function(agent, i) {
        var s = agentStatuses[i] || { status: 'offline', output: '' };
        var output = (s.output || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var lastLines = output.split('\\n').filter(function(l){ return l.trim(); }).slice(-5).join('\\n');
        var extraClass = agent.id === 1 ? ' mgr' : (agent.id === 5 ? ' qa' : '');
        html +=
          '<div class="agent-box ' + s.status + extraClass + '">' +
            '<div class="box-top">' +
              '<div class="box-identity">' +
                '<div class="box-avatar" style="color:' + agent.color + '">' + avatars[agent.id] + '</div>' +
                '<div>' +
                  '<div class="box-name" style="color:' + agent.color + '">' + agent.name + '</div>' +
                  '<div class="box-role">' + agent.role + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="box-status ' + s.status + '">' + s.status + '</div>' +
            '</div>' +
            makeCubes(s.status === 'running' ? 'scanning' : s.status) +
            '<div class="box-terminal">' + (lastLines || 'No output yet') + '</div>' +
          '</div>';
      });
      document.getElementById('agentGrid').innerHTML = html;
    }

    function timeAgo(ts) {
      var sec = Math.floor((Date.now() / 1000) - ts);
      if (sec < 0) sec = 0;
      if (sec < 60) return sec + 's ago';
      if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
      if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
      return Math.floor(sec / 86400) + 'd ago';
    }

    function renderPipeline(data) {
      var badge = document.getElementById('buildBadge');
      var stats = document.getElementById('buildStats');
      var el = document.getElementById('buildEvents');

      var total = data.prospects + data.drafts + data.approved + data.assets;
      if (total === 0) {
        badge.innerHTML = '<div class="build-dot none"></div><span style="color:#555">No activity</span>';
        stats.innerHTML = '';
        return;
      }

      var dotClass = data.approved > 0 ? 'pass' : (data.drafts > 0 ? 'none' : 'none');
      var statusText = data.approved > 0 ? 'ACTIVE' : 'WARMING UP';
      var statusColor = data.approved > 0 ? '#5a5' : '#da5';
      badge.innerHTML = '<div class="build-dot ' + dotClass + '"></div><span style="color:' + statusColor + '">' + statusText + '</span>';

      stats.innerHTML =
        '<div>Prospects: <span class="stat-val">' + data.prospects + '</span></div>' +
        '<div>Drafts: <span class="stat-val">' + data.drafts + '</span></div>' +
        '<div>Approved: <span class="stat-val">' + data.approved + '</span></div>' +
        '<div>Assets: <span class="stat-val">' + data.assets + '</span></div>';
      stats.style.marginBottom = '10px';

      if (data.events.length === 0) return;
      var html = '';
      data.events.forEach(function(ev) {
        var icon = ev.type === 'prospect' ? '&#x25C6;' : (ev.type === 'approved' ? '&#x2713;' : '&#x2709;');
        var msg = (ev.msg || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var company = (ev.company || '').replace(/</g, '&lt;');
        if (company.length > 20) company = company.substring(0, 20) + '...';
        html +=
          '<div class="build-ev ' + ev.type + '">' +
            '<div class="build-icon">' + icon + '</div>' +
            '<div class="build-sha">' + company + '</div>' +
            '<div class="build-msg">' + msg + '</div>' +
            '<div class="build-time">' + timeAgo(ev.ts) + '</div>' +
          '</div>';
      });
      el.innerHTML = html;
    }

    var allStreamEvents = [];
    var MAX_STREAM = 100;

    function renderStream(events, total) {
      for (var i = 0; i < events.length; i++) {
        allStreamEvents.unshift(events[i]);
      }
      while (allStreamEvents.length > MAX_STREAM) allStreamEvents.pop();

      var body = document.getElementById('streamBody');
      var html = '';
      for (var i = 0; i < allStreamEvents.length; i++) {
        var ev = allStreamEvents[i];
        var t = new Date(ev.ts);
        var ts = t.getFullYear() + '-' +
          String(t.getMonth()+1).padStart(2,'0') + '-' +
          String(t.getDate()).padStart(2,'0') + ' ' +
          String(t.getHours()).padStart(2,'0') + ':' +
          String(t.getMinutes()).padStart(2,'0') + ':' +
          String(t.getSeconds()).padStart(2,'0');
        var text = ev.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var hi = text.includes('prospect') || text.includes('email') || text.includes('Error') || text.includes('Created') || text.includes('Updated') || text.includes('approved') || text.includes('PASS') || text.includes('done') || text.includes('found');
        html += '<div class="ev">' +
          '<div class="ev-top">' +
            '<span class="ev-tag" style="color:' + ev.color + '">' + ev.agentName + '</span>' +
            '<span class="ev-time">' + ts + '</span>' +
          '</div>' +
          '<div class="ev-msg' + (hi ? ' hi' : '') + '">' + text + '</div>' +
        '</div>';
      }
      body.innerHTML = html || '<div style="padding:24px;color:#333;font-size:12px;text-align:center">Waiting for activity...</div>';
    }

    function renderCommits(commits) {
      var el = document.getElementById('gitLog');
      if (!commits || !commits.length) { el.innerHTML = '<span style="color:#333">No commits yet</span>'; return; }
      el.innerHTML = commits.map(function(c) {
        var parts = c.split('|');
        var sha = parts[0] || '';
        var dateStr = parts[1] || '';
        var msg = parts.slice(2).join('|') || '';
        var dt = '';
        if (dateStr) {
          var d = new Date(dateStr.trim());
          if (!isNaN(d.getTime())) {
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            dt = months[d.getMonth()] + ' ' +
              String(d.getDate()).padStart(2,'0') + ' ' +
              String(d.getHours()).padStart(2,'0') + ':' +
              String(d.getMinutes()).padStart(2,'0');
          }
        }
        return '<div class="gc"><span class="gh">' + sha + '</span> <span style="color:#555">' + dt + '</span> ' + msg + '</div>';
      }).join('');
    }

    function renderOutreach(data) {
      var el = document.getElementById('reviewEvents');
      if (!data.emails || data.emails.length === 0) return;
      var html = '';
      data.emails.forEach(function(r) {
        var body = (r.body || r.preview || '').replace(/\\|/g, '\\n').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var status = (r.status || 'draft').toUpperCase();
        html +=
          '<div class="review-ev" onclick="this.classList.toggle(&quot;expanded&quot;)">' +
            '<div class="review-top">' +
              '<span class="review-verdict ' + status + '">' + status + '</span>' +
              '<span class="review-sha">' + (r.company || r.to || '').substring(0,20) + '</span>' +
              '<span class="review-msg">' + (r.subject || r.msg || '').replace(/</g, '&lt;') + '</span>' +
              '<span class="review-time">' + (r.createdBy || '') + '</span>' +
            '</div>' +
            '<div class="review-body">' + body + '</div>' +
          '</div>';
      });
      el.innerHTML = html;
    }

    function renderQaReviews(data) {
      var el = document.getElementById('qaEvents');
      if (!data.reviews || data.reviews.length === 0) return;
      var html = '';
      data.reviews.forEach(function(r) {
        var feedback = (r.feedback || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var verdict = (r.verdict || 'PASS').toUpperCase();
        var item = (r.item || '').replace(/</g, '&lt;');
        html +=
          '<div class="qa-ev" onclick="this.classList.toggle(&quot;expanded&quot;)">' +
            '<div class="qa-top">' +
              '<span class="qa-verdict ' + verdict + '">' + verdict + '</span>' +
              '<span class="qa-item">' + item.substring(0, 30) + '</span>' +
              '<span class="qa-feedback">' + feedback.substring(0, 80) + '</span>' +
              '<span class="qa-time">' + (r.timestamp || '') + '</span>' +
            '</div>' +
            '<div class="qa-body">' + feedback + '</div>' +
          '</div>';
      });
      el.innerHTML = html;
    }

    function renderProspects(data) {
      var el = document.getElementById('alertEvents');
      if (!data.prospects || data.prospects.length === 0) return;
      var html = '';
      data.prospects.forEach(function(a) {
        var details = (a.notes || '').replace(/\\|/g, '\\n').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var summary = (a.company || a.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var country = (a.country || 'NEW').toUpperCase();
        var temp = country.length <= 4 ? country : 'NEW';
        html +=
          '<div class="alert-ev" onclick="this.classList.toggle(&quot;expanded&quot;)">' +
            '<div class="alert-top">' +
              '<span class="alert-severity NEW">' + (a.country || 'NEW') + '</span>' +
              '<span class="alert-summary">' + summary + ' — ' + (a.locations || '?') + ' locations</span>' +
              '<span class="alert-count">' + (a.addedBy || '') + '</span>' +
              '<span class="alert-time">' + (a.timestamp || '') + '</span>' +
            '</div>' +
            '<div class="alert-body">' + details + '\\nBrands: ' + (Array.isArray(a.brands) ? a.brands.join(', ') : (a.brands || '')) + '</div>' +
          '</div>';
      });
      el.innerHTML = html;
    }

    fetchStatus();
    fetchStream();
    fetchPipeline();
    fetchOutreach();
    fetchQaReviews();
    fetchProspects();
    setInterval(fetchStatus, 5000);
    setInterval(fetchStream, 3000);
    setInterval(fetchPipeline, 5000);
    setInterval(fetchOutreach, 8000);
    setInterval(fetchQaReviews, 8000);
    setInterval(fetchProspects, 10000);
  </script>
</body>
</html>`);
});

// Status API
app.get("/api/status", (_req, res) => {
  const session = sessionExists();

  const prospectCount = countLines(PROSPECTS_LOG);
  const draftCount = countLines(OUTREACH_DRAFT_LOG);
  const approvedCount = countLines(OUTREACH_APPROVED_LOG);
  const assetCount = countLines(ASSETS_LOG);

  const agents = AGENTS.map((agent) => ({
    id: agent.id, name: agent.name,
    status: session ? getAgentStatus(agent.windowIdx) : "offline",
    output: session ? getAgentOutput(agent.windowIdx) : "",
  }));
  res.json({ session, prospectCount, draftCount, approvedCount, assetCount, agents });
});

// Campaign pipeline API
app.get("/api/pipeline", (_req, res) => {
  const stats = getPipelineStats();
  res.json(stats);
});

// Outreach emails API — shows both drafts and approved
app.get("/api/outreach", (_req, res) => {
  const drafts = readJsonl(OUTREACH_DRAFT_LOG, 15);
  const approved = readJsonl(OUTREACH_APPROVED_LOG, 15);
  // Merge and sort by timestamp
  const all = [...drafts, ...approved].sort((a, b) => {
    const ta = a.timestamp || "";
    const tb = b.timestamp || "";
    return tb.localeCompare(ta);
  });
  res.json({ emails: all.slice(0, 20) });
});

// QA Reviews API
app.get("/api/qa-reviews", (_req, res) => {
  const reviews = readJsonl(QA_REVIEWS_LOG, 20);
  res.json({ reviews });
});

// Prospects API
app.get("/api/prospects", (_req, res) => {
  const prospects = readJsonl(PROSPECTS_LOG, 20);
  res.json({ prospects });
});

// Activity stream API
app.get("/api/stream", (req, res) => {
  const since = parseInt(req.query.since as string) || 0;
  const events = activityStream.slice(since);
  const commits = getRecentCommits(15);
  res.json({ events, total: activityStream.length, commits });
});

// Launch agent
app.post("/api/agent/:id/launch", (req, res) => {
  const id = parseInt(req.params.id);
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  try {
    const claudeBin = `/usr/local/bin/claude`;
    const model = "claude-sonnet-4-20250514";
    execSync(`tmux send-keys -t ${SESSION}:${agent.windowIdx} '${claudeBin} --model ${model}' Enter`, { stdio: "pipe" });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Send custom message to agent
app.post("/api/agent/:id/send", (req, res) => {
  const id = parseInt(req.params.id);
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const message = req.body.message as string;
  if (!message) return res.status(400).json({ error: "message required" });
  try {
    const fs = require("fs");
    const tmpFile = `/tmp/agent-msg-${agent.id}.txt`;
    fs.writeFileSync(tmpFile, message);
    execSync(`tmux load-buffer ${tmpFile} && tmux paste-buffer -t ${SESSION}:${agent.windowIdx}`, { stdio: "pipe" });
    execSync(`tmux send-keys -t ${SESSION}:${agent.windowIdx} '' Enter`, { stdio: "pipe" });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

const PORT = 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Commercial Ops Control Panel running at http://0.0.0.0:${PORT}`);
});
