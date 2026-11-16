# AI BenchMate — Prompt & Decision History

This file records the chronological conversation prompts, technical decisions, and implementation milestones so any future session or PC has full context.

---

## Entry 1 — 2026-11-14 (Initial Setup & Continuity Prep)

### User Request
- Ensure the conversation and project are well documented inside the workspace so files can be copy-pasted to another PC with other Google Antigravity projects.
- Prepare a GitHub repository for the upcoming **AI BenchMate** tool.
- Advise which applications need to be installed on this laptop before sending the main prompt for **AI BenchMate**.

### Environment Checks Performed
- Checked `c:\Users\GadgetPilipinas\Documents\AI BenchMate`: empty workspace.
- Checked installed CLI tools:
  - Installed: `winget`, `Python 3.15.0` (`py`), `.NET SDK 9.0.310` (`dotnet`).
  - Missing: `git`, `gh`, `node`, `npm`, `uv`, `cargo`, GitHub Desktop.

### Files Created
- `GEMINI.md` — Antigravity workspace instructions enforcing continuous documentation updates.
- `README.md` — Project overview and cross-PC transfer quickstart.
- `docs/HANDOFF.md` — Living handoff doc with environment snapshot, copy-paste/GitHub instructions, and architecture log.
- `docs/PROMPT_HISTORY.md` — This chronological prompt and milestone log.
- `.gitignore` — Multi-stack ignore rules keeping documentation and source tracked while excluding secrets/build artifacts.

### Pending
- Installation of `Git` and `GitHub CLI` (plus optional stack-specific tools) on this laptop.
- Git initialization (`git init`), initial commit, and GitHub repository creation (`gh repo create`).
- Receiving the user's **AI BenchMate** build prompt.

---

## Entry 2 — 2026-11-14 (Strict Single-Folder Portability Requirement)

### User Request
- Require that all project files, documentation, plans, and conversation-related materials live strictly inside `C:\Users\GadgetPilipinas\Documents\AI BenchMate` so transferring to another PC is a single folder copy-paste.

### Decisions & Updates Made
- Added the **Strict Single-Folder Portability Rule** to `GEMINI.md` requiring all code, `docs/plans/`, walkthroughs, scratch scripts, and prompt/response logs to stay inside `C:\Users\GadgetPilipinas\Documents\AI BenchMate` without relying on `.gemini` or any external paths.
- Updated `README.md` and `docs/HANDOFF.md` to remove external `.gemini` brain folder references and document the self-contained internal layout (`GEMINI.md`, `docs/HANDOFF.md`, `docs/PROMPT_HISTORY.md`, `docs/plans/`).

---

## Entry 3 — 2026-11-14 (Ultra-Low-Overhead Stack Selection)

### User Request
- Confirm the best technology stack for **AI BenchMate** given a critical requirement: the app must be as lightweight as possible and consume minimal system resources because it stays open while the PC is running benchmarks.

