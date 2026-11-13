Build a modern, self-contained, developer-focused web application called **"AI Benchmate"**.

**AI Benchmate** is an interactive LLM benchmarking command builder, environment setup guide, content-aware result folder auditor, and visual comparison studio. It lets users paste their model file path, choose their Hardware/OS platform, select from 6 industry-standard LLM benchmarks, toggle between our locked Baseline Parity Defaults or custom saved parameter configurations, automatically name result files/folders based on active parameters, and generate step-by-step copy-pasteable terminal commands.

---

### 1. UI LAYOUT, VISUAL DESIGN SYSTEM & DARK/LIGHT MODE (`https://brewedops.cloud/motionlibrary` STYLE)

Model the layout, typography, card architecture, and interactive motion directly after **BrewedOps Motion Library (`https://brewedops.cloud/motionlibrary`)**, with full support for both **Dark Mode** and **Light Mode**:

#### A. Dual Theme Engine (Dark Mode & Light Mode with Persistent Toggle)
Provide a prominent theme switcher in the top navigation bar (supporting **Dark Mode**, **Light Mode**, and **System Preference**, saved in `localStorage`) alongside a **"Pause Animations"** toggle:
- **Dark Mode Palette (Obsidian Studio — Default):**
  - Primary Background: `#0A0A0C` | Secondary Surface / Sidebar: `#111115`
  - Card Surface: `#15161C` with subtle hover elevation `#1B1C24` and `1px solid #232530` hairline borders
  - Code Block Viewport: `#07080A` with `#1E202B` border
  - Typography: Primary `#F3F4F6`, Secondary `#9CA3AF`, Muted/Index Numbers `#525566`
  - Accents: Electric Cyan (`#38BDF8`) & Amber/Orange (`#F59E0B`) for active states, Emerald (`#10B981`) for Verified Complete, Crimson (`#EF4444`) for Overflow/Stub errors.
- **Light Mode Palette (BrewedOps Warm Editorial Paper):**
  - Primary Background: `#F6F5F0` (warm stone/paper) | Secondary Surface / Sidebar: `#EFECE6`
  - Card Surface: `#FFFFFF` with hover elevation `#FAF9F6` and `1px solid #E2DFD7` architectural hairline borders
  - Code Block Viewport: `#18181B` (high-contrast dark terminal inset) or toggleable light terminal `#F0EFEA`
  - Typography: Primary Ink `#141413`, Secondary `#575653`, Muted/Index Numbers `#8C8A84`
  - Accents: Deep Terracotta/Amber (`#D97706`), Forest Emerald (`#059669`), Cobalt (`#2563EB`), Crimson (`#DC2626`).
- **Typography:**
  - Headings & UI: `Inter`, `Plus Jakarta Sans`, or `Geist Sans` (tight tracking, bold editorial hierarchy).
  - Numeric Indexes (`01`, `02`, `03`), Paths, Badges & Terminal Code: `JetBrains Mono` or `Geist Mono`.

#### B. BrewedOps Motion Library Structural Layout & Micro-Interactions
1. **Top Dynamic Island Navigation Bar:**
   - Sticky floating/docked top bar displaying the **AI Benchmate** brand mark, live session telemetry pills (e.g., `Active Target: DGX Spark ARM64`, `Model: Qwen3.8-27B`, `Audit: 8/10 Verified`), main view tabs (`01 Builder`, `02 Coverage Matrix`, `03 Results & Charts`, `04 SSH Remote`, `05 Setup & Fixes`), the **Pause Animations** button, and the **Dark/Light Theme Toggle**.
2. **Left Sticky Section Index & Filter Rail:**
   - Numbered index links (`01 Hardware & OS`, `02 Model & Paths`, `03 Server & Presets`, `04 Benchmark Suites`, `05 Playbook Output`, `06 Folder Verification`) with live completion indicators.
