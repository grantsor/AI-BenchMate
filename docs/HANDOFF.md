# AI BenchMate — Cross-PC Handoff & Context Document

**Last Updated:** 2026-11-16  
**Current Phase:** Zero-Error From-Scratch Setup Cards (Auto-Git, VC++ Runtime, Auto-Binaries, Safe PATH Refresh), Hover Tooltips & Results Dir (Ready & Pushed)

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
  - **Zero-Error From-Scratch Setup Cards (`01`–`07`):**
    - **Card `01` (`setup_verify`):** Refreshes `$env:Path` (including system, x86, and user-scope `$env:LOCALAPPDATA\Programs\Git\cmd`), and safely checks `git`, `nvidia-smi`/`amd-smi`, and `py`/`python` using `Get-Command ... -ErrorAction SilentlyContinue` (`command -v` on Linux) so it never throws `CommandNotFoundException` on a fresh machine.
    - **Card `02` (`setup_llamacpp`):** Automatically installs `Git.Git` via `winget` + refreshes `$env:Path` across all 3 Git install locations, installs Microsoft VC++ Redistributable (`Microsoft.VCRedist.2015+.arm64` + `x64` on `rtx_spark_win_arm64`, `x64` on Windows x64) if `vcruntime140.dll` is missing, clones `llama.cpp` with an automatic HTTPS `.zip` archive fallback (`curl.exe -L` + `Expand-Archive`), and automatically queries the official `ggml-org/llama.cpp` GitHub rolling releases API (`releases?per_page=1`) to download and extract `llama-bench.exe`, `llama-server.exe`, and matching `cudart` / backend DLLs into `${binDir}`.
    - **Card `03` (`setup_env`):** Includes its own `Git.Git` check, checks explicit filesystem paths (`$env:LOCALAPPDATA\Programs\Python\Python312\python.exe`, `C:\Program Files\Python312\python.exe`, `Python311`) so it never fails if `py.exe` is missing, installs `Python.Python.3.12` via `winget` (`--architecture x64` on `rtx_spark_win_arm64`), reloads `$env:Path` + `$foundPy`, invokes `& "$venvPy" -m pip install` directly (including `requests tqdm tabulate huggingface_hub` for `speed_bench.py`), clones `llmperf` with an HTTPS `.zip` fallback, patches `pyproject.toml` and `setup.py`, and installs `.venv-agentperf`.
    - **Card `04` (`setup_models`):** Creates target model directories first and uses `.venv-aiperf` `hf_hub_download` if available, with an automatic resumable `curl.exe -L -C -` (Windows) / `wget -c` (Linux) fallback if run before Card 03.
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

1. Open `portable/index.html` (or run `npm.cmd run dev` for the React + Vite edition), run `01 · Pre-flight Check` and `02`–`04` on `1. Setup & Pre-flight`, and execute your benchmark runs on `2. Benchmarks`.
2. When transferring to another PC, either copy-paste `C:\Users\GadgetPilipinas\Documents\AI BenchMate` or `git clone` either GitHub repository.

## Latest Update (2026-11-16) — Zero-Error From-Scratch Setup Cards (`01`–`04`) & Dependency Ordering

- **Fixed `git : The term 'git' is not recognized` & All Fresh-Machine Setup Dependencies:**
  - Upgraded `buildSetupCards()` and `buildSuiteClientCommand()` in both `src/core/benchmate-engine.js` and `portable/js/benchmate-engine.js`.
  - **Card `01` (`setup_verify`):** Added full `$env:Path` refresh (including `;C:\Program Files\Git\cmd;C:\Program Files (x86)\Git\cmd;$env:LOCALAPPDATA\Programs\Git\cmd`) and wrapped `git`, `nvidia-smi`/`amd-smi`, and `py`/`python` in `Get-Command ... -ErrorAction SilentlyContinue` (`command -v` on Linux) so Card 01 never throws `CommandNotFoundException`.
  - **Card `02` (`setup_llamacpp`):** Automatically installs `Git.Git` via `winget` + refreshes `$env:Path` across all 3 Git install scopes, installs Microsoft VC++ Redistributable (`vcruntime140.dll`), clones `llama.cpp` with an HTTPS `.zip` fallback if `git` is blocked, and automatically downloads + extracts the latest official `ggml-org/llama.cpp` pre-built Windows release binaries (`arm64` CUDA+`cudart`, `x64` CUDA+`cudart`, `vulkan-x64`, or `rocm-x64`) into `${binDir}`.
  - **Card `03` (`setup_env`):** Checks explicit `$pyPaths` (`Python312`/`Python311` in `$env:LOCALAPPDATA` and `C:\Program Files`), installs `Python.Python.3.12` via `winget`, reloads `$env:Path` + `$foundPy`, invokes `& "$venvPy" -m pip install` directly (including `requests tqdm tabulate huggingface_hub`), and includes an HTTPS `.zip` fallback for `llmperf`.
  - **Card `04` (`setup_models`):** Uses `.venv-aiperf` `hf_hub_download` if available, with an automatic resumable `curl.exe -L -C -` / `wget -c` fallback if run before Card 03.
- **Last Verified State:**
  - `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: exit 0
  - `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules, 849ms): exit 0
  - `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (10/10)`