### Stack Analysis & Recommendation
- **Recommended (#1): Native .NET 9 Desktop App (C# WPF with `RenderMode.SoftwareOnly` option, or WinForms)**
  - Already installed on this laptop (`.NET SDK 9.0.310`) — no extra runtime/SDK installs required.
  - `0.0%` idle CPU, ~20–45 MB RAM, and optional software-only rendering (`RenderMode.SoftwareOnly`) so it touches **0 MB of GPU VRAM** and avoids interfering with GPU/NPU/gaming benchmarks.
  - Can be published as a portable single-file `.exe` to run cleanly on any test rig.
- **Alternative (#2): Python 3.15 + Tkinter (`tkinter`)**
  - Also already installed on this laptop (~30–45 MB RAM, Win32 GDI with 0 GPU usage), suitable if the tool is primarily Python-driven, though `.NET 9` delivers a cleaner native Windows UI and standalone `.exe`.
- **Not Recommended: Electron / Tauri (WebView2)**
  - Browser-based shells spawn Chromium/Edge renderer processes that consume 100–300+ MB RAM and allocate GPU/D3D VRAM contexts, risking benchmark score interference.

---

## Entry 4 — 2026-11-14 (Git & GitHub CLI Installed; Local Repo Initialized)

### User Update
- Confirmed both **Git** and **GitHub CLI** are installed on the laptop.

### Actions & Verification
- Verified `git version 2.56.0.windows.4` and `gh version 2.104.0 (2026-11-12)`.
- Checked `gh auth status`: not yet signed in (`gh auth login` needed before creating remote GitHub repository).
- Initialized local Git repository on branch `main` inside `C:\Users\GadgetPilipinas\Documents\AI BenchMate` and staged all documentation files.

---

## Entry 5 — 2026-11-14 (Public GitHub Repo Created & Stack Decision Deferred)

### User Request
- Set GitHub repository visibility to **public**.
- Hold off on finalizing the `.NET` tech stack decision—analyze requirements first once the full **AI BenchMate** prompt is provided.

### Actions & Verification
- Verified GitHub CLI authentication as `grantsor`.
- Updated documentation to defer tech stack selection until analyzing the upcoming specification prompt.
- Created public GitHub repository `https://github.com/grantsor/AI-BenchMate` and pushed initial commit on `main`.

---

## Entry 6 — 2026-11-14 (Full Specification Received & Optimization Proposal Prepared)

### User Request
- Execute the specification in `AI Benchmate Prompt.md` using `DGX Spark vs Radeon AI Pro 9700 — AI Benchmarks & Inference.md` and `DGX Spark Setup & Hermes Server Guide.md` as references.
- Suggest any unclear points or optimizations first and wait for user opinions/approval before proceeding with implementation.

### Actions & Documentation Updates
- Copied all 3 reference markdown files into `docs/references/` so the workspace remains 100% self-contained inside `C:\Users\GadgetPilipinas\Documents\AI BenchMate`.
- Authored [docs/plans/2026-11-14-ai-benchmate-proposal.md](../plans/2026-11-14-ai-benchmate-proposal.md) detailing 6 optimization recommendations (Zero-Server Static Web App architecture with `file://` folder-audit fallback, Benchmark Stealth Mode, `--alias` parity in `llama-server`, reference model/path presets without hardcoded usernames, DGX Spark `start-ai`/Hermes stop-restore integration, and optional demo comparison dataset) and awaiting user approval.

---

## Entry 7 — 2026-11-14 (Dual Editions Built & Published to Two GitHub Repos)

### User Approval & Decisions
- **#1 Build Both Editions & 2 GitHub Repos:** Build Option 1A (Portable Zero-Server Static Edition) AND Option 1B (React + Vite Edition), publishing to two separate GitHub repositories.
- **#2 Option 2A Unified Toggle + Universal Persistence:** Single "Pause Animations" toggle (disabling motion + GPU blurs/shadows) and automatically remember every configurable setting, choice, and option across sessions (`localStorage` + `IndexedDB`).
- **#3 Approved All Optimizations:** `--alias` parity in `llama-server`, pre-loaded model chips, DGX/Hermes `start-ai` & fixes, and Sample Dataset toggle in Results & Charts.

### Implementation & Verification
- Built **Portable Edition** under `portable/` (`index.html`, `css/styles.css`, `js/benchmate-data.js`, `js/benchmate-engine.js`, `js/benchmate-ui.js`, `launch-local.bat`, `launch-local.sh`, `README.md`).
- Installed Node.js `v26.13.1` LTS and built **React + Vite Edition** in root (`package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`, `src/core/benchmate-data.js`, `src/core/benchmate-engine.js`).
- Published both public GitHub repositories (`AI-BenchMate` and `AI-BenchMate-Portable`).

---

## Entry 8 — 2026-11-14 (`file://` Auto-Redirect & Synchronous Portable Render Fix)

### User Request
- Reported that opening root `file:///C:/Users/GadgetPilipinas/Documents/AI%20BenchMate/index.html` directly in a browser showed a blank white page.

### Root Cause & Fixes Applied
- **Root Cause:** Root [index.html](../../index.html) is the React + Vite source entrypoint (`<script type="module" src="/src/main.jsx"></script>`), which browsers cannot execute over `file://` due to uncompiled JSX and ES module CORS restrictions; the static zero-server edition lives at `portable/index.html`.
- **Root `index.html` Auto-Redirect:** Added a synchronous `<head>` protocol check in [index.html](../../index.html) that automatically redirects `file://` launches (from root `index.html` or `dist/index.html`) to the Portable Edition while keeping the static module entrypoint intact for `vite dev` / `vite build`.
- **Synchronous Portable Render:** Updated [portable/js/benchmate-ui.js](../../portable/js/benchmate-ui.js) (`init()`) to call `renderApp()` synchronously before hydrating optional IndexedDB snapshots (and run immediately if `document.readyState !== "loading"`).
- **Verification:** Re-ran `npm run build` (`32 modules transformed`, `dist/index.html` + `dist/assets/*` emitted cleanly) and `node scripts\verify-benchmate.mjs` (`9/9` checks passed), and pushed updates to both `AI-BenchMate` and `AI-BenchMate-Portable`.

---

## Entry 9 — 2026-11-14 (Minimalist `sparkbench`-Style UI Redesign Across Both Editions)

### User Request
- Reported that the initial UI felt too cluttered and provided two reference `sparkbench` screenshots (`Models` fit table and `Run` minimal layout) requesting a cleaner, less cluttered design while keeping AI BenchMate's own benchmark suites.

### Changes Implemented (Synced 1:1 Across `portable/` and `src/`)
- **Data & Engine (`benchmate-data.js`, `benchmate-engine.js`):**
  - Enriched `QUICK_MODELS` with `quant`, `kind`, and additional reference models (9 models total).
  - Added `computeModelFitRows(state)` (calculates usable GiB budget `0.9 × Tier`, best fitting context window from `256K` down to `4K`, total GiB, and headroom per KV precision) and `buildSelectedSuitesPreview(state)` (`selected`, `outstanding`, and `prereqs` modes).
  - Defaulted UI to Light theme (`#F7F9FC` canvas / `#FFFFFF` cards / `#1B5698` accents) with connected folder tabs (`System`, `Models`, `Run`, `Results`, `Remote & Setup`) while keeping Dark Mode, System Theme, Stealth Mode (`Pause Animations`), and legacy `localStorage` tab migration intact.
- **Minimalist Layout (`portable/css/styles.css`, `src/styles.css`, `portable/js/benchmate-ui.js`, `src/App.jsx`):**
  - Removed sidebar rail and multi-card command clutter in favor of single focused workspace cards with flat pill headers (`platform`, `memory`, `binding`, `localhost only · publishes nothing`).
  - Built the **Models** fit table with Tier/KV controls + clickable model selection and custom `.gguf` input.
  - Built the **Run** tab with the left-bordered Outstanding callout rows, inline suite checkboxes (`agentperf`, `aiperf`, `aiperf-64k`, `llama-bench`, `llama-benchy`, `llmperf`, `speed-bench`), collapsible `Customize parameters` drawer, guardrail banners, and a single dark terminal command preview box.
  - Streamlined **Results** (audit table + toggleable charts/exports) and **Remote & Setup** (pill switcher + single terminal box).

---

### Entry 10 — Uncluttered 3-Tab Unified Benchmark Cards & Tested-Models-Only Cleanup (2026-11-14)
- **User Prompt Summary:**
  - Rejected the 5-tab split (`System`, `Models`, `Run`, `Results`, `Remote & Setup`) because switching tabs added extra clicks, suite checkboxes combined commands across benchmarks, UI text/checkboxes were still too verbose, and unnecessary predetermined models/presets were present. Requested keeping only the tested models from `DGX Spark vs Radeon AI Pro 9700 — AI Benchmarks & Inference.md` while retaining the ability for users to add custom models/presets later.
- **Design & Implementation Changes (Synced 1:1 Across `portable/` and Root React+Vite `src/`):**
  - **Clean 3-Tab Navigation (`Benchmarks`, `Results & Audit`, `SSH & Setup`):**
    - Updated default `ui.activeTab` to `"benchmarks"` (`ui.showPathsAndNaming: false`) with automatic legacy migration in `loadState()` (`builder`/`run`/`models`/`system` -> `"benchmarks"`, `coverage` -> `"results"`, `ssh`/`remote`/`setup` -> `"ssh"`).
    - **`Benchmarks` Tab:** Unified single-screen workflow with compact Platform/Backend/VRAM/Model bar, collapsible `Paths & Naming` drawer (with user `+ Save Preset` and `Reset Parity Defaults`), `.gguf` path input + `+ Add Model`, conditional guardrail banners, and 7 independent suite cards (`01 llama-bench` .. `06B AIPerf 64k Sweep`) each rendering separate Terminal 1 (Server) + Terminal 2 (Client) boxes and collapsed `Parameters ▾` drawers—never combined via checkboxes—plus bottom Full Playbook copy/download footer.
    - **`Results & Audit` Tab & `SSH & Setup` Tab:** Clean layout without verbose card blurbs, niche toggles, or extra navigation clicks.
  - **Only the 2 Tested Models in `QUICK_MODELS`:** Trimmed `QUICK_MODELS` in both `src/core/benchmate-data.js` and `portable/js/benchmate-data.js` exclusively to `Qwen3.8-27B` (`qwen38_27b`) and `Qwen3.6-35B-A3B` (`qwen36_35b_moe`), removing all other predetermined models.
- **Files Modified:**
  - `src/core/benchmate-data.js`, `portable/js/benchmate-data.js`
  - `src/core/benchmate-engine.js`, `portable/js/benchmate-engine.js`
  - `src/styles.css`, `portable/css/styles.css`
  - `portable/js/benchmate-ui.js`, `src/App.jsx`
  - `docs/HANDOFF.md`, `docs/PROMPT_HISTORY.md`
- **Verification Results:**
  - `node --check` on `portable/js/benchmate-data.js`, `benchmate-engine.js`, `benchmate-ui.js`: exit 0
  - Node `vm` + ESM verification (`VERIFIED_UI_AND_DATA_CHECKS_PASSED`): verified 2 models only, `activeTab: "benchmarks"`, legacy tab mapping, 7 separate suite cards without suite checkboxes, 3 tabs rendering, and `+ Add Model` custom chip persistence.
  - Vite production build (`npm-cli.js run build`): 32 modules transformed in 467ms.
  - Parity & regression suite (`node scripts\verify-benchmate.mjs`): `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (9/9)`.


---

### Entry 11 — Setup-First Tab Order, Pre-flight Verification, Strict Platform Filtering, Expanded Guardrails & Results Cleanup (2026-11-14)
- **User Prompt Summary:**
  - Asked where environment/dependency verification (Python venvs, packages, `.gguf` model discovery, binaries) lived and why setup came last instead of first.
  - Reported seeing unrelated DGX Spark commands while RTX Spark Win-ARM64 was selected.
  - Requested double-checking `AI Benchmate Prompt.md` for missing features, replacing `"Parity"` with `"Default"`, removing Sample Data and decluttering `Results & Audit` tables, making header pills (`platform:`, `vram:`, `model:`) clickable switchers, restoring always-visible parameter guardrails, and eliminating duplicate Copy buttons in benchmark headers.
- **Design & Implementation Changes (Synced 1:1 Across `portable/` and Root React+Vite `src/`):**
  - **1. `1. Setup & Pre-flight` as Tab 1 (`setup` -> `benchmarks` -> `results`):**
    - Updated `default activeTab` to `"setup"` and added legacy tab migration (`ssh`/`setup`/`remote` -> `"setup"`).
    - Added `setup_verify` Pre-flight Verification command card (GPU check via `nvidia-smi`/`amd-smi`, binary/script paths, active `.gguf` check + `.gguf` folder scan, Python & venv checks for `.venv-aiperf` (`llama_benchy`, `aiperf`, `ray`), `llmperf/token_benchmark_ray.py`, and `.venv-agentperf` (`agentperf-local`), plus port `8080` status) and included `aa-agentperf-local` install in `setup_env`.
    - Added a `00 · Pre-flight Check` banner on `2. Benchmarks` linking back to Tab 1.
  - **2. Strict Platform Filtering on `1. Setup & Pre-flight`:**
    - Gated `setup_hermes_dgx` (`/models` symlink + Ollama override) and the DGX SSH/`tmux`/`scp`/`start-ai` section strictly to `profile.id === "dgx_spark_linux_arm64"`, eliminating all unrelated Linux/DGX commands when Windows profiles are selected.
  - **3. Prompt Parity & `"Default"` Terminology:**
    - Replaced `"Parity"` with `"Default"` across UI labels/buttons (`Default Settings`, `Reset to Defaults`, `Reset to Default`, `Auto (Classic on Default, Stamped on Edit)`).
    - Added missing prompt controls: `03 llmperf` quick workload presets (`Default (1024 in / 256 out)` vs `Fast (512 in / 128 out)`), `04 SPEED-Bench` quick context selector (`16K`/`32K`/`64K`/`Custom`) synced with Server `-c`, AMD `Enable -fa 1 on Vulkan` checkbox (`amdEnableFa`), and `Missing / Incomplete Runs Only` playbook export toggle.
  - **4. Interactive Header Pills, Guardrails, Single Copy Buttons & Results Cleanup:**
    - Converted header `platform:`, `vram:`, and `model:` badges into clickable `<select class="sb-pill-select">` controls.
    - Rendered `.guardrails-wrap` unconditionally above suite cards (`sb-banner-ok` summary when valid; expanded 8-check `evaluateGuardrails()` warnings + 1-click Auto-Fix buttons when invalid).
    - Removed duplicate Copy buttons from `.suite-card-header`, leaving a single Copy button inside each terminal bar.
    - Removed Sample Data buttons/rows from `3. Results & Audit`, simplified the Audit table to 3 columns (`Benchmark`, `Expected Output`, `Status`) with collapsible `Terminal Audit Script`, and formatted the Comparison table to 6 columns (`Benchmark`, `Platform`, `Model`, `Headline Throughput`, `Latency / Details`, `File`).
- **Files Modified:**
  - `src/core/benchmate-data.js`, `portable/js/benchmate-data.js`
  - `src/core/benchmate-engine.js`, `portable/js/benchmate-engine.js`
  - `src/styles.css`, `portable/css/styles.css`
  - `portable/js/benchmate-ui.js`, `src/App.jsx`
  - `docs/HANDOFF.md`, `docs/PROMPT_HISTORY.md`
- **Verification Results:**
  - `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: exit 0
  - `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules, 470ms): exit 0
  - `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (9/9)`
  - Extended ESM + Node `vm` UI/engine verification (`EXTENDED UI + ENGINE VERIFICATION PASSED (ALL CHECKS OK)`): verified tab order, strict Windows vs DGX Setup filtering, interactive header pills, all 8 guardrails, `Default` terminology, single Copy buttons per terminal bar, `Missing / Incomplete Runs Only` playbook toggle, AMD `-fa 1` toggle, and sample-free `Results & Audit`.

---

### Entry 12 — Chat-History Troubleshooting Fixes & First-Setup Automation Across All 4 Hardware Profiles (2026-11-16)
- **User Prompt Summary:**
  - Provided `ai_benchmarks_ai_benchmate_chat_history.md` (alongside `dgx_spark_setup_server_chat_history.md` and earlier reference guides) containing the 1:1 troubleshooting history from benchmarking DGX Spark and Radeon AI Pro R9700 and preparing RTX Spark (Windows ARM64) and NVIDIA GPUs (Windows x64).
  - Requested analyzing all troubleshooting steps (Python version constraints, venv setups, binary/repo/model preparation, and per-model/per-hardware command flags) in comparison with our app first, and upon approval (`"ok proceed"`), applying all 10 improvements across the app.
- **Design & Implementation Changes (Synced 1:1 Across `portable/` and Root React+Vite `src/`):**
  - **1. Python 3.12 Pinning & Windows ARM64 Wheel Compatibility (`setup_env`):**
    - Windows profiles now verify/install `Python.Python.3.12` via `winget` (using `--architecture x64` on `rtx_spark_win_arm64` so `ray`/`llmperf` and `aiperf` install from pre-built `win_amd64` wheels without C++ compiler failures) and prefer `py -3.12` (fallback `py -3.11`) when creating `.venv-aiperf` and `.venv-agentperf`.
  - **2. Added `02 · Install / Build llama.cpp & SPEED-Bench Repo` (`setup_llamacpp`) & `04 · Download / Verify Benchmark GGUF Models` (`setup_models`):**
    - `setup_llamacpp` clones `https://github.com/ggml-org/llama.cpp.git` (ensuring `tools/server/bench/speed-bench/speed_bench.py` exists) and builds CUDA binaries on DGX Spark or verifies binaries on Windows.
    - `setup_models` uses Python's `huggingface_hub.hf_hub_download` directly inside `.venv-aiperf` to download `Qwen3.8-27B-UD-Q4_K_M.gguf` and `Qwen3.6-35B-A3B-UD-Q4_K_M.gguf` without `hf` CLI PATH errors or `transformers` version conflicts.
  - **3. Idempotent Venv & `llmperf` Setup (`setup_env`):**
    - Upgrades `pip setuptools wheel`, guards `git clone llmperf` with directory existence checks, strips `<3.11` from both `pyproject.toml` and `setup.py`, installs `llmperf` and `llama-benchy` before `aiperf`, and adds `pip install "aiperf[tdigest]" || pip install aiperf` fallback on Linux ARM64.
  - **4. Engine & Parser Fixes (`buildServerCommand`, `buildSuiteClientCommand`, `getClientModelArg`, `getOutputTarget`, `parseResultFile`, `auditFileList`):**
    - Fixed `getClientModelArg()` case-sensitivity bug (`"fullPath"` vs `"fullpath"`).
    - Updated `parseResultFile()` and `auditFileList()` to parse `SPEED-Bench` `"results"` when formatted as a JSON `Array` (fixing the `'list' object has no attribute 'keys'` issue from Chat 2).
    - Updated `getOutputTarget()` in Classic mode to output `speedbench_<slug>_ctx64k.json` when `SPEED-Bench` `-c >= 65536`, and added 1-click comparator preset chips (`Dense vs MoE` and `Standard vs 64K`) in the `04 SPEED-Bench` drawer.
    - Pre-stopped existing `llama-server` processes in Terminal 1 (`buildServerCommand()`) to prevent port `8080` conflicts when switching suites/models, and added `cd "${benchRoot}/llmperf"` / `Set-Location` to `03 llmperf`.
    - Hardened DGX Spark `vramSweep` (`sudo systemctl stop ollama`, `lms server stop`) and `setup_hermes_dgx` (safe directory migration before `ln -sfn`, `${SUDO_USER:-$USER}` in systemd override, and sudo-free `~/.local/bin/stop-ai` creation).
  - **5. Archived Reference Chat Histories:**
    - Copied `ai_benchmarks_ai_benchmate_chat_history.md` and `dgx_spark_setup_server_chat_history.md` into `docs/references/`.
- **Files Modified / Added:**
  - `src/core/benchmate-engine.js`, `portable/js/benchmate-engine.js`
  - `src/App.jsx`, `portable/js/benchmate-ui.js`
  - `docs/references/ai_benchmarks_ai_benchmate_chat_history.md`, `docs/references/dgx_spark_setup_server_chat_history.md`
  - `docs/HANDOFF.md`, `docs/PROMPT_HISTORY.md`
- **Verification Results:**
  - `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: exit 0
  - `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules, 821ms): exit 0
  - `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (9/9)`
  - Extended chat-history verification suite: `ALL 10 CHAT-HISTORY TROUBLESHOOTING & PARITY CHECKS PASSED` (exit 0)

