# AI BenchMate — Cross-PC Handoff & Context Document

**Last Updated:** 2026-11-17  
**Current Phase:** Complete Pre-Transfer Audit Done — Dual Editions Synced 1:1, LM Studio Windows Defaults + Recursive `\models\` Scanner, Action-First Setup Cards, Lifecycle Guidance & Full Conversation History Archived

---

## 1. Purpose of This File

This document captures the complete project state, environment setup, architectural decisions, archived reference assets, build/test commands, and next steps so you can copy-paste the project folder or clone it from GitHub onto another PC running **Google Antigravity** and continue immediately without losing context.

---

## 2. How to Transfer to Your Other Antigravity PC

### Method A: GitHub Transfer (Recommended — Zero Stale Build Artifacts)
1. Ensure **Git** is installed on the destination PC (and **Node.js** if building/developing the React + Vite edition).
2. Clone the repository:
   ```powershell
   git clone https://github.com/grantsor/AI-BenchMate.git
   ```
   *(Or clone only the static zero-server portable edition: `git clone https://github.com/grantsor/AI-BenchMate-Portable.git`)*
3. Open the cloned folder in **Google Antigravity**. Antigravity automatically reads `GEMINI.md` at the repo root, which points to `docs/HANDOFF.md` and `docs/PROMPT_HISTORY.md`.
4. If editing the React + Vite edition on the new PC, run `npm install` (or `npm.cmd install` in PowerShell).

### Method B: Single-Folder Copy-Paste Transfer
Everything for **AI BenchMate** (code, plans, architecture notes, reference screenshots, chat histories, and prompt/response history) is kept strictly inside the `AI BenchMate` folder—nothing external (`.gemini` brain/cache) needs to be copied.

1. Copy-paste the entire `AI BenchMate` folder onto the destination PC.
2. Open the folder in **Google Antigravity** and tell the agent:
   *"Read `GEMINI.md`, `docs/HANDOFF.md`, and `docs/PROMPT_HISTORY.md` to resume where we left off."*

**Internal Folder Layout (100% Self-Contained):**
- `GEMINI.md` — Auto-loaded Antigravity rules and single-folder continuity guidelines
- `README.md` — Project overview, transfer options, required tools, env policy, and run/build/verify commands
- `docs/HANDOFF.md` — Project state, environment snapshot, architecture, & resume checklist
- `docs/PROMPT_HISTORY.md` — Full chronological prompt & milestone log (**Entries 1–19**)
- `docs/plans/2026-11-14-ai-benchmate-proposal.md` — Initial architecture & optimization proposal
- `docs/references/` — All reference prompts, parity/setup guides, full chat histories, and uploaded screenshots:
  - `docs/references/AI Benchmate Prompt.md`
  - `docs/references/DGX Spark vs Radeon AI Pro 9700 — AI Benchmarks & Inference.md`
  - `docs/references/DGX Spark Setup & Hermes Server Guide.md`
  - `docs/references/ai_benchmarks_ai_benchmate_chat_history.md`
  - `docs/references/dgx_spark_setup_server_chat_history.md`
  - `docs/references/screenshots/` (`media_1794599539057_434acee7.png`, `media_1794599547490_61630a0a.png`, `media_1794601573794_87af4813.png`, `media_1794601683450_2cc9bc8b.png`, `media_1794819895170_24195ab2.png`, `media_1794820016995_e6220a6c.png`)
- `scripts/verify-benchmate.mjs` — Automated 11-check verification suite covering React vs. Portable parity

---

## 3. Source Laptop Environment Snapshot & Required Tools

### Already Installed on Source Laptop
- **OS:** Windows
- **Package Manager:** `winget` (`C:\Users\GadgetPilipinas\AppData\Local\Microsoft\WindowsApps\winget.exe`)
- **Python:** `3.15.0` (`py --version` -> `Python 3.15.0`)
- **.NET SDK:** `9.0.310`
- **Git:** `2.56.0.windows.4`
- **GitHub CLI:** `2.104.0` (`gh`, authenticated as `grantsor`)
- **Node.js:** `v26.13.1` (`npm` via `npm.cmd` in PowerShell)

### Required Tools & Environment Variables on Destination PC
- **Portable Edition (`portable/`):** Any modern browser (zero runtime dependencies; double-click `portable/index.html`). Optional Python 3 for `launch-local.bat` / `launch-local.sh`.
- **React + Vite Edition & Verification Suite:** Node.js LTS (`npm install`, `npm run dev`, `npm run build`, `node scripts/verify-benchmate.mjs`).
- **Environment Variables:** **None required** (100% local static client-side app; no `.env` file or API secrets needed).

---

## 4. Architecture & Implementation Log

- **Dual Editions Synced 1:1:**
  1. **Portable Zero-Server Static Edition (`portable/`):** Zero-dependency HTML5 + CSS3 + JS (`index.html`, `css/styles.css`, `js/benchmate-data.js`, `js/benchmate-engine.js`, `js/benchmate-ui.js`), `launch-local.bat`, `launch-local.sh`, `README.md`, `GEMINI.md`, runs over `file://` or `http://127.0.0.1:8765/`.
  2. **React + Vite Edition (Root `src/`):** `src/App.jsx`, `src/styles.css`, `src/core/benchmate-data.js`, `src/core/benchmate-engine.js`, `index.html` (`file://` auto-redirects to `portable/index.html`), `package.json`, `vite.config.js`.
