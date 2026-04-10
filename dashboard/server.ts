import express from "express";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const app = express();
const PORT = 3001;
const DATA_DIR = "/tmp/commercial-ops";
const TMUX_SESSION = "commercial-ops";

// --- Agent definitions ---
const AGENTS = [
  { id: 1, name: "Manager", windowIdx: 0, color: "#e8720c", role: "Campaign Coordinator" },
  { id: 2, name: "Operator-1", windowIdx: 1, color: "#3b82f6", role: "Commercial Operator" },
  { id: 3, name: "Operator-2", windowIdx: 2, color: "#22c55e", role: "Commercial Operator" },
  { id: 4, name: "Operator-3", windowIdx: 3, color: "#8b5cf6", role: "Commercial Operator" },
  { id: 5, name: "QA", windowIdx: 4, color: "#06b6d4", role: "Quality Review" },
];

// --- Helpers ---
function readJsonl(filename: string): any[] {
  const fp = path.join(DATA_DIR, filename);
  try {
    const raw = fs.readFileSync(fp, "utf-8").trim();
    if (!raw) return [];
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function captureTmuxPane(windowIdx: number): string[] {
  try {
    const out = execSync(
      `tmux capture-pane -t ${TMUX_SESSION}:${windowIdx} -p -S -30 2>/dev/null`,
      { timeout: 2000, encoding: "utf-8" }
    );
    const lines = out.split("\n").filter((l) => l.trim().length > 0);
    return lines.slice(-5);
  } catch {
    return ["[waiting for output...]"];
  }
}

function getAgentStatuses() {
  return AGENTS.map((a) => {
    const lines = captureTmuxPane(a.windowIdx);
    const hasRecent = lines.length > 1;
    return {
      ...a,
      status: hasRecent ? "active" : "idle",
      terminalLines: lines,
    };
  });
}

function getGitCommits(): any[] {
  try {
    const out = execSync(
      `cd /root/commercial-ops && git log --oneline --format='%H|||%s|||%an|||%ar' -20 2>/dev/null`,
      { timeout: 3000, encoding: "utf-8" }
    );
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, msg, author, rel] = line.split("|||");
        return { hash: hash?.slice(0, 8), message: msg, author, relative: rel };
      });
  } catch {
    return [];
  }
}

// --- API Routes ---
app.get("/api/status", (_req, res) => {
  const agents = getAgentStatuses();
  const active = agents.filter((a) => a.status === "active").length;
  const leads = readJsonl("prospects.jsonl");
  const drafts = readJsonl("outreach-draft.jsonl");
  const approved = readJsonl("outreach-approved.jsonl");
  const assets = readJsonl("assets.jsonl");
  const qa = readJsonl("qa-reviews.jsonl");
  res.json({
    agents,
    activeCount: active,
    totalCount: agents.length,
    counts: {
      leads: leads.length,
      outreach: drafts.length + approved.length,
      assets: assets.length,
      qa: qa.length,
    },
  });
});

app.get("/api/stream", (_req, res) => {
  const commits = getGitCommits();
  res.json({ commits, events: [] });
});

app.get("/api/leads", (_req, res) => {
  res.json(readJsonl("prospects.jsonl"));
});

app.get("/api/outreach", (_req, res) => {
  const drafts = readJsonl("outreach-draft.jsonl");
  const approved = readJsonl("outreach-approved.jsonl");
  res.json({ drafts, approved });
});

app.get("/api/assets", (_req, res) => {
  res.json(readJsonl("assets.jsonl"));
});

app.get("/api/qa", (_req, res) => {
  res.json(readJsonl("qa-reviews.jsonl"));
});

// --- Dashboard HTML ---
app.get("/", (_req, res) => {
  res.type("html").send(getDashboardHtml());
});

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Salesteq \u2014 Commercial Ops</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#111;--card:#1a1a1a;--border:#252525;--header:#151515;--terminal:#131313;
  --text:#ccc;--text2:#777;--text3:#555;--accent:#e8720c;
  --font:-apple-system,BlinkMacSystemFont,'SF Pro','Segoe UI',sans-serif;
  --mono:'SF Mono','Fira Code','Consolas',monospace;
  --blue:#3b82f6;--green:#22c55e;--purple:#8b5cf6;--cyan:#06b6d4;--amber:#f59e0b;--red:#ef4444;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;overflow:hidden}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

/* Scrollbar */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#333}

/* === TOP BAR === */
.topbar{
  position:fixed;top:0;left:0;right:0;height:54px;
  background:var(--header);border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;z-index:100;
  backdrop-filter:blur(12px);
}
.topbar-left{display:flex;align-items:center;gap:14px}
.topbar-left svg{width:30px;height:30px;flex-shrink:0}
.topbar-title{font-size:17px;font-weight:600;color:var(--text);letter-spacing:-0.4px}
.topbar-right{display:flex;align-items:center;gap:16px;font-size:13px;color:var(--text2)}
.live-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green),0 0 16px rgba(34,197,94,.3);animation:pulse-dot 2s ease-in-out infinite}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
.agent-count-display{font-family:var(--mono);font-size:12px;color:var(--text2);letter-spacing:.3px}