3. **Motion Library Card Pattern:**
   - Every benchmark suite and setup step is presented as an interactive card featuring:
     - Top index number (`01`–`06`), category badge (`NATIVE C++`, `HTTP DEPTH`, `CONCURRENCY`, `QUALITATIVE`, `AGENTIC`, `LONG-CONTEXT SWEEP`), and estimated duration badge.
     - Expandable **"Customize Parameters"** drawer with instant **"Reset to Parity Default"** chip.
     - Live syntax-highlighted terminal preview box (`bash` or `PowerShell`) that updates in real time as inputs change.
     - Bottom action bar with 1-click **"Copy Command"**, **"Copy Server Launch"**, and **"Mark Step Complete"** buttons with spring-animated feedback.
   - Use subtle scramble-decode text effects when switching hardware profiles and smooth CSS/Framer-style transitions (which respect the **"Pause Animations"** toggle).

---

### 2. SUPPORTED HARDWARE & OS MATRIX (EXACT SYNTAX & DRIVER ADAPTATION)

AI Benchmate MUST dynamically adapt every generated terminal command (file paths, slashes, line continuations, environment variables, binary `.exe` extensions, GPU driver flags, process cleanup commands, and Python package installation flags) based on 4 selectable Hardware + OS profiles:

#### Profile 1: NVIDIA DGX Spark — Linux ARM64 (`aarch64`, Grace Blackwell CUDA)
- **Shell & Syntax:** Linux `bash` (`/` path separators, `\` line continuation, `export VAR="val"`, `| tee "file"`, `mkdir -p`, `rm -rf`).
- **Binaries:** `llama-bench` and `llama-server` (no `.exe` extension).
- **Driver / Backend Flags:** `-ngl 99 -fa 1` (or `-fa on` when running `SPEED-Bench`).
- **Venv Activation:** `source "$HOME/benchmarks/.venv-aiperf/bin/activate"` (and `.venv-agentperf`).
- **Platform-Specific Setup:** Includes `sudo apt update && sudo apt install -y python3-dev python3.12-dev build-essential cmake git` so `crick` (`#include "Python.h"`) compiles cleanly on `aarch64` when installing `aiperf[tdigest]`, plus a non-sudo fallback (`pip install aiperf`). Uses `sed -i 's/<3.11,\s*//g; s/,\s*<3.11//g' pyproject.toml` to patch `llmperf` for Python 3.12+.
- **VRAM / Port Cleanup:** `pkill -u "$USER" -9 -f "llama-server"` and `fuser -k -9 8080/tcp`, verified via `nvidia-smi`.
- **Default VRAM Capacity:** `128 GB` (Unified Memory, editable).

#### Profile 2: NVIDIA RTX Spark — Windows ARM64 (NVIDIA Drivers / CUDA)
- **Shell & Syntax:** Windows `PowerShell` (`\` path separators, backtick `` ` `` line continuation, `$env:VAR = "val"`, `| Tee-Object -FilePath "file"`, `New-Item -ItemType Directory -Force -Path`, `Remove-Item -Recurse -Force`).
- **Binaries:** `.\llama-bench.exe` and `.\llama-server.exe`.
- **Driver / Backend Flags:** `--device CUDA0 -ngl 99 -fa 1` (or `-fa on`).
- **Venv Activation:** `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force` followed by `.\.venv-aiperf\Scripts\Activate.ps1`.
- **Platform-Specific Setup:** Defaults to `pip install aiperf llama-benchy` (with an optional toggle for `aiperf[tdigest]` if Visual Studio C++ ARM64 build tools are installed). Patches `llmperf` for Python 3.12+ using native PowerShell:
  `(Get-Content pyproject.toml) -replace '<3\.11,?\s*|,\s*<3\.11', '' | Set-Content pyproject.toml`
- **VRAM / Port Cleanup:** `Stop-Process -Name "llama-server" -Force -ErrorAction SilentlyContinue`, verified via `nvidia-smi`.

#### Profile 3: NVIDIA GPU (RTX 5090 & Other NVIDIA GPUs) — Windows x64 (NVIDIA Drivers / CUDA)
- **Shell & Syntax:** Windows `PowerShell` (`\` path separators, backtick `` ` `` line continuation, `$env:VAR = "val"`, `| Tee-Object -FilePath "file"`).
- **Binaries:** `.\llama-bench.exe` and `.\llama-server.exe`.
- **Driver / Backend Flags:** `--device CUDA0 -ngl 99 -fa 1` (or `-fa on`). Allow customizing `--device CUDA0` (e.g., `CUDA1` or multi-GPU tensor split).
- **Venv Activation:** `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force` and `.\.venv-aiperf\Scripts\Activate.ps1`.
- **Platform-Specific Setup:** Uses standard pre-built Windows x64 wheels (`pip install "aiperf[tdigest]" llama-benchy`). Patches `llmperf/pyproject.toml` via PowerShell `-replace` for Python 3.12+.
- **VRAM / Port Cleanup:** `Stop-Process -Name "llama-server" -Force -ErrorAction SilentlyContinue`, verified via `nvidia-smi`.
- **Default VRAM Capacity:** `32 GB` (for RTX 5090, with quick chips for `16 GB`, `24 GB`, `32 GB`, `48 GB`, `96 GB`).

#### Profile 4: AMD GPU (Radeon AI Pro R9700 & Other AMD GPUs) — Windows x64 (Vulkan / ROCm)
- **Shell & Syntax:** Windows `PowerShell` (`\` path separators, backtick `` ` `` line continuation, `$env:VAR = "val"`, `| Tee-Object -FilePath "file"`).
- **Binaries:** `.\llama-bench.exe` and `.\llama-server.exe`.
- **Driver / Backend Selector:** Provide a sub-toggle between:
  1. **Vulkan Backend (Default):** `--device Vulkan0 -ngl 99` (with optional toggle for `-fa 1` / `-fa on`).
  2. **ROCm / HIP Backend:** `--device HIP0 -ngl 99 -fa 1` (or `-fa on`).
- **Venv Activation:** `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force` and `.\.venv-aiperf\Scripts\Activate.ps1`.
- **Platform-Specific Setup:** Patches `llmperf/pyproject.toml` via PowerShell `-replace` for Python 3.12+.
- **VRAM / Port Cleanup:** `Stop-Process -Name "llama-server" -Force -ErrorAction SilentlyContinue`, plus Task Manager GPU Dedicated Memory / `amd-smi` check.
- **Default VRAM Capacity:** `32 GB` (for Radeon AI Pro R9700, editable for other Radeon GPUs).

---

### 3. SMART PATH EXTRACTOR, CUSTOM PRESETS & PERSISTENT LOCAL MEMORY

1. **Zero Hardcoded Usernames:** Never hardcode any Linux or Windows username. Use `$HOME` or derive paths directly from the user's pasted inputs.
2. **Smart Model Path Parser ("Paste Model Path, Auto-Fill Everything"):**
   When the user pastes a full `.gguf` file path into the **Model File Path** field (e.g., `C:\Users\Admin\.lmstudio\models\unsloth\Qwen3.8-27B-GGUF\Qwen3.8-27B-UD-Q4_K_M.gguf` or `/home/user/models/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf`):
   - Automatically detect OS path style (`\` vs `/`).
   - Extract the **Base Models Directory**, **Model Filename**, **Served Model Alias** (e.g., `Qwen3.8-27B` or `Qwen3.6-35B-A3B`), **Clean Output Slug** (e.g., `qwen38` or `qwen36`), and suggest the **Hugging Face Tokenizer ID** (e.g., `Qwen/Qwen3.8-27B` or `Qwen/Qwen3.6-35B-A3B`).
3. **Default vs. Custom Parameter Presets Manager (`localStorage` + `IndexedDB`):**
   - **Built-in "Baseline Parity Defaults" Preset (Locked Default):** Pre-populates all 6 benchmarks with the exact context windows, passes, token lengths, and concurrency levels used in our DGX Spark and Radeon AI Pro R9700 tests. Includes a 1-click **"Reset to Parity Defaults"** button per test and globally.
   - **Flexible Custom Configuration & Saved Presets:** Every parameter in the UI (context window `-c`, KV cache precision `-ctk`/`-ctv`, prompt tokens `pp`/`isl`, output tokens `tg`/`osl`, depth `--depth`, passes/runs `-r`/`--runs`, concurrency `--concurrency`, request counts, categories, and limits) is editable.
   - Users can click **"+ Save Current Settings as Preset"** to save custom configurations in `localStorage` and switch between them anytime, as well as save default model directories and a custom model library so they can stop and resume benchmarking across sessions without re-entering paths.

---

### 4. DYNAMIC PARAMETER-AWARE RESULT FILE & FOLDER NAMING ENGINE

To ensure custom benchmark runs are clearly identifiable and NEVER overwrite baseline or previous custom runs in the Centralized Results Folder, implement an automatic **Dynamic Result Naming Engine**:

1. **Naming Mode Selector:**
   - **Mode A: Parameter-Stamped Naming (Auto-enabled when parameters are customized, or toggleable for all runs):** Automatically encodes the active model slug and key benchmark parameters directly into the output filename or directory name.
   - **Mode B: Classic Parity Naming:** Uses compact baseline names (`llama_bench_<slug>.md`, `llama_benchy_<slug>.md`, `llmperf_<slug>/`, `speedbench_<slug>.json`, `agentperf_<slug>/`, `aiperf_<slug>_std/`, `aiperf_<slug>_nv64k/`).
   - **Live Filename Preview:** Display the exact generated output filename/folder path on each benchmark card before the user copies the command.

2. **Exact Dynamic Naming Templates (Mode A):**
   Format token numbers cleanly (e.g., `32768` -> `32k`, `65536` -> `64k`, `70000` -> `70k`, comma/space lists `512,2048` -> `512-2048`):
   - **Native C++ `llama-bench`:** `<Central_Dir>/llama_bench_<model_slug>_pp<p_list>_tg<n_list>_r<runs>.<fmt>`
   - **`llama-benchy` (HTTP):** `<Central_Dir>/llama_benchy_<model_slug>_ctx<c_short>_kv<ctk>_pp<pp_list>_tg<tg_list>_d<depth_list>_r<runs>.<fmt>`
   - **`llmperf` (Ray Concurrency):** `<Central_Dir>/llmperf_<model_slug>_ctx<c_short>_in<mean_in>_out<mean_out>_c<concurrency>_req<max_req>/`
   - **`SPEED-Bench`:** `<Central_Dir>/speedbench_<model_slug>_ctx<c_short>_osl<osl>_c<concurrency>_lim<limit>_<category_slug>.json`
   - **`AA-AgentPerf-Local`:** `<Central_Dir>/agentperf_<model_slug>_ctx<c_short>_kv<ctk>/`
   - **`AIPerf` Standard Concurrency:** `<Central_Dir>/aiperf_<model_slug>_std_ctx<c_short>_in<isl>_out<osl>_c<concurrency>_req<req_count>/`
   - **`AIPerf` Long-Context Zip Sweep:** `<Central_Dir>/aiperf_<model_slug>_sweep_ctx<c_short>_kv<ctk>_isl<isl_short_list>_osl<osl_first>_c<concurrency>_r<req_count>/`

---

### 5. THE 6 CORE BENCHMARK SUITES & EDITABLE PARITY DEFAULTS

Pre-fill each suite with our tested **Baseline Parity Defaults**, while allowing full customization of every parameter:

1. **Native C++ `llama-bench` (Direct `.gguf` — No Server Needed)**
   - **Parity Defaults:** `-ngl 99 -fa 1 -p 512,2048 -n 128,512 -r 3 -o md`
   - **Customizable:** Prompt tokens (`-p`), Generation tokens (`-n`), Repetitions/Passes (`-r`), Batch/Micro-batch (`-b`/`-ub`), `-ngl`, `-fa`, Format (`md`, `csv`, `json`).
2. **`llama-benchy` (HTTP Server & Context Depth Sweep)**
   - **Server Defaults (`Terminal 1`):** `llama-server` on port `8080` with `-ngl 99 -fa 1 -c 32768 -np 1`.
   - **Client Parity Defaults (`Terminal 2`):** Prepend Gutenberg cache cleanup (`rm -rf ~/.cache/llama-benchy` or PowerShell `Remove-Item`) to prevent `ZeroDivisionError`, then run:
     `python -u -m llama_benchy --base-url http://127.0.0.1:8080/v1 --model "<model_alias>" --tokenizer "<hf_tokenizer>" --pp 512 2048 --tg 128 512 --depth 0 4096 --runs 3 --format md`
   - **Customizable:** Server `-c`, KV cache `-ctk`/`-ctv`, `--pp`, `--tg`, `--depth`, `--runs`, `--format`.
3. **`llmperf` (Ray Multi-Stream Concurrency Benchmark)**
   - **Server Defaults (`Terminal 1`):** `llama-server` with `-c 32768 -np 1`.
   - **Client Parity Defaults (`Terminal 2`):** Runs in `.venv-aiperf` with `OPENAI_API_BASE="http://127.0.0.1:8080/v1"` and `OPENAI_API_KEY="dummy"`:
     `--model "<model_alias>" --mean-input-tokens 1024 --stddev-input-tokens 128 --mean-output-tokens 256 --stddev-output-tokens 32 --num-concurrent-requests 4 --max-num-completed-requests 20` (plus a 1-click preset chip for `512 in / 128 out`).
   - **Customizable:** Server `-c`, `-np`, Mean/Stddev Input & Output Tokens, Concurrency, Max Completed Requests.
4. **`SPEED-Bench` (`speed_bench.py` Multi-Category Workload & Comparator)**
   - **Server Defaults (`Terminal 1`):** `llama-server` with `-ngl 99 -fa on --jinja` and quick toggle for **Standard Context (`-c 16384` / `-c 32768`)** vs. **64k Long Context (`-c 65536`)** vs. **Custom Context**.
   - **Client Parity Defaults (`Terminal 2`):**
     `python tools/server/bench/speed-bench/speed_bench.py --url http://127.0.0.1:8080 --bench qualitative --category all --osl 1024 --concurrency 1 --extra-inputs "{}" --limit 5`
   - **Built-in Comparator Step:** Generates `speed_bench_compare.py --baseline <Run_A.json> --speculative <Run_B.json>`.
5. **`AA-AgentPerf-Local` (Agent Multi-Turn Latency Replay)**
   - **Server Defaults (`Terminal 1`):** `llama-server` with `-c 32768 -np 1`.
   - **Client Defaults (`Terminal 2`):** Runs in isolated `.venv-agentperf` environment:
     `agentperf-local run --base-url http://127.0.0.1:8080/v1 --model "<model_alias_or_path>" --output-dir "<Dynamic_Output_Dir>"`
6. **`AIPerf` (Standard Concurrency & NVIDIA Reviewer's Guide Long-Context Sweep)**
   - **6A: Standard Concurrency Profile:** Server `-c 32768 -np 1`; Client `--concurrency 4 --request-count 20 --synthetic-input-tokens-mean 1024 --output-tokens-mean 256 --extra-inputs "ignore_eos:true"`.
   - **6B: NVIDIA Reviewer's Guide 64k Long-Context Zip Sweep:**
     - **Server (`Terminal 1`):** `-c 70000 -ctk q8_0 -ctv q8_0 -np 1`
     - **Client (`Terminal 2`):**
       `aiperf profile --model "<model_alias>" --tokenizer "<hf_tokenizer>" --url "http://127.0.0.1:8080" --endpoint-type chat --streaming --ui simple --sweep-type zip --isl "16384,32768,65536" --osl "1024,1024,1024" --isl-stddev 0 --osl-stddev 0 --extra-inputs "ignore_eos:true" --extra-inputs "cache_prompt:false" --concurrency 1 --warmup-request-count 1 --request-count 3 --random-seed 42 --use-server-token-count`
     - **Customizable:** Sweep `--isl`, `--osl`, Server `-c`, KV Cache (`fp16`, `q8_0`, `q4_0`), Concurrency, Warmup & Request Counts, `cache_prompt` toggle.

---

### 6. PROACTIVE HARDWARE GUARDRAILS & CONTENT-AWARE BENCHMARK AUDITOR

1. **Dynamic Context Overflow Guardrail (`65588 > 65536` Trap):**
   - Compute `Required_Context = Max_Input_Tokens + Max_Depth + Max_Output_Tokens + 64 (chat template overhead)`.
   - If `Required_Context > Server -c`, display a high-visibility warning banner explaining that chat template wrappers (~52 tokens) + output tokens overflow `-c`, with a **1-Click Auto-Fix Button** that sets `-c 70000 -ctk q8_0 -ctv q8_0`.
2. **VRAM & KV Cache Estimator:**
   - Compute `Estimated VRAM = Model Weight GB + KV Cache GB (fp16 vs q8_0 vs q4_0) + 1.5 GB Compute Buffer`. Warn if it exceeds hardware VRAM (e.g., 32 GB on R9700 / RTX 5090) and offer a 1-click toggle for `q8_0` KV cache.
3. **Content-Aware Benchmark Coverage Matrix (Anti-1KB Stub Auditor):**
   - Let users link their Centralized Results Folder via `window.showDirectoryPicker()` / drag-and-drop (or run a generated terminal Deep Audit Script).
   - Inspect both **file size (>1–2 KB)** AND **internal formatted metrics** for both Baseline Parity and Custom Parameter runs:
     - `🟢 VERIFIED COMPLETE`: Valid formatted numbers confirmed for all expected rows, depths, categories, and sweep steps.
     - `🟡 PARTIAL / SETTING MISMATCH`: File has data, but is missing a pass/depth (e.g., `AIPerf` finished `16k`/`32k` but failed at `64k`, or `SPEED-Bench` used `OSL: 512` instead of `1024`).
     - `🔴 INCOMPLETE STUB / FAILED`: File is <= 1–2 KB, empty, contains only headers, or `AIPerf` folder only has `logs/aiperf.log` without `profile_export_aiperf.json` (extract and show the exact error from `aiperf.log`).
     - `⚪ NOT RUN`: File/directory not found.
   - Include a **"Generate Commands for Missing / Incomplete Runs Only"** filter button.

---

### 7. INTERACTIVE RESULT PARSER UI & SSH REMOTE EXECUTION

1. **Result Parser & Visual Comparison Studio:**
   - Drag-and-drop or auto-load validated `.md` and `.json` result files across multiple GPUs (DGX Spark, RTX Spark, RTX 5090, Radeon AI Pro R9700), models (Qwen 3.8 Dense vs. Qwen 3.6 MoE), and custom parameter runs.
   - Render interactive comparison tables and charts (adapting colors cleanly between Dark Mode and Light Mode) for Prefill/Decode `t/s`, Depth 4096 Degradation `%`, 4-Stream Concurrency TTFT/ITL, `SPEED-Bench` Category Speedups, and 16k/32k/64k Long-Context Scaling Curves, with 1-click export to Markdown (`.md`) and CSV (`.csv`).
2. **SSH Remote Execution Mode:**
   - Optional SSH remote builder (User, IP, Port) that wraps Linux/DGX commands in persistent `tmux` sessions, generates one-line Windows PowerShell `ssh` triggers, and generates a one-line `scp -r` command to pull remote results straight into the local Centralized Results Folder.