- **Key Implemented Features:**
  - **Clean 3-Tab Workflow:** `1. Setup & Pre-flight` | `2. Benchmarks` | `3. Results & Audit` (`Light` default + `Dark` + `System` modes and unified `Pause Animations` stealth toggle).
  - **Portable LM Studio Windows Default Pathing & Dual-Route Model Discovery (`$env:USERPROFILE\.lmstudio\models`):**
    - All Windows hardware profiles (`rtx_spark_win_arm64`, `nvidia_win_x64`, `amd_win_x64`) default `defaultModelsDir` and `hardware.modelsDir` to portable **`$env:USERPROFILE\.lmstudio\models`** (never hardcoding any PC username; legacy `$HOME\.lmstudio\models` or nested paths migrate cleanly in `loadState`).
    - **Route 1 (Recommended — `Scan \models\ Folder`):** Recursively scans any pointed LM Studio `\models\` directory via `<input webkitdirectory>` (`scanModelFolderEntries`) over both `file://` and HTTP, ignoring non-LLM helpers (`mmproj-*`, `mtp-*`, `projector*`, `draft*`), grouping multi-part split GGUFs (`-00001-of-0000N.gguf`), matching `Qwen3.8-27B` and `Qwen3.6-35B-A3B` across publishers/quants, and integrating ALL discovered `.gguf` models directly into the model chips, header dropdown, and VRAM Fit estimator.
    - **Route 2 (`Select .gguf File` / Smart Paste):** Pick any specific `.gguf` file (`resolvePickedModelFile`) or paste Explorer paths with quotes (`cleanUserPath`, `inferModelsRootFromInput`, `reRootModelPath`, `parseModelPath(rawPath, overrideModelsRoot)`), automatically extracting `modelsDir` without corrupting `baseDir`.
    - **Live Model Discovery Status Banner (`[FOUND]` / `[PARTIAL]` / `[NOT FOUND]`):** Clearly notifies which parity and custom GGUFs were found or missing, with one-click jump to **Setup Card `03`**.
  - **Action-First From-Scratch Setup Cards (`01` → `07`) — Zero Passive `[ACTION NEEDED]` Checks:**
    - **Card `01 · setup_llamacpp`:** Auto-installs `Git.Git` across all Windows PATH scopes (`Program Files`, `x86`, `LOCALAPPDATA`), VC++ Redistributable (`vcruntime140.dll`), clones `llama.cpp`, and downloads pre-built `llama-bench` / `llama-server` binaries via fast `tar.exe -xf`.
    - **Card `02 · setup_env`:** Checks `Python312`, `Python312-arm64`, `Python311`, `Python311-arm64`, auto-installs `Python.Python.3.12` via `winget` (`--architecture x64` on RTX Spark Windows ARM64), creates `.venv-aiperf` (`llmperf` patched `<3.11`, `aiperf` with `tdigest` fallback, `llama-benchy`) and `.venv-agentperf` (`agentperf-local` exact PyPI package, bootstrapping via `.venv-aiperf` python if `py` is absent).
    - **Card `03 · setup_models`:** Reads `$env:USERPROFILE\.lmstudio\settings.json` (`downloadsFolder`), recursively scans `$modelRoot` for runnable `.gguf` files (>500 MB) BEFORE downloading, prints `[FOUND]` for existing models, and downloads only missing parity GGUFs.
    - **Card `04 · setup_verify`:** Self-healing readiness verification using `modelsDir` + recursive fallback lookup.
  - **Live Server & Terminal Lifecycle Guidance (`getServerLifecycleInfo`):**
    - Top **Terminal & Server Lifecycle Guide** banner in `2. Benchmarks` + color-coded **Server Action Badges** and instruction bars on every Benchmark Suite Card (`01`–`06B`) plus `# [SERVER LIFECYCLE]` comments inside `Terminal 1 — Server`.
    - Dynamically compares `getServerConfigSignature` so edits to server args automatically reflect reuse vs. `Ctrl+C` relaunch; Suite `01` auto-stops any running `llama-server`.
  - **Interactive Hover Tooltip Popups (`HELP_TOOLTIPS` + `#sb-floating-tooltip`):** Instant viewport-aware popups on all checkboxes, card/suite/section titles, hardware/path/model/SSH fields, and every benchmark parameter.
  - **Always-Visible `Results Dir` & Single `Select Folder` Audit Button:** Surfaced across all 3 tabs with drag-and-drop Folder Auditing, `SPEED-Bench` JSON array parser, and CSV/Markdown comparison export.
  - **Universal Persistence:** Auto-saves every setting, model scan result, preset, and loaded result record to `localStorage` + `IndexedDB`.
- **GitHub Repositories:**
  - Main (React + Vite + Portable + Docs): `https://github.com/grantsor/AI-BenchMate` (Public, `main`)
  - Standalone Portable Edition: `https://github.com/grantsor/AI-BenchMate-Portable` (Public, `main`)

---

## 5. Immediate Next Steps on Destination PC

1. Open `AI BenchMate` in Google Antigravity (`File -> Open Folder`) and ask Antigravity to read `GEMINI.md`, `docs/HANDOFF.md`, and `docs/PROMPT_HISTORY.md`.
2. In AI BenchMate (`1. Setup & Pre-flight` or `2. Benchmarks`), click **`Scan \models\ Folder`** and select your LM Studio `models` directory (`C:\Users\<Username>\.lmstudio\models`) to detect existing `.gguf` models, OR skip straight to Setup Card **`03`** to auto-scan and download any missing parity `.gguf` files.
3. Follow the live **Server / Terminal Action** badges on each Benchmark Suite Card (`01` through `06B`).

## Verification Baseline (2026-11-17)

- `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: **passed (exit 0)**
- `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules): **passed (exit 0)**
- `node scripts\verify-benchmate.mjs`: **`ALL AI BENCHMATE VERIFICATION CHECKS PASSED (11/11)` (exit 0)**