/* === TABS === */
.tabs{display:flex;gap:3px}
.tab{
  padding:9px 18px;font-size:13px;font-weight:500;color:var(--text3);
  cursor:pointer;border-radius:7px;transition:all .2s;
  position:relative;user-select:none;white-space:nowrap;
}
.tab:hover{color:var(--text2);background:rgba(255,255,255,.03)}
.tab.active{color:var(--accent);background:rgba(232,114,12,.08)}
.tab .badge{
  font-size:10px;font-family:var(--mono);
  background:rgba(255,255,255,.06);color:var(--text3);
  padding:2px 7px;border-radius:9px;margin-left:7px;vertical-align:middle;
  transition:all .2s;
}
.tab.active .badge{background:rgba(232,114,12,.15);color:var(--accent)}

/* === MAIN CONTENT === */
.main{position:fixed;top:54px;left:0;right:0;bottom:0;overflow-y:auto;overflow-x:hidden;padding:24px 28px}
.tab-content{display:none}
.tab-content.active{display:block;animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

/* =========================================
   MISSION CONTROL
   ========================================= */
.mc-layout{display:grid;grid-template-columns:1fr 360px;gap:24px;height:calc(100vh - 102px);min-width:0;overflow:hidden}
.agent-grid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:14px;min-width:0;overflow:hidden}
.agent-card{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:16px;display:flex;flex-direction:column;gap:10px;
  transition:border-color .3s,box-shadow .3s;min-width:0;overflow:hidden;
}
.agent-card:hover{border-color:rgba(255,255,255,.08);box-shadow:0 4px 20px rgba(0,0,0,.3)}
.agent-header{display:flex;align-items:center;gap:10px}
.agent-avatar{
  width:38px;height:38px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:15px;font-weight:700;color:#fff;flex-shrink:0;
  box-shadow:0 0 12px rgba(0,0,0,.4);
}
.agent-info{flex:1;min-width:0}
.agent-name{font-size:14px;font-weight:600;color:var(--text)}
.agent-role{font-size:11px;color:var(--text3);margin-top:1px}
.status-badge{
  font-size:9px;font-family:var(--mono);padding:3px 8px;border-radius:4px;
  text-transform:uppercase;letter-spacing:.6px;font-weight:700;flex-shrink:0;
}
.status-active{background:rgba(34,197,94,.1);color:var(--green);box-shadow:0 0 8px rgba(34,197,94,.1)}
.status-idle{background:rgba(119,119,119,.08);color:var(--text3)}

/* KITT Scanner */
.kitt-row{display:flex;gap:3px;height:6px;padding:0 2px}
.kitt-cell{flex:1;border-radius:2px;background:rgba(255,255,255,.03);transition:all .1s ease}

/* Terminal preview */
.term-preview{
  background:var(--terminal);border-radius:8px;
  padding:10px 12px;font-family:var(--mono);font-size:10.5px;line-height:1.6;
  color:var(--text3);flex:1;overflow:hidden;min-height:60px;
  border:1px solid rgba(255,255,255,.03);
}
.term-line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* Sidebar */
.sidebar{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  display:flex;flex-direction:column;overflow:hidden;
}
.sidebar-header{
  padding:16px 18px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;
}
.live-badge{
  font-size:9px;font-family:var(--mono);
  background:rgba(239,68,68,.12);color:var(--red);
  padding:3px 8px;border-radius:4px;text-transform:uppercase;
  letter-spacing:.6px;font-weight:700;animation:pulse-dot 2s infinite;
}
.sidebar-body{flex:1;overflow-y:auto;padding:4px 0}
.commit-item{padding:10px 18px;border-bottom:1px solid rgba(255,255,255,.025);transition:background .15s}
.commit-item:hover{background:rgba(255,255,255,.02)}
.commit-hash{font-family:var(--mono);color:var(--accent);font-size:11px;font-weight:500}
.commit-msg{color:var(--text2);margin-top:3px;font-size:12px;line-height:1.4}
.commit-meta{font-size:10px;color:var(--text3);margin-top:3px}

/* =========================================
   LEADS
   ========================================= */
