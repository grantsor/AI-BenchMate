import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Minimal browser global shims for Node test execution
const memStore = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: (k, v) => memStore.set(k, String(v))
  }
};

import {
  HARDWARE_PROFILES,
  PARITY_DEFAULTS,
  SAMPLE_RESULTS_DATASET,
  createDefaultState
} from "../src/core/benchmate-data.js";
import {
  auditFileList,
  buildAllInOnePlaybook,
  buildServerCommand,
  buildSetupCards,
  buildSuiteClientCommand,
  evaluateGuardrails,
  exportComparisonCsv,
  exportComparisonMarkdown,
  getOutputTarget,
  getServerLifecycleInfo,
  loadState,
  parseModelPath,
  parseResultFile,
  saveState
} from "../src/core/benchmate-engine.js";

// 1. Smart Path Parser tests (Windows & Linux, zero hardcoded usernames)
const winParsed = parseModelPath(
  "C:\\Users\\Admin\\.lmstudio\\models\\unsloth\\Qwen3.8-27B-GGUF\\Qwen3.8-27B-UD-Q4_K_M.gguf"
);
assert.equal(winParsed.osStyle, "windows");
assert.equal(winParsed.alias, "Qwen3.8-27B");
assert.equal(winParsed.slug, "qwen38");
assert.equal(winParsed.tokenizer, "Qwen/Qwen3.8-27B");

const linParsed = parseModelPath("/home/user/models/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf");
assert.equal(linParsed.osStyle, "linux");
assert.equal(linParsed.alias, "Qwen3.6-35B-A3B");
assert.equal(linParsed.slug, "qwen36");
assert.equal(linParsed.tokenizer, "Qwen/Qwen3.6-35B-A3B");

// 2. Universal localStorage persistence test
const s0 = createDefaultState();
s0.ui.pauseAnimations = true;
s0.hardware.vramGb = 32;
saveState(s0);
const s1 = loadState();
assert.equal(s1.ui.pauseAnimations, true);
assert.equal(s1.hardware.vramGb, 32);

// 3. Dynamic Naming Engine (Classic vs Parameter-Stamped)
const baseState = createDefaultState();
baseState.naming.mode = "classic";
assert.ok(getOutputTarget(baseState, "llama_bench").leaf.endsWith("llama_bench_qwen38.md"));
assert.ok(getOutputTarget(baseState, "aiperf_sweep").leaf.startsWith("aiperf_qwen38_nv64k"));

baseState.naming.mode = "stamped";
assert.ok(getOutputTarget(baseState, "llama_bench").leaf.includes("pp512-2048_tg128-512_r3.md"));
assert.ok(getOutputTarget(baseState, "aiperf_sweep").leaf.includes("ctx70k_kvq8_0_isl16k-32k-64k_osl1024_c1_r3"));

// 4. Hardware/OS Command Adaptation across all 4 profiles
for (const pid of Object.keys(HARDWARE_PROFILES)) {
  const st = createDefaultState();
  st.hardware.profileId = pid;
  const prof = HARDWARE_PROFILES[pid];
  const srv = buildServerCommand(st, "aiperf_sweep");
  const cli = buildSuiteClientCommand(st, "llama_bench");
  assert.ok(srv.includes(`--alias "${st.model.alias}"`), `Missing --alias for ${pid}`);
  if (prof.os === "windows") {
    assert.ok(srv.includes("llama-server.exe"), `Missing .exe server for ${pid}`);
    assert.ok(cli.includes("Tee-Object"), `Missing PowerShell Tee-Object for ${pid}`);
  } else {
    assert.ok(!srv.includes(".exe"), `Unexpected .exe for ${pid}`);
    assert.ok(cli.includes("| tee "), `Missing bash tee for ${pid}`);
  }
}

// 5. Context Overflow Guardrail (65588 > 65536 Trap) & VRAM Warning
const trapState = createDefaultState();
trapState.hardware.profileId = "amd_win_x64";
trapState.hardware.vramGb = 32;
trapState.suites.aiperf_sweep.c = 65536; // Trigger overflow: 65536 + 1024 + 64 = 66624 > 65536
trapState.suites.aiperf_sweep.ctk = "fp16";
const g = evaluateGuardrails(trapState);
assert.ok(g.warnings.some((w) => w.id === "ctx_aiperf_sweep"), "Expected context overflow warning");
assert.ok(g.warnings.some((w) => w.id === "vram_overflow"), "Expected VRAM overflow warning on 32 GB R9700");

