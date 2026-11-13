# AI BenchMate — Cross-PC Handoff & Context Document

**Last Updated:** 2026-11-14  
**Current Phase:** Setup-First Workflow, Pre-flight Verification & Platform-Filtered Editions (Ready & Pushed)

---

## 1. Purpose of This File

This document captures the complete project state, environment setup, architectural decisions, and next steps so you can copy-paste the project folder or clone it from GitHub onto another PC running Google Antigravity and continue immediately without losing context.

---

## 2. How to Transfer to Your Other Antigravity PC

### Method A: Single-Folder Copy-Paste Transfer
Everything for **AI BenchMate** (code, plans, architecture notes, and prompt/response history) is kept strictly inside `C:\Users\GadgetPilipinas\Documents\AI BenchMate`—nothing external needs to be copied.

1. Copy-paste the entire folder:
   - Source path: `C:\Users\GadgetPilipinas\Documents\AI BenchMate`
2. Paste it into your projects folder on your other PC.
3. Open the folder in Google Antigravity on the other PC.
4. Antigravity automatically reads `GEMINI.md` at the repo root, which points it to this file (`docs/HANDOFF.md`) and `docs/PROMPT_HISTORY.md`.

**Internal Folder Layout (All Self-Contained Here):**
- `GEMINI.md` — Auto-loaded Antigravity rules and single-folder continuity guidelines
- `docs/HANDOFF.md` — Project state, environment snapshot, architecture, & setup guide
- `docs/PROMPT_HISTORY.md` — Full chronological prompt & response history
- `docs/plans/` — Implementation plans, walkthroughs, & design specs (created as features are planned/built)

### Method B: GitHub Transfer (Once Repo Is Pushed)
1. On this laptop: initialize git, commit, create the GitHub repo, and push.
2. On the other PC: `git clone <repo-url>` and open the folder in Google Antigravity.

---

## 3. Source Laptop Environment Snapshot (Checked 2026-11-14)

### Already Installed
- **OS:** Windows
- **Package Manager:** `winget` (`C:\Users\GadgetPilipinas\AppData\Local\Microsoft\WindowsApps\winget.exe`)
- **Python:** `3.15.0` (`py --version` -> `Python 3.15.0`)
- **.NET SDK:** `9.0.310` (`C:\Program Files\dotnet\dotnet.exe`)
- **Git:** `2.56.0.windows.4`
- **GitHub CLI:** `2.104.0` (`gh`, authenticated as `grantsor`)
- **Node.js:** `v26.13.1` (`npm` via `npm.cmd` in PowerShell)

### Not Installed (Optional)
- **uv (`uv`)** / **Rust (`cargo`)**: Not required for either web edition.

---

## 4. Architecture & Implementation Log

- **Dual Editions Delivered:**
  1. **Portable Zero-Server Static Edition (`portable/`):** Zero-dependency HTML5 + CSS3 + JS (`benchmate-data.js`, `benchmate-engine.js`, `benchmate-ui.js`), `launch-local.bat`, `launch-local.sh`, runs over `file://` or `py -m http.server`.
  2. **React + Vite Edition (Root `src/`):** `src/App.jsx`, `src/styles.css`, `src/core/benchmate-data.js`, `src/core/benchmate-engine.js`, `package.json`, `vite.config.js`.
- **Key Implemented Features:**
  - Clean 3-tab workflow (`1. Setup & Pre-flight` | `2. Benchmarks` | `3. Results & Audit`) with Light default + Dark + System modes and Pause Animations / Stealth Mode.
  - Interactive top header pills (`platform:`, `vram:`, `model:`) as `<select>` switchers synced across tabs.
  - Proactive always-visible Guardrails bar (`sb-banner-ok` when valid, 8-check validation + 1-click Auto-Fix when invalid).
  - Universal persistence (`localStorage` + `IndexedDB`) remembering all parameters, custom models, custom presets, UI drawer toggles, and active tab.
  - Content-Aware Folder Auditor (`showDirectoryPicker()`, `webkitdirectory`, Drag-and-Drop, Anti-1KB Stub & `aiperf.log` check) and clean 6-column Comparison Matrix with SVG charts and `.md`/`.csv` exports.
