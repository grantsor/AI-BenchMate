# AI BenchMate — Cross-PC Handoff & Context Document

**Last Updated:** 2026-11-16  
**Current Phase:** Full First-Setup Automation & Chat-History Troubleshooting Fixes (Ready & Pushed)

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
  - Interactive top header pills (`platform:`, `vram:`, `model:`) as `<select>` switchers synced across tabs.
  - Complete First-Time Setup Cards per Hardware Profile (`01 · Pre-flight Check`, `02 · Install / Build llama.cpp & SPEED-Bench Repo`, `03 · Install Python 3.12, Venvs & Patched llmperf`, `04 · Download / Verify Benchmark GGUF Models`, `05 · Free VRAM`, `06 · Clear llama-benchy Cache`, plus DGX-only `07 · DGX Spark /models Symlink, Ollama Override & start-ai / stop-ai Scripts`).
  - Proactive always-visible Guardrails bar (`sb-banner-ok` when valid, 8-check validation + 1-click Auto-Fix when invalid).
  - Universal persistence (`localStorage` + `IndexedDB`) remembering all parameters, custom models, custom presets, UI drawer toggles, and active tab.
  - Content-Aware Folder Auditor (`showDirectoryPicker()`, `webkitdirectory`, Drag-and-Drop, Anti-1KB Stub & `aiperf.log` check) and clean 6-column Comparison Matrix with `SPEED-Bench` JSON array (`results` list) parsing, SVG charts, and `.md`/`.csv` exports.
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

1. Open `portable/index.html` (or run `npm.cmd run dev` for the React + Vite edition), run `01 · Pre-flight Check` (and `02`–`04` if setting up a fresh machine) on `1. Setup & Pre-flight`, and execute your benchmark runs on `2. Benchmarks`.
2. When transferring to another PC, either copy-paste `C:\Users\GadgetPilipinas\Documents\AI BenchMate` or `git clone` either GitHub repository.

## Latest Update (2026-11-16) — Chat-History Troubleshooting Fixes & Zero-Error First-Setup Automation

- **10 Real-World Troubleshooting Fixes Applied Across `src/` & `portable/`:**
  1. **Python 3.12 Pinning & Windows ARM64 `ray` Wheel Handling (`setup_env`):** Windows setup now checks/installs `Python.Python.3.12` via `winget` (using `--architecture x64` on `rtx_spark_win_arm64` so `ray`/`llmperf` and `aiperf` install from pre-built wheels under Prism emulation without C++ build errors) and targets `py -3.12` (fallback `py -3.11`) when creating `.venv-aiperf` and `.venv-agentperf`.
  2. **`02 · Install / Build llama.cpp & SPEED-Bench Repo` (`setup_llamacpp`):** Added dedicated setup card to clone `llama.cpp` (providing `tools/server/bench/speed-bench/speed_bench.py`) and build CUDA binaries on DGX Spark or verify/prepare binaries on Windows.
  3. **`04 · Download / Verify Benchmark GGUF Models` (`setup_models`):** Added conflict-free Python `hf_hub_download` card to fetch `Qwen3.8-27B-UD-Q4_K_M.gguf` and `Qwen3.6-35B-A3B-UD-Q4_K_M.gguf` directly into `modelDir` without `hf` PATH or `transformers` version issues.
  4. **Idempotent `setup_env`:** Upgrades `pip setuptools wheel`, checks `if [ ! -d ... ]` / `if (-not (Test-Path ...))` before `git clone llmperf`, patches `<3.11` in both `pyproject.toml` and `setup.py`, and falls back automatically from `aiperf[tdigest]` to `aiperf` if `crick` fails.
  5. **Fixed Client `--model` Full Path Toggle (`getClientModelArg`):** Normalized `clientModelMode` comparison (`"fullPath"` / `"fullpath"`) so selecting "Full GGUF Path" properly passes `state.model.fullPath`.
  6. **Fixed `SPEED-Bench` JSON Array (`results` list) Parser (`parseResultFile` & `auditFileList`):** Iterates over `j.results` when formatted as a JSON array (`Array.isArray(j.results)`), resolving the `'list' object has no attribute 'keys'` issue and computing per-category and overall `tps`.
  7. **`SPEED-Bench` `_ctx64k.json` Classic Naming & 1-Click Comparator Presets:** Classic naming appends `_ctx64k.json` when `-c >= 65536`, and `04 SPEED-Bench` drawer includes `Dense vs MoE (qwen38 vs qwen36)` and `Standard vs 64K` preset chips.
  8. **Automatic Port `8080` / Existing Server Cleanup in Terminal 1 (`buildServerCommand`):** Pre-stops any running `llama-server` before starting a new server instance.
  9. **DGX Spark `vramSweep`, Safe `/models` Symlink Migration, `${SUDO_USER:-$USER}`, and `stop-ai` Creation:** Prevents nesting `.lmstudio/models/models`, stops `ollama.service` and `lms server stop`, and installs `~/.local/bin/stop-ai`.
  10. **`03 llmperf` Working Directory:** Changes directory into `${benchRoot}/llmperf` before executing `token_benchmark_ray.py`.
- **Last Verified State:**
  - `node --check` on `portable/js/benchmate-data.js`, `portable/js/benchmate-engine.js`, `portable/js/benchmate-ui.js`: exit 0
  - `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build` (`vite build`, 32 modules, 821ms): exit 0
  - `node scripts\verify-benchmate.mjs`: `ALL AI BENCHMATE VERIFICATION CHECKS PASSED (9/9)`
  - Chat-history troubleshooting & parity suite: `ALL 10 CHAT-HISTORY TROUBLESHOOTING & PARITY CHECKS PASSED` (exit 0)
