import express from "express";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

const app = express();
const PORT = 3001;
const SESSION = "commercial-ops";
const DATA_DIR = "/tmp/commercial-ops";

const AGENTS = [
  { id: 1, name: "Director", window: "Director", windowIdx: 0, color: "#d97757", role: "Campaign Coordinator" },
  { id: 2, name: "Research", window: "Research", windowIdx: 1, color: "#3b82f6", role: "Market Intelligence" },
  { id: 3, name: "SDR", window: "SDR", windowIdx: 2, color: "#22c55e", role: "Outreach & Email" },
  { id: 4, name: "Marketing", window: "Marketing", windowIdx: 3, color: "#8b5cf6", role: "Content & Landing Page" },
];

// ── Activity stream ──
interface ActivityEvent { ts: number; agentId: number; agentName: string; color: string; text: string; }
const activityStream: ActivityEvent[] = [];
const MAX_ACTIVITY = 200;
const previousOutputs: Record<number, string> = {};

function sessionExists(): boolean {
  try { execSync(`tmux has-session -t ${SESSION} 2>/dev/null`); return true; } catch { return false; }
}

function getAgentStatus(windowIdx: number): string {
  try {
    const pane = execSync(`tmux list-panes -t ${SESSION}:${windowIdx} -F "#{pane_current_command}" 2>/dev/null`).toString().trim();
    if (pane.includes("claude") || pane.includes("node") || pane.includes("tsx")) return "running";
    return "idle";
  } catch { return "offline"; }
}

function getAgentOutput(windowIdx: number, lines = 15): string {
  try {
    return execSync(`tmux capture-pane -t ${SESSION}:${windowIdx} -p -S -${lines} 2>/dev/null`).toString().trim();
  } catch { return ""; }
}

function readJsonl(filename: string): any[] {
  try {
    const filepath = `${DATA_DIR}/${filename}`;
    if (!existsSync(filepath)) return [];
    return readFileSync(filepath, "utf-8").trim().split("\n").filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

// Poll agents for activity
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
          activityStream.push({ ts: Date.now(), agentId: agent.id, agentName: agent.name, color: agent.color, text: line.substring(0, 200) });
        }
        while (activityStream.length > MAX_ACTIVITY) activityStream.shift();
        previousOutputs[agent.id] = output;
      }
    } catch {}
  }
}
setInterval(pollAgentActivity, 3000);

// ── API routes ──
app.get("/api/status", (_req, res) => {
  const agents = AGENTS.map(a => ({
    ...a,
    status: sessionExists() ? getAgentStatus(a.windowIdx) : "offline",
    output: sessionExists() ? getAgentOutput(a.windowIdx) : "",
  }));
  const prospects = readJsonl("prospects.jsonl");
  const outreach = readJsonl("outreach.jsonl");
  const assets = readJsonl("assets.jsonl");
  const statusMd = (() => { try { return readFileSync(`${process.cwd()}/STATUS.md`, "utf-8"); } catch { return "_No status yet._"; } })();
  res.json({ agents, prospects, outreach, assets, activity: activityStream.slice(-50).reverse(), statusMd, sessionActive: sessionExists() });
});

