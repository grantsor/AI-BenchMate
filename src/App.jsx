import React, { useEffect, useState } from "react";
import {
  HARDWARE_PROFILES,
  PARITY_DEFAULTS,
  QUICK_MODELS,
  SAMPLE_RESULTS_DATASET,
  SUITE_METADATA
} from "./core/benchmate-data.js";
import {
  STORAGE_KEY,
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
  loadSnapshotIDB,
  loadState,
  parseModelPath,
  parseResultFile,
  saveSnapshotIDB,
  saveState
} from "./core/benchmate-engine.js";

function renderHighlightedLine(line, lineIdx) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) {
    return (
      <span key={lineIdx} className="tok-comment">
        {line}
      </span>
    );
  }
  const tokens = line.split(/(\s+|--?[A-Za-z0-9_-]+|"[^"]*"|'[^']*')/g).filter(Boolean);
  return (
    <React.Fragment key={lineIdx}>
      {tokens.map((tok, i) => {
        if (/^--?[A-Za-z0-9_-]+$/.test(tok)) {
          return (
            <span key={i} className="tok-flag">
              {tok}
            </span>
          );
        }
        if (/^(["']).*\1$/.test(tok)) {
          return (
            <span key={i} className="tok-str">
              {tok}
            </span>
          );
        }
        if (/^(cd|mkdir|source|export|python3?|pip|git|ssh|scp|tmux|aiperf|speed-bench|llama-benchy|pkill|fuser|nvidia-smi|amd-smi|New-Item|Stop-Process|Set-Location|Remove-Item)$/.test(tok)) {
          return (
            <span key={i} className="tok-kw">
              {tok}
            </span>
          );
        }
        return <React.Fragment key={i}>{tok}</React.Fragment>;
      })}
    </React.Fragment>
  );
}

function HighlightedPre({ code }) {
  const lines = String(code || "").split("\n");
  return (
    <pre className="sb-terminal-pre">
      {lines.map((line, idx) => (
        <React.Fragment key={idx}>
          {renderHighlightedLine(line, idx)}
          {idx < lines.length - 1 ? "\n" : ""}
        </React.Fragment>
      ))}
    </pre>
  );
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readDroppedEntry(entry, list) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (file) => {
          list.push({
            name: file.name,
            path: entry.fullPath ? entry.fullPath.replace(/^\//, "") : file.name,
            size: file.size,
            textLoader: () => file.text()
          });
          resolve();
        },
        () => resolve()
      );
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readAll = () => {
        reader.readEntries(
          async (entries) => {
            if (!entries.length) return resolve();
            for (const sub of entries) await readDroppedEntry(sub, list);
            readAll();
          },
          () => resolve()
        );
      };
      readAll();
    } else {
      resolve();
    }
  });
}

