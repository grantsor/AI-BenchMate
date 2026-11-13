import React, { useEffect, useMemo, useState } from "react";
import {
  HARDWARE_PROFILES,
  PARITY_DEFAULTS,
  QUICK_MODELS,
  SAMPLE_RESULTS_DATASET,
  SUITE_METADATA
} from "./core/benchmate-data.js";
import {
  auditFileList,
  buildDeepAuditScript,
  buildSelectedSuitesPreview,
  buildSetupCards,
  buildSshCommands,
  computeModelFitRows,
  evaluateGuardrails,
  exportComparisonCsv,
  exportComparisonMarkdown,
  getOutputTarget,
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
  const tokenRe = /("[^"]*"|'[^']*'|`[^`]*`|\s--?[a-zA-Z0-9_-]+|^--?[a-zA-Z0-9_-]+|\S+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let k = 0;
  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
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
  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return <div key={idx}>{parts.length ? parts : " "}</div>;
}

function CopyButton({ text, label = "Copy", className = "btn", onClickExtra }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (onClickExtra) onClickExtra();
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
    <button type="button" className={`${className} ${copied ? "copied" : ""}`} onClick={onCopy}>
      {copied ? "Copied!" : label}
    </button>
  );
}

function TerminalBox({ titleLeft, code }) {
  const lines = useMemo(() => String(code || "").split("\n"), [code]);
  return (
    <div className="sb-terminal-wrap">
      <div className="sb-terminal-bar">
        <span>{titleLeft}</span>
        <CopyButton text={code} label="Copy" className="btn btn-sm btn-outline" />
      </div>
      <pre className="sb-terminal-pre">{lines.map((l, i) => renderHighlightedLine(l, i))}</pre>
    </div>
  );
}

