# AI BenchMate — Cross-PC Handoff & Context Document

**Last Updated:** 2026-11-16  
**Current Phase:** Portable Windows LM Studio Default Pathing (`$env:USERPROFILE\.lmstudio\models`), Dual-Route Model Folder Scanner + Single-File Picker, Smart Card `03` Conditional Download & Model Discovery Notifications (Ready & Pushed)

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
- `docs/plans/` — Implementation plans, walkthroughs, & design specs
- `docs/references/` — All reference prompts, parity guides, and full chat histories

### Method B: GitHub Transfer (Once Repo Is Pushed)
1. On this laptop: initialize git, commit, create the GitHub repo, and push.
2. On the other PC: `git clone <repo-url>` and open the folder in Google Antigravity.

---

## 3. Source Laptop Environment Snapshot (Checked 2026-11-16)

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
  - **Portable LM Studio Windows Default Pathing & Dual-Route Model Discovery (`$env:USERPROFILE\.lmstudio\models`):**
    - All Windows hardware profiles (`rtx_spark_win_arm64`, `nvidia_win_x64`, `amd_win_x64`) default `defaultModelsDir` and `hardware.modelsDir` to portable **`$env:USERPROFILE\.lmstudio\models`** (never hardcoding any PC username; legacy `$HOME\.lmstudio\models` or nested paths migrate cleanly in `loadState`).
    - **Route 1 (Recommended — `Scan \models\ Folder`):** Recursively scans any pointed LM Studio `\models\` directory via `<input webkitdirectory>` (`scanModelFolderEntries`) over both `file://` and HTTP, ignoring non-LLM helpers (`mmproj-*`, `mtp-*`, `projector*`, `draft*`), grouping multi-part split GGUFs (`-00001-of-0000N.gguf`), matching `Qwen3.8-27B` and `Qwen3.6-35B-A3B` across publishers (`unsloth`, `lmstudio-community`, etc.) and quant variants, and integrating ALL discovered `.gguf` models directly into the model chips, header dropdown, and VRAM Fit estimator.
    - **Route 2 (`Select .gguf File` / Smart Paste):** Pick any specific `.gguf` file via `resolvePickedModelFile` or paste Explorer paths with surrounding quotes (`cleanUserPath`, `inferModelsRootFromInput`, `reRootModelPath`), automatically extracting `modelsDir` when a `\models\` folder or nested `.gguf` path is pasted without corrupting `baseDir`.
    - **Live Model Discovery Status Banner (`[FOUND]` / `[PARTIAL]` / `[NOT FOUND]`):** Clearly notifies which parity and custom GGUFs were found or missing, with one-click navigation to **Setup Card `03`** (`setup_models`) when any default model needs downloading.
    - **Setup Card `03` Conditional Pre-Scan & Download:** Automatically inspects `.lmstudio\settings.json` (`downloadsFolder`) and recursively scans `$modelRoot` for runnable `.gguf` files (>500 MB) BEFORE downloading, printing `[FOUND]` for existing models and downloading only missing parity GGUFs.
  - **Live Server & Terminal Lifecycle Guidance (`getServerLifecycleInfo`):**
    - Displays a top **Terminal & Server Lifecycle Guide** banner in `2. Benchmarks` plus live color-coded **Server Action Badges** and instruction bars on every Benchmark Suite Card (`01` through `06B`).
    - Dynamically compares each suite's live `llama-server` configuration signature (`getServerConfigSignature`) so customizing any server parameter automatically updates whether Terminal 1 can be reused or must be stopped (`Ctrl+C`) and relaunched.
    - Suite `01 · Native C++ llama-bench` automatically prepends `Stop-Process -Name "llama-server"` / `pkill -f "llama-server"` so it never runs while a background server is holding VRAM.
  - **Action-First From-Scratch Setup Cards (`01` → `07`) — Zero Passive `[ACTION NEEDED]` Checks:**
    - **Card `01 · setup_llamacpp`:** Auto-installs `Git.Git`, VC++ Redistributable, clones `llama.cpp`, and downloads pre-built `llama-bench` / `llama-server` binaries into `${binDir}`.
    - **Card `02 · setup_env`:** Auto-installs Python 3.12, `.venv-aiperf` (`llmperf`, `aiperf`, `llama-benchy`), and `.venv-agentperf` (`agentperf-local`).
    - **Card `03 · setup_models`:** Reads `.lmstudio\settings.json`, scans recursively for existing GGUFs, and downloads only missing parity models (`Qwen3.8-27B` / `Qwen3.6-35B-A3B`).
    - **Card `04 · setup_verify`:** Self-healing pre-flight check using `modelsDir` + recursive fallback lookup.
  - **Interactive Hover Tooltip Popups (`HELP_TOOLTIPS` + `#sb-floating-tooltip`):** Instant multi-line floating tooltip popups on all checkboxes, card/suite/section titles, hardware/path/model/SSH fields, and every benchmark parameter.
  - **Always-Visible `Results Dir` (Default Benchmark Results Folder):** Displayed and editable across all 3 tabs alongside the single `Select Folder` button in `3. Results & Audit`.
  - Interactive top header pills (`platform:`, `vram:`, `model:`), always-visible Guardrails bar, and universal `localStorage` + `IndexedDB` persistence.
