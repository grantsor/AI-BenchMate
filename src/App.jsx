import React, { useEffect, useMemo, useState } from "react";
import {
  HARDWARE_PROFILES,
  PARITY_DEFAULTS,
  QUICK_MODELS,
  REFERENCE_PARITY_GUIDE,
  SAMPLE_RESULTS_DATASET,
  SUITE_METADATA
} from "./core/benchmate-data.js";
import {
  auditFileList,
  buildAllInOnePlaybook,
  buildDeepAuditScript,
  buildServerCommand,
  buildSetupCards,
  buildSshCommands,
  buildSuiteClientCommand,
  evaluateGuardrails,
  exportComparisonCsv,
  exportComparisonMarkdown,
  getOutputTarget,
  isSuiteCustomized,
  joinPath,
  loadSnapshotIDB,
  loadState,
  parseModelPath,
  parseResultFile,
  saveSnapshotIDB,
  saveState
} from "./core/benchmate-engine.js";

const KEYWORDS = new Set([
  "llama-bench", "llama-server", ".\\llama-bench.exe", ".\\llama-server.exe",
  "python", "python3", "aiperf", "agentperf-local", "tmux", "ssh", "scp",
  "sudo", "pip", "git", "source", "export", "mkdir", "rm", "pkill", "fuser",
  "nvidia-smi", "amd-smi", "Set-Location", "New-Item", "Remove-Item",
  "Stop-Process", "Set-ExecutionPolicy", "Tee-Object"
]);

function renderHighlightedLine(line, idx) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) {
    return (
      <div key={idx}>
        <span className="tok-comment">{line}</span>
      </div>
    );
  }
  // Tokenize quoted strings, flags, and keywords safely in React JSX
  const tokenRe = /("[^"]*"|'[^']*'|`[^`]*`|\s--?[a-zA-Z0-9_-]+|^--?[a-zA-Z0-9_-]+|\S+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let k = 0;
  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const raw = match[0];
    const clean = raw.trim();
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      parts.push(<span key={k++} className="tok-str">{raw}</span>);
    } else if (clean.startsWith("-")) {
      parts.push(<span key={k++} className="tok-flag">{raw}</span>);
    } else if (KEYWORDS.has(clean)) {
      parts.push(<span key={k++} className="tok-kw">{raw}</span>);
    } else {
      parts.push(raw);
    }
    lastIndex = tokenRe.lastIndex;
  }
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  return <div key={idx}>{parts.length ? parts : " "}</div>;
}

function CopyButton({ text, label = "Copy", className = "btn", style }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button type="button" className={`${className} ${copied ? "copied" : ""}`} style={style} onClick={onCopy}>
      {copied ? "Copied!" : label}
    </button>
  );
}

function TerminalBox({ titleLeft, titleRight, code, rightAction }) {
  const lines = useMemo(() => String(code || "").split("\n"), [code]);
  return (
    <div className="terminal-box">
      <div className="terminal-header">
        <span>{titleLeft}</span>
        {rightAction ? rightAction : <span>{titleRight}</span>}
      </div>
      <pre className="terminal-pre">{lines.map((l, i) => renderHighlightedLine(l, i))}</pre>
    </div>
  );
}

