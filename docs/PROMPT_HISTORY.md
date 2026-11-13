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