function SvgBarChart({ title, subtitle, items, unit }) {
  if (!items.length) {
    return (
      <div className="sb-chart-card">
        <h4 style={{ margin: 0 }}>{title}</h4>
        <div className="small muted">{subtitle}</div>
        <div className="small muted">No matching parsed files loaded yet.</div>
      </div>
    );
  }
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const rowH = 30;
  const svgH = items.length * rowH + 20;
  return (
    <div className="sb-chart-card">
      <h4 style={{ margin: 0, fontSize: "13.5px" }}>{title}</h4>
      <div className="small muted">{subtitle}</div>
      <svg className="sb-chart-svg" viewBox={`0 0 560 ${svgH}`}>
        {items.map((item, idx) => {
          const y = idx * rowH + 10;
          const barW = Math.max(4, Math.round((item.value / maxVal) * 280));
          const color = item.color || "var(--accent)";
          return (
            <g key={idx}>
              <text x="4" y={y + 13} fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">
                {item.label.slice(0, 26)}
              </text>
              <rect x="205" y={y + 2} width="280" height="14" rx="4" fill="var(--chart-grid)" />
              <rect x="205" y={y + 2} width={barW} height="14" rx="4" fill={color} />
              <text x={213 + barW} y={y + 13} fill="var(--text-primary)" fontSize="11" fontWeight="700" fontFamily="var(--font-mono)">
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
  const [, setRefreshTick] = useState(0);
  const [dragOverAudit, setDragOverAudit] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

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

  useEffect(() => {
    const html = document.documentElement;
    let resolved = state.ui.theme || "light";
    if (resolved === "system") {
      resolved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    html.setAttribute("data-theme", resolved);
    html.setAttribute("data-light-terminal", state.ui.lightTerminal ? "true" : "false");
    html.classList.toggle("pause-animations", Boolean(state.ui.pauseAnimations));
  }, [state.ui.theme, state.ui.lightTerminal, state.ui.pauseAnimations]);

  const profile = HARDWARE_PROFILES[state.hardware.profileId];
  const vramGb = Number(state.hardware.vramGb) || profile.defaultVramGb;
  const budgetGib = (vramGb * 0.9).toFixed(1);
  const poolType = profile.os === "linux" ? "unified" : "discrete";

  const guardrails = useMemo(() => evaluateGuardrails(state), [state]);
  const fitRows = useMemo(() => computeModelFitRows(state), [state]);
  const runPreviewCode = useMemo(() => buildSelectedSuitesPreview(state), [state]);

  const updateUi = (patch) => setState((prev) => ({ ...prev, ui: { ...prev.ui, ...patch } }));
  const updateHardware = (patch) => setState((prev) => ({ ...prev, hardware: { ...prev.hardware, ...patch } }));
  const updateModel = (patch) => setState((prev) => ({ ...prev, model: { ...prev.model, ...patch } }));
  const updateSuiteField = (suiteId, field, value) =>
    setState((prev) => ({
      ...prev,
      suites: { ...prev.suites, [suiteId]: { ...prev.suites[suiteId], [field]: value } }
    }));

  const switchHardwareProfile = (newProfileId) => {
    const nextP = HARDWARE_PROFILES[newProfileId];
    if (!nextP) return;
    setState((prev) => {
      const prevP = HARDWARE_PROFILES[prev.hardware.profileId];
      const sep = nextP.os === "windows" ? "\\" : "/";
      const matchQuick = QUICK_MODELS.find((m) => m.alias === prev.model.alias);
      let nextFullPath = prev.model.fullPath;
      if (matchQuick) {
        const rel = nextP.os === "windows" ? matchQuick.relativeWin : matchQuick.relativeLinux;
        nextFullPath = joinPath(nextP.defaultModelsDir, rel, sep);
      } else if (prevP.os !== nextP.os) {
        const fileOnly = (prev.model.filename || "model.gguf").split(/[\\/]+/).pop();
        nextFullPath = joinPath(nextP.defaultModelsDir, fileOnly, sep);
      }
      const parsed = parseModelPath(nextFullPath);
      return {
        ...prev,
        hardware: {
          ...prev.hardware,
          profileId: nextP.id,
          vramGb: nextP.defaultVramGb,
          binDir: nextP.defaultBinDir,
          repoDir: nextP.defaultRepoDir,
          benchRoot: nextP.defaultBenchRoot,
          resultsDir: nextP.defaultResultsDir,
          nvidiaDevice: nextP.deviceFlag || prev.hardware.nvidiaDevice
        },
        model: {
          ...prev.model,
          fullPath: nextFullPath,
          baseDir: parsed.baseDir,
          filename: parsed.filename
        }
      };
    });
  };

  const selectQuickModel = (qm) => {
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

  const selectModelById = (modelId) => {
    const quick = QUICK_MODELS.find((m) => m.id === modelId);
    if (quick) {
      selectQuickModel(quick);
      return;
    }
    if (modelId.startsWith("custom_")) {
      const idx = parseInt(modelId.replace("custom_", ""), 10);
      const cm = (state.customModels || [])[idx];
      if (cm) updateModel(cm);
    }
  };

  const applyGuardrailFix = (fixId) => {
    setState((prev) => {
      if (fixId === "ctx_aiperf_sweep") {
        return { ...prev, suites: { ...prev.suites, aiperf_sweep: { ...prev.suites.aiperf_sweep, c: 70000, ctk: "q8_0", ctv: "q8_0" } } };
      }
      if (fixId === "ctx_benchy") {
        return { ...prev, suites: { ...prev.suites, llama_benchy: { ...prev.suites.llama_benchy, c: 70000 } } };
      }
      if (fixId === "vram_overflow") {
        const nextKv = guardrails.vramEstimate.kvPrecision === "fp16" ? "q8_0" : "q4_0";
        const nextSuites = { ...prev.suites };
        ["llama_benchy", "llmperf", "speed_bench", "agentperf", "aiperf_std", "aiperf_sweep"].forEach((sid) => {
          nextSuites[sid] = { ...nextSuites[sid], ctk: nextKv, ctv: nextKv };
        });
        return { ...prev, suites: nextSuites };
      }
      return prev;
    });
  };

  const runAuditEntries = async (entries, folderName) => {
    const items = await auditFileList(entries, state);
    const nextAudit = { items, lastFolderName: folderName, lastAuditedAt: new Date().toLocaleTimeString() };
    setState((prev) => ({ ...prev, audit: nextAudit }));
    await saveSnapshotIDB("latest_audit", nextAudit);
  };

  const handleAuditDrop = async (e) => {
    e.preventDefault();
    setDragOverAudit(false);
    const dtItems = Array.from(e.dataTransfer.items || []);
    const entries = [];
    async function readEntry(entry, prefix) {
      if (entry.isFile) {
        await new Promise((res) => entry.file((file) => {
          entries.push({ path: prefix + entry.name, name: entry.name, size: file.size, textLoader: () => file.text() });
          res();
        }));
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        await new Promise((res) => {
          const all = [];
          const batch = () => reader.readEntries(async (list) => {
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
    }
    for (const it of dtItems) {
      const entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
      if (entry) await readEntry(entry, "");
    }
    if (!entries.length && e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach((f) => entries.push({ path: f.name, name: f.name, size: f.size, textLoader: () => f.text() }));
    }
    if (entries.length) await runAuditEntries(entries, "Dropped Folder");
  };

  const handleResultFiles = async (fileList) => {
    const parsed = [];
    for (const f of Array.from(fileList || [])) {
      const rec = parseResultFile(f.name, await f.text());
      if (rec) parsed.push(rec);
    }
    if (parsed.length) {
      const nextRecords = [...(state.results.loadedRecords || []), ...parsed];
      setState((prev) => ({ ...prev, results: { ...prev.results, loadedRecords: nextRecords } }));
      await saveSnapshotIDB("latest_results", nextRecords);
    }
  };

  // Derived lists for Run / Results / Remote
  const auditItems = state.audit.items || {};
  const verifiedCount = Object.values(auditItems).filter((i) => i && i.status === "verified").length;
  const outstandingSuitesText = SUITE_METADATA
    .filter((m) => !(auditItems[m.id] && auditItems[m.id].status === "verified"))
    .map((m) => m.shortLabel || m.id)
    .join(", ") || "all verified";

  const suiteOrder = ["agentperf", "aiperf_std", "aiperf_sweep", "llama_bench", "llama_benchy", "llmperf", "speed_bench"];
  const metaMap = useMemo(() => {
    const m = {};
    SUITE_METADATA.forEach((x) => { m[x.id] = x; });
    return m;
  }, []);

  const modelOptions = useMemo(() => {
    const arr = QUICK_MODELS.map((m) => ({ id: m.id, label: `${m.alias} (${m.quant || "Q4_K_M"})`, alias: m.alias }));
    (state.customModels || []).forEach((cm, idx) => arr.push({ id: `custom_${idx}`, label: `${cm.alias} (Custom)`, alias: cm.alias }));
    return arr;
  }, [state.customModels]);
  const activeModelMatch = modelOptions.find((o) => o.alias === state.model.alias);

  const remoteSections = useMemo(() => {
    const cmds = buildSshCommands(state);
    const items = [
      { id: "ssh_ps", label: "SSH PowerShell", code: cmds.psTrigger },
      { id: "ssh_tmux", label: "tmux Split", code: cmds.tmuxLaunch },
      { id: "ssh_scp", label: "SCP Pull Results", code: cmds.scpPull },
      { id: "ssh_vram", label: "DGX VRAM Sweep", code: cmds.vramSweep },
      { id: "ssh_startai", label: "Restore start-ai", code: cmds.startAiRestore },
      { id: "ssh_hermes", label: "Hermes YAML", code: cmds.hermesYaml },
      { id: "audit_deep", label: "Deep Audit Script", code: buildDeepAuditScript(state) }
    ];
    buildSetupCards(state).forEach((c) => items.push({ id: c.id, label: c.badge, code: c.cmd }));
    return items;
  }, [state]);
  const activeRemote = remoteSections.find((r) => r.id === state.ui.remoteSection) || remoteSections[0];

  const baseTiers = useMemo(() => {
    const arr = [16, 24, 32, 48, 64, 96, 128];
    if (!arr.includes(vramGb)) arr.push(vramGb);
    return arr.sort((a, b) => a - b);
  }, [vramGb]);

  const records = state.results.loadedRecords || [];
  const benchBars = [];
  const depthBars = [];
  const concBars = [];
  if (state.ui.showCharts) {
    records.filter((r) => r.suiteType === "llama_bench").forEach((r) => {
      if (r.metrics.tg128) benchBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} tg128`, value: r.metrics.tg128, color: "var(--accent)" });
      if (r.metrics.pp512) benchBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} pp/10`, value: Math.round(r.metrics.pp512 / 10), color: "var(--ok)" });
    });
    records.filter((r) => r.suiteType === "llama_benchy").forEach((r) => {
      depthBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]}`, value: r.metrics.degradationPct || 0, color: "var(--warn)" });
    });
    records.filter((r) => r.suiteType === "llmperf").forEach((r) => {
      concBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]}`, value: r.metrics.totalTps || 0, color: "var(--accent)" });
    });
  }

  const tabs = [
    { id: "system", label: "System" },
    { id: "models", label: "Models" },
    { id: "run", label: "Run" },
    { id: "results", label: "Results" },
    { id: "remote", label: "Remote & Setup" }
  ];

  const selectedSuites = state.ui.selectedRunSuites || [];

  return (
    <div className="sb-container">
      <header className="sb-header">
        <div className="sb-brand-cluster">
          <span className="sb-brand">ai-benchmate</span>
          <span className="sb-version">1.0.0</span>
          <span className="sb-pill">platform: <strong>{profile.id}</strong></span>
          <span className="sb-pill">memory: <strong>{poolType} {vramGb} GiB</strong></span>
          <span className="sb-pill">binding: <strong>system_usable {budgetGib} GiB</strong></span>
          <span className="sb-pill sb-pill-quiet">localhost only · publishes nothing</span>
        </div>

        <div className="sb-header-controls">
          <button
            type="button"
            className={`sb-ctrl-btn ${state.ui.pauseAnimations ? "is-active" : ""}`}
            onClick={() => updateUi({ pauseAnimations: !state.ui.pauseAnimations })}
            title="Pause Animations & Benchmark Stealth Mode"
          >
            {state.ui.pauseAnimations ? "Stealth: ON" : "Pause Animations"}
          </button>
          <select className="sb-ctrl-select" aria-label="Theme" value={state.ui.theme} onChange={(e) => updateUi({ theme: e.target.value })}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </header>

      <nav className="folder-tabs" aria-label="Primary Tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`folder-tab ${state.ui.activeTab === t.id ? "active" : ""}`}
            onClick={() => updateUi({ activeTab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="sb-card">
        {state.ui.activeTab === "system" && (
          <>
            <h2 className="sb-section-title">System & Platform Configuration</h2>
            <div className="sb-form-grid">
              <div className="sb-field">
                <label>Target Compute Profile</label>
                <select className="sb-select" value={state.hardware.profileId} onChange={(e) => switchHardwareProfile(e.target.value)}>
                  {Object.values(HARDWARE_PROFILES).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.shell})</option>
                  ))}
                </select>
              </div>
              <div className="sb-field">
                <label>VRAM Capacity (GiB)</label>
                <input type="number" className="sb-input mono" value={state.hardware.vramGb} min={4} max={512} onChange={(e) => updateHardware({ vramGb: Number(e.target.value) || 32 })} />
              </div>
              {state.hardware.profileId === "amd_win_x64" && (
                <div className="sb-field">
                  <label>AMD Compute Backend</label>
                  <select className="sb-select" value={state.hardware.amdBackend} onChange={(e) => updateHardware({ amdBackend: e.target.value, binDir: e.target.value === "rocm" ? "C:\\llama.cpp\\hip" : "C:\\llama.cpp\\vulkan" })}>
                    <option value="vulkan">Vulkan0 (Default)</option>
                    <option value="rocm">ROCm / HIP0</option>
                  </select>
                </div>
              )}
              {profile.supportsMultiGpu && (
                <>
                  <div className="sb-field">
                    <label>CUDA Device (--device)</label>
                    <input type="text" className="sb-input mono" value={state.hardware.nvidiaDevice} onChange={(e) => updateHardware({ nvidiaDevice: e.target.value })} />
                  </div>
                  <div className="sb-field">
                    <label>Multi-GPU Tensor Split (Optional)</label>
                    <input type="text" className="sb-input mono" value={state.hardware.tensorSplit} placeholder="0.5,0.5" onChange={(e) => updateHardware({ tensorSplit: e.target.value })} />
                  </div>
                </>
              )}
              <div className="sb-field">
                <label>Server Host & Port</label>
                <div className="sb-inline-row" style={{ gap: "6px", flexWrap: "nowrap" }}>
                  <input type="text" className="sb-input mono" value={state.hardware.host} style={{ flex: 1, minWidth: "90px" }} onChange={(e) => updateHardware({ host: e.target.value })} />
                  <input type="number" className="sb-input mono" value={state.hardware.port} style={{ width: "82px" }} onChange={(e) => updateHardware({ port: Number(e.target.value) || 8080 })} />
                </div>
              </div>
              <div className="sb-field">
                <label>Dynamic Result Naming</label>
                <select className="sb-select" value={state.naming.mode} onChange={(e) => setState((prev) => ({ ...prev, naming: { ...prev.naming, mode: e.target.value } }))}>
                  <option value="auto">Auto (Stamp on Customize)</option>
                  <option value="stamped">Mode A · Parameter-Stamped</option>
                  <option value="classic">Mode B · Classic Parity</option>
                </select>
              </div>
              <div className="sb-field">
                <label>Client --model Argument</label>
                <select className="sb-select" value={state.model.clientModelMode} onChange={(e) => updateModel({ clientModelMode: e.target.value })}>
                  <option value="alias">Served Alias (--alias)</option>
                  <option value="fullpath">Full GGUF File Path</option>
                </select>
              </div>
            </div>

            <h3 className="sb-sub-title">Directory Paths</h3>
            <div className="sb-form-grid">
              <div className="sb-field"><label>llama.cpp Binaries</label><input type="text" className="sb-input mono" value={state.hardware.binDir} onChange={(e) => updateHardware({ binDir: e.target.value })} /></div>
              <div className="sb-field"><label>Centralized Results</label><input type="text" className="sb-input mono" value={state.hardware.resultsDir} onChange={(e) => updateHardware({ resultsDir: e.target.value })} /></div>
              <div className="sb-field"><label>Benchmarks Root (Venvs)</label><input type="text" className="sb-input mono" value={state.hardware.benchRoot} onChange={(e) => updateHardware({ benchRoot: e.target.value })} /></div>
              <div className="sb-field"><label>llama.cpp Repo Root</label><input type="text" className="sb-input mono" value={state.hardware.repoDir} onChange={(e) => updateHardware({ repoDir: e.target.value })} /></div>
            </div>

            <div className="sb-inline-row" style={{ marginTop: "16px", justifyContent: "space-between" }}>
              <div className="sb-inline-row">
                {state.hardware.profileId === "dgx_spark_linux_arm64" && (
                  <label className="suite-check-label"><input type="checkbox" checked={state.hardware.nonSudoSetup} onChange={(e) => updateHardware({ nonSudoSetup: e.target.checked })} /> Non-sudo setup (skip apt python3-dev)</label>
                )}
                {state.hardware.profileId === "rtx_spark_win_arm64" && (
                  <label className="suite-check-label"><input type="checkbox" checked={state.hardware.rtxArmTdigestCompile} onChange={(e) => updateHardware({ rtxArmTdigestCompile: e.target.checked })} /> Compile aiperf[tdigest] C extension</label>
                )}
                {state.hardware.profileId === "amd_win_x64" && state.hardware.amdBackend === "vulkan" && (
                  <label className="suite-check-label"><input type="checkbox" checked={state.hardware.amdEnableFa} onChange={(e) => updateHardware({ amdEnableFa: e.target.checked })} /> Enable -fa 1 on Vulkan</label>
                )}
                <label className="suite-check-label"><input type="checkbox" checked={state.ui.lightTerminal} onChange={(e) => updateUi({ lightTerminal: e.target.checked })} /> Light Terminal (#F0EFEA)</label>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setState((prev) => ({ ...prev, suites: JSON.parse(JSON.stringify(PARITY_DEFAULTS)), naming: { ...prev.naming, activePresetName: "Baseline Parity Defaults" } }))}
              >
                Reset Suites to Parity Defaults
              </button>
            </div>
          </>
        )}

        {state.ui.activeTab === "models" && (
          <>
            <h2 className="sb-section-title">What fits, and at what context</h2>
            <div className="sb-inline-row">
              <label className="sb-field-inline">
                <span>Tier</span>
                <select className="sb-select" value={vramGb} onChange={(e) => updateHardware({ vramGb: Number(e.target.value) || 64 })}>
                  {baseTiers.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="sb-field-inline">
                <span>KV</span>
                <select className="sb-select" value={state.ui.fitKv || "fp16"} onChange={(e) => updateUi({ fitKv: e.target.value })}>
                  <option value="fp16">f16</option>
                  <option value="q8_0">q8_0</option>
                  <option value="q4_0">q4_0</option>
                </select>
              </label>
              <button type="button" className="btn btn-outline" onClick={() => setRefreshTick((n) => n + 1)}>Refresh</button>
              <span className="small muted">Every answer is a model and a context. A fit at 2K is not a usable result. Click a row to select.</span>
            </div>

            <div className="sb-table-wrap">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Quant</th>
                    <th>Kind</th>
                    <th className="num">Best ctx</th>
                    <th className="num">Total</th>
                    <th className="num">Budget</th>
                    <th className="num">Headroom</th>
                  </tr>
                </thead>
                <tbody>
                  {fitRows.map((r) => {
                    const isSelected = state.model.alias === r.rawModel.alias;
                    return (
                      <tr key={r.id} className={isSelected ? "is-selected" : ""} onClick={() => selectModelById(r.id)} title={`Click to select ${r.modelLabel}`}>
                        <td>{r.modelLabel}</td>
                        <td className="mono">{r.quant}</td>
                        <td className="mono">{r.kind}</td>
                        <td className="num mono">{r.bestCtxLabel}</td>
                        <td className="num mono">{r.totalGib.toFixed(2)}</td>
                        <td className="num mono">{r.budgetGib.toFixed(1)}</td>
                        <td className="num mono" style={!r.fits ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{r.headroomGib.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sb-inline-row" style={{ marginTop: "14px" }}>
              <span className="small muted" style={{ fontWeight: 600 }}>Custom .gguf:</span>
              <input
                type="text"
                className="sb-input sb-input-wide mono"
                value={state.model.fullPath}
                placeholder="Paste full Windows or Linux .gguf path to auto-fill alias & slug"
                onChange={(e) => {
                  const p = parseModelPath(e.target.value);
                  updateModel({ fullPath: e.target.value, baseDir: p.baseDir, filename: p.filename, alias: p.alias, slug: p.slug, tokenizer: p.tokenizer, weightGb: p.weightGb, paramsB: p.paramsB });
                }}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setState((prev) => ({
                  ...prev,
                  customModels: prev.customModels.some((m) => m.fullPath === prev.model.fullPath) ? prev.customModels : [...prev.customModels, { ...prev.model }]
                }))}
              >
                + Save Model
              </button>
            </div>
          </>
        )}

        {state.ui.activeTab === "run" && (
          <>
            <h2 className="sb-section-title">Run benchmarks</h2>
            <div className="outstanding-box">
              <div className="outstanding-heading">One click: the outstanding parity benchmarks.</div>
              <div className="outstanding-list">
                <div className={`outstanding-row ${state.model.slug === "qwen38" ? "is-active" : ""}`} onClick={() => selectModelById("qwen38_27b")}>
                  <div className="outstanding-left"><strong>qwen38-27b</strong> · {outstandingSuitesText}</div>
                  <div className="outstanding-right">AIPerf 64k/1k TTFT and E2E, plus Dense 27B parity suites</div>
                </div>
                <div className={`outstanding-row ${state.model.slug === "qwen36" ? "is-active" : ""}`} onClick={() => selectModelById("qwen36_35b_moe")}>
                  <div className="outstanding-left"><strong>qwen36-35b-a3b</strong> · aiperf-64k, speed-bench, llama-bench, llama-benchy, llmperf</div>
                  <div className="outstanding-right">AIPerf 64k/1k TTFT and E2E on the MoE model</div>
                </div>
              </div>
            </div>

            <div className="sb-inline-row" style={{ marginBottom: "18px" }}>
              <CopyButton
                text={buildSelectedSuitesPreview({ ...state, ui: { ...state.ui, previewMode: "outstanding" } })}
                label="Run everything outstanding"
                className="btn btn-primary"
                onClickExtra={() => updateUi({ previewMode: "outstanding" })}
              />
              <button type="button" className="btn btn-outline" onClick={() => updateUi({ previewMode: "prereqs" })}>Check prerequisites only</button>
            </div>

            <h3 className="sb-sub-title">Or a single run</h3>
            <div className="sb-inline-row" style={{ marginBottom: "10px" }}>
              <label className="sb-field-inline">
                <span>Model</span>
                <select className="sb-select" value={activeModelMatch ? activeModelMatch.id : "__current__"} onChange={(e) => e.target.value !== "__current__" && selectModelById(e.target.value)}>
                  {!activeModelMatch && <option value="__current__">{state.model.alias} (Custom Path)</option>}
                  {modelOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>

              <span className="sb-field-inline"><span>Suites</span></span>
              <div className="suite-checks">
                {suiteOrder.map((sid) => {
                  const m = metaMap[sid];
                  const checked = selectedSuites.includes(sid);
                  const verified = auditItems[sid] && auditItems[sid].status === "verified";
                  return (
                    <label key={sid} className={`suite-check-label ${verified ? "is-verified" : ""}`} title={m.title}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const nextSet = new Set(selectedSuites);
                          if (e.target.checked) nextSet.add(sid);
                          else nextSet.delete(sid);
                          updateUi({ selectedRunSuites: Array.from(nextSet), previewMode: "selected" });
                        }}
                      />
                      <span>{m.shortLabel || sid}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="sb-inline-row">
              <label className="sb-field-inline" style={{ minWidth: "240px" }}>
                <span>Note</span>
                <input
                  type="text"
                  className="sb-input"
                  style={{ minWidth: "190px" }}
                  placeholder="Performance fan profile"
                  value={state.ui.runNote || ""}
                  onChange={(e) => updateUi({ runNote: e.target.value })}
                />
              </label>
              <button type="button" className="btn btn-outline" onClick={() => updateUi({ previewMode: "selected" })}>Preview commands</button>
              <CopyButton text={runPreviewCode} label="Copy commands" className="btn btn-primary" />
              <button type="button" className="btn btn-outline" onClick={() => updateUi({ showParamCustomize: !state.ui.showParamCustomize })}>
                Customize parameters {state.ui.showParamCustomize ? "▴" : "▾"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => downloadFile(`ai_benchmate_${state.model.slug || "run"}.${profile.os === "windows" ? "ps1" : "sh"}`, runPreviewCode)}
              >
                Download {profile.os === "windows" ? ".ps1" : ".sh"}
              </button>
            </div>

            {guardrails.warnings.map((w) => (
              <div key={w.id} className={`sb-banner ${w.severity === "crimson" ? "sb-banner-danger" : "sb-banner-warn"}`}>
                <div><strong>{w.title}:</strong> {w.detail}</div>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => applyGuardrailFix(w.id)}>{w.fixLabel}</button>
              </div>
            ))}

            {state.ui.showParamCustomize && (
              <div className="sb-drawer">
                <div className="sb-inline-row" style={{ justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "13px" }}>Customize Model Fields, Naming & Active Suite Parameters</strong>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setState((prev) => ({ ...prev, suites: JSON.parse(JSON.stringify(PARITY_DEFAULTS)), naming: { ...prev.naming, activePresetName: "Baseline Parity Defaults" } }))}
                  >
                    Reset to Parity Defaults
                  </button>
                </div>
                <div className="sb-form-grid" style={{ marginBottom: "12px" }}>
                  <div className="sb-field"><label>Model Alias (--alias)</label><input type="text" className="sb-input mono" value={state.model.alias} onChange={(e) => updateModel({ alias: e.target.value })} /></div>
                  <div className="sb-field"><label>Output File Slug</label><input type="text" className="sb-input mono" value={state.model.slug} onChange={(e) => updateModel({ slug: e.target.value })} /></div>
                  <div className="sb-field"><label>HF Tokenizer ID</label><input type="text" className="sb-input mono" value={state.model.tokenizer} onChange={(e) => updateModel({ tokenizer: e.target.value })} /></div>
                  <div className="sb-field">
                    <label>Result Naming Mode</label>
                    <select className="sb-select" value={state.naming.mode} onChange={(e) => setState((prev) => ({ ...prev, naming: { ...prev.naming, mode: e.target.value } }))}>
                      <option value="auto">Auto (Stamp on Customize)</option>
                      <option value="stamped">Mode A · Parameter-Stamped</option>
                      <option value="classic">Mode B · Classic Parity</option>
                    </select>
                  </div>
                </div>
                <div className="sb-form-grid">
                  {selectedSuites.includes("llama_bench") && (
                    <div className="sb-field"><label>llama-bench (-p / -n / -r)</label>
                      <div className="sb-inline-row" style={{ gap: "6px" }}>
                        <input type="text" className="sb-input mono" style={{ width: "92px" }} value={state.suites.llama_bench.p} onChange={(e) => updateSuiteField("llama_bench", "p", e.target.value)} />
                        <input type="text" className="sb-input mono" style={{ width: "82px" }} value={state.suites.llama_bench.n} onChange={(e) => updateSuiteField("llama_bench", "n", e.target.value)} />
                        <input type="number" className="sb-input mono" style={{ width: "58px" }} value={state.suites.llama_bench.r} onChange={(e) => updateSuiteField("llama_bench", "r", Number(e.target.value) || 0)} />
                      </div>
                    </div>
                  )}
                  {selectedSuites.includes("llama_benchy") && (
                    <div className="sb-field"><label>llama-benchy (-c / depth / runs)</label>
                      <div className="sb-inline-row" style={{ gap: "6px" }}>
                        <input type="number" className="sb-input mono" style={{ width: "84px" }} value={state.suites.llama_benchy.c} onChange={(e) => updateSuiteField("llama_benchy", "c", Number(e.target.value) || 0)} />
                        <input type="text" className="sb-input mono" style={{ width: "84px" }} value={state.suites.llama_benchy.depth} onChange={(e) => updateSuiteField("llama_benchy", "depth", e.target.value)} />
                        <input type="number" className="sb-input mono" style={{ width: "54px" }} value={state.suites.llama_benchy.runs} onChange={(e) => updateSuiteField("llama_benchy", "runs", Number(e.target.value) || 0)} />
                      </div>
                    </div>
                  )}
                  {selectedSuites.includes("llmperf") && (
                    <div className="sb-field"><label>llmperf (in / out / conc / max)</label>
                      <div className="sb-inline-row" style={{ gap: "6px" }}>
                        <input type="number" className="sb-input mono" style={{ width: "68px" }} value={state.suites.llmperf.meanInput} onChange={(e) => updateSuiteField("llmperf", "meanInput", Number(e.target.value) || 0)} />
                        <input type="number" className="sb-input mono" style={{ width: "64px" }} value={state.suites.llmperf.meanOutput} onChange={(e) => updateSuiteField("llmperf", "meanOutput", Number(e.target.value) || 0)} />
                        <input type="number" className="sb-input mono" style={{ width: "52px" }} value={state.suites.llmperf.concurrency} onChange={(e) => updateSuiteField("llmperf", "concurrency", Number(e.target.value) || 0)} />
                        <input type="number" className="sb-input mono" style={{ width: "54px" }} value={state.suites.llmperf.maxCompleted} onChange={(e) => updateSuiteField("llmperf", "maxCompleted", Number(e.target.value) || 0)} />
                      </div>
                    </div>
                  )}
                  {selectedSuites.includes("speed_bench") && (
                    <div className="sb-field"><label>SPEED-Bench (-c / category / limit)</label>
                      <div className="sb-inline-row" style={{ gap: "6px" }}>
                        <input type="number" className="sb-input mono" style={{ width: "82px" }} value={state.suites.speed_bench.c} onChange={(e) => updateSuiteField("speed_bench", "c", Number(e.target.value) || 0)} />
                        <input type="text" className="sb-input mono" style={{ width: "68px" }} value={state.suites.speed_bench.category} onChange={(e) => updateSuiteField("speed_bench", "category", e.target.value)} />
                        <input type="number" className="sb-input mono" style={{ width: "54px" }} value={state.suites.speed_bench.limit} onChange={(e) => updateSuiteField("speed_bench", "limit", Number(e.target.value) || 0)} />
                      </div>
                    </div>
                  )}
                  {selectedSuites.includes("aiperf_std") && (
                    <div className="sb-field"><label>AIPerf Standard (-c / conc / reqs)</label>
                      <div className="sb-inline-row" style={{ gap: "6px" }}>
                        <input type="number" className="sb-input mono" style={{ width: "82px" }} value={state.suites.aiperf_std.c} onChange={(e) => updateSuiteField("aiperf_std", "c", Number(e.target.value) || 0)} />
                        <input type="number" className="sb-input mono" style={{ width: "54px" }} value={state.suites.aiperf_std.concurrency} onChange={(e) => updateSuiteField("aiperf_std", "concurrency", Number(e.target.value) || 0)} />
                        <input type="number" className="sb-input mono" style={{ width: "60px" }} value={state.suites.aiperf_std.requestCount} onChange={(e) => updateSuiteField("aiperf_std", "requestCount", Number(e.target.value) || 0)} />
                      </div>
                    </div>
                  )}
                  {selectedSuites.includes("aiperf_sweep") && (
                    <div className="sb-field"><label>AIPerf 64k (-c / KV / isl)</label>
                      <div className="sb-inline-row" style={{ gap: "6px" }}>
                        <input type="number" className="sb-input mono" style={{ width: "82px" }} value={state.suites.aiperf_sweep.c} onChange={(e) => updateSuiteField("aiperf_sweep", "c", Number(e.target.value) || 0)} />
                        <select className="sb-select" style={{ width: "74px" }} value={state.suites.aiperf_sweep.ctk} onChange={(e) => { updateSuiteField("aiperf_sweep", "ctk", e.target.value); updateSuiteField("aiperf_sweep", "ctv", e.target.value); }}>
                          <option value="fp16">fp16</option>
                          <option value="q8_0">q8_0</option>
                          <option value="q4_0">q4_0</option>
                        </select>
                        <input type="text" className="sb-input mono" style={{ width: "140px" }} value={state.suites.aiperf_sweep.islList} onChange={(e) => updateSuiteField("aiperf_sweep", "islList", e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <TerminalBox titleLeft={`${state.ui.previewMode || "selected"} · ${profile.shell} · ${state.model.alias}`} code={runPreviewCode} />
          </>
        )}

        {state.ui.activeTab === "results" && (
          <>
            <h2 className="sb-section-title">Results & Anti-1KB Audit Coverage ({verifiedCount}/7 Verified)</h2>
            <div className="sb-inline-row">
              {typeof window.showDirectoryPicker === "function" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      const dirHandle = await window.showDirectoryPicker();
                      const entries = [];
                      async function walk(handle, prefix) {
                        for await (const [name, child] of handle.entries()) {
                          const rel = prefix ? `${prefix}/${name}` : name;
                          if (child.kind === "file") {
                            const f = await child.getFile();
                            entries.push({ path: rel, name, size: f.size, textLoader: () => f.text() });
                          } else if (child.kind === "directory") {
                            await walk(child, rel);
                          }
                        }
                      }
                      await walk(dirHandle, "");
                      await runAuditEntries(entries, dirHandle.name);
                    } catch {}
                  }}
                >
                  Open Results Folder
                </button>
              )}
              <label className="btn btn-outline" style={{ cursor: "pointer" }}>
                Select Folder
                <input
                  type="file"
                  webkitdirectory=""
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const entries = files.map((f) => ({ path: f.webkitRelativePath || f.name, name: f.name, size: f.size, textLoader: () => f.text() }));
                    await runAuditEntries(entries, (files[0].webkitRelativePath || "").split("/")[0] || "Selected Folder");
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const missing = SUITE_METADATA.filter((m) => !(auditItems[m.id] && auditItems[m.id].status === "verified")).map((m) => m.id);
                  updateUi({ selectedRunSuites: missing, previewMode: "outstanding", activeTab: "run" });
                }}
              >
                Select Missing in Run Tab
              </button>
              <span className="small muted">
                {state.audit.lastFolderName ? `Last Audited: ${state.audit.lastFolderName} (${state.audit.lastAuditedAt})` : "Inspects byte sizes & parsed JSON/MD rows."}
              </span>
            </div>

            <div
              className={`sb-dropzone ${dragOverAudit ? "dragover" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverAudit(true); }}
              onDragLeave={() => setDragOverAudit(false)}
              onDrop={handleAuditDrop}
            >
              <strong>Drop Centralized Results Folder or Benchmark Files Here</strong>
              <div className="small muted">Detects &gt;1 KB stubs, incomplete <code>llama-benchy</code> depth runs, and <code>aiperf.log</code> overflow errors.</div>
            </div>

            <div className="sb-table-wrap">
              <table className="sb-table">
                <thead><tr><th>Suite</th><th>Expected Output Target</th><th>Status</th><th>Audit Findings</th></tr></thead>
                <tbody>
                  {SUITE_METADATA.map((meta) => {
                    const exp = getOutputTarget(state, meta.id);
                    const r = auditItems[meta.id] || { status: "not_run", label: "NOT RUN", detail: "Select or drop a folder to audit." };
                    const cls = r.status === "verified" ? "sb-badge-ok" : r.status === "partial" ? "sb-badge-warn" : r.status === "stub" ? "sb-badge-danger" : "";
                    return (
                      <tr key={meta.id}>
                        <td><strong>{meta.shortLabel || meta.id}</strong></td>
                        <td className="mono small">{exp.leaf}</td>
                        <td><span className={`sb-badge ${cls}`}>{r.label}</span></td>
                        <td className="small muted">{r.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h3 className="sb-sub-title">Parsed Benchmark Comparisons ({records.length})</h3>
            <div className="sb-inline-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={async () => {
                  const nonSample = records.filter((r) => !r.isSample);
                  const next = [...nonSample, ...SAMPLE_RESULTS_DATASET];
                  setState((prev) => ({ ...prev, results: { includeSampleData: true, loadedRecords: next } }));
                  await saveSnapshotIDB("latest_results", next);
                }}
              >
                Load Sample Dataset (DGX vs R9700)
              </button>
              <label className="btn btn-outline" style={{ cursor: "pointer" }}>
                Load .md / .json Files
                <input type="file" multiple accept=".md,.json,.csv" className="hidden" onChange={(e) => handleResultFiles(e.target.files)} />
              </label>
              <button type="button" className="btn btn-outline" onClick={() => updateUi({ showCharts: !state.ui.showCharts })}>
                {state.ui.showCharts ? "Hide Charts" : "Show Charts"}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => downloadFile("ai_benchmate_comparison.md", exportComparisonMarkdown(records), "text/markdown")}>Export .md</button>
              <button type="button" className="btn btn-outline" onClick={() => downloadFile("ai_benchmate_comparison.csv", exportComparisonCsv(records), "text/csv")}>Export .csv</button>
              {records.length > 0 && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    setState((prev) => ({ ...prev, results: { includeSampleData: false, loadedRecords: [] } }));
                    await saveSnapshotIDB("latest_results", []);
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {state.ui.showCharts && (
              <div className="sb-chart-grid">
                <SvgBarChart title="Decode (tg128) & Prefill (/10)" subtitle="Native llama-bench throughput" items={benchBars} unit="t/s" />
                <SvgBarChart title="Depth 4096 KV Degradation (%)" subtitle="Lower is better KV stability" items={depthBars} unit="% drop" />
                <SvgBarChart title="4-Stream Parallel Throughput" subtitle="llmperf concurrent output" items={concBars} unit="t/s" />
              </div>
            )}

            <div className="sb-table-wrap">
              <table className="sb-table">
                <thead><tr><th>Source File</th><th>GPU / Backend</th><th>Model</th><th>Suite</th><th>Metrics</th></tr></thead>
                <tbody>
                  {records.length ? records.map((r) => (
                    <tr key={r.id}>
                      <td className="mono small">{r.sourceFile}</td>
                      <td>{r.gpuLabel}</td>
                      <td>{r.modelLabel}</td>
                      <td><span className="sb-badge">{r.suiteType}</span></td>
                      <td className="mono small">{Object.entries(r.metrics || {}).map(([k, v]) => `${k}=${v}`).join(" · ")}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="muted">No result files loaded. Click "Load Sample Dataset" or upload .md/.json files above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {state.ui.activeTab === "remote" && (
          <>
            <h2 className="sb-section-title">SSH Remote, Hermes Stack & Platform Setup Fixes</h2>
            <div className="sb-form-grid" style={{ marginBottom: "14px" }}>
              <div className="sb-field"><label>SSH User</label><input type="text" className="sb-input mono" value={state.ssh.user} onChange={(e) => setState((p) => ({ ...p, ssh: { ...p.ssh, user: e.target.value } }))} /></div>
              <div className="sb-field"><label>Remote Host / IP</label><input type="text" className="sb-input mono" value={state.ssh.host} onChange={(e) => setState((p) => ({ ...p, ssh: { ...p.ssh, host: e.target.value } }))} /></div>
              <div className="sb-field"><label>Port / tmux Session</label>
                <div className="sb-inline-row" style={{ gap: "6px", flexWrap: "nowrap" }}>
                  <input type="number" className="sb-input mono" style={{ width: "72px" }} value={state.ssh.port} onChange={(e) => setState((p) => ({ ...p, ssh: { ...p.ssh, port: Number(e.target.value) || 22 } }))} />
                  <input type="text" className="sb-input mono" style={{ flex: 1, minWidth: "80px" }} value={state.ssh.tmuxSession} onChange={(e) => setState((p) => ({ ...p, ssh: { ...p.ssh, tmuxSession: e.target.value } }))} />
                </div>
              </div>
              <div className="sb-field"><label>Remote Results Dir</label><input type="text" className="sb-input mono" value={state.ssh.remoteResultsDir} onChange={(e) => setState((p) => ({ ...p, ssh: { ...p.ssh, remoteResultsDir: e.target.value } }))} /></div>
              <div className="sb-field"><label>Local Pull Folder</label><input type="text" className="sb-input mono" value={state.ssh.localPullDir} onChange={(e) => setState((p) => ({ ...p, ssh: { ...p.ssh, localPullDir: e.target.value } }))} /></div>
              <div className="sb-field"><label>Hermes LAN IP</label><input type="text" className="sb-input mono" value={state.ssh.hermesServerIp} onChange={(e) => setState((p) => ({ ...p, ssh: { ...p.ssh, hermesServerIp: e.target.value } }))} /></div>
            </div>

            <div className="sb-inline-row" style={{ justifyContent: "space-between", marginBottom: "10px" }}>
              <div className="sb-pill-row">
                {remoteSections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    className={`sb-chip ${activeRemote.id === sec.id ? "active" : ""}`}
                    onClick={() => updateUi({ remoteSection: sec.id })}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>
              <label className="suite-check-label">
                <input
                  type="checkbox"
                  checked={state.ssh.includeVllmInStartAi}
                  onChange={(e) => setState((p) => ({ ...p, ssh: { ...p.ssh, includeVllmInStartAi: e.target.checked } }))}
                />
                <span>Include vLLM ({state.ssh.vllmGpuUtil})</span>
              </label>
            </div>

            <TerminalBox titleLeft={activeRemote.label} code={activeRemote.code} />
          </>
        )}
      </main>
    </div>
  );
}