// 6. Content-Aware Folder Auditor (Anti-1KB Stub + aiperf.log error extraction)
const auditRes = await auditFileList(
  [
    {
      path: "llama_bench_qwen38.md",
      name: "llama_bench_qwen38.md",
      size: 2048,
      textLoader: async () => "| model | test | t/s |\n| --- | --- | --- |\n| qwen38 | pp512 | 1945.2 |\n| qwen38 | tg128 | 22.4 |"
    },
    {
      path: "llama_benchy_qwen38.md",
      name: "llama_benchy_qwen38.md",
      size: 240,
      textLoader: async () => "| header |"
    },
    {
      path: "aiperf_qwen38_nv64k/logs/aiperf.log",
      name: "aiperf.log",
      size: 620,
      textLoader: async () => "INFO starting\nERROR: prompt length 66612 exceeds n_ctx 65536\n"
    }
  ],
  createDefaultState()
);
assert.equal(auditRes.llama_bench.status, "verified");
assert.equal(auditRes.llama_benchy.status, "stub");
assert.equal(auditRes.aiperf_sweep.status, "stub");
assert.ok(auditRes.aiperf_sweep.detail.includes("66612"));

// 7. Playbook & Export verification
const playbook = buildAllInOnePlaybook(createDefaultState(), false);
assert.ok(playbook.includes("llama-bench") && playbook.includes("aiperf profile"));
assert.ok(exportComparisonMarkdown(SAMPLE_RESULTS_DATASET).includes("DGX Spark"));
assert.ok(exportComparisonCsv(SAMPLE_RESULTS_DATASET).includes("Radeon AI Pro R9700"));

// 8. Verify Portable files exist alongside React + Vite files
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assert.ok(fs.existsSync(path.join(rootDir, "portable", "index.html")));
assert.ok(fs.existsSync(path.join(rootDir, "portable", "js", "benchmate-ui.js")));
assert.ok(fs.existsSync(path.join(rootDir, "src", "App.jsx")));

// 9. Verify Portable IIFE bundle in vm sandbox (simulating file:// browser script loading)
import vm from "node:vm";
const winCtx = { window: { localStorage: globalThis.window.localStorage }, document: {} };
winCtx.window.window = winCtx.window;
vm.createContext(winCtx);
vm.runInContext(fs.readFileSync(path.join(rootDir, "portable", "js", "benchmate-data.js"), "utf8"), winCtx);
vm.runInContext(fs.readFileSync(path.join(rootDir, "portable", "js", "benchmate-engine.js"), "utf8"), winCtx);
assert.ok(winCtx.window.BenchmateData && winCtx.window.BenchmateEngine);
const pState = winCtx.window.BenchmateData.createDefaultState();
assert.ok(winCtx.window.BenchmateEngine.buildServerCommand(pState, "aiperf_sweep").includes("--alias"));
assert.ok(winCtx.window.BenchmateEngine.evaluateGuardrails({
  ...pState,
  suites: { ...pState.suites, aiperf_sweep: { ...pState.suites.aiperf_sweep, c: 65536 } }
}).warnings.some((w) => w.id === "ctx_aiperf_sweep"));