// ── Dashboard HTML ──
app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commercial Ops — Salesteq Agent Dashboard</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'><rect width='32' height='32' rx='8' fill='%23131314'/><path d='M20.5 6 C11.5 6 10.5 10.5 16 16 C21.5 21.5 20.5 26 11.5 26' stroke='%23d97757' stroke-width='4.5' stroke-linecap='round' fill='none'/></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    ::selection { background: rgba(217, 119, 87, 0.25); }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #faf9f0; color: #131314; min-height: 100vh;
    }

    /* Header */
    .header {
      padding: 16px 28px; border-bottom: 1px solid rgba(19,19,20,0.06);
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(250,249,240,0.9); backdrop-filter: blur(16px);
      position: sticky; top: 0; z-index: 50;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }
    .header .subtitle { font-size: 11px; color: #3d3d3f; opacity: 0.5; margin-top: 1px; }
    .session-badge {
      font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 6px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .session-badge.active { background: rgba(34,197,94,0.1); color: #16a34a; }
    .session-badge.inactive { background: rgba(239,68,68,0.1); color: #dc2626; }

    /* Layout */
    .layout { display: flex; min-height: calc(100vh - 56px); }
    .main { flex: 1; padding: 24px; overflow-y: auto; }
    .sidebar { width: 380px; border-left: 1px solid rgba(19,19,20,0.04); padding: 24px; overflow-y: auto; background: #f0efe4; }

    /* Section titles */
    .section-title {
      font-size: 10px; font-weight: 700; color: #d97757;
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px;
    }

    /* Agent Grid */
    .agents-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 28px; }
    .agent-card {
      background: white; border: 1px solid rgba(19,19,20,0.06); border-radius: 14px;
      padding: 18px; transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
    }
    .agent-card:hover { border-color: rgba(19,19,20,0.12); box-shadow: 0 4px 24px rgba(19,19,20,0.04); }
    .agent-card.running { border-left: 3px solid var(--agent-color, #d97757); }
    .agent-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .agent-identity { display: flex; align-items: center; gap: 10px; }
    .agent-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: white;
    }
    .agent-name { font-size: 14px; font-weight: 700; }
    .agent-role { font-size: 11px; color: #3d3d3f; opacity: 0.5; margin-top: 1px; }
    .agent-status {
      font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 5px;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .agent-status.running { background: rgba(217,119,87,0.1); color: #d97757; }
    .agent-status.idle { background: rgba(19,19,20,0.04); color: #3d3d3f; }
    .agent-status.offline { background: rgba(239,68,68,0.08); color: #dc2626; }

    /* Scanner */
    .scanner { display: flex; gap: 2px; margin-bottom: 12px; height: 8px; align-items: center; }
    .scanner-dot { width: 5px; height: 5px; border-radius: 1px; background: rgba(19,19,20,0.04); transition: all 0.15s; }
    .scanner.running .scanner-dot { animation: scan 2s ease-in-out infinite; }
    @keyframes scan {
      0%, 100% { background: rgba(19,19,20,0.04); }
      50% { background: var(--agent-color, #d97757); box-shadow: 0 0 6px var(--agent-color, #d97757); }
    }
    ${Array.from({length: 16}, (_, i) => `.scanner.running .scanner-dot:nth-child(${i+1}) { animation-delay: ${(i * 0.06).toFixed(2)}s; }`).join('\n    ')}

    /* Terminal preview */
    .agent-terminal {
      background: #131314; border-radius: 8px; padding: 10px 12px;
      font-family: 'JetBrains Mono', monospace; font-size: 10px; line-height: 1.6;
      color: rgba(250,249,240,0.5); height: 72px; overflow: hidden;
      white-space: pre-wrap; word-break: break-all;
    }

    /* Pipeline Summary */
    .pipeline { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .pipe-card {
      background: white; border: 1px solid rgba(19,19,20,0.06); border-radius: 12px;
      padding: 20px; text-align: center;
    }
    .pipe-num { font-size: 32px; font-weight: 800; letter-spacing: -0.04em; color: #d97757; }
    .pipe-label { font-size: 11px; color: #3d3d3f; opacity: 0.5; margin-top: 4px; }

    /* Tables */
    .data-section { margin-bottom: 28px; }
    .data-table {
      width: 100%; background: white; border: 1px solid rgba(19,19,20,0.06);
      border-radius: 12px; overflow: hidden; border-collapse: collapse;
    }
    .data-table th {
      text-align: left; padding: 10px 16px; font-size: 10px; font-weight: 700;
      color: #3d3d3f; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.06em;
      border-bottom: 1px solid rgba(19,19,20,0.04); background: rgba(19,19,20,0.01);
    }
    .data-table td {
      padding: 10px 16px; font-size: 13px; border-bottom: 1px solid rgba(19,19,20,0.03);
      vertical-align: top;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: rgba(217,119,87,0.02); }
    .badge {
      display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 7px;
      border-radius: 4px; background: rgba(217,119,87,0.08); color: #d97757;
    }

    /* Activity Stream */
    .activity-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 28px; }
    .activity-item {
      display: flex; gap: 10px; padding: 8px 12px; border-radius: 8px;
      font-size: 12px; transition: background 0.15s;
    }
    .activity-item:hover { background: rgba(19,19,20,0.03); }
    .activity-agent {
      font-weight: 700; font-size: 10px; min-width: 60px; flex-shrink: 0;
      padding-top: 1px;
    }
    .activity-text { color: #3d3d3f; word-break: break-word; line-height: 1.5; }
    .activity-time { font-size: 10px; color: #3d3d3f; opacity: 0.3; margin-left: auto; flex-shrink: 0; font-family: 'JetBrains Mono', monospace; }

    /* Status markdown */
    .status-box {
      background: white; border: 1px solid rgba(19,19,20,0.06); border-radius: 12px;
      padding: 20px; font-size: 13px; line-height: 1.7; white-space: pre-wrap;
      font-family: 'JetBrains Mono', monospace; color: #3d3d3f;
      max-height: 300px; overflow-y: auto;
    }

    /* Empty state */
    .empty { text-align: center; padding: 40px; color: #3d3d3f; opacity: 0.3; font-size: 13px; }

    /* Outreach email preview */
    .email-preview { max-width: 100%; }
    .email-subject { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
    .email-to { font-size: 11px; color: #3d3d3f; opacity: 0.5; }
    .email-body { font-size: 12px; color: #3d3d3f; line-height: 1.5; margin-top: 6px; max-height: 60px; overflow: hidden; }

    /* Responsive */
    @media (max-width: 1100px) {
      .layout { flex-direction: column; }
      .sidebar { width: 100%; border-left: none; border-top: 1px solid rgba(19,19,20,0.04); }
      .agents-grid { grid-template-columns: 1fr; }
      .pipeline { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-left">
      <svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="8" fill="#131314"/><path d="M20.5 6 C11.5 6 10.5 10.5 16 16 C21.5 21.5 20.5 26 11.5 26" stroke="#d97757" stroke-width="4.5" stroke-linecap="round" fill="none"/></svg>
      <div>
        <h1>Commercial Ops</h1>
        <div class="subtitle">European Automotive Expansion Campaign</div>
      </div>
    </div>
    <div id="session-status" class="session-badge inactive">Offline</div>
  </header>

  <div class="layout">
    <div class="main">
      <!-- Pipeline -->
      <div class="section-title">Pipeline</div>
      <div class="pipeline" id="pipeline">
        <div class="pipe-card"><div class="pipe-num" id="p-prospects">0</div><div class="pipe-label">Prospects</div></div>
        <div class="pipe-card"><div class="pipe-num" id="p-outreach">0</div><div class="pipe-label">Emails Drafted</div></div>
        <div class="pipe-card"><div class="pipe-num" id="p-assets">0</div><div class="pipe-label">Assets</div></div>
        <div class="pipe-card"><div class="pipe-num" id="p-agents">0/4</div><div class="pipe-label">Agents Active</div></div>
      </div>

      <!-- Agents -->
      <div class="section-title">Agent Team</div>
      <div class="agents-grid" id="agents-grid"></div>

      <!-- Prospects -->
      <div class="data-section">
        <div class="section-title">Prospects</div>
        <table class="data-table" id="prospects-table">
          <thead><tr><th>Company</th><th>Country</th><th>Brands</th><th>Locations</th><th>Notes</th></tr></thead>
          <tbody id="prospects-body"><tr><td colspan="5" class="empty">Awaiting research agent...</td></tr></tbody>
        </table>
      </div>

      <!-- Outreach -->
      <div class="data-section">
        <div class="section-title">Outreach Emails</div>
        <table class="data-table" id="outreach-table">
          <thead><tr><th>To</th><th>Company</th><th>Subject</th><th>Preview</th></tr></thead>
          <tbody id="outreach-body"><tr><td colspan="4" class="empty">Awaiting SDR agent...</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="sidebar">
      <!-- Activity -->
      <div class="section-title">Activity Stream</div>
      <div class="activity-list" id="activity-list">
        <div class="empty">Waiting for agent activity...</div>
      </div>

      <!-- Status -->
      <div class="section-title">Director Status</div>
      <div class="status-box" id="status-md">Awaiting Director agent...</div>

      <!-- Assets -->
      <div class="section-title" style="margin-top: 20px;">Campaign Assets</div>
      <div id="assets-list" class="activity-list">
        <div class="empty">No assets yet...</div>
      </div>
    </div>
  </div>

  <script>
    const AGENTS_META = ${JSON.stringify(AGENTS)};

    function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function timeAgo(ts) {
      const s = Math.floor((Date.now() - ts) / 1000);
      if (s < 60) return s + 's';
      if (s < 3600) return Math.floor(s/60) + 'm';
      return Math.floor(s/3600) + 'h';
    }

    function renderAgents(agents) {
      const grid = document.getElementById('agents-grid');
      let activeCount = 0;
      grid.innerHTML = agents.map(a => {
        const meta = AGENTS_META.find(m => m.id === a.id);
        if (a.status === 'running') activeCount++;
        const scannerDots = Array.from({length: 16}, () => '<div class="scanner-dot"></div>').join('');
        const lines = (a.output || '').split('\\n').filter(l => l.trim()).slice(-5);
        return \`<div class="agent-card \${a.status}" style="--agent-color: \${a.color}">
          <div class="agent-top">
            <div class="agent-identity">
              <div class="agent-avatar" style="background: \${a.color}">\${a.name[0]}</div>
              <div><div class="agent-name">\${escHtml(a.name)}</div><div class="agent-role">\${escHtml(a.role)}</div></div>
            </div>
            <div class="agent-status \${a.status}">\${a.status}</div>
          </div>
          <div class="scanner \${a.status}">\${scannerDots}</div>
          <div class="agent-terminal">\${escHtml(lines.join('\\n'))}</div>
        </div>\`;
      }).join('');
      document.getElementById('p-agents').textContent = activeCount + '/4';
    }

    function renderProspects(prospects) {
      const body = document.getElementById('prospects-body');
      if (!prospects.length) { body.innerHTML = '<tr><td colspan="5" class="empty">Awaiting research agent...</td></tr>'; return; }
      body.innerHTML = prospects.slice(-30).reverse().map(p => \`<tr>
        <td><strong>\${escHtml(p.company || '')}</strong></td>
        <td>\${escHtml(p.country || '')}</td>
        <td>\${escHtml(Array.isArray(p.brands) ? p.brands.join(', ') : (p.brands || ''))}</td>
        <td>\${escHtml(String(p.locations || ''))}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">\${escHtml(p.notes || '')}</td>
      </tr>\`).join('');
      document.getElementById('p-prospects').textContent = prospects.length;
    }

    function renderOutreach(outreach) {
      const body = document.getElementById('outreach-body');
      if (!outreach.length) { body.innerHTML = '<tr><td colspan="4" class="empty">Awaiting SDR agent...</td></tr>'; return; }
      body.innerHTML = outreach.slice(-20).reverse().map(o => \`<tr>
        <td>\${escHtml(o.to || '')}</td>
        <td>\${escHtml(o.company || '')}</td>
        <td><strong>\${escHtml(o.subject || '')}</strong></td>
        <td style="max-width:300px"><div class="email-body">\${escHtml((o.body || '').substring(0, 150))}</div></td>
      </tr>\`).join('');
      document.getElementById('p-outreach').textContent = outreach.length;
    }

    function renderActivity(activity) {
      const list = document.getElementById('activity-list');
      if (!activity.length) { list.innerHTML = '<div class="empty">Waiting for agent activity...</div>'; return; }
      list.innerHTML = activity.slice(0, 30).map(a => \`<div class="activity-item">
        <div class="activity-agent" style="color: \${a.color}">\${escHtml(a.agentName)}</div>
        <div class="activity-text">\${escHtml(a.text)}</div>
        <div class="activity-time">\${timeAgo(a.ts)}</div>
      </div>\`).join('');
    }

    function renderAssets(assets) {
      const list = document.getElementById('assets-list');
      if (!assets.length) { list.innerHTML = '<div class="empty">No assets yet...</div>'; return; }
      list.innerHTML = assets.slice(-15).reverse().map(a => \`<div class="activity-item">
        <div class="badge">\${escHtml(a.type || 'asset')}</div>
        <div class="activity-text"><strong>\${escHtml(a.title || '')}</strong></div>
      </div>\`).join('');
      document.getElementById('p-assets').textContent = assets.length;
    }

    async function refresh() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const badge = document.getElementById('session-status');
        badge.textContent = data.sessionActive ? 'Live' : 'Offline';
        badge.className = 'session-badge ' + (data.sessionActive ? 'active' : 'inactive');
        renderAgents(data.agents);
        renderProspects(data.prospects);
        renderOutreach(data.outreach);
        renderActivity(data.activity);
        renderAssets(data.assets);
        document.getElementById('status-md').textContent = data.statusMd;
      } catch (e) {
        console.error('Refresh failed:', e);
      }
    }

    refresh();
    setInterval(refresh, 4000);
  </script>
</body>
</html>`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Commercial Ops Dashboard: http://localhost:${PORT}`);
});