---

### Entry 13 — Interactive Hover Tooltip Popups (Checkboxes, Titles & Parameters) & Default Results Folder Visibility (2026-11-16)
- **User Prompt Summary:**
  - Requested hover tooltip popups on all checkboxes explaining what each option does and its default/recommended setting (when to turn it on or off).
  - Requested hover tooltip popups on card/suite/section titles showing their descriptions.
  - Asked where the default benchmark results folder (`Results Dir`) is stated in the app, and requested removing the redundant `Select Files` button in `Results & Audit` so only `Select Folder` remains.
  - Requested hover tooltip popups on all benchmark parameters (e.g. `-ngl`, `-fa`, `Server -c`, `-ctk`, etc.) showing meaning, description, and default/recommended values.
- **Design & Implementation Changes (Synced 1:1 Across `portable/` and Root React+Vite `src/`):**
  - **1. Structured `HELP_TOOLTIPS` & Floating Tooltip Popup (`#sb-floating-tooltip`):**
    - Added 65+ structured tooltip entries (`{ title, desc, rec }`) in `src/core/benchmate-data.js` and `portable/js/benchmate-data.js` covering all 8 checkboxes, all 7 benchmark suite titles, all 11 setup/SSH card titles, section headers, hardware/path/model/SSH fields, preset chips, and all 30+ benchmark suite parameters.
    - Implemented viewport-aware `#sb-floating-tooltip` on `mouseover`/`mouseout` of `[data-tip]` elements in `portable/js/benchmate-ui.js`, `src/App.jsx`, `portable/css/styles.css`, and `src/styles.css`.
  - **2. Default Benchmark Results Folder (`Results Dir`) Surfaced Across All 3 Tabs & Single `Select Folder` Button:**
    - Added `Results Dir (Benchmark Outputs)` to the top path grid in `1. Setup & Pre-flight`.
    - Added `Results Dir` inline next to `Model (.gguf)` in `2. Benchmarks`.
    - Added a `Default Results Folder:` bar (`state.hardware.resultsDir` + `Copy Path` button) in `3. Results & Audit` and removed the redundant `Select Files` button from `Results Folder Audit` (leaving only `Select Folder`).