.pipeline-row{display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap}
.pipeline-card{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:20px 24px;flex:1;min-width:150px;text-align:center;
  transition:border-color .2s;
}
.pipeline-card:hover{border-color:rgba(255,255,255,.08)}
.pipeline-num{font-size:32px;font-weight:800;color:var(--text);font-family:var(--mono);letter-spacing:-1px}
.pipeline-label{font-size:10px;color:var(--text3);margin-top:6px;text-transform:uppercase;letter-spacing:.8px;font-weight:500}
.leads-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding-bottom:40px}
.lead-card{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:20px;transition:border-color .3s,box-shadow .3s;
}
.lead-card:hover{border-color:rgba(255,255,255,.08);box-shadow:0 4px 20px rgba(0,0,0,.3)}
.lead-card.recent{
  border-left:3px solid var(--green);
  box-shadow:-6px 0 20px rgba(34,197,94,.06),0 0 0 1px rgba(34,197,94,.08);
}
.lead-company{font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px;letter-spacing:-0.3px}
.lead-country{font-size:13px;color:var(--text2);margin-bottom:12px}
.lead-brands{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
.brand-badge{
  font-size:10px;background:rgba(255,255,255,.05);color:var(--text2);
  padding:3px 9px;border-radius:5px;font-family:var(--mono);
  border:1px solid rgba(255,255,255,.04);
}
.lead-meta{font-size:12px;color:var(--text3);line-height:1.7}
.lead-meta a{font-size:12px;word-break:break-all}
.lead-contacts{margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.contact-line{font-size:11px;color:var(--text3);line-height:1.7}
.contact-name{color:var(--text2);font-weight:600}
.lead-notes{margin-top:10px;font-size:11px;color:var(--text3);font-style:italic;line-height:1.5}

/* =========================================
   OUTREACH
   ========================================= */
.section-title{
  font-size:16px;font-weight:600;color:var(--text);margin-bottom:16px;
  display:flex;align-items:center;gap:10px;
}
.section-title .count{font-size:12px;font-family:var(--mono);color:var(--text3)}
.email-list{display:flex;flex-direction:column;gap:10px;margin-bottom:36px}
.email-card{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:18px 20px;cursor:pointer;transition:border-color .2s;
}
.email-card:hover{border-color:rgba(255,255,255,.08)}
.email-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:12px}
.email-subject{font-size:15px;font-weight:600;color:var(--text);margin-bottom:2px}
.email-addr{font-size:11px;color:var(--text3);font-family:var(--mono);margin-bottom:2px}
.email-preview{font-size:12px;color:var(--text2);line-height:1.6;margin-top:6px}
.email-full{
  display:none;font-size:12px;color:var(--text2);line-height:1.8;
  margin-top:12px;padding-top:12px;border-top:1px solid var(--border);white-space:pre-wrap;
}
.email-card.expanded .email-full{display:block}
.email-card.expanded .email-preview{display:none}
.email-timestamp{font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:10px}
.outreach-status{
  font-size:9px;font-family:var(--mono);padding:3px 9px;border-radius:5px;
  text-transform:uppercase;letter-spacing:.6px;font-weight:700;flex-shrink:0;white-space:nowrap;
}
.outreach-draft{background:rgba(245,158,11,.1);color:var(--amber)}
.outreach-approved{background:rgba(34,197,94,.1);color:var(--green)}
.outreach-sent{background:rgba(59,130,246,.1);color:var(--blue)}

/* =========================================
   ASSETS
   ========================================= */
.assets-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding-bottom:40px}
.asset-card{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:20px;cursor:pointer;transition:border-color .2s,box-shadow .2s;
}
.asset-card:hover{border-color:rgba(255,255,255,.08);box-shadow:0 4px 20px rgba(0,0,0,.3)}
.asset-icon{font-size:30px;margin-bottom:10px}
.asset-title{font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px}
.asset-type{
  font-size:10px;font-family:var(--mono);color:var(--text3);
  text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;
}
.asset-preview{font-size:12px;color:var(--text2);line-height:1.6}
.asset-full{
  display:none;font-size:12px;color:var(--text2);line-height:1.8;
  margin-top:12px;padding-top:12px;border-top:1px solid var(--border);white-space:pre-wrap;
}
.asset-card.expanded .asset-full{display:block}
.asset-card.expanded .asset-preview{display:none}

/* =========================================
   QA REVIEWS
   ========================================= */
.qa-stats-row{display:flex;gap:14px;margin-bottom:28px}
.qa-stat{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:20px 28px;text-align:center;min-width:140px;
}
.qa-stat-num{font-size:32px;font-weight:800;font-family:var(--mono);letter-spacing:-1px}
.qa-stat-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-top:6px;font-weight:500}
.qa-list{display:flex;flex-direction:column;gap:10px;padding-bottom:40px}
.qa-card{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:18px 20px;cursor:pointer;transition:border-color .2s;
}
.qa-card:hover{border-color:rgba(255,255,255,.08)}
.qa-top{display:flex;justify-content:space-between;align-items:center;gap:12px}
.qa-company{font-size:15px;font-weight:600;color:var(--text)}
.qa-type{font-size:11px;color:var(--text3);font-family:var(--mono);margin-top:2px}
.verdict{
  font-size:9px;font-family:var(--mono);padding:3px 9px;border-radius:5px;
  text-transform:uppercase;letter-spacing:.6px;font-weight:700;flex-shrink:0;
}
.verdict-pass{background:rgba(34,197,94,.1);color:var(--green)}
.verdict-attention{background:rgba(245,158,11,.1);color:var(--amber)}
.qa-review-text{
  display:none;font-size:12px;color:var(--text2);line-height:1.8;
  margin-top:12px;padding-top:12px;border-top:1px solid var(--border);white-space:pre-wrap;
}
.qa-card.expanded .qa-review-text{display:block}
.qa-ts{font-size:10px;color:var(--text3);font-family:var(--mono)}

/* Empty state */
.empty-state{text-align:center;padding:60px 24px;color:var(--text3);font-size:13px;letter-spacing:.2px}
</style>
</head>
<body>

<!-- ====== TOP BAR ====== -->
<div class="topbar">
  <div class="topbar-left">
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5C25.2 5 5 25.2 5 50s20.2 45 45 45 45-20.2 45-45S74.8 5 50 5z" stroke="#e8720c" stroke-width="2.5" fill="none"/>
      <path d="M28 65c0 0 6-35 22-35s22 35 22 35" stroke="#e8720c" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M34 58c0 0 5-22 16-22s16 22 16 22" stroke="#e8720c" stroke-width="3" stroke-linecap="round" fill="none" opacity=".55"/>
      <circle cx="50" cy="36" r="3.5" fill="#e8720c"/>
    </svg>
    <span class="topbar-title">Commercial Ops</span>
  </div>
  <div class="tabs" id="tabs">
    <div class="tab active" data-tab="mission-control">Mission Control</div>
    <div class="tab" data-tab="leads">Leads <span class="badge" id="badge-leads">0</span></div>
    <div class="tab" data-tab="outreach">Outreach <span class="badge" id="badge-outreach">0</span></div>
    <div class="tab" data-tab="assets">Assets <span class="badge" id="badge-assets">0</span></div>
    <div class="tab" data-tab="qa">QA <span class="badge" id="badge-qa">0</span></div>
  </div>
  <div class="topbar-right">
    <div class="live-dot"></div>
    <span class="agent-count-display" id="agent-count">0/5 active</span>
  </div>