- **Reference Docs Archived Inside Repo (`docs/references/`):**
  - `docs/references/AI Benchmate Prompt.md`
  - `docs/references/DGX Spark vs Radeon AI Pro 9700 — AI Benchmarks & Inference.md`
  - `docs/references/DGX Spark Setup & Hermes Server Guide.md`
  - `docs/references/ai_benchmarks_ai_benchmate_chat_history.md`
  - `docs/references/dgx_spark_setup_server_chat_history.md`
- **Proposal Document:** `docs/plans/2026-11-14-ai-benchmate-proposal.md`
- **GitHub Repositories:**
  - Main (React + Vite + Portable + Docs): `https://github.com/grantsor/AI-BenchMate` (Public)
  - Standalone Portable Edition: `https://github.com/grantsor/AI-BenchMate-Portable` (Public)

---

## 5. Immediate Next Steps

1. In `1. Setup & Pre-flight` or `2. Benchmarks`, click **`Scan \models\ Folder`** and select your Windows LM Studio `models` directory (`C:\Users\<Username>\.lmstudio\models`) to verify instant detection of your existing GGUF models, OR skip straight to Setup Card **`03`** to auto-scan and download any missing parity `.gguf` files.
2. Follow the live **Server / Terminal Action** badges on each Benchmark Suite Card (`01` through `06B`).

## Latest Update (2026-11-16) — LM Studio Windows Default Paths, Recursive `\models\` Scanner & Smart Card `03` Download

- **Portable LM Studio Windows Default Path:** Changed Windows `defaultModelsDir` from `$HOME\models` to **`$env:USERPROFILE\.lmstudio\models`** across `rtx_spark_win_arm64`, `nvidia_win_x64`, and `amd_win_x64` (`loadState` migrates legacy `$HOME\.lmstudio\models` and repairs accidental double-nested `\unsloth\...\unsloth\...` paths).
- **Dual-Route Model Picker & Recursive Folder Discovery (`Scan \models\ Folder` & `Select .gguf File`):** Added dedicated `hardware.modelsDir`, Explorer quote stripping, `inferModelsRootFromInput`, `reRootModelPath`, `scanModelFolderEntries` (recursive GGUF discovery with `mmproj`/`mtp` filtering and split-shard grouping), `resolvePickedModelFile`, live `[FOUND]`/`[PARTIAL]`/`[NOT FOUND]` banners, and conditional Setup Card `03` pre-scan (`downloadsFolder` + `Get-ChildItem -Recurse`).
- **Last Verified State:**
  - `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: exit 0
  - `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules, 713ms): exit 0
  - `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (11/11)` (exit 0)