- **Files Modified:**
  - `src/core/benchmate-data.js`, `portable/js/benchmate-data.js`
  - `src/styles.css`, `portable/css/styles.css`
  - `portable/js/benchmate-ui.js`, `src/App.jsx`
  - `docs/HANDOFF.md`, `docs/PROMPT_HISTORY.md`
- **Verification Results:**
  - `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: exit 0
  - `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules, 670ms): exit 0
  - `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (9/9)`
  - Tooltip & Results Dir verification suite: `ALL TOOLTIP POPUPS & RESULTS DIR VISIBILITY CHECKS PASSED` (exit 0)


---

## Entry 14 — Zero-Error From-Scratch Setup Cards (Auto-Git, VC++ Runtime, Auto-Binaries & Dependency Ordering) (2026-11-16)

### User Prompt Summary
- While testing the app on a brand-new **RTX Spark laptop** (`rtx_spark_win_arm64`), the user pasted Setup Card 01 without issue, then pasted Setup Card 02 (`git clone https://github.com/ggml-org/llama.cpp.git ...`) and hit:
  `git : The term 'git' is not recognized as the name of a cmdlet, function, script file, or operable program.`
- Requested:
  1. Cover `git` installation and `$env:Path` refresh directly in the setup process so commands run from scratch on a clean machine without error.
  2. Review and improve the proposed Git install/PATH snippet (`$env:Path = ...; if (-not (Get-Command git -ErrorAction SilentlyContinue)) { winget install --id Git.Git ... }`) and apply improvements across all 4 hardware profiles (`dgx_spark_linux_arm64`, `rtx_spark_win_arm64`, `nvidia_win_x64`, `amd_win_x64`).
  3. Ensure the order of terminal commands across the setup process (`01` -> `02` -> `03` -> `04` -> `05` -> `06` / `07`) and client benchmark commands (`2. Benchmarks`) is dependency-safe and won't fail due to missing tools, missing pre-built `llama.cpp` binaries, missing VC++ Redistributable (`vcruntime140.dll`), or unrefreshed `PATH` variables.