</div>

<!-- ====== MAIN ====== -->
<div class="main">

  <!-- Mission Control -->
  <div class="tab-content active" id="tab-mission-control">
    <div class="mc-layout">
      <div class="agent-grid" id="agent-grid"></div>
      <div class="sidebar">
        <div class="sidebar-header">Activity Stream <span class="live-badge">LIVE</span></div>
        <div class="sidebar-body" id="activity-stream"></div>
      </div>
    </div>
  </div>

  <!-- Leads -->
  <div class="tab-content" id="tab-leads">
    <div class="pipeline-row" id="pipeline-row"></div>
    <div class="leads-grid" id="leads-grid"></div>
  </div>

  <!-- Outreach -->
  <div class="tab-content" id="tab-outreach">
    <div class="section-title">Drafts <span class="count" id="drafts-count"></span></div>
    <div class="email-list" id="drafts-list"></div>
    <div class="section-title">Approved <span class="count" id="approved-count"></span></div>
    <div class="email-list" id="approved-list"></div>
  </div>

  <!-- Assets -->
  <div class="tab-content" id="tab-assets">
    <div class="assets-grid" id="assets-grid"></div>
  </div>

  <!-- QA -->
  <div class="tab-content" id="tab-qa">
    <div class="qa-stats-row" id="qa-stats"></div>
    <div class="qa-list" id="qa-list"></div>
  </div>

</div>