function SvgBarChart({ title, subtitle, items, unit }) {
  if (!items.length) {
    return (
      <div className="chart-card">
        <h4 style={{ margin: 0 }}>{title}</h4>
        <p className="small muted">{subtitle}</p>
        <div className="small muted">No matching parsed files loaded yet.</div>
      </div>
    );
  }
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const rowH = 34;
  const svgH = items.length * rowH + 24;
  return (
    <div className="chart-card">
      <div>
        <h4 style={{ margin: 0, fontSize: "14px" }}>{title}</h4>
        <div className="small muted">{subtitle}</div>
      </div>
      <svg className="chart-svg" viewBox={`0 0 560 ${svgH}`}>
        {items.map((item, idx) => {
          const y = idx * rowH + 12;
          const barW = Math.max(4, Math.round((item.value / maxVal) * 280));
          const color = item.color || "var(--accent-primary)";
          return (
            <g key={idx}>
              <text x="4" y={y + 14} fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">
                {item.label.slice(0, 28)}
              </text>
              <rect x="210" y={y + 2} width="280" height="16" rx="4" fill="var(--chart-grid)" />
              <rect x="210" y={y + 2} width={barW} height="16" rx="4" fill={color} />
              <text x={218 + barW} y={y + 14} fill="var(--text-primary)" fontSize="11" fontWeight="700" fontFamily="var(--font-mono)">
                {item.value} {unit}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [displayTargetName, setDisplayTargetName] = useState(
    () => HARDWARE_PROFILES[loadState().hardware.profileId]?.shortName || "DGX Spark ARM64"
  );
  const [dragOverAudit, setDragOverAudit] = useState(false);
  const [dragOverResults, setDragOverResults] = useState(false);

  // Universal auto-persistence on EVERY configurable change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Restore large IndexedDB audit/result snapshots on startup if needed
  useEffect(() => {
    (async () => {
      const [savedAudit, savedResults] = await Promise.all([
        loadSnapshotIDB("latest_audit"),
        loadSnapshotIDB("latest_results")
      ]);
      setState((prev) => {
        let next = prev;
        if (savedAudit?.items && Object.keys(prev.audit?.items || {}).length === 0) {
          next = { ...next, audit: savedAudit };
        }
        if (Array.isArray(savedResults) && savedResults.length && !(prev.results?.loadedRecords || []).length) {
          next = { ...next, results: { ...next.results, loadedRecords: savedResults } };
        }
        return next;
      });
    })();
  }, []);

  // Apply Dark/Light/System theme & Option 2A Unified Pause Animations / Benchmark Stealth Mode
  useEffect(() => {
    const html = document.documentElement;
    let resolved = state.ui.theme;
    if (resolved === "system") {
      resolved = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    html.setAttribute("data-theme", resolved);
    html.setAttribute("data-light-terminal", state.ui.lightTerminal ? "true" : "false");
    html.classList.toggle("pause-animations", Boolean(state.ui.pauseAnimations));
  }, [state.ui.theme, state.ui.lightTerminal, state.ui.pauseAnimations]);

  // Subtle scramble-decode effect when switching hardware profiles (respects Pause Animations)
  const profile = HARDWARE_PROFILES[state.hardware.profileId];
  useEffect(() => {
    const target = profile.shortName;
    if (state.ui.pauseAnimations) {
      setDisplayTargetName(target);
      return;
    }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
    let frame = 0;
    const total = 10;
    const timer = setInterval(() => {
      frame += 1;
      if (frame >= total) {
        clearInterval(timer);
        setDisplayTargetName(target);
        return;
      }
      const reveal = Math.floor((frame / total) * target.length);
      let out = "";
      for (let i = 0; i < target.length; i++) {
        out += i < reveal || target[i] === " " ? target[i] : chars[Math.floor(Math.random() * chars.length)];
      }
      setDisplayTargetName(out);
    }, 22);
    return () => clearInterval(timer);
  }, [profile.shortName, state.ui.pauseAnimations]);

  const resolvedTheme =
    state.ui.theme === "system"
      ? window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : state.ui.theme;

  const guardrails = useMemo(() => evaluateGuardrails(state), [state]);
  const verifiedCount = useMemo(
    () => Object.values(state.audit.items || {}).filter((i) => i && i.status === "verified").length,
    [state.audit.items]
  );
  const completedCount = useMemo(
    () => Object.values(state.completedSteps || {}).filter(Boolean).length,
    [state.completedSteps]
  );

  const updateUi = (patch) => setState((prev) => ({ ...prev, ui: { ...prev.ui, ...patch } }));
  const updateHardware = (patch) => setState((prev) => ({ ...prev, hardware: { ...prev.hardware, ...patch } }));
  const updateModel = (patch) => setState((prev) => ({ ...prev, model: { ...prev.model, ...patch } }));
  const updateSuite = (suiteId, patch) =>
    setState((prev) => ({
      ...prev,
      suites: { ...prev.suites, [suiteId]: { ...prev.suites[suiteId], ...patch } }
    }));
  const updateSsh = (patch) => setState((prev) => ({ ...prev, ssh: { ...prev.ssh, ...patch } }));

  const switchHardwareProfile = (newProfileId) => {
    const prevProfile = HARDWARE_PROFILES[state.hardware.profileId];
    const nextProfile = HARDWARE_PROFILES[newProfileId];
    if (!nextProfile) return;

    const sep = nextProfile.os === "windows" ? "\\" : "/";
    const filenameOnly = (state.model.filename || "Qwen3.8-27B-UD-Q4_K_M.gguf").split(/[\\/]+/).pop();
    const matchQuick = QUICK_MODELS.find((m) => m.alias === state.model.alias);
    let nextPath = state.model.fullPath;
    if (matchQuick) {
      const rel = nextProfile.os === "windows" ? matchQuick.relativeWin : matchQuick.relativeLinux;
      nextPath = joinPath(nextProfile.defaultModelsDir, rel, sep);
    } else if (prevProfile.os !== nextProfile.os) {
      nextPath = joinPath(nextProfile.defaultModelsDir, filenameOnly, sep);
    }
    const parsed = parseModelPath(nextPath);

    setState((prev) => ({
      ...prev,
      hardware: {
        ...prev.hardware,
        profileId: nextProfile.id,
        vramGb: nextProfile.defaultVramGb,
        binDir: nextProfile.defaultBinDir,
        repoDir: nextProfile.defaultRepoDir,
        benchRoot: nextProfile.defaultBenchRoot,
        resultsDir: nextProfile.defaultResultsDir,
        nvidiaDevice: nextProfile.deviceFlag || prev.hardware.nvidiaDevice
      },
      model: {
        ...prev.model,
        fullPath: nextPath,
        baseDir: parsed.baseDir,
        filename: parsed.filename
      }
    }));
  };

  const applyQuickModel = (qm) => {
    const sep = profile.os === "windows" ? "\\" : "/";
    const rel = profile.os === "windows" ? qm.relativeWin : qm.relativeLinux;
    updateModel({
      fullPath: joinPath(profile.defaultModelsDir, rel, sep),
      baseDir: profile.defaultModelsDir,
      filename: rel,
      alias: qm.alias,
      slug: qm.slug,
      tokenizer: qm.tokenizer,
      weightGb: qm.weightGb,
      paramsB: qm.paramsB
    });
  };

  const applyGuardrailFix = (fixId) => {
    if (fixId === "ctx_aiperf_sweep") {
      updateSuite("aiperf_sweep", { c: 70000, ctk: "q8_0", ctv: "q8_0" });
    } else if (fixId === "ctx_benchy") {
      updateSuite("llama_benchy", { c: 70000 });
    } else if (fixId === "vram_overflow") {
      const nextKv = guardrails.vramEstimate.kvPrecision === "fp16" ? "q8_0" : "q4_0";
      setState((prev) => {
        const nextSuites = { ...prev.suites };
        ["llama_benchy", "llmperf", "speed_bench", "agentperf", "aiperf_std", "aiperf_sweep"].forEach((sid) => {
          nextSuites[sid] = { ...nextSuites[sid], ctk: nextKv, ctv: nextKv };
        });
        return { ...prev, suites: nextSuites };
      });
    }
  };

  const runAuditEntries = async (entries, folderName) => {
    const items = await auditFileList(entries, state);
    const nextAudit = { items, lastFolderName: folderName, lastAuditedAt: new Date().toLocaleTimeString() };
    setState((prev) => ({ ...prev, audit: nextAudit }));
    await saveSnapshotIDB("latest_audit", nextAudit);
  };

  const handleResultFiles = async (fileList) => {
    const parsed = [];
    for (const f of Array.from(fileList || [])) {
      const txt = await f.text();
      const rec = parseResultFile(f.name, txt);
      if (rec) parsed.push(rec);
    }
    if (parsed.length) {
      setState((prev) => {
        const nextRecs = [...(prev.results.loadedRecords || []), ...parsed];
        saveSnapshotIDB("latest_results", nextRecs);
        return { ...prev, results: { ...prev.results, loadedRecords: nextRecs } };
      });
    }
  };

  const tabs = [
    { id: "builder", idx: "01", label: "Builder" },
    { id: "coverage", idx: "02", label: "Coverage Matrix" },
    { id: "results", idx: "03", label: "Results & Charts" },
    { id: "ssh", idx: "04", label: "SSH Remote" },
    { id: "setup", idx: "05", label: "Setup & Fixes" }
  ];

  const railSections = [
    { id: "sec-hardware", num: "01", label: "Hardware & OS", tab: "builder" },
    { id: "sec-model", num: "02", label: "Model & Paths", tab: "builder" },
    { id: "sec-presets", num: "03", label: "Server & Presets", tab: "builder" },
    { id: "sec-suites", num: "04", label: "Benchmark Suites", tab: "builder" },
    { id: "sec-playbook", num: "05", label: "Playbook Output", tab: "builder" },
    { id: "sec-verify", num: "06", label: "Folder Verification", tab: "coverage" }
  ];

  const records = state.results.loadedRecords || [];
  const benchBars = [];
  records.filter((r) => r.suiteType === "llama_bench").forEach((r) => {
    const color = r.gpuLabel.includes("DGX") ? "var(--accent-emerald)" : "var(--accent-primary)";
    if (r.metrics.tg128) benchBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} tg128`, value: r.metrics.tg128, color });
    if (r.metrics.pp512) benchBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} pp512/10`, value: Math.round(r.metrics.pp512 / 10), color: "var(--accent-amber)" });
  });
  const depthBars = records.filter((r) => r.suiteType === "llama_benchy").map((r) => ({
    label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} Drop`,
    value: r.metrics.degradationPct || 0,
    color: "var(--accent-crimson)"
  }));
  const concBars = records.filter((r) => r.suiteType === "llmperf").map((r) => ({
    label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} Total`,
    value: r.metrics.totalTps || 0,
    color: "var(--accent-primary)"
  }));
  const sbBars = records.filter((r) => r.suiteType === "speed_bench").map((r) => ({
    label: `${r.gpuLabel.split(" ")[0]} Overall`,
    value: r.metrics.overall || 0,
    color: "var(--accent-emerald)"
  }));
  const sweepRecs = records.filter((r) => r.suiteType === "aiperf_sweep");
  const sshCmds = useMemo(() => buildSshCommands(state), [state]);
  const setupCards = useMemo(() => buildSetupCards(state), [state]);
  const playbookCode = useMemo(() => buildAllInOnePlaybook(state, state.ui.showMissingOnly), [state]);

  return (
    <>
      <header className="top-island-wrap">
        <nav className="top-island-nav">
          <div className="brand-cluster">
            <div className="brand-mark">BM</div>
            <div className="brand-title">
              <span>AI Benchmate</span>
              <span className="edition-badge">REACT + VITE</span>
            </div>
            <div className="telemetry-pills">
              <span className="telemetry-pill">
                <span className="dot-pulse" />
                Target: <strong>{displayTargetName}</strong>
              </span>
              <span className="telemetry-pill">
                Model: <strong>{state.model.alias}</strong>
              </span>
              <span className="telemetry-pill">
                Audit: <strong>{verifiedCount}/{SUITE_METADATA.length} Verified</strong>
              </span>
            </div>
          </div>

          <div className="nav-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`nav-tab-btn ${state.ui.activeTab === t.id ? "active" : ""}`}
                onClick={() => updateUi({ activeTab: t.id })}
              >
                <span className="idx">{t.idx}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="nav-controls">
            <button
              type="button"
              className={`control-pill ${state.ui.pauseAnimations ? "is-active" : ""}`}
              onClick={() => updateUi({ pauseAnimations: !state.ui.pauseAnimations })}
              title="Option 2A Benchmark Stealth Mode: Pauses motion, timers, backdrop blurs & GPU shadows"
            >
              {state.ui.pauseAnimations ? "● Stealth / Paused" : "❚❚ Pause Animations"}
            </button>
            {resolvedTheme === "light" && (
              <button
                type="button"
                className={`control-pill ${state.ui.lightTerminal ? "is-active" : ""}`}
                onClick={() => updateUi({ lightTerminal: !state.ui.lightTerminal })}
              >
                {state.ui.lightTerminal ? "Light Terminal" : "Dark Terminal"}
              </button>
            )}
            <select
              className="theme-select"
              value={state.ui.theme}
              onChange={(e) => updateUi({ theme: e.target.value })}
              aria-label="Theme Mode"
            >
              <option value="dark">Dark · Obsidian</option>
              <option value="light">Light · Editorial</option>
              <option value="system">System</option>
            </select>
          </div>
        </nav>
      </header>

      <div className="app-shell">
        <aside className="section-rail">
          <div className="rail-heading">Section Index</div>
          {railSections.map((s) => {
            let pill = "";
            let cls = "";
            if (s.id === "sec-hardware") pill = profile.os.toUpperCase();
            if (s.id === "sec-presets") {
              pill = guardrails.warnings.length ? `${guardrails.warnings.length} WARN` : "OK";
              cls = guardrails.warnings.length ? "err" : "ok";
            }
            if (s.id === "sec-suites") {
              pill = `${completedCount}/7`;
              cls = completedCount === 7 ? "ok" : "";
            }
            return (
              <button
                key={s.id}
                type="button"
                className={`rail-link ${state.ui.activeSection === s.id ? "active" : ""}`}
                onClick={() => {
                  updateUi({ activeSection: s.id, activeTab: s.tab });
                  setTimeout(() => {
                    const el = document.getElementById(s.id);
                    if (el) el.scrollIntoView({ behavior: state.ui.pauseAnimations ? "auto" : "smooth" });
                  }, 20);
                }}
              >
                <span className="rail-link-left">
                  <span className="rail-num">{s.num}</span>
                  <span>{s.label}</span>
                </span>
                {pill && <span className={`rail-status ${cls}`}>{pill}</span>}
              </button>
            );
          })}

          <div className="rail-divider" />
          <div className="rail-heading">Session State (Auto-Saved)</div>
          <div className="rail-mini-meta">
            <div className="rail-mini-row">
              <span>VRAM Est.</span>
              <strong
                style={{
                  color:
                    guardrails.vramEstimate.totalVramGb > guardrails.vramEstimate.vramCeiling
                      ? "var(--accent-amber)"
                      : "var(--accent-emerald)"
                }}
              >
                {guardrails.vramEstimate.totalVramGb} / {guardrails.vramEstimate.vramCeiling} GB
              </strong>
            </div>
            <div className="rail-mini-row">
              <span>Guardrails</span>
              <strong style={{ color: guardrails.warnings.length ? "var(--accent-crimson)" : "var(--accent-emerald)" }}>
                {guardrails.warnings.length ? `${guardrails.warnings.length} Alert(s)` : "Healthy"}
              </strong>
            </div>
            <div className="rail-mini-row">
              <span>Steps Done</span>
              <strong>{completedCount}/7</strong>
            </div>
            <div className="rail-mini-row">
              <span>Naming</span>
              <strong>{state.naming.mode.toUpperCase()}</strong>
            </div>
          </div>

          <button
            type="button"
            className={`chip-btn ${state.ui.showMissingOnly ? "amber active" : ""}`}
            style={{ justifyContent: "center", marginTop: "4px" }}
            onClick={() => updateUi({ showMissingOnly: !state.ui.showMissingOnly })}
          >
            {state.ui.showMissingOnly ? "✓ Showing Missing/Incomplete Only" : "Filter: Missing Runs Only"}
          </button>
        </aside>

        <main className="main-content">
          {state.ui.activeTab === "builder" && (
            <>
              <section className="panel-card section-block" id="sec-hardware">
                <div className="card-header" style={{ marginBottom: "12px" }}>
                  <div className="card-title-group">
                    <div className="card-kicker">
                      <span className="index-num">01</span>
                      <span className="badge badge-cyan">HARDWARE & OS MATRIX</span>
                    </div>
                    <h2 className="card-title">Target Compute Profile & Tool Paths</h2>
                    <p className="card-desc">
                      Adapts shell syntax ({profile.shell}), binary names, GPU flags, venv activation, and cleanup commands automatically.
                    </p>
                  </div>
                </div>

                <div className="profile-grid" style={{ marginBottom: "14px" }}>
                  {Object.values(HARDWARE_PROFILES).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`profile-btn ${state.hardware.profileId === p.id ? "active" : ""}`}
                      onClick={() => switchHardwareProfile(p.id)}
                    >
                      <div className="profile-btn-top">
                        <span className="profile-name">{p.shortName}</span>
                        <span className={`badge ${p.os === "linux" ? "badge-emerald" : "badge-cyan"}`}>{p.shell}</span>
                      </div>
                      <div className="profile-meta">{p.arch}</div>
                      <div className="profile-meta">Default VRAM: {p.defaultVramGb} GB</div>
                    </button>
                  ))}
                </div>

                <div className="form-grid" style={{ marginBottom: "12px" }}>
                  <div className="field">
                    <label>VRAM Capacity (GB)</label>
                    <input
                      type="number"
                      value={state.hardware.vramGb}
                      min="4"
                      max="512"
                      onChange={(e) => updateHardware({ vramGb: Number(e.target.value) || 32 })}
                    />
                    <div className="chip-row" style={{ marginTop: "4px" }}>
                      {profile.vramChips.map((gb) => (
                        <button
                          key={gb}
                          type="button"
                          className={`chip-btn ${Number(state.hardware.vramGb) === gb ? "active" : ""}`}
                          onClick={() => updateHardware({ vramGb: gb })}
                        >
                          {gb} GB
                        </button>
                      ))}
                    </div>
                  </div>

                  {state.hardware.profileId === "amd_win_x64" && (
                    <div className="field">
                      <label>AMD Compute Backend</label>
                      <div className="chip-row">
                        <button
                          type="button"
                          className={`chip-btn ${state.hardware.amdBackend === "vulkan" ? "active" : ""}`}
                          onClick={() => updateHardware({ amdBackend: "vulkan", binDir: "C:\\llama.cpp\\vulkan" })}
                        >
                          Vulkan0 (Default)
                        </button>
                        <button
                          type="button"
                          className={`chip-btn ${state.hardware.amdBackend === "rocm" ? "active" : ""}`}
                          onClick={() => updateHardware({ amdBackend: "rocm", binDir: "C:\\llama.cpp\\hip" })}
                        >
                          ROCm / HIP0
                        </button>
                      </div>
                      {state.hardware.amdBackend === "vulkan" && (
                        <label style={{ marginTop: "6px", fontWeight: 500 }}>
                          <span>
                            <input
                              type="checkbox"
                              checked={state.hardware.amdEnableFa}
                              onChange={(e) => updateHardware({ amdEnableFa: e.target.checked })}
                            />{" "}
                            Include <code>-fa 1</code> on Vulkan
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {profile.supportsMultiGpu && (
                    <>
                      <div className="field">
                        <label>CUDA Device (--device)</label>
                        <input
                          className="mono"
                          value={state.hardware.nvidiaDevice}
                          onChange={(e) => updateHardware({ nvidiaDevice: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>Multi-GPU Tensor Split (Optional)</label>
                        <input
                          className="mono"
                          value={state.hardware.tensorSplit}
                          placeholder="e.g. 0.5,0.5"
                          onChange={(e) => updateHardware({ tensorSplit: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {state.hardware.profileId === "dgx_spark_linux_arm64" && (
                    <div className="field">
                      <label>DGX Setup Mode</label>
                      <label style={{ fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={state.hardware.nonSudoSetup}
                          onChange={(e) => updateHardware({ nonSudoSetup: e.target.checked })}
                        />{" "}
                        Non-sudo fallback (skip <code>apt install python3-dev</code>)
                      </label>
                    </div>
                  )}

                  {state.hardware.profileId === "rtx_spark_win_arm64" && (
                    <div className="field">
                      <label>ARM64 Optional Wheels</label>
                      <label style={{ fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={state.hardware.rtxArmTdigestCompile}
                          onChange={(e) => updateHardware({ rtxArmTdigestCompile: e.target.checked })}
                        />{" "}
                        Compile <code>aiperf[tdigest]</code>
                      </label>
                    </div>
                  )}

                  <div className="field">
                    <label>Server Host & Port</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        className="mono"
                        value={state.hardware.host}
                        onChange={(e) => updateHardware({ host: e.target.value })}
                      />
                      <input
                        className="mono"
                        type="number"
                        value={state.hardware.port}
                        style={{ maxWidth: "95px" }}
                        onChange={(e) => updateHardware({ port: Number(e.target.value) || 8080 })}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="field">
                    <label>llama.cpp Binaries Folder</label>
                    <input className="mono" value={state.hardware.binDir} onChange={(e) => updateHardware({ binDir: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Centralized Results Folder</label>
                    <input className="mono" value={state.hardware.resultsDir} onChange={(e) => updateHardware({ resultsDir: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Benchmarks Root (Venvs / llmperf)</label>
                    <input className="mono" value={state.hardware.benchRoot} onChange={(e) => updateHardware({ benchRoot: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>llama.cpp Repo Root (for SPEED-Bench)</label>
                    <input className="mono" value={state.hardware.repoDir} onChange={(e) => updateHardware({ repoDir: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="panel-card section-block" id="sec-model">
                <div className="card-header" style={{ marginBottom: "12px" }}>
                  <div className="card-title-group">
                    <div className="card-kicker">
                      <span className="index-num">02</span>
                      <span className="badge badge-cyan">SMART PATH PARSER & LIBRARY</span>
                    </div>
                    <h2 className="card-title">Paste Model Path — Auto-Fill Everything</h2>
                    <p className="card-desc">
                      Zero hardcoded usernames. Paste any Windows or Linux <code>.gguf</code> path to derive alias, slug, tokenizer ID & weight estimate.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        customModels: [...prev.customModels, { ...prev.model }]
                      }))
                    }
                  >
                    + Save Model to Library
                  </button>
                </div>

                <div className="chip-row" style={{ marginBottom: "10px" }}>
                  <span className="small muted" style={{ fontWeight: 600 }}>Quick Presets:</span>
                  {QUICK_MODELS.map((qm) => (
                    <button
                      key={qm.id}
                      type="button"
                      className={`chip-btn ${state.model.alias === qm.alias ? "active" : ""}`}
                      onClick={() => applyQuickModel(qm)}
                    >
                      {qm.label}
                    </button>
                  ))}
                </div>

                {state.customModels.length > 0 && (
                  <div className="chip-row" style={{ marginBottom: "10px" }}>
                    <span className="small muted" style={{ fontWeight: 600 }}>Saved Models:</span>
                    {state.customModels.map((cm, idx) => (
                      <span key={idx} className={`chip-btn ${state.model.fullPath === cm.fullPath ? "active" : ""}`}>
                        <span style={{ cursor: "pointer" }} onClick={() => updateModel(cm)}>{cm.alias}</span>
                        <span
                          style={{ cursor: "pointer", opacity: 0.65, marginLeft: "4px" }}
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              customModels: prev.customModels.filter((_, i) => i !== idx)
                            }))
                          }
                        >
                          ×
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="field" style={{ marginBottom: "12px" }}>
                  <label>
                    <span>Full Model File Path (.gguf)</span>
                    <span className="small muted">Paste full path to auto-extract fields below</span>
                  </label>
                  <input
                    className="mono"
                    value={state.model.fullPath}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = parseModelPath(val);
                      updateModel({
                        fullPath: val,
                        baseDir: parsed.baseDir,
                        filename: parsed.filename,
                        alias: parsed.alias,
                        slug: parsed.slug,
                        tokenizer: parsed.tokenizer,
                        weightGb: parsed.weightGb,
                        paramsB: parsed.paramsB
                      });
                    }}
                  />
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Served Model Alias (--alias)</label>
                    <input className="mono" value={state.model.alias} onChange={(e) => updateModel({ alias: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Clean Output Slug</label>
                    <input className="mono" value={state.model.slug} onChange={(e) => updateModel({ slug: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>HF Tokenizer ID</label>
                    <input className="mono" value={state.model.tokenizer} onChange={(e) => updateModel({ tokenizer: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Model Weight (GB) / Params (B)</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        className="mono"
                        type="number"
                        step="0.1"
                        value={state.model.weightGb}
                        onChange={(e) => updateModel({ weightGb: parseFloat(e.target.value) || 15.8 })}
                      />
                      <input
                        className="mono"
                        type="number"
                        step="1"
                        value={state.model.paramsB}
                        style={{ maxWidth: "80px" }}
                        onChange={(e) => updateModel({ paramsB: parseFloat(e.target.value) || 27 })}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Client --model Argument</label>
                    <div className="chip-row">
                      <button
                        type="button"
                        className={`chip-btn ${state.model.clientModelMode === "alias" ? "active" : ""}`}
                        onClick={() => updateModel({ clientModelMode: "alias" })}
                      >
                        Served Alias
                      </button>
                      <button
                        type="button"
                        className={`chip-btn ${state.model.clientModelMode === "fullpath" ? "active" : ""}`}
                        onClick={() => updateModel({ clientModelMode: "fullpath" })}
                      >
                        Full Path
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel-card section-block" id="sec-presets">
                <div className="card-header" style={{ marginBottom: "12px" }}>
                  <div className="card-title-group">
                    <div className="card-kicker">
                      <span className="index-num">03</span>
                      <span className="badge badge-amber">NAMING ENGINE, PRESETS & GUARDRAILS</span>
                    </div>
                    <h2 className="card-title">Dynamic Result Naming, Presets & Context/VRAM Safety</h2>
                  </div>
                  <div className="action-group">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        const name = window.prompt("Enter preset name:", `Custom ${state.model.slug} (${new Date().toLocaleDateString()})`);
                        if (!name || !name.trim()) return;
                        setState((prev) => ({
                          ...prev,
                          customPresets: [...prev.customPresets, { name: name.trim(), suites: JSON.parse(JSON.stringify(prev.suites)) }],
                          naming: { ...prev.naming, activePresetName: name.trim() }
                        }));
                      }}
                    >
                      + Save Current Settings as Preset
                    </button>
                    <button
                      type="button"
                      className="btn btn-amber"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          suites: JSON.parse(JSON.stringify(PARITY_DEFAULTS)),
                          naming: { ...prev.naming, activePresetName: "Baseline Parity Defaults" }
                        }))
                      }
                    >
                      Reset All to Parity Defaults
                    </button>
                  </div>
                </div>

                <div className="form-grid-2" style={{ marginBottom: "14px" }}>
                  <div className="field">
                    <label>Dynamic Result Naming Mode</label>
                    <div className="chip-row">
                      {[
                        { id: "auto", label: "Auto (Stamp on Customize)" },
                        { id: "stamped", label: "Mode A · Parameter-Stamped", amber: true },
                        { id: "classic", label: "Mode B · Classic Parity" }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`chip-btn ${m.amber ? "amber" : ""} ${state.naming.mode === m.id ? "active" : ""}`}
                          onClick={() => setState((prev) => ({ ...prev, naming: { ...prev.naming, mode: m.id } }))}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label>Saved Parameter Presets ({state.naming.activePresetName})</label>
                    <div className="chip-row">
                      <button
                        type="button"
                        className={`chip-btn ${state.naming.activePresetName === "Baseline Parity Defaults" ? "active" : ""}`}
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            suites: JSON.parse(JSON.stringify(PARITY_DEFAULTS)),
                            naming: { ...prev.naming, activePresetName: "Baseline Parity Defaults" }
                          }))
                        }
                      >
                        Baseline Parity Defaults
                      </button>
                      {state.customPresets.map((cp, idx) => (
                        <span key={idx} className={`chip-btn ${state.naming.activePresetName === cp.name ? "active" : ""}`}>
                          <span
                            style={{ cursor: "pointer" }}
                            onClick={() =>
                              setState((prev) => ({
                                ...prev,
                                suites: JSON.parse(JSON.stringify(cp.suites)),
                                naming: { ...prev.naming, activePresetName: cp.name }
                              }))
                            }
                          >
                            {cp.name}
                          </span>
                          <span
                            style={{ cursor: "pointer", opacity: 0.65, marginLeft: "4px" }}
                            onClick={() =>
                              setState((prev) => ({
                                ...prev,
                                customPresets: prev.customPresets.filter((_, i) => i !== idx)
                              }))
                            }
                          >
                            ×
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="guardrail-stack">
                  {guardrails.warnings.length === 0 ? (
                    <div className="banner banner-emerald">
                      <div className="banner-body">
                        <div className="banner-title">Guardrails Healthy — Zero Context Overflow or VRAM Violations</div>
                        <div className="small muted">
                          Estimated peak VRAM: <strong>{guardrails.vramEstimate.totalVramGb} GB</strong> (Model{" "}
                          {guardrails.vramEstimate.weightGb} GB + KV {guardrails.vramEstimate.kvGb} GB @{" "}
                          {guardrails.vramEstimate.kvPrecision} + 1.5 GB Compute) within {guardrails.vramEstimate.vramCeiling} GB ceiling.
                        </div>
                      </div>
                    </div>
                  ) : (
                    guardrails.warnings.map((w) => (
                      <div key={w.id} className={`banner banner-${w.severity}`}>
                        <div className="banner-body">
                          <div className="banner-title">{w.title}</div>
                          <div className="small">{w.detail}</div>
                        </div>
                        <button
                          type="button"
                          className={`btn ${w.severity === "crimson" ? "btn-crimson" : "btn-amber"}`}
                          onClick={() => applyGuardrailFix(w.id)}
                        >
                          {w.fixLabel}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="section-block" id="sec-suites" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="action-bar" style={{ padding: "0 2px" }}>
                  <div>
                    <span className="index-num">04</span>
                    <strong style={{ marginLeft: "6px", fontSize: "15px" }}>
                      Benchmark Suites ({state.ui.showMissingOnly ? "Filtered: Missing/Incomplete Only" : "All 6 Core Suites"})
                    </strong>
                  </div>
                  <button
                    type="button"
                    className={`chip-btn ${state.ui.showMissingOnly ? "amber active" : ""}`}
                    onClick={() => updateUi({ showMissingOnly: !state.ui.showMissingOnly })}
                  >
                    {state.ui.showMissingOnly
                      ? "Showing Missing / Incomplete Only (Show All)"
                      : "Generate Commands for Missing / Incomplete Runs Only"}
                  </button>
                </div>

                {SUITE_METADATA.map((meta) => {
                  const auditItem = (state.audit.items || {})[meta.id];
                  if (state.ui.showMissingOnly && auditItem && auditItem.status === "verified") return null;

                  const isDone = Boolean((state.completedSteps || {})[meta.id]);
                  const isExpanded = Boolean((state.ui.expandedDrawers || {})[meta.id]);
                  const isCustom = isSuiteCustomized(state, meta.id);
                  const out = getOutputTarget(state, meta.id);
                  const srvCmd = meta.hasServer ? buildServerCommand(state, meta.id) : "";
                  const cliCmd = buildSuiteClientCommand(state, meta.id);
                  const s = state.suites[meta.id];

                  return (
                    <article key={meta.id} className={`suite-card ${isDone ? "is-complete" : ""}`}>
                      <div className="card-header">
                        <div className="card-title-group">
                          <div className="card-kicker">
                            <span className="index-num">{meta.index}</span>
                            <span className={`badge ${meta.badgeClass}`}>{meta.category}</span>
                            <span className="badge">{meta.duration}</span>
                            {isCustom ? <span className="badge badge-amber">CUSTOMIZED</span> : <span className="badge">PARITY DEFAULT</span>}
                            {auditItem ? (
                              <span
                                className={`badge ${
                                  auditItem.status === "verified"
                                    ? "badge-emerald"
                                    : auditItem.status === "partial"
                                    ? "badge-amber"
                                    : auditItem.status === "stub"
                                    ? "badge-crimson"
                                    : ""
                                }`}
                              >
                                {auditItem.status === "verified" ? "🟢 VERIFIED COMPLETE" : auditItem.status === "partial" ? "🟡 PARTIAL" : auditItem.status === "stub" ? "🔴 STUB / FAILED" : "⚪ NOT RUN"}
                              </span>
                            ) : (
                              <span className="badge">⚪ NOT AUDITED</span>
                            )}
                          </div>
                          <h3 className="card-title">{meta.title}</h3>
                          <p className="card-desc">{meta.description}</p>
                        </div>

                        <div className="action-group">
                          <button
                            type="button"
                            className="btn"
                            onClick={() =>
                              updateUi({
                                expandedDrawers: { ...state.ui.expandedDrawers, [meta.id]: !isExpanded }
                              })
                            }
                          >
                            {isExpanded ? "Hide Parameters" : "Customize Parameters"}
                          </button>
                          {isCustom && (
                            <button
                              type="button"
                              className="btn btn-amber"
                              onClick={() => updateSuite(meta.id, JSON.parse(JSON.stringify(PARITY_DEFAULTS[meta.id])))}
                            >
                              Reset to Parity Default
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="output-preview-bar">
                        <span className={`badge ${out.mode === "stamped" ? "badge-amber" : "badge-cyan"}`}>
                          {out.mode === "stamped" ? "MODE A · STAMPED" : "MODE B · PARITY"}
                        </span>
                        <code>{out.fullPath}</code>
                      </div>

                      {isExpanded && (
                        <div className="drawer-panel">
                          {meta.id === "llama_bench" && (
                            <div className="form-grid">
                              <div className="field"><label>Prompt Tokens (-p)</label><input className="mono" value={s.p} onChange={(e) => updateSuite("llama_bench", { p: e.target.value })} /></div>
                              <div className="field"><label>Gen Tokens (-n)</label><input className="mono" value={s.n} onChange={(e) => updateSuite("llama_bench", { n: e.target.value })} /></div>
                              <div className="field"><label>Repetitions (-r)</label><input type="number" value={s.r} onChange={(e) => updateSuite("llama_bench", { r: Number(e.target.value) || 1 })} /></div>
                              <div className="field"><label>GPU Layers (-ngl)</label><input type="number" value={s.ngl} onChange={(e) => updateSuite("llama_bench", { ngl: Number(e.target.value) || 0 })} /></div>
                              <div className="field"><label>Batch (-b) / Micro (-ub)</label>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <input type="number" value={s.b} onChange={(e) => updateSuite("llama_bench", { b: Number(e.target.value) || 512 })} />
                                  <input type="number" value={s.ub} onChange={(e) => updateSuite("llama_bench", { ub: Number(e.target.value) || 128 })} />
                                </div>
                              </div>
                              <div className="field"><label>Flash Attn (-fa) / Output (-o)</label>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <select value={s.fa} onChange={(e) => updateSuite("llama_bench", { fa: e.target.value })}><option value="1">-fa 1</option><option value="0">-fa 0</option></select>
                                  <select value={s.format} onChange={(e) => updateSuite("llama_bench", { format: e.target.value })}><option value="md">md</option><option value="csv">csv</option><option value="json">json</option></select>
                                </div>
                              </div>
                            </div>
                          )}

                          {meta.id === "llama_benchy" && (
                            <div className="form-grid">
                              <div className="field"><label>Server Context (-c)</label><input type="number" value={s.c} onChange={(e) => updateSuite("llama_benchy", { c: Number(e.target.value) || 4096 })} /></div>
                              <div className="field"><label>KV Cache (-ctk / -ctv)</label>
                                <select value={s.ctk} onChange={(e) => updateSuite("llama_benchy", { ctk: e.target.value, ctv: e.target.value })}><option value="fp16">fp16 (Default)</option><option value="q8_0">q8_0 (Half VRAM)</option><option value="q4_0">q4_0</option></select>
                              </div>
                              <div className="field"><label>--pp List</label><input className="mono" value={s.pp} onChange={(e) => updateSuite("llama_benchy", { pp: e.target.value })} /></div>
                              <div className="field"><label>--tg List</label><input className="mono" value={s.tg} onChange={(e) => updateSuite("llama_benchy", { tg: e.target.value })} /></div>
                              <div className="field"><label>--depth List</label><input className="mono" value={s.depth} onChange={(e) => updateSuite("llama_benchy", { depth: e.target.value })} /></div>
                              <div className="field"><label>--runs / --format</label>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <input type="number" value={s.runs} onChange={(e) => updateSuite("llama_benchy", { runs: Number(e.target.value) || 1 })} />
                                  <select value={s.format} onChange={(e) => updateSuite("llama_benchy", { format: e.target.value })}><option value="md">md</option><option value="json">json</option></select>
                                </div>
                              </div>
                            </div>
                          )}

                          {meta.id === "llmperf" && (
                            <>
                              <div className="chip-row" style={{ marginBottom: "6px" }}>
                                <span className="small muted">Quick Profile:</span>
                                <button type="button" className={`chip-btn ${Number(s.meanInput) === 1024 ? "active" : ""}`} onClick={() => updateSuite("llmperf", { meanInput: 1024, meanOutput: 256 })}>1024 in / 256 out (Parity)</button>
                                <button type="button" className={`chip-btn ${Number(s.meanInput) === 512 ? "active" : ""}`} onClick={() => updateSuite("llmperf", { meanInput: 512, meanOutput: 128 })}>512 in / 128 out (Fast)</button>
                              </div>
                              <div className="form-grid">
                                <div className="field"><label>Server -c / -np</label>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input type="number" value={s.c} onChange={(e) => updateSuite("llmperf", { c: Number(e.target.value) || 4096 })} />
                                    <input type="number" value={s.np} style={{ maxWidth: "75px" }} onChange={(e) => updateSuite("llmperf", { np: Number(e.target.value) || 1 })} />
                                  </div>
                                </div>
                                <div className="field"><label>Mean / Stddev Input</label>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input type="number" value={s.meanInput} onChange={(e) => updateSuite("llmperf", { meanInput: Number(e.target.value) || 128 })} />
                                    <input type="number" value={s.stddevInput} onChange={(e) => updateSuite("llmperf", { stddevInput: Number(e.target.value) || 0 })} />
                                  </div>
                                </div>
                                <div className="field"><label>Mean / Stddev Output</label>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input type="number" value={s.meanOutput} onChange={(e) => updateSuite("llmperf", { meanOutput: Number(e.target.value) || 64 })} />
                                    <input type="number" value={s.stddevOutput} onChange={(e) => updateSuite("llmperf", { stddevOutput: Number(e.target.value) || 0 })} />
                                  </div>
                                </div>
                                <div className="field"><label>Concurrency / Max Req</label>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input type="number" value={s.concurrency} onChange={(e) => updateSuite("llmperf", { concurrency: Number(e.target.value) || 1 })} />
                                    <input type="number" value={s.maxCompleted} onChange={(e) => updateSuite("llmperf", { maxCompleted: Number(e.target.value) || 1 })} />
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {meta.id === "speed_bench" && (
                            <>
                              <div className="chip-row" style={{ marginBottom: "6px" }}>
                                <span className="small muted">Server Context Quick Toggle:</span>
                                {[16384, 32768, 65536].map((ctx) => (
                                  <button key={ctx} type="button" className={`chip-btn ${Number(s.c) === ctx ? "active" : ""}`} onClick={() => updateSuite("speed_bench", { c: ctx })}>
                                    {ctx === 65536 ? "64k Long Context" : `Standard ${ctx / 1024}k`}
                                  </button>
                                ))}
                              </div>
                              <div className="form-grid">
                                <div className="field"><label>Server Context (-c)</label><input type="number" value={s.c} onChange={(e) => updateSuite("speed_bench", { c: Number(e.target.value) || 4096 })} /></div>
                                <div className="field"><label>--category / --osl</label>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input className="mono" value={s.category} onChange={(e) => updateSuite("speed_bench", { category: e.target.value })} />
                                    <input type="number" value={s.osl} style={{ maxWidth: "85px" }} onChange={(e) => updateSuite("speed_bench", { osl: Number(e.target.value) || 256 })} />
                                  </div>
                                </div>
                                <div className="field"><label>--concurrency / --limit</label>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input type="number" value={s.concurrency} onChange={(e) => updateSuite("speed_bench", { concurrency: Number(e.target.value) || 1 })} />
                                    <input type="number" value={s.limit} onChange={(e) => updateSuite("speed_bench", { limit: Number(e.target.value) || 1 })} />
                                  </div>
                                </div>
                                <div className="field"><label>Comparator Baseline / Speculative</label>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input className="mono" value={s.compareBaselineFile} onChange={(e) => updateSuite("speed_bench", { compareBaselineFile: e.target.value })} />
                                    <input className="mono" value={s.compareSpeculativeFile} onChange={(e) => updateSuite("speed_bench", { compareSpeculativeFile: e.target.value })} />
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {meta.id === "agentperf" && (
                            <div className="form-grid">
                              <div className="field"><label>Server Context (-c)</label><input type="number" value={s.c} onChange={(e) => updateSuite("agentperf", { c: Number(e.target.value) || 4096 })} /></div>
                              <div className="field"><label>KV Cache (-ctk / -ctv)</label>
                                <select value={s.ctk} onChange={(e) => updateSuite("agentperf", { ctk: e.target.value, ctv: e.target.value })}><option value="fp16">fp16</option><option value="q8_0">q8_0</option><option value="q4_0">q4_0</option></select>
                              </div>
                              <div className="field"><label>Extra Flags</label><input className="mono" value={s.extraFlags} onChange={(e) => updateSuite("agentperf", { extraFlags: e.target.value })} /></div>
                            </div>
                          )}

                          {meta.id === "aiperf_std" && (
                            <div className="form-grid">
                              <div className="field"><label>Server Context (-c)</label><input type="number" value={s.c} onChange={(e) => updateSuite("aiperf_std", { c: Number(e.target.value) || 4096 })} /></div>
                              <div className="field"><label>Concurrency / Requests</label>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <input type="number" value={s.concurrency} onChange={(e) => updateSuite("aiperf_std", { concurrency: Number(e.target.value) || 1 })} />
                                  <input type="number" value={s.requestCount} onChange={(e) => updateSuite("aiperf_std", { requestCount: Number(e.target.value) || 1 })} />
                                </div>
                              </div>
                              <div className="field"><label>ISL Mean / OSL Mean</label>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <input type="number" value={s.islMean} onChange={(e) => updateSuite("aiperf_std", { islMean: Number(e.target.value) || 128 })} />
                                  <input type="number" value={s.oslMean} onChange={(e) => updateSuite("aiperf_std", { oslMean: Number(e.target.value) || 64 })} />
                                </div>
                              </div>
                            </div>
                          )}

                          {meta.id === "aiperf_sweep" && (
                            <div className="form-grid">
                              <div className="field"><label>Server Context (-c)</label><input type="number" value={s.c} onChange={(e) => updateSuite("aiperf_sweep", { c: Number(e.target.value) || 4096 })} /></div>
                              <div className="field"><label>KV Cache (-ctk / -ctv)</label>
                                <select value={s.ctk} onChange={(e) => updateSuite("aiperf_sweep", { ctk: e.target.value, ctv: e.target.value })}><option value="fp16">fp16</option><option value="q8_0">q8_0 (Recommended)</option><option value="q4_0">q4_0</option></select>
                              </div>
                              <div className="field"><label>Sweep --isl List</label><input className="mono" value={s.islList} onChange={(e) => updateSuite("aiperf_sweep", { islList: e.target.value })} /></div>
                              <div className="field"><label>Sweep --osl List</label><input className="mono" value={s.oslList} onChange={(e) => updateSuite("aiperf_sweep", { oslList: e.target.value })} /></div>
                              <div className="field"><label>Concurrency / Warmup / Req</label>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <input type="number" value={s.concurrency} onChange={(e) => updateSuite("aiperf_sweep", { concurrency: Number(e.target.value) || 1 })} />
                                  <input type="number" value={s.warmupCount} onChange={(e) => updateSuite("aiperf_sweep", { warmupCount: Number(e.target.value) || 0 })} />
                                  <input type="number" value={s.requestCount} onChange={(e) => updateSuite("aiperf_sweep", { requestCount: Number(e.target.value) || 1 })} />
                                </div>
                              </div>
                              <div className="field"><label>Options</label>
                                <label style={{ fontWeight: 500 }}>
                                  <input type="checkbox" checked={s.cachePrompt} onChange={(e) => updateSuite("aiperf_sweep", { cachePrompt: e.target.checked })} />{" "}
                                  <code>cache_prompt:true</code>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {meta.hasServer && (
                        <TerminalBox
                          titleLeft={`Terminal 1 · llama-server (${profile.shell})`}
                          titleRight={`--alias "${state.model.alias}"`}
                          code={srvCmd}
                        />
                      )}
                      <TerminalBox
                        titleLeft={`${meta.hasServer ? "Terminal 2 · Client Benchmark" : "Terminal · Native Direct Execution"} (${profile.shell})`}
                        titleRight="Live Preview"
                        code={cliCmd}
                      />

                      <div className="action-bar">
                        <div className="action-group">
                          <CopyButton text={cliCmd} label="Copy Command" className="btn btn-primary" />
                          {meta.hasServer && <CopyButton text={srvCmd} label="Copy Server Launch" className="btn" />}
                        </div>
                        <button
                          type="button"
                          className={`btn ${isDone ? "btn-emerald" : ""}`}
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              completedSteps: { ...prev.completedSteps, [meta.id]: !isDone }
                            }))
                          }
                        >
                          {isDone ? "✓ Step Complete" : "Mark Step Complete"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>

              <section className="panel-card section-block" id="sec-playbook">
                <div className="card-header" style={{ marginBottom: "12px" }}>
                  <div className="card-title-group">
                    <div className="card-kicker">
                      <span className="index-num">05</span>
                      <span className="badge badge-emerald">ALL-IN-ONE PLAYBOOK</span>
                    </div>
                    <h2 className="card-title">Complete Copy-Pasteable Runbook ({profile.shortName})</h2>
                    <p className="card-desc">Combines every active suite using your live paths, naming rules, and preset settings.</p>
                  </div>
                  <div className="action-group">
                    <CopyButton text={playbookCode} label="Copy Full Playbook" className="btn btn-primary" />
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        downloadFile(`ai_benchmate_${state.model.slug || "run"}.${profile.os === "windows" ? "ps1" : "sh"}`, playbookCode)
                      }
                    >
                      Download Script ({profile.os === "windows" ? ".ps1" : ".sh"})
                    </button>
                  </div>
                </div>
                <TerminalBox
                  titleLeft={`${profile.shell} · ${state.ui.showMissingOnly ? "Missing/Incomplete Runs Only" : "Full 6-Suite Playbook"}`}
                  titleRight={state.model.alias}
                  code={playbookCode}
                />
              </section>
            </>
          )}

          {state.ui.activeTab === "coverage" && (
            <section className="panel-card">
              <div className="card-header" style={{ marginBottom: "14px" }}>
                <div className="card-title-group">
                  <div className="card-kicker">
                    <span className="index-num">02</span>
                    <span className="badge badge-cyan">ANTI-1KB STUB AUDITOR</span>
                  </div>
                  <h2 className="card-title">Content-Aware Benchmark Folder Auditor</h2>
                  <p className="card-desc">
                    Inspects both file size (&gt;1–2 KB) and internal formatted metric rows/JSON exports via Directory Picker, folder selection, or drag-and-drop.
                  </p>
                </div>
                <div className="action-group">
                  {typeof window.showDirectoryPicker === "function" && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        try {
                          const dirHandle = await window.showDirectoryPicker();
                          const entries = [];
                          const walk = async (handle, prefix) => {
                            for await (const [name, child] of handle.entries()) {
                              const rel = prefix ? prefix + "/" + name : name;
                              if (child.kind === "file") {
                                const file = await child.getFile();
                                entries.push({ path: rel, name, size: file.size, textLoader: () => file.text() });
                              } else if (child.kind === "directory") {
                                await walk(child, rel);
                              }
                            }
                          };
                          await walk(dirHandle, "");
                          await runAuditEntries(entries, dirHandle.name);
                        } catch {}
                      }}
                    >
                      Open Results Folder (Picker)
                    </button>
                  )}
                  <label className="btn" style={{ cursor: "pointer" }}>
                    Select Folder
                    <input
                      type="file"
                      webkitdirectory=""
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (!files.length) return;
                        const entries = files.map((f) => ({
                          path: f.webkitRelativePath || f.name,
                          name: f.name,
                          size: f.size,
                          textLoader: () => f.text()
                        }));
                        const rootName = (files[0].webkitRelativePath || "").split("/")[0] || "Selected Folder";
                        await runAuditEntries(entries, rootName);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-amber"
                    onClick={() => updateUi({ showMissingOnly: true, activeTab: "builder" })}
                  >
                    Generate Commands for Missing / Incomplete Only
                  </button>
                </div>
              </div>

              <div
                className={`dropzone ${dragOverAudit ? "dragover" : ""}`}
                style={{ marginBottom: "16px" }}
                onDragOver={(e) => { e.preventDefault(); setDragOverAudit(true); }}
                onDragLeave={() => setDragOverAudit(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragOverAudit(false);
                  const entries = [];
                  const readEntry = async (entry, prefix) => {
                    if (entry.isFile) {
                      await new Promise((res) =>
                        entry.file((file) => {
                          entries.push({ path: prefix + entry.name, name: entry.name, size: file.size, textLoader: () => file.text() });
                          res();
                        })
                      );
                    } else if (entry.isDirectory) {
                      const reader = entry.createReader();
                      await new Promise((res) => {
                        const all = [];
                        const batch = () =>
                          reader.readEntries(async (list) => {
                            if (!list.length) {
                              for (const c of all) await readEntry(c, prefix + entry.name + "/");
                              res();
                            } else {
                              all.push(...list);
                              batch();
                            }
                          });
                        batch();
                      });
                    }
                  };
                  for (const it of Array.from(e.dataTransfer.items || [])) {
                    const entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
                    if (entry) await readEntry(entry, "");
                  }
                  if (entries.length) await runAuditEntries(entries, "Dropped Folder");
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>Drop Centralized Results Folder or Files Here</div>
                <div className="small muted">
                  {state.audit.lastFolderName
                    ? `Last Audited: ${state.audit.lastFolderName} (${state.audit.lastAuditedAt})`
                    : "Drag your results folder here (or click Select Folder above) to verify all 6 benchmark suites."}
                </div>
              </div>

              <div className="summary-kpi-row" style={{ marginBottom: "16px" }}>
                <div className="kpi-box"><div className="kpi-label">Verified Complete</div><div className="kpi-value" style={{ color: "var(--accent-emerald)" }}>{verifiedCount} / 7</div></div>
                <div className="kpi-box"><div className="kpi-label">Partial / Mismatch</div><div className="kpi-value" style={{ color: "var(--accent-amber)" }}>{Object.values(state.audit.items || {}).filter((i) => i?.status === "partial").length}</div></div>
                <div className="kpi-box"><div className="kpi-label">Stub / Failed</div><div className="kpi-value" style={{ color: "var(--accent-crimson)" }}>{Object.values(state.audit.items || {}).filter((i) => i?.status === "stub").length}</div></div>
                <div className="kpi-box"><div className="kpi-label">Not Run</div><div className="kpi-value">{7 - Object.values(state.audit.items || {}).filter((i) => i && i.status !== "not_run").length}</div></div>
              </div>

              <div className="data-table-wrap" style={{ marginBottom: "16px" }}>
                <table className="data-table">
                  <thead><tr><th>Suite</th><th>Expected Output Target</th><th>Status</th><th>Audit Findings</th></tr></thead>
                  <tbody>
                    {SUITE_METADATA.map((meta) => {
                      const exp = getOutputTarget(state, meta.id);
                      const r = (state.audit.items || {})[meta.id] || { status: "not_run", label: "NOT RUN", detail: "Select or drop a folder to audit." };
                      const badgeCls = r.status === "verified" ? "badge-emerald" : r.status === "partial" ? "badge-amber" : r.status === "stub" ? "badge-crimson" : "";
                      const icon = r.status === "verified" ? "🟢" : r.status === "partial" ? "🟡" : r.status === "stub" ? "🔴" : "⚪";
                      return (
                        <tr key={meta.id}>
                          <td><strong>{meta.index} · {meta.title}</strong></td>
                          <td><code>{exp.leaf}</code></td>
                          <td><span className={`badge ${badgeCls}`}>{icon} {r.label}</span></td>
                          <td className="small">{r.detail}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <TerminalBox
                  titleLeft="Terminal Deep Audit Script (Fallback / Headless SSH)"
                  code={buildDeepAuditScript(state)}
                  rightAction={<CopyButton text={buildDeepAuditScript(state)} label="Copy Audit Script" style={{ padding: "3px 9px" }} />}
                />
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "14px" }}>Reference Parity Matrix (Radeon AI Pro 9700 vs. DGX Spark)</h3>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Suite / Config</th><th>Radeon AI Pro 9700</th><th>DGX Spark</th><th>Purpose</th></tr></thead>
                  <tbody>
                    {REFERENCE_PARITY_GUIDE.map((row, idx) => (
                      <tr key={idx}>
                        <td><strong>{row.suite}</strong></td>
                        <td><span className="badge badge-emerald">{row.r9700}</span></td>
                        <td><span className={`badge ${row.dgx.startsWith("Completed") ? "badge-emerald" : "badge-amber"}`}>{row.dgx}</span></td>
                        <td className="small muted">{row.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {state.ui.activeTab === "results" && (
            <section className="panel-card">
              <div className="card-header" style={{ marginBottom: "14px" }}>
                <div className="card-title-group">
                  <div className="card-kicker"><span className="index-num">03</span><span className="badge badge-cyan">RESULT PARSER & COMPARISON STUDIO</span></div>
                  <h2 className="card-title">Interactive Comparison Tables, SVG Charts & Exports</h2>
                  <p className="card-desc">Drop or load <code>.md</code> and <code>.json</code> benchmark files across DGX Spark, RTX 5090 & Radeon AI Pro R9700.</p>
                </div>
                <div className="action-group">
                  <button
                    type="button"
                    className="btn btn-amber"
                    onClick={() => {
                      const nonSample = records.filter((r) => !r.isSample);
                      const nextRecs = [...nonSample, ...SAMPLE_RESULTS_DATASET];
                      saveSnapshotIDB("latest_results", nextRecs);
                      setState((prev) => ({ ...prev, results: { includeSampleData: true, loadedRecords: nextRecs } }));
                    }}
                  >
                    Load Sample Dataset (DGX Spark vs R9700)
                  </button>
                  <label className="btn btn-primary" style={{ cursor: "pointer" }}>
                    Load Result Files (.md / .json)
                    <input type="file" multiple accept=".md,.json,.csv" className="hidden" onChange={(e) => handleResultFiles(e.target.files)} />
                  </label>
                  <button type="button" className="btn" onClick={() => downloadFile("ai_benchmate_comparison.md", exportComparisonMarkdown(records), "text/markdown")}>Export .md</button>
                  <button type="button" className="btn" onClick={() => downloadFile("ai_benchmate_comparison.csv", exportComparisonCsv(records), "text/csv")}>Export .csv</button>
                  {records.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-crimson"
                      onClick={() => {
                        saveSnapshotIDB("latest_results", []);
                        setState((prev) => ({ ...prev, results: { includeSampleData: false, loadedRecords: [] } }));
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div
                className={`dropzone ${dragOverResults ? "dragover" : ""}`}
                style={{ marginBottom: "16px" }}
                onDragOver={(e) => { e.preventDefault(); setDragOverResults(true); }}
                onDragLeave={() => setDragOverResults(false)}
                onDrop={(e) => { e.preventDefault(); setDragOverResults(false); handleResultFiles(e.dataTransfer.files); }}
              >
                <strong>Drag & Drop Benchmark <code>.md</code> or <code>.json</code> Result Files Here</strong>
                <div className="small muted" style={{ marginTop: "4px" }}>
                  Supports <code>llama-bench</code>, <code>llama-benchy</code>, <code>llmperf</code>, <code>SPEED-Bench</code>, and <code>AIPerf</code> exports ({records.length} record(s) active).
                </div>
              </div>

              <div className="chart-grid" style={{ marginBottom: "16px" }}>
                <SvgBarChart title="Prefill (pp512 / 10) & Decode (tg128) Throughput" subtitle="Native C++ llama-bench comparison" items={benchBars} unit="t/s" />
                <SvgBarChart title="Depth 4096 KV Cache Degradation (%)" subtitle="Lower % drop = better long-context cache stability" items={depthBars} unit="% drop" />
                <SvgBarChart title="4-Stream Concurrency Output Throughput" subtitle="llmperf / AIPerf parallel stream total t/s" items={concBars} unit="t/s" />
                <SvgBarChart title="SPEED-Bench Qualitative Mean Throughput" subtitle="Multi-category qualitative average speed" items={sbBars} unit="t/s" />
              </div>

              <div className="chart-card" style={{ marginBottom: "16px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "14px" }}>16k / 32k / 64k Long-Context Scaling Curve (AIPerf Sweep)</h4>
                  <div className="small muted">Decode t/s scaling across 16k, 32k, and 64k input token prompts</div>
                </div>
                {sweepRecs.length ? (
                  <svg className="chart-svg" viewBox="0 0 560 175">
                    <line x1="60" y1="20" x2="60" y2="140" stroke="var(--border-strong)" />
                    <line x1="60" y1="140" x2="520" y2="140" stroke="var(--border-strong)" />
                    <text x="110" y="160" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">16k ISL</text>
                    <text x="275" y="160" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">32k ISL</text>
                    <text x="455" y="160" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">64k ISL</text>
                    {sweepRecs.map((rec, idx) => {
                      const maxT = Math.max(...sweepRecs.flatMap((r) => [r.metrics.tps16k || 0, r.metrics.tps32k || 0, r.metrics.tps64k || 0]), 40);
                      const yMap = (v) => 135 - Math.round(((v || 0) / maxT) * 105);
                      const col = idx % 2 === 0 ? "var(--accent-emerald)" : "var(--accent-primary)";
                      return (
                        <g key={idx}>
                          <polyline
                            fill="none"
                            stroke={col}
                            strokeWidth="2.5"
                            points={`125,${yMap(rec.metrics.tps16k)} 295,${yMap(rec.metrics.tps32k)} 470,${yMap(rec.metrics.tps64k)}`}
                          />
                          <circle cx="125" cy={yMap(rec.metrics.tps16k)} r="4" fill={col} />
                          <circle cx="295" cy={yMap(rec.metrics.tps32k)} r="4" fill={col} />
                          <circle cx="470" cy={yMap(rec.metrics.tps64k)} r="4" fill={col} />
                          <text x="72" y={18 + idx * 15} fill={col} fontSize="11" fontFamily="var(--font-mono)">
                            ● {rec.gpuLabel} ({rec.metrics.tps16k} → {rec.metrics.tps64k} t/s)
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <div className="small muted">Load an AIPerf 64k sweep JSON or click "Load Sample Dataset" above to render the 16k → 64k scaling curve.</div>
                )}
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Source File</th><th>GPU / Backend</th><th>Model</th><th>Suite</th><th>Parsed Metrics</th></tr></thead>
                  <tbody>
                    {records.length ? (
                      records.map((r) => (
                        <tr key={r.id}>
                          <td><code>{r.sourceFile}</code> {r.isSample && <span className="badge badge-amber">SAMPLE</span>}</td>
                          <td>{r.gpuLabel}</td>
                          <td>{r.modelLabel}</td>
                          <td><span className="badge">{r.suiteType}</span></td>
                          <td className="mono small">{Object.entries(r.metrics || {}).map(([k, v]) => `${k}=${v}`).join(" · ")}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="muted">No result files loaded yet. Drop files above or click "Load Sample Dataset".</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {state.ui.activeTab === "ssh" && (
            <section className="panel-card">
              <div className="card-header" style={{ marginBottom: "14px" }}>
                <div className="card-title-group">
                  <div className="card-kicker"><span className="index-num">04</span><span className="badge badge-emerald">SSH REMOTE & HERMES HOST</span></div>
                  <h2 className="card-title">Remote Linux/DGX Execution, tmux, scp & Hermes Stack Control</h2>
                  <p className="card-desc">All SSH parameters and Hermes LAN routing settings auto-save to <code>localStorage</code>.</p>
                </div>
              </div>

              <div className="form-grid" style={{ marginBottom: "16px" }}>
                <div className="field"><label>SSH User</label><input className="mono" value={state.ssh.user} onChange={(e) => updateSsh({ user: e.target.value })} /></div>
                <div className="field"><label>Remote Host / IP</label><input className="mono" value={state.ssh.host} onChange={(e) => updateSsh({ host: e.target.value })} /></div>
                <div className="field"><label>SSH Port</label><input type="number" className="mono" value={state.ssh.port} onChange={(e) => updateSsh({ port: Number(e.target.value) || 22 })} /></div>
                <div className="field"><label>tmux Session Name</label><input className="mono" value={state.ssh.tmuxSession} onChange={(e) => updateSsh({ tmuxSession: e.target.value })} /></div>
                <div className="field"><label>Remote Results Directory</label><input className="mono" value={state.ssh.remoteResultsDir} onChange={(e) => updateSsh({ remoteResultsDir: e.target.value })} /></div>
                <div className="field"><label>Local Windows Pull Folder</label><input className="mono" value={state.ssh.localPullDir} onChange={(e) => updateSsh({ localPullDir: e.target.value })} /></div>
                <div className="field"><label>Hermes Host LAN IP</label><input className="mono" value={state.ssh.hermesServerIp} onChange={(e) => updateSsh({ hermesServerIp: e.target.value })} /></div>
                <div className="field"><label>vLLM Restore Options</label>
                  <label style={{ fontWeight: 500 }}>
                    <input type="checkbox" checked={state.ssh.includeVllmInStartAi} onChange={(e) => updateSsh({ includeVllmInStartAi: e.target.checked })} /> Include vLLM ({state.ssh.vllmGpuUtil} VRAM) in restore
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  { title: "01 · Windows PowerShell 1-Line SSH Trigger (Persistent tmux)", code: sshCmds.psTrigger },
                  { title: "02 · Remote Linux tmux Split Session Setup", code: sshCmds.tmuxLaunch },
                  { title: "03 · Pull Remote Results via scp -r into Local Centralized Folder", code: sshCmds.scpPull },
                  { title: "04 · Pre-Benchmark DGX Spark VRAM Sweep (Free All AI Ports)", code: sshCmds.vramSweep },
                  { title: "05 · Post-Benchmark Restore: Bring Hermes AI Stack Back Online (start-ai)", code: sshCmds.startAiRestore },
                  { title: "06 · Hermes Agent Multi-Instance Routing YAML Snippet", code: sshCmds.hermesYaml }
                ].map((b, i) => (
                  <TerminalBox
                    key={i}
                    titleLeft={b.title}
                    code={b.code}
                    rightAction={<CopyButton text={b.code} label="Copy" style={{ padding: "3px 9px" }} />}
                  />
                ))}
              </div>
            </section>
          )}

          {state.ui.activeTab === "setup" && (
            <section className="panel-card">
              <div className="card-header" style={{ marginBottom: "14px" }}>
                <div className="card-title-group">
                  <div className="card-kicker"><span className="index-num">05</span><span className="badge badge-amber">ENVIRONMENT SETUP & HOTFIXES</span></div>
                  <h2 className="card-title">Platform Setup, Python 3.12+ Patches & Troubleshooting ({profile.shortName})</h2>
                  <p className="card-desc">Tailored for {profile.name} ({profile.arch}).</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {setupCards.map((c) => (
                  <TerminalBox
                    key={c.id}
                    titleLeft={
                      <span>
                        <strong>{c.title}</strong> <span className="badge badge-cyan" style={{ marginLeft: "6px" }}>{c.badge}</span>
                      </span>
                    }
                    code={c.cmd}
                    rightAction={<CopyButton text={c.cmd} label="Copy Command" style={{ padding: "3px 9px" }} />}
                  />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