### Key Changes & Files Modified
1. **Improved `$env:Path` Refresh & Automatic `Git.Git` + VC++ Runtime + Official Pre-Built Binary Provisioning (`src/core/benchmate-engine.js`, `portable/js/benchmate-engine.js`):**
   - Appended all 3 Windows Git install scopes (`;C:\Program Files\Git\cmd;C:\Program Files (x86)\Git\cmd;$env:LOCALAPPDATA\Programs\Git\cmd`) when refreshing `$env:Path` so both Administrator (`C:\Program Files\Git\cmd`) and non-elevated user-scope (`$env:LOCALAPPDATA\Programs\Git\cmd`) `winget` installs resolve immediately in the active PowerShell session.
   - **Card `01` (`setup_verify`):** Wrapped `git`, `nvidia-smi` / `amd-smi`, and `py` / `python` in `Get-Command ... -ErrorAction SilentlyContinue` (and `command -v` on Linux) so Card 01 never throws `CommandNotFoundException` on a brand-new machine.
   - **Card `02` (`setup_llamacpp`):**
     - Installs `Git.Git` via `winget` if missing and re-refreshes `$env:Path`.
     - Installs `Microsoft.VCRedist.2015+.arm64` + `Microsoft.VCRedist.2015+.x64` (on `rtx_spark_win_arm64`) or `Microsoft.VCRedist.2015+.x64` (on Windows x64) if `vcruntime140.dll` is missing.
     - Clones `llama.cpp` (`--depth 1`) for `speed_bench.py`, with an automatic HTTPS `.zip` fallback (`curl.exe -L` + `Expand-Archive`) if `git` is unavailable.
     - Queries `https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=1` and automatically downloads + extracts the matching official pre-built `llama-bench.exe`, `llama-server.exe`, and `cudart` / backend DLLs into `${binDir}` (`arm64` CUDA+`cudart` for `rtx_spark_win_arm64`, `x64` CUDA+`cudart` for `nvidia_win_x64`, `vulkan-x64` or `rocm-*-x64` for `amd_win_x64`).
   - **Card `03` (`setup_env`):**
     - Includes its own `Git.Git` check + `$env:Path` refresh so it works even if run before Card 02.
     - Checks explicit filesystem paths (`$env:LOCALAPPDATA\Programs\Python\Python312\python.exe`, `C:\Program Files\Python312\python.exe`, `Python311`) so it never throws `CommandNotFoundException` if `py.exe` is absent, installs `Python.Python.3.12` via `winget` (`--architecture x64` on `rtx_spark_win_arm64`), and re-resolves `$foundPy` directly from disk.
     - Invokes `& "$venvPy" -m pip install` directly (including `requests tqdm tabulate huggingface_hub` required by `speed_bench.py`) and includes an HTTPS `.zip` fallback for `llmperf`.
   - **Card `04` (`setup_models`):**
     - Creates target directories first and uses `.venv-aiperf` `hf_hub_download` if available, with an automatic resumable `curl.exe -L -C -` (Windows) / `wget -c` (Linux) fallback if run before Card 03.
   - **Benchmark Client Commands (`buildSuiteClientCommand`):**
     - Prepends `${benchRoot}\.venv-aiperf\Scripts;` (and `.venv-agentperf\Scripts;`) + refreshed Machine/User `PATH` (`export PATH="${benchRoot}/.venv-aiperf/bin:$HOME/.local/bin:$PATH"` on Linux) before `Activate.ps1` / `activate`.
2. **Verification Suite (`scripts/verify-benchmate.mjs`):**
   - Added Check #10 verifying 1:1 setup card & client command parity and scratch-setup dependency safety across all 4 hardware profiles (`ALL AI BENCHMATE VERIFICATION CHECKS PASSED (10/10)`).

### Verification Results
- `node --check portable/js/benchmate-data.js`: exit 0
- `node --check portable/js/benchmate-engine.js`: exit 0
- `node --check portable/js/benchmate-ui.js`: exit 0
- `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build`: exit 0 (`32 modules transformed`, built in `849ms`)
- `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (10/10)` (exit 0)
