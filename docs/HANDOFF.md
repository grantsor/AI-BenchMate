# AI BenchMate — Cross-PC Handoff & Context Document

**Last Updated:** 2026-11-14  
**Current Phase:** Workspace & Documentation Setup (Pre-Prompt / Pre-GitHub Init)

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
  - BrewedOps Motion Library UI with **Dark Mode (Obsidian Studio)**, **Light Mode (Warm Editorial Paper)**, **System Preference**, toggleable **Light Terminal (`#F0EFEA`)**, and **Option 2A Unified Pause Animations / Benchmark Stealth Mode** (strips transitions, scramble animations, `backdrop-filter`, shadows, and GPU layers).
  - **Universal Persistence:** All settings, choices, tabs, drawers, presets, models, SSH config, and audit/chart datasets auto-save to `localStorage` + `IndexedDB`.
  - **4 Hardware/OS Profiles:** DGX Spark Linux ARM64, RTX Spark Windows ARM64, NVIDIA GPU Windows x64, AMD GPU Windows x64 (Vulkan/ROCm toggle).
  - **Smart Path Parser, Quick Model Chips & Dynamic Naming Engine:** Mode A (Parameter-Stamped) + Mode B (Classic Parity) + `--alias` parity toggle.
  - **6 Core Suites + Proactive Guardrails:** Context Overflow (`65588 > 65536`) trap + 1-click Auto-Fix (`-c 70000 -ctk q8_0 -ctv q8_0`), VRAM + KV Cache Estimator, All-in-One Playbook export.
  - **Content-Aware Folder Auditor & Visual Comparison Studio:** `showDirectoryPicker()`, `webkitdirectory`, Drag-and-Drop, Anti-1KB Stub & `aiperf.log` error inspection, 5 SVG charts, Sample Dataset toggle, `.md`/`.csv` exports, and SSH/Hermes host control.
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

1. Open `portable/index.html` (or run `npm.cmd run dev` for the React + Vite edition) and optionally test against a real benchmark folder on DGX Spark or Radeon AI Pro R9700.
2. When transferring to another PC, either copy-paste `C:\Users\GadgetPilipinas\Documents\AI BenchMate` or `git clone` either GitHub repository.