function SvgBarCard({ title, rows, unit }) {
  const valid = rows.filter((r) => r.value > 0);
  if (!valid.length) return null;
  const maxVal = Math.max(...valid.map((r) => r.value), 1);
  const barH = 22;
  const gap = 8;
  const svgH = valid.length * (barH + gap) + 12;

  return (
    <div className="sb-chart-card">
      <div style={{ fontSize: "12.5px", fontWeight: 700 }}>{title}</div>
      <svg className="sb-chart-svg" viewBox={`0 0 490 ${svgH}`} aria-label={title}>
        {valid.map((r, i) => {
          const y = 6 + i * (barH + gap);
          const pct = Math.max(4, Math.round((r.value / maxVal) * 230));
          const fill = r.gpuLabel.includes("DGX") ? "#10b981" : "#1b5698";
          return (
            <g key={i}>
              <text x="0" y={y + 15} fill="currentColor" fontSize="11">
                {r.label}
              </text>
              <rect x="195" y={y + 2} width={pct} height="16" rx="4" fill={fill} opacity="0.88" />
              <text x={202 + pct} y={y + 14} fill="currentColor" fontSize="11" fontWeight="600">
                {r.value}
                {unit}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [presetDraft, setPresetDraft] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const updateState = (updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveState(next);
      try {
        saveSnapshotIDB("latest_state", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    let resolved = state.ui.theme || "light";
    if (resolved === "system") {
      try {
        resolved =
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      } catch {
        resolved = "light";
      }
    }
    document.documentElement.setAttribute("data-theme", resolved);
    document.body.classList.toggle("pause-animations", Boolean(state.ui.pauseAnimations));
  }, [state.ui.theme, state.ui.pauseAnimations]);

  useEffect(() => {
    try {
      loadSnapshotIDB("latest_state").then((snap) => {
        if (snap && snap.schemaVersion && !localStorage.getItem(STORAGE_KEY)) {
          setState(loadState());
        }
      });
    } catch {
      /* ignore */
    }
  }, []);

  const copyCommand = (text, key) => {
    const val = String(text || "");
    const markCopied = () => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1300);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val).then(markCopied).catch(markCopied);
    } else {
      markCopied();
    }
  };

  const profile = HARDWARE_PROFILES[state.hardware.profileId];
  const tab = state.ui.activeTab || "benchmarks";
  const allModels = [...QUICK_MODELS, ...(state.customModels || [])];

  const handleSelectModel = (modelObj) => {
    updateState((prev) => {
      const p = HARDWARE_PROFILES[prev.hardware.profileId];
      const isWin = p.os === "windows";
      const sep = isWin ? "\\" : "/";
      const cleanBase = String(prev.model.baseDir || p.defaultModelsDir).replace(/[\\/]+$/, "");
      const rel = isWin
        ? modelObj.relativeWin || modelObj.filename || modelObj.relativeLinux
        : modelObj.relativeLinux || modelObj.filename || modelObj.relativeWin;
      const cleanRel = String(rel || "").replace(/^[\\/]+/, "");
      const fullPath = modelObj.fullPath ? modelObj.fullPath : cleanBase + sep + cleanRel;
      return {
        ...prev,
        model: {
          ...prev.model,
          fullPath,
          baseDir: cleanBase,
          filename: cleanRel.split(/[\\/]/).pop() || cleanRel,
          alias: modelObj.alias,
          slug: modelObj.slug,
          tokenizer: modelObj.tokenizer,
          weightGb: Number(modelObj.weightGb) || 15.8,
          paramsB: Number(modelObj.paramsB) || 27
        }
      };
    });
  };

  const handleChangeProfile = (newProfileId) => {
    updateState((prev) => {
      const prevProfile = HARDWARE_PROFILES[prev.hardware.profileId];
      const nextProfile = HARDWARE_PROFILES[newProfileId];
      if (!nextProfile) return prev;
      const sep = nextProfile.os === "windows" ? "\\" : "/";
      const matched = allModels.find(
        (m) => m.slug === prev.model.slug || m.alias === prev.model.alias
      );
      let nextModel = { ...prev.model, baseDir: nextProfile.defaultModelsDir };
      if (matched && matched.relativeWin && matched.relativeLinux) {
        const rel = nextProfile.os === "windows" ? matched.relativeWin : matched.relativeLinux;
        nextModel.fullPath = nextProfile.defaultModelsDir + sep + rel;
        nextModel.filename = rel.split(/[\\/]/).pop() || rel;
        nextModel.alias = matched.alias;
        nextModel.slug = matched.slug;
        nextModel.tokenizer = matched.tokenizer;
        nextModel.weightGb = matched.weightGb;
        nextModel.paramsB = matched.paramsB;
      } else if (prevProfile.os !== nextProfile.os) {
        const fileOnly = String(prev.model.fullPath || prev.model.filename || "").split(/[\\/]/).pop();
        nextModel.fullPath = nextProfile.defaultModelsDir + sep + fileOnly;
        nextModel.filename = fileOnly;
      }
      return {
        ...prev,
        hardware: {
          ...prev.hardware,
          profileId: newProfileId,
          vramGb: nextProfile.defaultVramGb,
          binDir: nextProfile.defaultBinDir,
          repoDir: nextProfile.defaultRepoDir,
          benchRoot: nextProfile.defaultBenchRoot,
          resultsDir: nextProfile.defaultResultsDir,
          nvidiaDevice: nextProfile.deviceFlag || "CUDA0"
        },
        model: nextModel
      };
    });
  };

  const handleAutoFix = (warningId) => {
    updateState((prev) => {
      const suites = JSON.parse(JSON.stringify(prev.suites));
      if (warningId === "ctx_aiperf_sweep") {
        suites.aiperf_sweep.c = 70000;
        suites.aiperf_sweep.ctk = "q8_0";
        suites.aiperf_sweep.ctv = "q8_0";
      } else if (warningId === "ctx_benchy") {
        suites.llama_benchy.c = 70000;
      } else if (warningId === "vram_overflow") {
        const targetKv = suites.aiperf_sweep.ctk === "fp16" ? "q8_0" : "q4_0";
        Object.keys(suites).forEach((k) => {
          if ("ctk" in suites[k]) suites[k].ctk = targetKv;
          if ("ctv" in suites[k]) suites[k].ctv = targetKv;
        });
      }
      return { ...prev, suites };
    });
  };

  const updateSuiteField = (suiteId, field, value) => {
    updateState((prev) => {
      const nextSuite = { ...prev.suites[suiteId], [field]: value };
      if (suiteId === "speed_bench" && field === "contextPreset") {
        nextSuite.c = Number(value) || 32768;
      }
      return { ...prev, suites: { ...prev.suites, [suiteId]: nextSuite } };
    });
  };

  const renderSuiteFieldInput = (suiteId, field, label, type, val) => (
    <div className="sb-field" key={field}>
      <label>{label}</label>
      <input
        type={type}
        className="sb-input"
        value={val}
        onChange={(e) => updateSuiteField(suiteId, field, type === "number" ? Number(e.target.value) || 0 : e.target.value)}
      />
    </div>
  );

  const renderSuiteFieldSelect = (suiteId, field, label, val, options) => (
    <div className="sb-field" key={field}>
      <label>{label}</label>
      <select className="sb-select" value={val} onChange={(e) => updateSuiteField(suiteId, field, e.target.value)}>
        {options.map((o) => {
          const v = typeof o === "object" ? o.value : o;
          const t = typeof o === "object" ? o.label : o;
          return (
            <option key={v} value={v}>
              {t}
            </option>
          );
        })}
      </select>
    </div>
  );

  const renderSuiteFieldCheck = (suiteId, field, label, checked) => (
    <div className="sb-field" key={field}>
      <label>{label}</label>
      <label className="sb-field-inline" style={{ height: "32px" }}>
        <input type="checkbox" checked={Boolean(checked)} onChange={(e) => updateSuiteField(suiteId, field, e.target.checked)} />
        <span>{checked ? "Enabled" : "Disabled"}</span>
      </label>
    </div>
  );

  const renderSuiteDrawerFields = (suiteId) => {
    const s = state.suites[suiteId];
    const kvOpts = ["fp16", "q8_0", "q4_0"];
    const faOpts = ["1", "on", "0", "off", "auto"];

    if (suiteId === "llama_bench") {
      return (
        <>
          {renderSuiteFieldInput(suiteId, "ngl", "-ngl", "number", s.ngl)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldInput(suiteId, "p", "-p (Prompt Sizes)", "text", s.p)}
          {renderSuiteFieldInput(suiteId, "n", "-n (Gen Tokens)", "text", s.n)}
          {renderSuiteFieldInput(suiteId, "r", "-r (Repetitions)", "number", s.r)}
          {renderSuiteFieldInput(suiteId, "b", "-b (Batch)", "number", s.b)}
          {renderSuiteFieldInput(suiteId, "ub", "-ub (uBatch)", "number", s.ub)}
          {renderSuiteFieldSelect(suiteId, "format", "-o Format", s.format, ["md", "json", "csv"])}
        </>
      );
    }
    if (suiteId === "llama_benchy") {
      return (
        <>
          {renderSuiteFieldInput(suiteId, "c", "Server -c", "number", s.c)}
          {renderSuiteFieldInput(suiteId, "np", "Server -np", "number", s.np)}
          {renderSuiteFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldInput(suiteId, "pp", "--pp", "text", s.pp)}
          {renderSuiteFieldInput(suiteId, "tg", "--tg", "text", s.tg)}
          {renderSuiteFieldInput(suiteId, "depth", "--depth", "text", s.depth)}
          {renderSuiteFieldInput(suiteId, "runs", "--runs", "number", s.runs)}
        </>
      );
    }
    if (suiteId === "llmperf") {
      return (
        <>
          {renderSuiteFieldInput(suiteId, "c", "Server -c", "number", s.c)}
          {renderSuiteFieldInput(suiteId, "np", "Server -np", "number", s.np)}
          {renderSuiteFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts)}
          {renderSuiteFieldInput(suiteId, "concurrency", "--num-concurrent-requests", "number", s.concurrency)}
          {renderSuiteFieldInput(suiteId, "maxCompleted", "--max-num-completed-requests", "number", s.maxCompleted)}
          {renderSuiteFieldInput(suiteId, "meanInput", "--mean-input-tokens", "number", s.meanInput)}
          {renderSuiteFieldInput(suiteId, "stddevInput", "--stddev-input-tokens", "number", s.stddevInput)}
          {renderSuiteFieldInput(suiteId, "meanOutput", "--mean-output-tokens", "number", s.meanOutput)}
          {renderSuiteFieldInput(suiteId, "stddevOutput", "--stddev-output-tokens", "number", s.stddevOutput)}
        </>
      );
    }
    if (suiteId === "speed_bench") {
      return (
        <>
          {renderSuiteFieldSelect(suiteId, "contextPreset", "Server Context (-c)", s.contextPreset || String(s.c), [
            { value: "16384", label: "16K (16384)" },
            { value: "32768", label: "32K (32768)" },
            { value: "65536", label: "64K (65536)" }
          ])}
          {renderSuiteFieldInput(suiteId, "np", "Server -np", "number", s.np)}
          {renderSuiteFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldCheck(suiteId, "jinja", "--jinja Flag", s.jinja)}
          {renderSuiteFieldInput(suiteId, "category", "--category", "text", s.category)}
          {renderSuiteFieldInput(suiteId, "osl", "--osl", "number", s.osl)}
          {renderSuiteFieldInput(suiteId, "concurrency", "--concurrency", "number", s.concurrency)}
          {renderSuiteFieldInput(suiteId, "limit", "--limit", "number", s.limit)}
          {renderSuiteFieldInput(suiteId, "compareBaselineFile", "Compare Baseline JSON", "text", s.compareBaselineFile)}
          {renderSuiteFieldInput(suiteId, "compareSpeculativeFile", "Compare Speculative JSON", "text", s.compareSpeculativeFile)}
        </>
      );
    }
    if (suiteId === "agentperf") {
      return (
        <>
          {renderSuiteFieldInput(suiteId, "c", "Server -c", "number", s.c)}
          {renderSuiteFieldInput(suiteId, "np", "Server -np", "number", s.np)}
          {renderSuiteFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldInput(suiteId, "extraFlags", "Extra Client Flags", "text", s.extraFlags || "")}
        </>
      );
    }
    if (suiteId === "aiperf_std") {
      return (
        <>
          {renderSuiteFieldInput(suiteId, "c", "Server -c", "number", s.c)}
          {renderSuiteFieldInput(suiteId, "np", "Server -np", "number", s.np)}
          {renderSuiteFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldInput(suiteId, "concurrency", "--concurrency", "number", s.concurrency)}
          {renderSuiteFieldInput(suiteId, "requestCount", "--request-count", "number", s.requestCount)}
          {renderSuiteFieldInput(suiteId, "islMean", "--synthetic-input-tokens-mean", "number", s.islMean)}
          {renderSuiteFieldInput(suiteId, "oslMean", "--output-tokens-mean", "number", s.oslMean)}
          {renderSuiteFieldCheck(suiteId, "ignoreEos", "ignore_eos:true", s.ignoreEos)}
        </>
      );
    }
    if (suiteId === "aiperf_sweep") {
      return (
        <>
          {renderSuiteFieldInput(suiteId, "c", "Server -c", "number", s.c)}
          {renderSuiteFieldInput(suiteId, "np", "Server -np", "number", s.np)}
          {renderSuiteFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldInput(suiteId, "islList", "Sweep ISLs", "text", s.islList)}
          {renderSuiteFieldInput(suiteId, "oslList", "Sweep OSLs", "text", s.oslList)}
          {renderSuiteFieldInput(suiteId, "concurrency", "--concurrency", "number", s.concurrency)}
          {renderSuiteFieldInput(suiteId, "warmupCount", "--warmup-request-count", "number", s.warmupCount)}
          {renderSuiteFieldInput(suiteId, "requestCount", "--request-count", "number", s.requestCount)}
          {renderSuiteFieldInput(suiteId, "randomSeed", "--random-seed", "number", s.randomSeed)}
          {renderSuiteFieldCheck(suiteId, "ignoreEos", "ignore_eos:true", s.ignoreEos)}
          {renderSuiteFieldCheck(suiteId, "cachePrompt", "cache_prompt", s.cachePrompt)}
        </>
      );
    }
    return null;
  };

  const handleAuditEntries = async (entries, label) => {
    if (!entries.length) return;
    const items = await auditFileList(entries, state);
    const parsedNew = [];
    for (const ent of entries) {
      if (/\.(md|json)$/i.test(ent.name) && ent.size > 120) {
        const parsed = parseResultFile(ent.name, await ent.textLoader());
        if (parsed) parsedNew.push(parsed);
      }
    }
    updateState((prev) => {
      const existing = prev.results.loadedRecords || [];
      const merged = [...existing];
      parsedNew.forEach((p) => {
        if (!merged.some((r) => r.sourceFile === p.sourceFile)) merged.push(p);
      });
      return {
        ...prev,
        audit: {
          lastFolderName: label || (entries[0].path.includes("/") ? entries[0].path.split("/")[0] : `${entries.length} file(s)`),
          lastAuditedAt: new Date().toLocaleTimeString(),
          items
        },
        results: { ...prev.results, loadedRecords: merged }
      };
    });
  };

  const handleFileListAudit = (fileList) => {
    const entries = Array.from(fileList || []).map((f) => ({
      name: f.name,
      path: f.webkitRelativePath || f.name,
      size: f.size,
      textLoader: () => f.text()
    }));
    return handleAuditEntries(entries);
  };

  const handleDropAudit = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const items = e.dataTransfer?.items;
    if (items && items.length && items[0].webkitGetAsEntry) {
      const entries = [];
      for (const item of Array.from(items)) {
        const ent = item.webkitGetAsEntry();
        if (ent) await readDroppedEntry(ent, entries);
      }
      await handleAuditEntries(entries);
    } else if (e.dataTransfer?.files?.length) {
      await handleFileListAudit(e.dataTransfer.files);
    }
  };

  const handleCompareUpload = async (fileList) => {
    const parsedList = [];
    for (const f of Array.from(fileList || [])) {
      const parsed = parseResultFile(f.name, await f.text());
      if (parsed) parsedList.push(parsed);
    }
    if (parsedList.length) {
      updateState((prev) => ({
        ...prev,
        results: { ...prev.results, loadedRecords: [...(prev.results.loadedRecords || []), ...parsedList] }
      }));
    }
  };

  const { warnings } = evaluateGuardrails(state);
  const activeRecords = [
    ...(state.results.includeSampleData ? SAMPLE_RESULTS_DATASET : []),
    ...(state.results.loadedRecords || [])
  ];

  const sshCmds = buildSshCommands(state);
  const setupCards = buildSetupCards(state).filter(
    (c) => profile.os === "windows" || c.id !== "setup_cleanup"
  );
  const sshCards = [
    { id: "psTrigger", title: "Windows PowerShell SSH Trigger", cmd: sshCmds.psTrigger },
    { id: "tmuxLaunch", title: "tmux Split Session", cmd: sshCmds.tmuxLaunch },
    { id: "scpPull", title: "scp Pull Remote Results", cmd: sshCmds.scpPull },
    { id: "vramSweep", title: "DGX Pre-Benchmark VRAM Sweep", cmd: sshCmds.vramSweep },
    { id: "startAiRestore", title: "Restore start-ai Stack (DGX)", cmd: sshCmds.startAiRestore },
    ...setupCards.map((c) => ({ id: c.id, title: c.title, cmd: c.cmd }))
  ];

  return (
    <div className="sb-container">
      <header className="sb-header">
        <div className="sb-brand-cluster">
          <span className="sb-brand">ai-benchmate</span>
          <span className="sb-version">1.0.0</span>
          <span className="sb-pill">
            platform: <strong>{profile.shortName}</strong>
          </span>
          <span className="sb-pill">
            vram: <strong>{state.hardware.vramGb} GB</strong>
          </span>
          <span className="sb-pill">
            model: <strong>{state.model.alias || state.model.slug}</strong>
          </span>
        </div>

        <div className="sb-header-controls">
          <button
            type="button"
            className={`sb-ctrl-btn ${state.ui.pauseAnimations ? "is-active" : ""}`}
            onClick={() => updateState((p) => ({ ...p, ui: { ...p.ui, pauseAnimations: !p.ui.pauseAnimations } }))}
          >
            {state.ui.pauseAnimations ? "Resume Animations" : "Pause Animations"}
          </button>
          <select
            className="sb-ctrl-select"
            aria-label="Theme"
            value={state.ui.theme}
            onChange={(e) => updateState((p) => ({ ...p, ui: { ...p.ui, theme: e.target.value } }))}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </header>

      <nav className="folder-tabs" aria-label="Primary Tabs">
        {[
          { id: "benchmarks", label: "Benchmarks" },
          { id: "results", label: "Results & Audit" },
          { id: "ssh", label: "SSH & Setup" }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`folder-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => updateState((p) => ({ ...p, ui: { ...p.ui, activeTab: t.id } }))}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="sb-card">
        {tab === "benchmarks" && (
          <>
            <div className="config-section">
              <div className="config-bar">
                <label className="sb-field-inline">
                  Platform
                  <select className="sb-select" value={state.hardware.profileId} onChange={(e) => handleChangeProfile(e.target.value)}>
                    {Object.values(HARDWARE_PROFILES).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                {profile.id === "amd_win_x64" && (
                  <label className="sb-field-inline">
                    Backend
                    <select
                      className="sb-select"
                      value={state.hardware.amdBackend}
                      onChange={(e) =>
                        updateState((p) => ({
                          ...p,
                          hardware: {
                            ...p.hardware,
                            amdBackend: e.target.value,
                            binDir: e.target.value === "rocm" ? "C:\\llama.cpp\\rocm" : "C:\\llama.cpp\\vulkan"
                          }
                        }))
                      }
                    >
                      <option value="vulkan">Vulkan</option>
                      <option value="rocm">ROCm HIP</option>
                    </select>
                  </label>
                )}

                <label className="sb-field-inline">
                  VRAM (GB)
                  <input
                    type="number"
                    className="sb-input"
                    style={{ width: "76px" }}
                    value={state.hardware.vramGb}
                    onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, vramGb: Number(e.target.value) || 0 } }))}
                  />
                </label>

                <div className="sb-pill-row">
                  {QUICK_MODELS.map((m) => {
                    const active = state.model.slug === m.slug || state.model.alias === m.alias;
                    return (
                      <button key={m.id} type="button" className={`sb-chip ${active ? "active" : ""}`} onClick={() => handleSelectModel(m)}>
                        {m.label}
                      </button>
                    );
                  })}
                  {(state.customModels || []).map((m) => {
                    const active = state.model.slug === m.slug || state.model.alias === m.alias;
                    return (
                      <span key={m.id} className="sb-chip-group">
                        <button type="button" className={`sb-chip ${active ? "active" : ""}`} onClick={() => handleSelectModel(m)}>
                          {m.label || m.alias}
                        </button>
                        <button
                          type="button"
                          className="sb-chip-x"
                          title="Remove model"
                          onClick={() => updateState((p) => ({ ...p, customModels: (p.customModels || []).filter((x) => x.id !== m.id) }))}
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{ marginLeft: "auto" }}
                  onClick={() => updateState((p) => ({ ...p, ui: { ...p.ui, showPathsAndNaming: !p.ui.showPathsAndNaming } }))}
                >
                  Paths &amp; Naming {state.ui.showPathsAndNaming ? "▴" : "▾"}
                </button>
              </div>

              <div className="config-model-row">
                <label className="sb-field-inline" style={{ flex: 1, minWidth: "260px" }}>
                  Model (.gguf)
                  <input
                    type="text"
                    className="sb-input sb-input-wide"
                    value={state.model.fullPath}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = parseModelPath(val);
                      updateState((p) => ({
                        ...p,
                        model: {
                          ...p.model,
                          fullPath: val,
                          baseDir: parsed.baseDir,
                          filename: parsed.filename,
                          alias: parsed.alias,
                          slug: parsed.slug,
                          tokenizer: parsed.tokenizer,
                          weightGb: parsed.weightGb,
                          paramsB: parsed.paramsB
                        }
                      }));
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    const parsed = parseModelPath(state.model.fullPath);
                    const alias = state.model.alias || parsed.alias;
                    const slug = state.model.slug || parsed.slug;
                    const entry = {
                      id: "custom-" + Date.now(),
                      label: alias,
                      alias,
                      slug,
                      tokenizer: state.model.tokenizer || parsed.tokenizer,
                      weightGb: Number(state.model.weightGb) || parsed.weightGb,
                      paramsB: Number(state.model.paramsB) || parsed.paramsB,
                      fullPath: state.model.fullPath
                    };
                    updateState((p) => ({
                      ...p,
                      customModels: [...(p.customModels || []).filter((m) => m.slug !== slug && m.alias !== alias), entry]
                    }));
                  }}
                >
                  + Add Model
                </button>
              </div>

              {state.ui.showPathsAndNaming && (
                <div className="sb-drawer">
                  <div className="sb-form-grid">
                    <div className="sb-field">
                      <label>Llama Bin Dir</label>
                      <input type="text" className="sb-input" value={state.hardware.binDir} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, binDir: e.target.value } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Repo Dir</label>
                      <input type="text" className="sb-input" value={state.hardware.repoDir} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, repoDir: e.target.value } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Bench Root</label>
                      <input type="text" className="sb-input" value={state.hardware.benchRoot} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, benchRoot: e.target.value } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Results Dir</label>
                      <input type="text" className="sb-input" value={state.hardware.resultsDir} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, resultsDir: e.target.value } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Model Alias</label>
                      <input type="text" className="sb-input" value={state.model.alias} onChange={(e) => updateState((p) => ({ ...p, model: { ...p.model, alias: e.target.value } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Output Slug</label>
                      <input type="text" className="sb-input" value={state.model.slug} onChange={(e) => updateState((p) => ({ ...p, model: { ...p.model, slug: e.target.value } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Tokenizer ID</label>
                      <input type="text" className="sb-input" value={state.model.tokenizer} onChange={(e) => updateState((p) => ({ ...p, model: { ...p.model, tokenizer: e.target.value } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Weight (GB)</label>
                      <input type="number" step="0.1" className="sb-input" value={state.model.weightGb} onChange={(e) => updateState((p) => ({ ...p, model: { ...p.model, weightGb: Number(e.target.value) || 0 } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Params (B)</label>
                      <input type="number" step="0.5" className="sb-input" value={state.model.paramsB} onChange={(e) => updateState((p) => ({ ...p, model: { ...p.model, paramsB: Number(e.target.value) || 0 } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Server Host</label>
                      <input type="text" className="sb-input" value={state.hardware.host} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, host: e.target.value } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Server Port</label>
                      <input type="number" className="sb-input" value={state.hardware.port} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, port: Number(e.target.value) || 8080 } }))} />
                    </div>
                    <div className="sb-field">
                      <label>Client --model Flag</label>
                      <select className="sb-select" value={state.model.clientModelMode} onChange={(e) => updateState((p) => ({ ...p, model: { ...p.model, clientModelMode: e.target.value } }))}>
                        <option value="alias">Alias (--alias)</option>
                        <option value="fullPath">Full GGUF Path</option>
                      </select>
                    </div>
                    <div className="sb-field">
                      <label>Filename Naming</label>
                      <select className="sb-select" value={state.naming.mode} onChange={(e) => updateState((p) => ({ ...p, naming: { ...p.naming, mode: e.target.value } }))}>
                        <option value="auto">Auto (Classic on Default, Stamped on Edit)</option>
                        <option value="stamped">Always Stamped (_c32k_fp16)</option>
                        <option value="classic">Always Classic</option>
                      </select>
                    </div>
                    {profile.supportsMultiGpu && (
                      <>
                        <div className="sb-field">
                          <label>Device (-dev)</label>
                          <input type="text" className="sb-input" value={state.hardware.nvidiaDevice || ""} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, nvidiaDevice: e.target.value } }))} />
                        </div>
                        <div className="sb-field">
                          <label>Tensor Split (-ts)</label>
                          <input type="text" className="sb-input" placeholder="e.g. 1,1" value={state.hardware.tensorSplit || ""} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, tensorSplit: e.target.value } }))} />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="sb-inline-row" style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border-soft)" }}>
                    <input
                      type="text"
                      className="sb-input"
                      placeholder="Save current parameters as preset..."
                      style={{ minWidth: "220px" }}
                      value={presetDraft}
                      onChange={(e) => setPresetDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        const name = presetDraft.trim() || `Preset ${(state.customPresets || []).length + 1}`;
                        updateState((p) => ({
                          ...p,
                          naming: { ...p.naming, activePresetName: name },
                          customPresets: [
                            ...(p.customPresets || []).filter((x) => x.name !== name),
                            { name, suites: JSON.parse(JSON.stringify(p.suites)) }
                          ]
                        }));
                        setPresetDraft("");
                      }}
                    >
                      + Save Preset
                    </button>
                    {(state.customPresets || []).map((preset) => (
                      <span key={preset.name} className="sb-chip-group">
                        <button
                          type="button"
                          className={`sb-chip ${state.naming.activePresetName === preset.name ? "active" : ""}`}
                          onClick={() =>
                            updateState((p) => ({
                              ...p,
                              suites: JSON.parse(JSON.stringify(preset.suites)),
                              naming: { ...p.naming, activePresetName: preset.name }
                            }))
                          }
                        >
                          {preset.name}
                        </button>
                        <button
                          type="button"
                          className="sb-chip-x"
                          title="Delete preset"
                          onClick={() =>
                            updateState((p) => ({
                              ...p,
                              customPresets: (p.customPresets || []).filter((x) => x.name !== preset.name),
                              naming: {
                                ...p.naming,
                                activePresetName: p.naming.activePresetName === preset.name ? "Baseline Parity Defaults" : p.naming.activePresetName
                              }
                            }))
                          }
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() =>
                        updateState((p) => ({
                          ...p,
                          suites: JSON.parse(JSON.stringify(PARITY_DEFAULTS)),
                          naming: { ...p.naming, activePresetName: "Baseline Parity Defaults" }
                        }))
                      }
                    >
                      Reset Parity Defaults
                    </button>
                  </div>
                </div>
              )}
            </div>

            {warnings.length > 0 && (
              <div>
                {warnings.map((w) => (
                  <div key={w.id} className={`sb-banner ${w.severity === "crimson" ? "sb-banner-danger" : "sb-banner-warn"}`}>
                    <span>
                      <strong>{w.title}</strong> — {w.detail}
                    </span>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => handleAutoFix(w.id)}>
                      {w.fixLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="suite-list">
              {SUITE_METADATA.map((meta) => {
                const modified = isSuiteCustomized(state, meta.id);
                const target = getOutputTarget(state, meta.id);
                const expanded = Boolean(state.ui.expandedDrawers[meta.id]);
                const serverCmd = meta.hasServer ? buildServerCommand(state, meta.id) : "";
                const clientCmd = buildSuiteClientCommand(state, meta.id);

                return (
                  <div key={meta.id} className="suite-card">
                    <div className="suite-card-header">
                      <div className="suite-card-title">
                        <span className="suite-card-num">{meta.index}</span>
                        <span>{meta.title}</span>
                        <code className="suite-output-tag">-&gt; {target.leaf}</code>
                        {modified && <span className="sb-badge sb-badge-warn">Modified</span>}
                      </div>
                      <div className="suite-card-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            updateState((p) => ({
                              ...p,
                              ui: {
                                ...p.ui,
                                expandedDrawers: { ...p.ui.expandedDrawers, [meta.id]: !p.ui.expandedDrawers[meta.id] }
                              }
                            }))
                          }
                        >
                          Parameters {expanded ? "▴" : "▾"}
                        </button>
                        {modified && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() =>
                              updateState((p) => ({
                                ...p,
                                suites: { ...p.suites, [meta.id]: JSON.parse(JSON.stringify(PARITY_DEFAULTS[meta.id])) }
                              }))
                            }
                          >
                            Reset
                          </button>
                        )}
                        {meta.hasServer && (
                          <button
                            type="button"
                            className={`btn btn-sm btn-outline ${copiedKey === `srv-${meta.id}` ? "copied" : ""}`}
                            onClick={() => copyCommand(serverCmd, `srv-${meta.id}`)}
                          >
                            {copiedKey === `srv-${meta.id}` ? "Copied" : "Copy Server"}
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn btn-sm btn-primary ${copiedKey === `cli-${meta.id}` ? "copied" : ""}`}
                          onClick={() => copyCommand(clientCmd, `cli-${meta.id}`)}
                        >
                          {copiedKey === `cli-${meta.id}` ? "Copied" : "Copy Command"}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="sb-drawer">
                        <div className="sb-form-grid">{renderSuiteDrawerFields(meta.id)}</div>
                      </div>
                    )}

                    <div className="suite-terminals-stack">
                      {meta.hasServer && (
                        <div className="sb-terminal-wrap">
                          <div className="sb-terminal-bar">
                            <span>Terminal 1 — Server</span>
                            <button
                              type="button"
                              className={`btn btn-sm ${copiedKey === `t1-${meta.id}` ? "copied" : ""}`}
                              onClick={() => copyCommand(serverCmd, `t1-${meta.id}`)}
                            >
                              {copiedKey === `t1-${meta.id}` ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <HighlightedPre code={serverCmd} />
                        </div>
                      )}
                      <div className="sb-terminal-wrap">
                        <div className="sb-terminal-bar">
                          <span>{meta.hasServer ? "Terminal 2 — Client" : "Command"}</span>
                          <button
                            type="button"
                            className={`btn btn-sm ${copiedKey === `t2-${meta.id}` ? "copied" : ""}`}
                            onClick={() => copyCommand(clientCmd, `t2-${meta.id}`)}
                          >
                            {copiedKey === `t2-${meta.id}` ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <HighlightedPre code={clientCmd} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="playbook-footer">
              <span className="playbook-footer-title">
                Full Playbook ({profile.shortName} · {state.model.alias || state.model.slug})
              </span>
              <div className="playbook-footer-actions">
                <button
                  type="button"
                  className={`btn btn-sm btn-outline ${copiedKey === "playbook" ? "copied" : ""}`}
                  onClick={() => copyCommand(buildAllInOnePlaybook(state, false), "playbook")}
                >
                  {copiedKey === "playbook" ? "Copied" : "Copy Playbook"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const ext = profile.shell === "powershell" ? "ps1" : "sh";
                    downloadText(`benchmate_${state.model.slug || "run"}.${ext}`, buildAllInOnePlaybook(state, false));
                  }}
                >
                  Download {profile.shell === "powershell" ? ".ps1" : ".sh"}
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "results" && (
          <>
            <div className="config-section">
              <div className="sb-inline-row">
                <h2 className="sb-section-title" style={{ margin: 0 }}>
                  Results Folder Audit
                </h2>
                <label className="btn btn-sm btn-primary" style={{ cursor: "pointer" }}>
                  Select Folder
                  <input type="file" webkitdirectory="" directory="" multiple style={{ display: "none" }} onChange={(e) => handleFileListAudit(e.target.files)} />
                </label>
                <label className="btn btn-sm btn-outline" style={{ cursor: "pointer" }}>
                  Select Files
                  <input type="file" multiple accept=".md,.json,.log" style={{ display: "none" }} onChange={(e) => handleFileListAudit(e.target.files)} />
                </label>
                {state.audit.lastFolderName && <span className="sb-badge">{state.audit.lastFolderName}</span>}
                {Object.keys(state.audit.items || {}).length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => updateState((p) => ({ ...p, audit: { lastFolderName: "", lastAuditedAt: "", items: {} } }))}
                  >
                    Clear Audit
                  </button>
                )}
              </div>

              <div
                className={`sb-dropzone ${dragOver ? "dragover" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDropAudit}
              >
                Drop a benchmark results folder or .md / .json / .log files here
              </div>

              <div className="sb-table-wrap">
                <table className="sb-table">
                  <thead>
                    <tr>
                      <th>Suite</th>
                      <th>Target Output</th>
                      <th>Status</th>
                      <th>Audit Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUITE_METADATA.map((meta) => {
                      const target = getOutputTarget(state, meta.id);
                      const item = (state.audit.items || {})[meta.id];
                      const badgeCls = !item
                        ? ""
                        : item.status === "verified"
                          ? "sb-badge-ok"
                          : item.status === "partial"
                            ? "sb-badge-warn"
                            : item.status === "stub"
                              ? "sb-badge-danger"
                              : "";
                      return (
                        <tr key={meta.id}>
                          <td>
                            <strong>
                              {meta.index} {meta.title}
                            </strong>
                          </td>
                          <td>
                            <code>{target.leaf}</code>
                          </td>
                          <td>
                            <span className={`sb-badge ${badgeCls}`}>{item ? item.label : "NOT AUDITED"}</span>
                          </td>
                          <td>{item ? item.detail : `Expected: ${target.leaf}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="sb-terminal-wrap">
                <div className="sb-terminal-bar">
                  <span>Deep Audit Script (1 KB Stub Verification)</span>
                  <button
                    type="button"
                    className={`btn btn-sm ${copiedKey === "deep-audit" ? "copied" : ""}`}
                    onClick={() => copyCommand(buildDeepAuditScript(state), "deep-audit")}
                  >
                    {copiedKey === "deep-audit" ? "Copied" : "Copy"}
                  </button>
                </div>
                <HighlightedPre code={buildDeepAuditScript(state)} />
              </div>
            </div>

            <div>
              <div className="sb-inline-row">
                <h2 className="sb-section-title" style={{ margin: 0 }}>
                  Comparison Matrix
                </h2>
                <button
                  type="button"
                  className={`btn btn-sm ${state.results.includeSampleData ? "btn-primary" : "btn-outline"}`}
                  onClick={() =>
                    updateState((p) => ({
                      ...p,
                      results: { ...p.results, includeSampleData: !p.results.includeSampleData }
                    }))
                  }
                >
                  {state.results.includeSampleData ? "Hide Sample (DGX vs R9700)" : "Load Sample (DGX vs R9700)"}
                </button>
                <label className="btn btn-sm btn-outline" style={{ cursor: "pointer" }}>
                  Upload .md / .json
                  <input type="file" multiple accept=".md,.json" style={{ display: "none" }} onChange={(e) => handleCompareUpload(e.target.files)} />
                </label>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => updateState((p) => ({ ...p, ui: { ...p.ui, showCharts: !p.ui.showCharts } }))}
                >
                  {state.ui.showCharts ? "Hide Charts" : "Show Charts"}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => downloadText("ai_benchmate_comparison.md", exportComparisonMarkdown(activeRecords))}>
                  Export .md
                </button>
                <button type="button" className="btn btn-sm" onClick={() => downloadText("ai_benchmate_comparison.csv", exportComparisonCsv(activeRecords))}>
                  Export .csv
                </button>
                {(state.results.loadedRecords || []).length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => updateState((p) => ({ ...p, results: { ...p.results, loadedRecords: [] } }))}
                  >
                    Clear Uploaded
                  </button>
                )}
              </div>

              {state.ui.showCharts && activeRecords.length > 0 && (
                <div className="sb-chart-grid">
                  <SvgBarCard
                    title="llama-bench Decode tg128 (tok/s)"
                    unit=" t/s"
                    rows={activeRecords
                      .filter((r) => r.suiteType === "llama_bench" && r.metrics?.tg128)
                      .map((r) => ({
                        label: `${r.gpuLabel.split(" ")[0]} · ${r.modelLabel.split(" ")[0]}`,
                        gpuLabel: r.gpuLabel,
                        value: r.metrics.tg128
                      }))}
                  />
                  <SvgBarCard
                    title="SPEED-Bench Overall Decode (tok/s)"
                    unit=" t/s"
                    rows={activeRecords
                      .filter((r) => r.suiteType === "speed_bench" && r.metrics?.overall)
                      .map((r) => ({
                        label: `${r.gpuLabel.split(" ")[0]} · ${r.modelLabel.split(" ")[0]}`,
                        gpuLabel: r.gpuLabel,
                        value: r.metrics.overall
                      }))}
                  />
                </div>
              )}

              <div className="sb-table-wrap">
                <table className="sb-table">
                  <thead>
                    <tr>
                      <th>Suite</th>
                      <th>GPU / Backend</th>
                      <th>Model</th>
                      <th>Metrics</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRecords.length > 0 ? (
                      activeRecords.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <code>{r.suiteType}</code>
                          </td>
                          <td>{r.gpuLabel}</td>
                          <td>{r.modelLabel}</td>
                          <td>
                            <code>
                              {Object.entries(r.metrics || {})
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" · ")}
                            </code>
                          </td>
                          <td>{r.sourceFile}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          Load .md/.json output files or toggle the DGX vs R9700 sample dataset.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "ssh" && (
          <>
            <div className="config-section">
              <div className="sb-form-grid">
                {[
                  { field: "user", label: "SSH User", type: "text" },
                  { field: "host", label: "SSH Host / IP", type: "text" },
                  { field: "port", label: "SSH Port", type: "number" },
                  { field: "tmuxSession", label: "tmux Session", type: "text" },
                  { field: "remoteResultsDir", label: "Remote Results Dir", type: "text" },
                  { field: "localPullDir", label: "Local Pull Dir", type: "text" },
                  { field: "hermesServerIp", label: "Hermes Server IP", type: "text" }
                ].map((f) => (
                  <div key={f.field} className="sb-field">
                    <label>{f.label}</label>
                    <input
                      type={f.type}
                      className="sb-input"
                      value={state.ssh[f.field]}
                      onChange={(e) =>
                        updateState((p) => ({
                          ...p,
                          ssh: { ...p.ssh, [f.field]: f.type === "number" ? Number(e.target.value) || 0 : e.target.value }
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="ssh-stack">
              {sshCards.map((c) => (
                <div key={c.id} className="sb-terminal-wrap">
                  <div className="sb-terminal-bar">
                    <span>{c.title}</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${copiedKey === `ssh-${c.id}` ? "copied" : ""}`}
                      onClick={() => copyCommand(c.cmd, `ssh-${c.id}`)}
                    >
                      {copiedKey === `ssh-${c.id}` ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <HighlightedPre code={c.cmd} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
