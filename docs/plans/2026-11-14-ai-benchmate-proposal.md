# AI BenchMate — Architecture Analysis & Optimization Proposal

**Date:** 2026-11-14  
**Status:** Pending User Review & Approval  
**Source References:**
- [AI Benchmate Prompt.md](../references/AI%20Benchmate%20Prompt.md)
- [DGX Spark vs Radeon AI Pro 9700 — AI Benchmarks & Inference.md](../references/DGX%20Spark%20vs%20Radeon%20AI%20Pro%209700%20%E2%80%94%20AI%20Benchmarks%20%26%20Inference.md)
- [DGX Spark Setup & Hermes Server Guide.md](../references/DGX%20Spark%20Setup%20%26%20Hermes%20Server%20Guide.md)

---

## Executive Summary

The prompt defines **AI Benchmate** as a self-contained, developer-focused **web application** featuring:
- A BrewedOps Motion Library-inspired UI with Dark Mode (Obsidian Studio) + Light Mode (Warm Editorial Paper) + Pause Animations toggle.
- 4 Hardware/OS Profiles (`DGX Spark Linux ARM64`, `RTX Spark Windows ARM64`, `NVIDIA GPU Windows x64`, `AMD GPU Windows x64 Vulkan/ROCm`).
- Smart Model Path Extractor, Parity vs. Custom Preset Manager (`localStorage` + `IndexedDB`), and Dynamic Parameter-Aware Result Naming Engine.
- 6 Core LLM Benchmark Suites (`llama-bench`, `llama-benchy`, `llmperf`, `SPEED-Bench`, `AA-AgentPerf-Local`, `AIPerf` Standard + 64k Reviewer Sweep).
- Proactive Context Overflow (`65588 > 65536`) & VRAM/KV Cache Guardrails, Content-Aware Folder Auditor (Anti-1KB Stub Auditor), Visual Result Comparison Studio, and SSH Remote Execution (`tmux` + `scp`).

To satisfy both the **web application** specification AND the **ultra-low-overhead benchmark requirement** (zero Node.js install needed, minimal RAM/CPU, and zero GPU/VRAM contention while benchmarks run), here are 6 key architectural recommendations and optimizations for user approval before implementation.

---

## Proposed Optimizations & Decisions

### 1. Zero-Server Static Web App Architecture (Pure HTML / CSS / Modular ES Modules)
- **Proposal:** Build AI Benchmate as a **100% zero-dependency, zero-build-step Vanilla HTML/CSS/ES-Module web application** (optionally bundled cleanly into a self-contained folder or single HTML + modular JS/CSS that works over `file://` or a tiny static server, with zero Node.js/npm/React runtime overhead).
- **Why it beats Vite/React/Electron for benchmarking:**
  - **Ultra-low footprint:** ~25–40 MB RAM, `0.0%` idle CPU, zero dev server (`vite`/`node`) running in the background during benchmarks.
  - **Portable on any test rig:** Works immediately by opening `index.html` (or running `py -m http.server` if `showDirectoryPicker` requires a secure context), and transfers cleanly via copy-paste or GitHub.
  - **Dual Folder Audit Fallback:** In addition to `window.showDirectoryPicker()`, support `<input type="file" webkitdirectory multiple>` + Drag-and-Drop folders so the Content-Aware Folder Auditor works reliably even on `file://` URLs or browsers where `showDirectoryPicker()` is restricted.
  - **Offline-first fonts & charts:** Use clean SVG/Canvas lightweight custom charts (no bloated chart library bundles) and graceful system-UI / JetBrains Mono font stacks with optional online Google Fonts links that degrade cleanly offline.

### 2. "Benchmark Stealth Mode" (Upgrading the "Pause Animations" Toggle)
- **Proposal:** Combine or pair the **"Pause Animations"** toggle with a **"Benchmark Stealth Mode"** that:
  - Stops all JS text-scramble animations, transitions, and hover transforms (`prefers-reduced-motion` style).
  - Strips `backdrop-filter: blur(...)`, heavy box-shadows, and `will-change` GPU compositing layers so the browser stays off the GPU/D3D compositor while `llama-bench` / `llama-server` is saturating VRAM and compute.

### 3. Cross-Platform `--alias` Parity Fix for `llama-server`
- **Observation from Reference Doc:** On the Radeon AI Pro 9700 Windows tests, `llama-benchy`, `llmperf`, and `AA-AgentPerf-Local` passed the full Windows `.gguf` path (`C:\...\Qwen3.8-27B-UD-Q4_K_M.gguf`) in `--model`, whereas `AIPerf` and DGX Spark tests used the short alias (`Qwen3.8-27B`).
- **Proposal:** Include `--alias "<model_alias>"` in every generated `llama-server` launch command by default, so all 5 HTTP client suites (`llama-benchy`, `llmperf`, `SPEED-Bench`, `AA-AgentPerf-Local`, `AIPerf`) can consistently use `--model "<model_alias>"`, while providing an editable toggle (`Use Served Alias` vs. `Use Full Model Path`) in case a user prefers passing the full `.gguf` path on Windows.

