import React, { useEffect, useState } from "react";
import {
  HARDWARE_PROFILES,
  PARITY_DEFAULTS,
  QUICK_MODELS,
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
        if (
          /^(cd|mkdir|source|export|python3?|pip|git|ssh|scp|tmux|aiperf|speed-bench|llama-benchy|pkill|fuser|nvidia-smi|amd-smi|New-Item|Stop-Process|Set-Location|Remove-Item|Test-Path|Get-ChildItem|Get-NetTCPConnection|Write-Host)$/.test(
            tok
          )
        ) {
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

function formatRecordCells(r) {
  const m = r.metrics || {};
  if (r.suiteType === "llama_bench") {
    return {
      headline: `tg128: ${m.tg128 || 0} t/s · pp512: ${m.pp512 || 0} t/s`,
      details: `pp2048: ${m.pp2048 || 0} t/s · tg512: ${m.tg512 || 0} t/s`
    };
  }
  if (r.suiteType === "llama_benchy") {
    return {
      headline: `depth 0: ${m.depth0Tg || 0} t/s · depth 4096: ${m.depth4096Tg || 0} t/s`,
      details: `KV degradation: ${m.degradationPct || 0}%`
    };
  }
  if (r.suiteType === "llmperf") {
    return {
      headline: `${m.totalTps || 0} t/s · ${m.reqPerMin || 0} req/min`,
      details: `TTFT: ${m.ttftMs || 0} ms · ITL: ${m.itlMs || 0} ms`
    };
  }
  if (r.suiteType === "speed_bench") {
    return {
      headline: `Overall: ${m.overall || 0} t/s`,
      details: `Code ${m.coding || 0} · Reason ${m.reasoning || 0} · Write ${m.writing || 0} · Math ${m.math || 0} t/s`
    };
  }
  if (r.suiteType === "aiperf_sweep" || r.suiteType === "aiperf_std") {
    return {
      headline: `16k: ${m.tps16k || 0} · 32k: ${m.tps32k || 0} · 64k: ${m.tps64k || 0} t/s`,
      details: `TTFT 16k/32k/64k: ${m.ttft16k || 0} / ${m.ttft32k || 0} / ${m.ttft64k || 0} ms`
    };
  }
  return {
    headline: Object.entries(m)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · "),
    details: "—"
  };
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
  const isDgx = profile.id === "dgx_spark_linux_arm64";
  const tab = state.ui.activeTab || "setup";
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
      } else if (warningId === "ctx_llmperf") {
        const lp = suites.llmperf;
        const req = (Number(lp.meanInput) || 1024) + 2 * (Number(lp.stddevInput) || 0) + (Number(lp.meanOutput) || 256) + 64;
        lp.c = Math.max(32768, req + 1024);
      } else if (warningId === "ctx_speed_bench") {
        const sb = suites.speed_bench;
        const req = 16384 + (Number(sb.osl) || 1024) + 64;
        sb.c = Math.max(32768, req + 1024);
        sb.contextPreset = [16384, 32768, 65536].includes(sb.c) ? String(sb.c) : "custom";
      } else if (warningId === "ctx_aiperf_std") {
        const astd = suites.aiperf_std;
        const req = (Number(astd.islMean) || 1024) + (Number(astd.oslMean) || 256) + 64;
        astd.c = Math.max(32768, req + 1024);
      } else if (warningId === "sweep_cache_prompt") {
        suites.aiperf_sweep.cachePrompt = false;
      } else if (warningId === "vram_fp16_64k") {
        suites.aiperf_sweep.ctk = "q8_0";
        suites.aiperf_sweep.ctv = "q8_0";
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
      if (suiteId === "speed_bench" && field === "contextPreset" && value !== "custom") {
        nextSuite.c = Number(value) || 32768;
      } else if (suiteId === "speed_bench" && field === "c") {
        const strC = String(value);
        nextSuite.contextPreset = ["16384", "32768", "65536"].includes(strC) ? strC : "custom";
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
        <div className="sb-form-grid">
          {renderSuiteFieldInput(suiteId, "ngl", "-ngl", "number", s.ngl)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldInput(suiteId, "p", "-p (Prompt Sizes)", "text", s.p)}
          {renderSuiteFieldInput(suiteId, "n", "-n (Gen Tokens)", "text", s.n)}
          {renderSuiteFieldInput(suiteId, "r", "-r (Repetitions)", "number", s.r)}
          {renderSuiteFieldInput(suiteId, "b", "-b (Batch)", "number", s.b)}
          {renderSuiteFieldInput(suiteId, "ub", "-ub (uBatch)", "number", s.ub)}
          {renderSuiteFieldSelect(suiteId, "format", "-o Format", s.format, ["md", "json", "csv"])}
        </div>
      );
    }
    if (suiteId === "llama_benchy") {
      return (
        <div className="sb-form-grid">
          {renderSuiteFieldInput(suiteId, "c", "Server -c", "number", s.c)}
          {renderSuiteFieldInput(suiteId, "np", "Server -np", "number", s.np)}
          {renderSuiteFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldInput(suiteId, "pp", "--pp", "text", s.pp)}
          {renderSuiteFieldInput(suiteId, "tg", "--tg", "text", s.tg)}
          {renderSuiteFieldInput(suiteId, "depth", "--depth", "text", s.depth)}
          {renderSuiteFieldInput(suiteId, "runs", "--runs", "number", s.runs)}
        </div>
      );
    }
    if (suiteId === "llmperf") {
      const isDefault = Number(s.meanInput) === 1024 && Number(s.meanOutput) === 256;
      const isFast = Number(s.meanInput) === 512 && Number(s.meanOutput) === 128;
      return (
        <>
          <div className="sb-inline-row" style={{ marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Token Workload Preset:</span>
            <button
              type="button"
              className={`sb-chip ${isDefault ? "active" : ""}`}
              onClick={() =>
                updateState((p) => ({
                  ...p,
                  suites: {
                    ...p.suites,
                    llmperf: { ...p.suites.llmperf, meanInput: 1024, stddevInput: 128, meanOutput: 256, stddevOutput: 32 }
                  }
                }))
              }
            >
              Default: 1024 in / 256 out
            </button>
            <button
              type="button"
              className={`sb-chip ${isFast ? "active" : ""}`}
              onClick={() =>
                updateState((p) => ({
                  ...p,
                  suites: {
                    ...p.suites,
                    llmperf: { ...p.suites.llmperf, meanInput: 512, stddevInput: 64, meanOutput: 128, stddevOutput: 16 }
                  }
                }))
              }
            >
              Fast: 512 in / 128 out
            </button>
          </div>
          <div className="sb-form-grid">
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
          </div>
        </>
      );
    }
    if (suiteId === "speed_bench") {
      const presetVal = ["16384", "32768", "65536"].includes(String(s.c)) ? String(s.c) : "custom";
      return (
        <div className="sb-form-grid">
          {renderSuiteFieldSelect(suiteId, "contextPreset", "Context Quick Select", presetVal, [
            { value: "16384", label: "16K (16384)" },
            { value: "32768", label: "32K (32768)" },
            { value: "65536", label: "64K (65536)" },
            { value: "custom", label: "Custom (-c below)" }
          ])}
          {renderSuiteFieldInput(suiteId, "c", "Server -c", "number", s.c)}
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
        </div>
      );
    }
    if (suiteId === "agentperf") {
      return (
        <div className="sb-form-grid">
          {renderSuiteFieldInput(suiteId, "c", "Server -c", "number", s.c)}
          {renderSuiteFieldInput(suiteId, "np", "Server -np", "number", s.np)}
          {renderSuiteFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts)}
          {renderSuiteFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts)}
          {renderSuiteFieldInput(suiteId, "extraFlags", "Extra Client Flags", "text", s.extraFlags || "")}
        </div>
      );
    }
    if (suiteId === "aiperf_std") {
      return (
        <div className="sb-form-grid">
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
        </div>
      );
    }
    if (suiteId === "aiperf_sweep") {
      return (
        <div className="sb-form-grid">
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
        </div>
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

  const { warnings, vramEstimate } = evaluateGuardrails(state);
  const setupCards = buildSetupCards(state);
  const verifyCard = setupCards.find((c) => c.id === "setup_verify");
  const activeRecords = state.results.loadedRecords || [];

  const baseVram = [16, 24, 32, 48, 64, 96, 128];
  const curVram = Number(state.hardware.vramGb) || 32;
  const vramList = baseVram.includes(curVram) ? baseVram : [...baseVram, curVram].sort((a, b) => a - b);
  const matchedModel = allModels.find((m) => m.slug === state.model.slug || m.alias === state.model.alias);

  const sshCmds = isDgx ? buildSshCommands(state) : null;
  const dgxRemoteCards = isDgx
    ? [
        { id: "psTrigger", title: "Remote SSH Trigger (from Windows PowerShell to DGX Spark)", cmd: sshCmds.psTrigger },
        { id: "tmuxLaunch", title: "tmux Split Benchmark Session (DGX Spark)", cmd: sshCmds.tmuxLaunch },
        { id: "scpPull", title: "scp Pull Remote Results (from DGX Spark to PC)", cmd: sshCmds.scpPull },
        { id: "startAiRestore", title: "Restore start-ai Stack (DGX Spark Post-Benchmark)", cmd: sshCmds.startAiRestore }
      ]
    : [];

  return (
    <div className="sb-container">
      <header className="sb-header">
        <div className="sb-brand-cluster">
          <span className="sb-brand">ai-benchmate</span>
          <span className="sb-version">1.0.0</span>
          <span className="sb-pill-row">
            <span className="sb-pill sb-pill-interactive">
              <span>platform:</span>
              <select className="sb-pill-select" aria-label="Platform" value={state.hardware.profileId} onChange={(e) => handleChangeProfile(e.target.value)}>
                {Object.values(HARDWARE_PROFILES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName}
                  </option>
                ))}
              </select>
            </span>

            <span className="sb-pill sb-pill-interactive">
              <span>vram:</span>
              <select
                className="sb-pill-select"
                aria-label="VRAM"
                value={curVram}
                onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, vramGb: Number(e.target.value) || 32 } }))}
              >
                {vramList.map((gb) => (
                  <option key={gb} value={gb}>
                    {gb} GB
                  </option>
                ))}
              </select>
            </span>

            <span className="sb-pill sb-pill-interactive">
              <span>model:</span>
              <select
                className="sb-pill-select"
                aria-label="Model"
                value={matchedModel ? matchedModel.id : "__custom__"}
                onChange={(e) => {
                  const found = allModels.find((m) => m.id === e.target.value);
                  if (found) handleSelectModel(found);
                }}
              >
                {!matchedModel && <option value="__custom__">{state.model.alias || state.model.slug || "Custom"}</option>}
                {allModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label || m.alias}
                  </option>
                ))}
              </select>
            </span>
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
          { id: "setup", label: "1. Setup & Pre-flight" },
          { id: "benchmarks", label: "2. Benchmarks" },
          { id: "results", label: "3. Results & Audit" }
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
        {tab === "setup" && (
          <>
            <div className="config-section">
              <div className="sb-inline-row" style={{ justifyContent: "space-between", marginBottom: "10px" }}>
                <h2 className="sb-section-title" style={{ margin: 0 }}>
                  Pre-flight Verification &amp; Environment Setup — {profile.shortName}
                </h2>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => updateState((p) => ({ ...p, ui: { ...p.ui, activeTab: "benchmarks" } }))}
                >
                  Continue to Benchmarks &rarr;
                </button>
              </div>
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
                  <label>Bench Root (Venvs &amp; llmperf)</label>
                  <input type="text" className="sb-input" value={state.hardware.benchRoot} onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, benchRoot: e.target.value } }))} />
                </div>
                <div className="sb-field">
                  <label>Active Model (.gguf)</label>
                  <input
                    type="text"
                    className="sb-input"
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
                </div>
              </div>

              {profile.id === "rtx_spark_win_arm64" && (
                <div className="sb-inline-row" style={{ marginTop: "10px" }}>
                  <label className="sb-field-inline">
                    <input
                      type="checkbox"
                      checked={Boolean(state.hardware.rtxArmTdigestCompile)}
                      onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, rtxArmTdigestCompile: e.target.checked } }))}
                    />
                    <span>Compile aiperf[tdigest] (requires VS C++ ARM64 build tools)</span>
                  </label>
                </div>
              )}

              {isDgx && (
                <div className="sb-inline-row" style={{ marginTop: "10px" }}>
                  <label className="sb-field-inline">
                    <input
                      type="checkbox"
                      checked={Boolean(state.hardware.nonSudoSetup)}
                      onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, nonSudoSetup: e.target.checked } }))}
                    />
                    <span>Non-sudo setup (skip python3-dev / crick C extension)</span>
                  </label>
                  <label className="sb-field-inline">
                    <input
                      type="checkbox"
                      checked={Boolean(state.ssh.includeVllmInStartAi)}
                      onChange={(e) => updateState((p) => ({ ...p, ssh: { ...p.ssh, includeVllmInStartAi: e.target.checked } }))}
                    />
                    <span>Include vLLM in start-ai restore</span>
                  </label>
                </div>
              )}
            </div>

            <div className="ssh-stack">
              {setupCards.map((c) => (
                <div key={c.id} className="sb-terminal-wrap">
                  <div className="sb-terminal-bar">
                    <span>{c.title}</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${copiedKey === `setup-${c.id}` ? "copied" : ""}`}
                      onClick={() => copyCommand(c.cmd, `setup-${c.id}`)}
                    >
                      {copiedKey === `setup-${c.id}` ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <HighlightedPre code={c.cmd} />
                </div>
              ))}
            </div>

            {isDgx && (
              <div className="config-section" style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border-soft)" }}>
                <h3 className="sb-sub-title" style={{ marginTop: 0 }}>
                  DGX Spark Remote SSH &amp; Post-Benchmark Stack
                </h3>
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
                <div className="ssh-stack">
                  {dgxRemoteCards.map((c) => (
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
              </div>
            )}
          </>
        )}

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
                  <>
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
                    <label className="sb-field-inline">
                      <input
                        type="checkbox"
                        checked={Boolean(state.hardware.amdEnableFa)}
                        onChange={(e) => updateState((p) => ({ ...p, hardware: { ...p.hardware, amdEnableFa: e.target.checked } }))}
                      />
                      <span>Enable -fa 1 on Vulkan</span>
                    </label>
                  </>
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
                                activePresetName: p.naming.activePresetName === preset.name ? "Default Settings" : p.naming.activePresetName
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
                          naming: { ...p.naming, activePresetName: "Default Settings" }
                        }))
                      }
                    >
                      Reset to Defaults
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="sb-banner" style={{ marginTop: 0, marginBottom: "10px", background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <span>
                <strong>00 · Pre-flight Check</strong> — Verify GPU, binaries, <code>.gguf</code> model, Python &amp; venvs before benchmarking.
              </span>
              <div className="sb-inline-row" style={{ gap: "6px" }}>
                {verifyCard && (
                  <button
                    type="button"
                    className={`btn btn-sm btn-outline ${copiedKey === "preflight-banner" ? "copied" : ""}`}
                    onClick={() => copyCommand(verifyCard.cmd, "preflight-banner")}
                  >
                    {copiedKey === "preflight-banner" ? "Copied" : "Copy Pre-flight Script"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => updateState((p) => ({ ...p, ui: { ...p.ui, activeTab: "setup" } }))}
                >
                  Open 1. Setup &amp; Pre-flight
                </button>
              </div>
            </div>

            <div className="guardrails-wrap">
              {warnings.length === 0 ? (
                <div className="sb-banner sb-banner-ok">
                  <span>
                    <strong>Guardrails Active (All Parameters Valid)</strong> — Est. Peak VRAM: {vramEstimate.totalVramGb} GB / {vramEstimate.vramCeiling} GB
                    (Weights {vramEstimate.weightGb} GB + KV {vramEstimate.kvGb} GB @ {vramEstimate.kvPrecision} + 1.5 GB Buffer) · Max Server Context:{" "}
                    {vramEstimate.maxServerCtx}
                  </span>
                </div>
              ) : (
                warnings.map((w) => (
                  <div key={w.id} className={`sb-banner ${w.severity === "crimson" ? "sb-banner-danger" : "sb-banner-warn"}`}>
                    <span>
                      <strong>{w.title}</strong> — {w.detail}
                    </span>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => handleAutoFix(w.id)}>
                      {w.fixLabel}
                    </button>
                  </div>
                ))
              )}
            </div>

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
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>

                    {expanded && <div className="sb-drawer">{renderSuiteDrawerFields(meta.id)}</div>}

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
                              {copiedKey === `t1-${meta.id}` ? "Copied" : "Copy Server"}
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
                            className={`btn btn-sm btn-primary ${copiedKey === `t2-${meta.id}` ? "copied" : ""}`}
                            onClick={() => copyCommand(clientCmd, `t2-${meta.id}`)}
                          >
                            {copiedKey === `t2-${meta.id}` ? "Copied" : "Copy Command"}
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
                Playbook ({profile.shortName} · {state.model.alias || state.model.slug})
              </span>
              <div className="playbook-footer-actions">
                <button
                  type="button"
                  className={`btn btn-sm ${state.ui.playbookMissingOnly ? "btn-primary" : ""}`}
                  onClick={() => updateState((p) => ({ ...p, ui: { ...p.ui, playbookMissingOnly: !p.ui.playbookMissingOnly } }))}
                >
                  {state.ui.playbookMissingOnly ? "Missing / Incomplete Runs Only: ON" : "Missing / Incomplete Runs Only"}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm btn-outline ${copiedKey === "playbook" ? "copied" : ""}`}
                  onClick={() => copyCommand(buildAllInOnePlaybook(state, Boolean(state.ui.playbookMissingOnly)), "playbook")}
                >
                  {copiedKey === "playbook" ? "Copied" : "Copy Playbook"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const ext = profile.shell === "powershell" ? "ps1" : "sh";
                    downloadText(`benchmate_${state.model.slug || "run"}.${ext}`, buildAllInOnePlaybook(state, Boolean(state.ui.playbookMissingOnly)));
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
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => updateState((p) => ({ ...p, ui: { ...p.ui, showDeepAuditScript: !p.ui.showDeepAuditScript } }))}
                >
                  Terminal Audit Script {state.ui.showDeepAuditScript ? "▴" : "▾"}
                </button>
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

              {state.ui.showDeepAuditScript && (
                <div className="sb-terminal-wrap">
                  <div className="sb-terminal-bar">
                    <span>Terminal Audit Script (1 KB Stub Check)</span>
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
              )}

              <div className="sb-table-wrap">
                <table className="sb-table">
                  <thead>
                    <tr>
                      <th>Benchmark</th>
                      <th>Expected Output</th>
                      <th>Status</th>
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
                              {meta.index} · {meta.title}
                            </strong>
                          </td>
                          <td>
                            <code>{target.leaf}</code>
                          </td>
                          <td>
                            <span className={`sb-badge ${badgeCls}`}>{item ? item.label : "NOT AUDITED"}</span>
                            <div className="sb-audit-sub">{item ? item.detail : "Run folder audit or drop files above."}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="sb-inline-row">
                <h2 className="sb-section-title" style={{ margin: 0 }}>
                  Parsed Results Comparison
                </h2>
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
                {activeRecords.length > 0 && (
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
                      <th>Benchmark</th>
                      <th>Platform</th>
                      <th>Model</th>
                      <th>Headline Throughput</th>
                      <th>Latency / Details</th>
                      <th>File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRecords.length > 0 ? (
                      activeRecords.map((r) => {
                        const cells = formatRecordCells(r);
                        return (
                          <tr key={r.id}>
                            <td>
                              <code>{r.suiteType}</code>
                            </td>
                            <td>{r.gpuLabel}</td>
                            <td>{r.modelLabel}</td>
                            <td>
                              <strong>{cells.headline}</strong>
                            </td>
                            <td>{cells.details}</td>
                            <td>
                              <code>{r.sourceFile}</code>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          Upload benchmark result files (.md / .json) or drop your Results folder above to populate the comparison table.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