- **Reference Docs Archived Inside Repo:**
  - `docs/references/AI Benchmate Prompt.md`
  - `docs/references/DGX Spark vs Radeon AI Pro 9700 — AI Benchmarks & Inference.md`
  - `docs/references/DGX Spark Setup & Hermes Server Guide.md`
- **Proposal Document:** `docs/plans/2026-11-14-ai-benchmate-proposal.md`
- **GitHub Repositories:**
  - Main (React + Vite + Portable + Docs): `https://github.com/grantsor/AI-BenchMate` (Public)
  - Standalone Portable Edition: `https://github.com/grantsor/AI-BenchMate-Portable` (Public)

---

## 5. Immediate Next Steps

1. Open `portable/index.html` (or run `npm.cmd run dev` for the React + Vite edition), run `01 · Pre-flight Check` on `1. Setup & Pre-flight` for your active hardware profile, and execute your benchmark runs on `2. Benchmarks`.
2. When transferring to another PC, either copy-paste `C:\Users\GadgetPilipinas\Documents\AI BenchMate` or `git clone` either GitHub repository.

## Latest Update (2026-11-14) — Pre-flight First Workflow, Platform Filtering, Guardrails & Clutter Cleanup

- **Workflow-First 3-Tab Order (`1. Setup & Pre-flight` -> `2. Benchmarks` -> `3. Results & Audit`):**
  - **`1. Setup & Pre-flight` (default tab):** Starts with `01 · Pre-flight Check` (`setup_verify`: checks GPU driver via `nvidia-smi`/`amd-smi`, `llama-bench`/`llama-server`/`speed_bench.py`, active `.gguf` + directory `.gguf` scan, Python + `.venv-aiperf` (`llama_benchy`/`aiperf`/`ray`) + `llmperf/token_benchmark_ray.py` + `.venv-agentperf` (`agentperf-local`), and port `8080` status), followed by `02 · Install Python Venvs & Benchmark Dependencies` (including `aa-agentperf-local`), `03 · Free VRAM`, and `04 · Clear llama-benchy Cache`.
  - **Strict Platform Filtering:** Selecting any Windows profile (`rtx_spark_win_arm64`, `nvidia_win_x64`, `amd_win_x64`) renders ONLY Windows PowerShell commands (`setup_hermes_dgx`, `pkill`, `tmux`, `DGX VRAM Sweep`, and `start-ai` restore cards are strictly gated to `dgx_spark_linux_arm64`).
  - **Interactive Header Pills:** `platform:`, `vram:`, and `model:` in the top status bar are clickable `<select class="sb-pill-select">` controls synced 1:1 with the toolbar and persisted in `localStorage` + `IndexedDB`.
  - **`2. Benchmarks` Tab:** Features a `00 · Pre-flight Check` reminder bar, always-visible Guardrails status/warning bar (`sb-banner-ok` when valid, warning/error + 1-click Auto-Fix across 8 checks: `ctx_aiperf_sweep`, `ctx_benchy`, `ctx_llmperf`, `ctx_speed_bench`, `ctx_aiperf_std`, `sweep_cache_prompt`, `vram_fp16_64k`, `vram_overflow`), `Default` terminology (replacing `"Parity"`), AMD `Enable -fa 1 on Vulkan`, `03 llmperf` quick workload presets (`Default 1024/256` vs `Fast 512/128`), `04 SPEED-Bench` quick context selector (`16K`/`32K`/`64K`/`Custom`) + numeric `-c`, single `Copy Server` / `Copy Command` button per terminal box (none duplicated in `.suite-card-header`), and `Missing / Incomplete Runs Only` playbook export toggle.
  - **`3. Results & Audit` Tab:** Removed sample preview dataset/buttons from UI; simplified Audit table to 3 columns (`Benchmark`, `Expected Output`, `Status`) with collapsible `Terminal Audit Script`, and formatted Comparison table into 6 readable columns (`Benchmark`, `Platform`, `Model`, `Headline Throughput`, `Latency / Details`, `File`).
- **Last Verified State:**
  - `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: exit 0
  - `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules, 470ms): exit 0
  - `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (9/9)`
  - Extended ESM + Node `vm` UI/engine verification (`EXTENDED UI + ENGINE VERIFICATION PASSED (ALL CHECKS OK)`): exit 0