// 10. Verify Setup Cards & Client Commands 1:1 Parity and Scratch-Setup Dependency Order across all 4 profiles
for (const pid of Object.keys(HARDWARE_PROFILES)) {
  const sReact = createDefaultState();
  sReact.hardware.profileId = pid;
  const sPort = winCtx.window.BenchmateData.createDefaultState();
  sPort.hardware.profileId = pid;

  const cardsReact = buildSetupCards(sReact);
  const cardsPort = winCtx.window.BenchmateEngine.buildSetupCards(sPort);
  assert.equal(JSON.stringify(cardsReact), JSON.stringify(cardsPort), `Setup cards mismatch for ${pid}`);
  assert.equal(cardsReact[0].id, "setup_llamacpp", `Card 01 must be setup_llamacpp on ${pid}`);
  assert.equal(cardsReact[1].id, "setup_env", `Card 02 must be setup_env on ${pid}`);
  assert.equal(cardsReact[2].id, "setup_models", `Card 03 must be setup_models on ${pid}`);
  assert.equal(cardsReact[3].id, "setup_verify", `Card 04 must be setup_verify on ${pid}`);
  for (const card of cardsReact) {
    assert.ok(!card.cmd.includes("[ACTION NEEDED]"), `Passive [ACTION NEEDED] found in ${card.id} on ${pid}`);
  }

  const c1 = cardsReact.find((c) => c.id === "setup_verify").cmd;
  const c2 = cardsReact.find((c) => c.id === "setup_llamacpp").cmd;
  const c3 = cardsReact.find((c) => c.id === "setup_env").cmd;
  const c4 = cardsReact.find((c) => c.id === "setup_models").cmd;

  assert.ok(c3.includes("agentperf-local") && !c3.includes("aa-agentperf-local"), `PyPI package name must be agentperf-local on ${pid}`);

  if (pid !== "dgx_spark_linux_arm64") {
    assert.ok(c1.includes("Get-Command git -ErrorAction SilentlyContinue"), `Card 01 git check missing on ${pid}`);
    assert.ok(c1.includes("Get-Command py -ErrorAction SilentlyContinue"), `Card 01 py check missing on ${pid}`);
    assert.ok(c2.includes("winget install --id Git.Git"), `Card 02 winget git missing on ${pid}`);
    assert.ok(c2.includes("LOCALAPPDATA\\Programs\\Git\\cmd"), `Card 02 user Git path missing on ${pid}`);
    assert.ok(c2.includes("Microsoft.VCRedist"), `Card 02 VCRedist missing on ${pid}`);
    assert.ok(c2.includes("https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=1"), `Card 02 auto binary download missing on ${pid}`);
    assert.ok(c3.includes("winget install --id Git.Git"), `Card 03 git fallback missing on ${pid}`);
    assert.ok(c3.includes("Python.Python.3.12"), `Card 03 Python 3.12 missing on ${pid}`);
    assert.ok(c3.includes("llmperf/archive/refs/heads/main.zip"), `Card 03 llmperf zip fallback missing on ${pid}`);
    assert.ok(c4.includes("curl.exe -L -C -"), `Card 04 curl fallback missing on ${pid}`);
  } else {
    assert.ok(c1.includes("command -v git"), "Linux Card 01 git check missing");
    assert.ok(c2.includes("sudo apt update && sudo apt install -y build-essential cmake git curl wget"), "Linux Card 02 apt missing");
    assert.ok(c4.includes("wget -c"), "Linux Card 04 wget fallback missing");
  }

  assert.equal(getServerLifecycleInfo(sReact, "llama_bench").mode, "no_server");
  assert.equal(getServerLifecycleInfo(sReact, "llama_benchy").mode, "start_new");
  assert.deepEqual(getServerLifecycleInfo(sReact, "llama_benchy").sharedIndices, ["02", "03", "05", "06A"]);
  assert.equal(getServerLifecycleInfo(sReact, "llmperf").mode, "reuse_prev");
  assert.equal(getServerLifecycleInfo(sReact, "speed_bench").mode, "relaunch_dedicated");
  assert.equal(getServerLifecycleInfo(sReact, "agentperf").mode, "relaunch_shared");
  assert.equal(getServerLifecycleInfo(sReact, "aiperf_std").mode, "reuse_prev");
  assert.equal(getServerLifecycleInfo(sReact, "aiperf_sweep").mode, "relaunch_dedicated");

  for (const suiteId of ["llama_bench", "llama_benchy", "llmperf", "speed_bench", "agentperf", "aiperf_std", "aiperf_sweep"]) {
    const cliR = buildSuiteClientCommand(sReact, suiteId);
    const cliP = winCtx.window.BenchmateEngine.buildSuiteClientCommand(sPort, suiteId);
    assert.equal(cliR, cliP, `Client command mismatch on ${pid} / ${suiteId}`);
    const srvR = buildServerCommand(sReact, suiteId);
    const srvP = winCtx.window.BenchmateEngine.buildServerCommand(sPort, suiteId);
    assert.equal(srvR, srvP, `Server command mismatch on ${pid} / ${suiteId}`);
    assert.equal(
      JSON.stringify(getServerLifecycleInfo(sReact, suiteId)),
      JSON.stringify(winCtx.window.BenchmateEngine.getServerLifecycleInfo(sPort, suiteId)),
      `Lifecycle info mismatch on ${pid} / ${suiteId}`
    );
  }
}

console.log("ALL AI BENCHMATE VERIFICATION CHECKS PASSED (10/10)");
