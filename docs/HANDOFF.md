# AI BenchMate — Cross-PC Handoff & Context Document

**Last Updated:** 2026-11-16  
**Current Phase:** Action-First Setup Card Ordering (`01` Engine -> `02` Python/Venvs -> `03` Models -> `04` Self-Healing Verify), Auto-Binary Provisioning & Hover Tooltips (Ready & Pushed)

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
  - **Action-First From-Scratch Setup Cards (`01` → `07`) — Zero Passive `[ACTION NEEDED]` Checks:**
    - **Card `01 · Install & Verify Git, VC++ Runtime, llama.cpp Binaries & SPEED-Bench` (`setup_llamacpp`):** Runs FIRST. Refreshes `$env:Path` across all 3 Git install scopes (`C:\Program Files\Git\cmd`, `C:\Program Files (x86)\Git\cmd`, `$env:LOCALAPPDATA\Programs\Git\cmd`), auto-installs `Git.Git` and Microsoft VC++ Redistributable (`vcruntime140.dll`) via `winget`, clones `llama.cpp` (`speed_bench.py`) with HTTPS `.zip` fallback, and automatically queries `https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=1` (`-Headers @{"User-Agent"="ai-benchmate"}`) to download and extract `llama-bench.exe`, `llama-server.exe`, and `ggml-cuda.dll` / `cudart` / Vulkan / ROCm DLLs into `${binDir}` via fast `tar.exe -xf` (or `Expand-Archive` fallback).
    - **Card `02 · Install & Verify Python 3.12, Venvs & Benchmark Suites` (`setup_env`):** Runs SECOND. Auto-installs `Python.Python.3.12` via `winget` (`--architecture x64` on `rtx_spark_win_arm64`), creates `.venv-aiperf` & `.venv-agentperf`, clones & patches `llmperf` (`<3.11` stripped), and installs `llama-benchy`, `aiperf` (with automatic fallback to base `aiperf` if `crick` C++ build tools are absent), and `aa-agentperf-local`.
    - **Card `03 · Download & Verify Benchmark GGUF Models` (`setup_models`):** Runs THIRD. Creates target model folders and automatically downloads `Qwen3.8-27B-UD-Q4_K_M.gguf` and `Qwen3.6-35B-A3B-UD-Q4_K_M.gguf` via `.venv-aiperf` `hf_hub_download` (or resumable `curl.exe -L -C -` / `wget -c` fallback).
    - **Card `04 · Complete Pre-Flight Verification & Self-Healing Check` (`setup_verify`):** Runs FOURTH. Verifies GPU, Git, `llama-bench`, `llama-server`, `speed_bench.py`, `.gguf` models, and venv packages—and automatically installs/downloads any missing Git, repo, or release binary on the spot, clears `~/.cache/llama-benchy`, and checks port `8080`.
  - **Interactive Hover Tooltip Popups (`HELP_TOOLTIPS` + `#sb-floating-tooltip`):** Instant multi-line floating tooltip popups on all checkboxes, card/suite/section titles, hardware/path/model/SSH fields, and every benchmark parameter (`-ngl`, `-fa`, `Server -c`, `-ctk`, `--pp`, `--depth`, `--isl`, etc.) showing meaning, description, and default/recommended values.
  - **Always-Visible `Results Dir` (Default Benchmark Results Folder):** Displayed and editable in the top grid on `1. Setup & Pre-flight`, in `.config-model-row` on `2. Benchmarks`, and as a `Default Results Folder:` bar (with 1-click `Copy Path`) in `3. Results & Audit` alongside the single `Select Folder` button.
  - Interactive top header pills (`platform:`, `vram:`, `model:`) as `<select>` switchers synced across tabs.
  - Proactive always-visible Guardrails bar (`sb-banner-ok` when valid, 8-check validation + 1-click Auto-Fix when invalid).
  - Universal persistence (`localStorage` + `IndexedDB`) remembering all parameters, custom models, custom presets, UI drawer toggles, and active tab.
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

1. Pull the latest repo (or copy the updated folder) to your RTX Spark laptop, open `portable/index.html` (or run `npm.cmd run dev`), and run Cards `01` → `02` → `03` → `04` on `1. Setup & Pre-flight` (or click `Copy Setup Playbook` to run all setup steps in one go).
2. Execute your benchmark runs on `2. Benchmarks` and audit outputs in `3. Results & Audit`.

## Latest Update (2026-11-16) — Action-First Setup Card Ordering (`01` → `04`) & Fast `tar.exe` Binary Provisioning

- **Eliminated Passive `[ACTION NEEDED]` / Check-Only First Step:**
  - Reordered `buildSetupCards()` so installation actions happen FIRST (`01 · Install & Verify Git, VC++ Runtime, llama.cpp Binaries & SPEED-Bench` → `02 · Install & Verify Python 3.12, Venvs & Benchmark Suites` → `03 · Download & Verify Benchmark GGUF Models` → `04 · Complete Pre-Flight Verification & Self-Healing Check`).
  - Added `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`, `$ProgressPreference = 'SilentlyContinue'`, `-Headers @{"User-Agent"="ai-benchmate"}`, and fast `tar.exe -xf` extraction (with `Expand-Archive` fallback) to automatically download and extract `llama-bench.exe`, `llama-server.exe`, `ggml-cuda.dll` (`ggml-vulkan.dll` / `ggml-hip.dll`), and `cudart` DLLs directly into `C:\llama.cpp\cuda`.
- **Last Verified State:**
  - `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: exit 0
  - `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules, 658ms): exit 0
  - `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (10/10)`
