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
- **GitHub CLI:** `2.104.0` (`gh`, authenticated as `grantsor`)

### Not Installed (Stack-Dependent / Optional)
- **Node.js / npm (`node`, `npm`)**: Only needed if a JS/TS stack is ever chosen (not recommended for benchmark low-overhead).
- **uv (`uv`)**: Optional fast Python package/environment manager.
- **Rust / Cargo (`cargo`)**: Only needed if building a Rust or Tauri desktop app.

---

## 4. Architecture & Implementation Log

> *Pending the user's AI BenchMate specification prompt before choosing the tech stack.*

- **Core Non-Functional Requirement:** **Ultra-Low-Overhead Benchmark Requirement** — the app must stay as lightweight as possible (near-zero idle CPU, minimal RAM, and zero GPU/VRAM contention) because it remains open while the PC is running benchmarks.
- **Tech Stack:** **TBD (Deferred)** — Holding off on stack selection (including `.NET 9` vs. alternatives) until analyzing the full **AI BenchMate** specification prompt against the ultra-low-overhead requirement.
- **Key Modules:** TBD
- **GitHub Repository URL:** `https://github.com/grantsor/AI-BenchMate` (Public)

---

## 5. Immediate Next Steps

1. Receive the user's **AI BenchMate** specification prompt and log it in `docs/PROMPT_HISTORY.md`.
2. Analyze the exact functional requirements together with the ultra-low-overhead constraint to choose the optimal tech stack.
3. Author the implementation plan inside `docs/plans/`, build, verify, and keep `docs/HANDOFF.md` and `docs/PROMPT_HISTORY.md` updated at every milestone.
