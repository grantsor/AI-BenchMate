# AI BenchMate

> Self-contained, portable cross-platform LLM benchmarking workspace built for **Google Antigravity** and offline/local execution.

## Project Documentation

- [GEMINI.md](./GEMINI.md) — Antigravity workspace instructions (auto-loaded on any PC).
- [docs/HANDOFF.md](./docs/HANDOFF.md) — Current state, environment snapshot, architecture notes, and PC-to-PC transfer guide.
- [docs/PROMPT_HISTORY.md](./docs/PROMPT_HISTORY.md) — Complete chronological log of conversation prompts, troubleshooting fixes, decisions, and build milestones.
- [docs/plans/2026-11-14-ai-benchmate-proposal.md](./docs/plans/2026-11-14-ai-benchmate-proposal.md) — Initial optimization and architecture proposal.
- [docs/references/](./docs/references/) — Archived prompt specification, benchmark reports, server setup guides, chat histories, and conversation screenshots (`docs/references/screenshots/`).

## Transferring This Project to Another Google Antigravity PC

### Option 1: Via GitHub (Recommended)
1. Ensure **Git** is installed on the target PC (and **Node.js** if building/editing the React + Vite edition).
2. Clone the repository:
   ```powershell
   git clone https://github.com/grantsor/AI-BenchMate.git
   ```
   *(Or for only the zero-server Portable Edition: `git clone https://github.com/grantsor/AI-BenchMate-Portable.git`)*
3. Open the cloned folder in **Google Antigravity**. Antigravity reads `GEMINI.md` and the `docs/` files automatically.

### Option 2: Direct Copy-Paste (100% Self-Contained)
The entire repository folder (`AI BenchMate`) is completely self-contained—all source code, implementation plans (`docs/plans/`), reference docs & screenshots (`docs/references/`), handoff docs (`docs/HANDOFF.md`), and conversation logs (`docs/PROMPT_HISTORY.md`) live strictly inside this folder.

1. Copy-paste the single `AI BenchMate` folder to your other PC (for example under `Documents\AI BenchMate`).
2. Open the folder in **Google Antigravity** and tell the agent: *"Read `GEMINI.md`, `docs/HANDOFF.md`, and `docs/PROMPT_HISTORY.md` to resume where we left off."*

## Getting Started & Commands

AI BenchMate ships in **two synced editions** inside this repository:

### 1. Portable Zero-Server Edition (`portable/` · `AI-BenchMate-Portable`)
Ultra-lightweight (~25–40 MB RAM, 0.0% idle CPU, zero `node_modules`) so you can keep it open on any benchmark rig:
- **Required tools:** Any modern browser (zero runtime dependencies). Optional Python 3 for `launch-local.bat` / `launch-local.sh`.
- **Instant launch:** Double-click `portable/index.html` (`file://` works out of the box, including `Select Folder` / `Scan \models\ Folder` and drag-and-drop Folder Auditing).
- **Optional static server:** Run `portable/launch-local.bat` (Windows) or `portable/launch-local.sh` (Linux) for `http://127.0.0.1:8765/`.
- **Standalone Repo:** `https://github.com/grantsor/AI-BenchMate-Portable`

### 2. React + Vite Edition (Root `src/` · `AI-BenchMate`)
- **Required tools:** Node.js (`v26.13.1` LTS verified) + npm.
```powershell
npm install
npm run dev      # Start dev server
npm run build    # Production build into dist/
```
*(In PowerShell with restricted script execution policy, use `npm.cmd install` / `npm.cmd run build` or `node "<node_dir>\node_modules\npm\bin\npm-cli.js" run build`.)*

### Verification & Integrity Suite
Run syntax checks across all portable scripts, build Vite production assets, and run all 11 engine/parity checks:
```powershell
node --check portable/js/benchmate-data.js
node --check portable/js/benchmate-engine.js
node --check portable/js/benchmate-ui.js
npm.cmd run build
node scripts/verify-benchmate.mjs
```

### Environment Variables
- **None required:** AI BenchMate runs 100% locally in the browser with no API keys or `.env` configuration. Do not commit any secrets.

### Universal State Persistence
Every configurable setting, theme (`Light` default / `Dark` / `System`), unified **Pause Animations / Benchmark Stealth Mode** toggle, active hardware profile, `modelsDir` (`$env:USERPROFILE\.lmstudio\models` on Windows), scanned/custom models, saved presets, suite parameters, drawer open/closed state, step completion checkboxes, SSH parameters, and audited/parsed results auto-saves to `localStorage` and `IndexedDB`.