### 4. Pre-Loaded Model & Path Chips (Zero Hardcoded Usernames)
- **Proposal:** Keep **zero hardcoded usernames** (using `$HOME` / `%USERPROFILE%` or derived paths from the user's pasted `.gguf` path), while pre-loading 1-click **Quick Model Preset Chips** derived from the two reference guides:
  - **Benchmark Parity Models:**
    - `Qwen3.8-27B` Dense (`Qwen3.8-27B-UD-Q4_K_M.gguf`, ~15.8 GB, `Qwen/Qwen3.8-27B`)
    - `Qwen3.6-35B-A3B` MoE (`Qwen3.6-35B-A3B-UD-Q4_K_M.gguf`, ~21.0 GB, `Qwen/Qwen3.6-35B-A3B`)
  - **DGX Spark Hermes Stack Models:**
    - `Nemotron-3-Nano-Omni-30B-A3B-Reasoning-Q4_K_M.gguf`
    - `gemma-4-31B-it-QAT-Q4_0.gguf`
    - `Hermes-3-Llama-3.1-8B-Q8_0.gguf`
    - `NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` (vLLM / Safetensors note)
- Provide editable fields for **Binary Dir** (e.g., `$HOME/llama.cpp/build/bin` on Linux vs. `C:\llama.cpp\vulkan` or `C:\llama.cpp\cuda` on Windows), **Benchmarks Root** (`$HOME/benchmarks`), and **Centralized Results Folder**.

### 5. Integrating `DGX Spark Setup & Hermes Server Guide.md` into Tabs `04 SSH Remote` & `05 Setup & Fixes`
- **Proposal:** Incorporate all operational workflows from the DGX Spark Hermes guide directly into Tabs `04` and `05`:
  - **Pre-Benchmark VRAM Sweep (`05 Setup & Fixes`):** Terminates `llama-server`, `ollama serve`, `ComfyUI`, `lm-studio`, kills `ollama`/`comfyui`/`vllm_nemotron` `tmux` sessions, and frees ports `8080`, `11434`, `1234`, `8000`, `8189` before running `nvidia-smi` (or Windows `Stop-Process` + GPU check).
  - **Post-Benchmark Stack Restore (`start-ai`):** One-click command block to bring Ollama (`11434`), LM Studio (`1234`), ComfyUI (`8189`), and optionally vLLM (`8000` with `--gpu-memory-utilization 0.70`) back online after benchmarking finishes, with editable Remote IP (default placeholder `192.168.50.55`).
  - **Verified Troubleshooting Fixes:** Include copyable cards for the LM Studio `.internal/temp` `ENOENT` fix, Ollama `override.conf` (`OLLAMA_MODELS` + `0.0.0.0:11434`), `/models` symlink setup, `llmperf` Python 3.12+ `<3.11` patch, `aiperf[tdigest]` `crick` `Python.h` fix, `llama-benchy` Gutenberg cache `ZeroDivisionError` cleanup, and `AIPerf` `--ui simple` sweep fix.

### 6. Demo Benchmark Dataset Toggle in `03 Results & Charts`
- **Proposal:** Alongside real file drag-and-drop and folder loading for `.md` (`llama-bench`, `llama-benchy`) and `.json` (`SPEED-Bench`, `AIPerf`, `llmperf`, `AA-AgentPerf-Local`) outputs, add a **"Load Sample Dataset (DGX Spark vs. R9700 Parity)"** button (clearly labeled as sample/preview data) so the user can test every comparison chart, table, and Markdown/CSV export immediately upon opening the app.

---

## Open Clarifications for User
1. Confirm **Zero-Server Static Web App** (pure HTML/CSS/ES Modules, works via `file://` or optional local static server—zero Node/React overhead) vs. a bundled framework (e.g., Vite).
2. Confirm whether **Benchmark Stealth Mode** (disabling blur/shadows/compositor layers when animations are paused) is desired.
3. Confirm **`--alias` parity in `llama-server`** with a toggle for Full Path vs. Alias.
4. Confirm pre-loading the **Quick Model Chips** and **DGX Spark Hermes Stop/Restore (`start-ai`)** scripts in Tabs `04`/`05`.
5. Confirm whether to include a clearly labeled **Sample Dataset** button in Tab `03 Results & Charts` for instant chart preview.
6. Any specific adjustments to the 4 Hardware Profiles, 6 Benchmark Suites, or UI tabs before implementation begins?