<script>
(function(){
  // ========== Tab Switching ==========
  document.querySelectorAll('.tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
      document.querySelectorAll('.tab-content').forEach(function(tc){tc.classList.remove('active')});
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ========== Country Flags ==========
  var FLAGS = {
    DE:'\\u{1F1E9}\\u{1F1EA}',GERMANY:'\\u{1F1E9}\\u{1F1EA}',
    CH:'\\u{1F1E8}\\u{1F1ED}',SWITZERLAND:'\\u{1F1E8}\\u{1F1ED}',
    AT:'\\u{1F1E6}\\u{1F1F9}',AUSTRIA:'\\u{1F1E6}\\u{1F1F9}',
    UK:'\\u{1F1EC}\\u{1F1E7}',GB:'\\u{1F1EC}\\u{1F1E7}','UNITED KINGDOM':'\\u{1F1EC}\\u{1F1E7}',
    FR:'\\u{1F1EB}\\u{1F1F7}',FRANCE:'\\u{1F1EB}\\u{1F1F7}',
    NL:'\\u{1F1F3}\\u{1F1F1}',NETHERLANDS:'\\u{1F1F3}\\u{1F1F1}',
    US:'\\u{1F1FA}\\u{1F1F8}',IT:'\\u{1F1EE}\\u{1F1F9}',
    ES:'\\u{1F1EA}\\u{1F1F8}',BE:'\\u{1F1E7}\\u{1F1EA}',
    LU:'\\u{1F1F1}\\u{1F1FA}',PL:'\\u{1F1F5}\\u{1F1F1}',
    CZ:'\\u{1F1E8}\\u{1F1FF}',SE:'\\u{1F1F8}\\u{1F1EA}',
    DK:'\\u{1F1E9}\\u{1F1F0}',NO:'\\u{1F1F3}\\u{1F1F4}',
    FI:'\\u{1F1EB}\\u{1F1EE}',IE:'\\u{1F1EE}\\u{1F1EA}'
  };
  function flag(c){if(!c)return'\\u{1F30D}';return FLAGS[c.toUpperCase().trim()]||'\\u{1F30D}';}

  // ========== Asset Icons ==========
  function assetIcon(type){
    var m={'one-pager':'\\u{1F4C4}','linkedin-post':'\\u{1F4F1}','presentation':'\\u{1F4CA}','landing-page':'\\u{1F310}'};
    return m[type]||'\\u{1F4C4}';
  }

  // ========== HTML Escape ==========
  function esc(s){
    if(s===null||s===undefined)return'';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ========== KITT Scanner Animation ==========
  var kittPos = {};
  var kittDir = {};
  function updateKitt(){
    document.querySelectorAll('.kitt-row').forEach(function(row){
      var id = row.dataset.agentId;
      var color = row.dataset.color;
      var isActive = row.dataset.status === 'active';
      if(kittPos[id]===undefined){kittPos[id]=0;kittDir[id]=1;}
      if(isActive){
        kittPos[id]+=kittDir[id];
        if(kittPos[id]>=15)kittDir[id]=-1;
        if(kittPos[id]<=0)kittDir[id]=1;
      }
      var cells = row.querySelectorAll('.kitt-cell');
      for(var i=0;i<cells.length;i++){
        var dist = Math.abs(i - kittPos[id]);
        if(!isActive){
          cells[i].style.background='rgba(255,255,255,.03)';
          cells[i].style.boxShadow='none';
          cells[i].style.opacity='1';
          continue;
        }
        if(dist===0){
          cells[i].style.background=color;
          cells[i].style.boxShadow='0 0 8px '+color+',0 0 2px '+color;
          cells[i].style.opacity='1';
        }else if(dist===1){
          cells[i].style.background=color;
          cells[i].style.boxShadow='0 0 4px '+color;
          cells[i].style.opacity='0.5';
        }else if(dist===2){
          cells[i].style.background=color;
          cells[i].style.boxShadow='none';
          cells[i].style.opacity='0.2';
        }else if(dist===3){
          cells[i].style.background=color;
          cells[i].style.boxShadow='none';
          cells[i].style.opacity='0.08';
        }else{
          cells[i].style.background='rgba(255,255,255,.03)';
          cells[i].style.boxShadow='none';
          cells[i].style.opacity='1';
        }
      }
    });
  }
  setInterval(updateKitt, 75);

  // ========== RENDER: Mission Control ==========
  function renderAgents(agents){
    var grid = document.getElementById('agent-grid');
    var html = '';
    for(var a=0;a<agents.length;a++){
      var ag = agents[a];
      var initials = ag.name.charAt(0);
      var sc = ag.status==='active'?'status-active':'status-idle';
      var kittCells = '';
      for(var k=0;k<16;k++) kittCells+='<div class="kitt-cell"></div>';
      var termLines = '';
      var tl = ag.terminalLines||[];
      for(var t=0;t<tl.length;t++) termLines+='<div class="term-line">'+esc(tl[t])+'</div>';
      if(!termLines) termLines='<div class="term-line" style="color:var(--text3)">[waiting...]</div>';

      html+='<div class="agent-card">'+
        '<div class="agent-header">'+
          '<div class="agent-avatar" style="background:'+ag.color+'">'+esc(initials)+'</div>'+
          '<div class="agent-info"><div class="agent-name">'+esc(ag.name)+'</div><div class="agent-role">'+esc(ag.role)+'</div></div>'+
          '<span class="status-badge '+sc+'">'+ag.status+'</span>'+
        '</div>'+
        '<div class="kitt-row" data-agent-id="'+ag.id+'" data-color="'+ag.color+'" data-status="'+ag.status+'">'+kittCells+'</div>'+
        '<div class="term-preview">'+termLines+'</div>'+
      '</div>';
    }
    grid.innerHTML = html;
  }

  function renderStream(data){
    var el = document.getElementById('activity-stream');
    var commits = data.commits||[];
    if(!commits.length){
      el.innerHTML='<div class="empty-state">Waiting for activity...</div>';
      return;
    }
    var html='';
    for(var i=0;i<commits.length;i++){
      var c=commits[i];
      html+='<div class="commit-item">'+
        '<span class="commit-hash">'+esc(c.hash)+'</span>'+
        '<div class="commit-msg">'+esc(c.message)+'</div>'+
        '<div class="commit-meta">'+esc(c.author)+' \\u00b7 '+esc(c.relative)+'</div>'+
      '</div>';
    }
    el.innerHTML=html;
  }

  // ========== RENDER: Leads ==========
  function renderLeads(leads){
    // Pipeline counts
    var byCountry={};
    for(var i=0;i<leads.length;i++){
      var cc=(leads[i].country||'').toUpperCase().trim();
      byCountry[cc]=(byCountry[cc]||0)+1;
    }
    var deCount=(byCountry['DE']||0)+(byCountry['GERMANY']||0);
    var chCount=(byCountry['CH']||0)+(byCountry['SWITZERLAND']||0);
    var ukCount=(byCountry['UK']||0)+(byCountry['GB']||0)+(byCountry['UNITED KINGDOM']||0);
    var otherCount=leads.length-deCount-chCount-ukCount;

    var pRow=document.getElementById('pipeline-row');
    var buckets=[
      {n:leads.length,l:'Total Prospects'},
      {n:deCount,l:'Germany'},
      {n:chCount,l:'Switzerland'},
      {n:ukCount,l:'UK'},
      {n:Math.max(0,otherCount),l:'Other'}
    ];
    var pHtml='';
    for(var b=0;b<buckets.length;b++){
      pHtml+='<div class="pipeline-card"><div class="pipeline-num">'+buckets[b].n+'</div><div class="pipeline-label">'+buckets[b].l+'</div></div>';
    }
    pRow.innerHTML=pHtml;

    // Lead cards
    var now=Date.now();
    var grid=document.getElementById('leads-grid');
    var html='';
    for(var i=0;i<leads.length;i++){
      var l=leads[i];
      var isRecent=l.timestamp&&(now-new Date(l.timestamp).getTime())<300000;
      var brands='';
      if(l.brands&&l.brands.length){
        brands='<div class="lead-brands">';
        for(var j=0;j<l.brands.length;j++) brands+='<span class="brand-badge">'+esc(l.brands[j])+'</span>';
        brands+='</div>';
      }
      var contacts='';
      if(l.contacts&&l.contacts.length){
        contacts='<div class="lead-contacts">';
        for(var j=0;j<l.contacts.length;j++){
          var ct=l.contacts[j];
          contacts+='<div class="contact-line"><span class="contact-name">'+esc(ct.name)+'</span>'+(ct.title?' \\u2014 '+esc(ct.title):'')+(ct.email?' \\u00b7 '+esc(ct.email):'')+'</div>';
        }
        contacts+='</div>';
      }
      html+='<div class="lead-card'+(isRecent?' recent':'')+'">'+
        '<div class="lead-company">'+esc(l.company)+'</div>'+
        '<div class="lead-country">'+flag(l.country)+' '+esc(l.country)+(l.locations?' \\u00b7 '+l.locations+' locations':'')+'</div>'+
        brands+
        '<div class="lead-meta">'+(l.website?'<a href="'+esc(l.website)+'" target="_blank" rel="noopener">'+esc(l.website)+'</a>':'')+'</div>'+
        contacts+
        (l.notes?'<div class="lead-notes">'+esc(l.notes)+'</div>':'')+
      '</div>';
    }
    grid.innerHTML=html||'<div class="empty-state">No prospects yet</div>';
  }

  // ========== RENDER: Outreach ==========
  function renderOutreach(data){
    var drafts=data.drafts||[];
    var approved=data.approved||[];
    document.getElementById('drafts-count').textContent='('+drafts.length+')';
    document.getElementById('approved-count').textContent='('+approved.length+')';

    function emailCard(e,statusClass,statusLabel){
      var preview=(e.body||'').slice(0,200)+((e.body||'').length>200?'...':'');
      return '<div class="email-card" onclick="this.classList.toggle(\\x27expanded\\x27)">'+
        '<div class="email-top">'+
          '<div>'+
            '<div class="email-addr">From: viktor@salesteq.com</div>'+
            '<div class="email-addr">To: '+esc(e.to)+'</div>'+
          '</div>'+
          '<span class="outreach-status '+statusClass+'">'+statusLabel+'</span>'+
        '</div>'+
        '<div class="email-subject">'+esc(e.subject)+'</div>'+
        '<div class="email-preview">'+esc(preview)+'</div>'+
        '<div class="email-full">'+esc(e.body)+'</div>'+
        '<div class="email-timestamp">'+esc(e.timestamp||'')+(e.company?' \\u00b7 '+esc(e.company):'')+'</div>'+
      '</div>';
    }

    var dHtml='';
    for(var i=0;i<drafts.length;i++) dHtml+=emailCard(drafts[i],'outreach-draft','DRAFT');
    document.getElementById('drafts-list').innerHTML=dHtml||'<div class="empty-state">No drafts yet</div>';

    var aHtml='';
    for(var i=0;i<approved.length;i++){
      var st=approved[i].status;
      var cls=st==='sent'?'outreach-sent':'outreach-approved';
      var lbl=st==='sent'?'SENT':'APPROVED';
      aHtml+=emailCard(approved[i],cls,lbl);
    }
    document.getElementById('approved-list').innerHTML=aHtml||'<div class="empty-state">No approved emails yet</div>';
  }

  // ========== RENDER: Assets ==========
  function renderAssets(assets){
    var grid=document.getElementById('assets-grid');
    if(!assets.length){grid.innerHTML='<div class="empty-state">No assets generated yet</div>';return;}
    var html='';
    for(var i=0;i<assets.length;i++){
      var a=assets[i];
      var preview=(a.content||'').slice(0,200)+((a.content||'').length>200?'...':'');
      var landingLink=a.type==='landing-page'?'<div style="margin-top:10px"><a href="/landing/" target="_blank">View Landing Page \\u2192</a></div>':'';
      html+='<div class="asset-card" onclick="this.classList.toggle(\\x27expanded\\x27)">'+
        '<div class="asset-icon">'+assetIcon(a.type)+'</div>'+
        '<div class="asset-title">'+esc(a.title)+'</div>'+
        '<div class="asset-type">'+esc(a.type)+'</div>'+
        '<div class="asset-preview">'+esc(preview)+'</div>'+
        '<div class="asset-full">'+esc(a.content)+landingLink+'</div>'+
      '</div>';
    }
    grid.innerHTML=html;
  }

  // ========== RENDER: QA ==========
  function renderQA(reviews){
    var total=reviews.length;
    var passed=0,flagged=0;
    for(var i=0;i<reviews.length;i++){
      if(reviews[i].verdict==='PASS')passed++;
      else flagged++;
    }

    document.getElementById('qa-stats').innerHTML=
      '<div class="qa-stat"><div class="qa-stat-num" style="color:var(--text)">'+total+'</div><div class="qa-stat-label">Reviewed</div></div>'+
      '<div class="qa-stat"><div class="qa-stat-num" style="color:var(--green)">'+passed+'</div><div class="qa-stat-label">Passed</div></div>'+
      '<div class="qa-stat"><div class="qa-stat-num" style="color:var(--amber)">'+flagged+'</div><div class="qa-stat-label">Flagged</div></div>';

    if(!reviews.length){
      document.getElementById('qa-list').innerHTML='<div class="empty-state">No QA reviews yet</div>';
      return;
    }
    var html='';
    for(var i=0;i<reviews.length;i++){
      var r=reviews[i];
      var isPass=r.verdict==='PASS';
      var ts=r.ts?new Date(r.ts).toLocaleString():'';
      html+='<div class="qa-card" onclick="this.classList.toggle(\\x27expanded\\x27)">'+
        '<div class="qa-top">'+
          '<div><div class="qa-company">'+esc(r.company)+'</div><div class="qa-type">'+esc(r.type)+'</div></div>'+
          '<div style="display:flex;align-items:center;gap:12px">'+
            '<span class="qa-ts">'+esc(ts)+'</span>'+
            '<span class="verdict '+(isPass?'verdict-pass':'verdict-attention')+'">'+esc(r.verdict)+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="qa-review-text">'+esc(r.review)+'</div>'+
      '</div>';
    }
    document.getElementById('qa-list').innerHTML=html;
  }

  // ========== DATA FETCHING ==========
  function fetchAll(){
    Promise.all([
      fetch('/api/status').then(function(r){return r.json()}),
      fetch('/api/stream').then(function(r){return r.json()}),
      fetch('/api/leads').then(function(r){return r.json()}),
      fetch('/api/outreach').then(function(r){return r.json()}),
      fetch('/api/assets').then(function(r){return r.json()}),
      fetch('/api/qa').then(function(r){return r.json()})
    ]).then(function(results){
      var status=results[0],stream=results[1],leads=results[2],outreach=results[3],assets=results[4],qa=results[5];

      // Badges
      document.getElementById('badge-leads').textContent=status.counts.leads;
      document.getElementById('badge-outreach').textContent=status.counts.outreach;
      document.getElementById('badge-assets').textContent=status.counts.assets;
      document.getElementById('badge-qa').textContent=status.counts.qa;
      document.getElementById('agent-count').textContent=status.activeCount+'/'+status.totalCount+' active';

      renderAgents(status.agents);
      renderStream(stream);
      renderLeads(leads);
      renderOutreach(outreach);
      renderAssets(assets);
      renderQA(qa);
    }).catch(function(e){
      console.error('Dashboard fetch error:',e);
    });
  }

  // Initial load + auto-refresh
  fetchAll();
  setInterval(fetchAll, 4000);
})();
</script>
</body>
</html>`;
}

// ── Admin Routes ──
app.use(express.json());

app.post("/api/admin/kill-agents", (_req, res) => {
  try { execSync(`tmux kill-session -t ${TMUX_SESSION} 2>/dev/null`, { stdio: "pipe" }); res.json({ ok: true, message: "All agents killed" }); } catch { res.json({ ok: true, message: "No session to kill" }); }
});

app.post("/api/admin/wipe-data", (_req, res) => {
  try {
    execSync(`rm -f ${DATA_DIR}/*.jsonl ${DATA_DIR}/.qa-reviewed 2>/dev/null; mkdir -p ${DATA_DIR}`, { stdio: "pipe" });
    try { execSync(`cp /root/commercial-ops/data/seed-prospects.jsonl ${DATA_DIR}/prospects.jsonl 2>/dev/null`, { stdio: "pipe" }); } catch {}
    execSync(`touch ${DATA_DIR}/outreach-draft.jsonl ${DATA_DIR}/outreach-approved.jsonl ${DATA_DIR}/assets.jsonl ${DATA_DIR}/qa-reviews.jsonl ${DATA_DIR}/qa-feedback.jsonl`, { stdio: "pipe" });
    try { execSync(`cd /root/commercial-ops && git checkout -- STATUS.md 2>/dev/null`, { stdio: "pipe" }); } catch {}
    res.json({ ok: true, message: "Data wiped, prospects re-seeded" });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/admin/clear-sessions", (_req, res) => {
  try {
    execSync(`rm -rf /root/.claude/sessions /root/.claude/projects /root/.claude/cache /root/commercial-ops/.claude/sessions /root/commercial-ops/.claude/projects 2>/dev/null`, { stdio: "pipe" });
    res.json({ ok: true, message: "Claude sessions cleared" });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/admin/launch-agents", (_req, res) => {
  res.json({ ok: true, message: "Agents launching (~70s). Dashboard will restart in tmux window 5." });
  const { spawn } = require("child_process");
  const child = spawn("bash", ["start-agents.sh"], {
    cwd: "/root/commercial-ops",
    env: { ...process.env, SKIP_DASHBOARD_KILL: "1" },
    detached: true,
    stdio: ["ignore", fs.openSync("/tmp/agent-launch.log", "w"), fs.openSync("/tmp/agent-launch.log", "w")],
  });
  child.unref();
});

app.get("/api/admin/stats", (_req, res) => {
  try {
    const mem = execSync(`free -h | head -3`, { stdio: "pipe" }).toString().trim();
    const load = execSync(`uptime`, { stdio: "pipe" }).toString().trim();
    const tmux = (() => { try { return execSync(`tmux list-windows -t ${TMUX_SESSION} 2>/dev/null`, { stdio: "pipe" }).toString().trim(); } catch { return "No session"; } })();
    const dataFiles = (() => { try { return execSync(`wc -l ${DATA_DIR}/*.jsonl 2>/dev/null`, { stdio: "pipe" }).toString().trim(); } catch { return "No data"; } })();
    res.json({ mem, load, tmux, dataFiles });
  } catch (e) { res.json({ error: String(e) }); }
});

app.get("/admin", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#000;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;overflow:hidden}
::selection{background:rgba(255,255,255,.15)}
::-webkit-scrollbar{width:0;height:0}

.page{max-width:600px;margin:0 auto;padding:40px 32px 24px;height:100vh;display:flex;flex-direction:column;justify-content:center}

h1{font-size:36px;font-weight:600;color:#fff;letter-spacing:-1.2px;margin-bottom:2px}
.sub{font-size:14px;font-weight:400;color:#555;margin-bottom:36px;letter-spacing:-.2px}

.section{margin-bottom:24px}
.label{font-size:13px;font-weight:500;color:#555;letter-spacing:-.1px;margin-bottom:10px}

.row{display:flex;gap:10px;flex-wrap:wrap}
.btn{
  padding:11px 22px;font-size:14px;font-weight:500;color:#fff;letter-spacing:-.2px;
  background:#161616;border:none;border-radius:10px;
  cursor:pointer;transition:all .15s ease;font-family:inherit;
}
.btn:hover{background:#222}
.btn:active{transform:scale(.97);background:#1a1a1a}
.btn.red{color:#ff453a}
.btn.red:hover{background:#1a0f0e}

.terminal{
  margin-top:4px;padding:14px 18px;background:#111;border-radius:10px;
  font-family:'SF Mono','Menlo','Consolas',monospace;font-size:13px;color:#aaa;
  cursor:pointer;transition:all .15s;line-height:1.5;word-break:break-all;
}
.terminal:hover{background:#161616;color:#fff}
.terminal:active{transform:scale(.995)}

.stats{
  margin-top:4px;padding:14px;background:#111;border-radius:10px;
  font-family:'SF Mono','Menlo',monospace;font-size:11px;line-height:1.6;
  color:#666;white-space:pre-wrap;max-height:140px;overflow-y:auto;
}
.stats-header{display:flex;align-items:center;justify-content:space-between}
.stats-refresh{font-size:13px;color:#555;background:none;border:none;cursor:pointer;font-family:inherit;transition:color .15s}
.stats-refresh:hover{color:#fff}

.toast{
  position:fixed;bottom:40px;left:50%;transform:translateX(-50%) translateY(16px);
  background:#1a1a1a;color:#fff;font-size:13px;font-weight:500;padding:12px 28px;border-radius:12px;
  opacity:0;transition:all .25s ease;pointer-events:none;letter-spacing:-.2px;
}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

.foot{margin-top:28px;display:flex;gap:20px}
.foot a{font-size:13px;color:#333;text-decoration:none;transition:color .15s}
.foot a:hover{color:#aaa}
</style></head><body>

<div class="page">
  <h1>Admin</h1>
  <div class="sub">Commercial Ops</div>

  <div class="section">
    <div class="label">Agents</div>
    <div class="row">
      <button class="btn" onclick="api('/api/admin/launch-agents','POST')">Launch</button>
      <button class="btn red" onclick="api('/api/admin/kill-agents','POST')">Kill All</button>
      <button class="btn red" onclick="fullReset()">Full Reset</button>
    </div>
  </div>

  <div class="section">
    <div class="label">Data</div>
    <div class="row">
      <button class="btn" onclick="api('/api/admin/wipe-data','POST')">Wipe + Re-seed</button>
      <button class="btn" onclick="api('/api/admin/clear-sessions','POST')">Clear Sessions</button>
    </div>
  </div>

  <div class="section">
    <div class="label">Launch from Mac</div>
    <div class="terminal" onclick="copy(this)">ssh -i ~/.ssh/id_experiment root@89.167.77.26 -t 'cd /root/commercial-ops && bash start-agents.sh && tmux -CC attach -t commercial-ops'</div>
  </div>

  <div class="section">
    <div class="label">Launch on server</div>
    <div class="terminal" onclick="copy(this)">cd /root/commercial-ops && bash start-agents.sh</div>
  </div>

  <div class="section">
    <div class="label">Open agent tabs in iTerm2</div>
    <div class="terminal" onclick="copy(this)">tmux -CC attach -t commercial-ops</div>
  </div>

  <div class="section">
    <div class="stats-header">
      <div class="label" style="margin-bottom:0">Status</div>
      <button class="stats-refresh" onclick="loadStats()">Refresh</button>
    </div>
    <div class="stats" id="statsBox">Loading...</div>
  </div>

  <div class="foot">
    <a href="/">Dashboard</a>
    <a href="https://github.com/SalesteqHoneyBadger/commercial-ops" target="_blank">GitHub</a>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},1800)}
function copy(el){navigator.clipboard.writeText(el.textContent).then(function(){toast('Copied')}).catch(function(){toast('Copy failed')})}
async function api(u,m){toast('Sending...');try{var r=await fetch(u,{method:m||'GET'});var d=await r.json();toast(d.message||JSON.stringify(d))}catch(e){toast('Error: '+e.message)}}
async function fullReset(){if(!confirm('Kill all agents, wipe data, clear sessions?'))return;toast('Resetting...');await fetch('/api/admin/kill-agents',{method:'POST'});await fetch('/api/admin/wipe-data',{method:'POST'});await fetch('/api/admin/clear-sessions',{method:'POST'});toast('Reset complete')}
async function loadStats(){try{var r=await fetch('/api/admin/stats');var d=await r.json();document.getElementById('statsBox').textContent=d.mem+'\\n\\n'+d.load+'\\n\\n'+d.tmux+'\\n\\n'+d.dataFiles}catch(e){document.getElementById('statsBox').textContent=e.message}}
loadStats();
</script></body></html>`);
});

// Serve automotive landing page
app.get('/automotive', (req, res) => {
  const landingPath = path.join(__dirname, '../landing/index.html');
  res.sendFile(landingPath);
});

app.listen(PORT, () => {
  console.log(`Commercial Ops Dashboard running at http://localhost:${PORT}`);
  console.log(`Automotive landing page at http://localhost:${PORT}/automotive`);
});
