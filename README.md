# AI BenchMate

> Project workspace initialized and documented for seamless cross-PC development with Google Antigravity and GitHub.

## Project Documentation

- [GEMINI.md](./GEMINI.md) — Antigravity workspace instructions (auto-loaded on any PC).
- [docs/HANDOFF.md](./docs/HANDOFF.md) — Current state, environment snapshot, architecture notes, and PC-to-PC transfer guide.
- [docs/PROMPT_HISTORY.md](./docs/PROMPT_HISTORY.md) — Chronological log of conversation prompts, decisions, and build milestones.

## Transferring This Project to Another Google Antigravity PC

### Option 1: Via GitHub (Recommended)
1. Ensure **Git** is installed on the target PC.
2. Clone the repository:
   ```powershell
   git clone <your-repo-url>
   ```
3. Open the cloned `AI BenchMate` folder in Google Antigravity. Antigravity will read `GEMINI.md` and the `docs/` files automatically.

### Option 2: Direct Copy-Paste (100% Self-Contained)
`C:\Users\GadgetPilipinas\Documents\AI BenchMate` is completely self-contained—all source code, implementation plans (`docs/plans/`), handoff docs, and conversation logs live strictly inside this folder.

1. Copy-paste the single `AI BenchMate` folder to your other PC (e.g., into your Antigravity projects directory).
2. Open the folder in Google Antigravity and tell the agent: *"Read `GEMINI.md`, `docs/HANDOFF.md`, and `docs/PROMPT_HISTORY.md` to resume where we left off."*

## Getting Started

AI BenchMate ships in **two editions** inside this repository:

### 1. Portable Zero-Server Edition (`portable/` · `AI-BenchMate-Portable`)
Ultra-lightweight (~25–40 MB RAM, 0.0% idle CPU, zero `node_modules`) so you can keep it open on any benchmark rig:
- **Instant launch:** Double-click `portable/index.html` (`file://` works out of the box, including Folder Auditing).
- **Optional static server:** Run `portable/launch-local.bat` (Windows) or `portable/launch-local.sh` (Linux) for `http://127.0.0.1:8765/`.
- **Standalone Repo:** `https://github.com/grantsor/AI-BenchMate-Portable`

### 2. React + Vite Edition (Root `src/` · `AI-BenchMate`)
Requires Node.js (`v26.13.1` LTS verified):
```powershell
npm install
npm run dev      # Start dev server
npm run build    # Production build into dist/
```
*(In PowerShell with restricted script execution policy, use `npm.cmd install` / `npm.cmd run build`.)*

### Universal State Persistence
Every configurable setting, theme, unified **Pause Animations / Benchmark Stealth Mode** toggle, active hardware profile, model path, saved presets/models, suite parameters, drawer open/closed state, step completion checkboxes, SSH parameters, and audited/parsed results auto-saves to `localStorage` and `IndexedDB`.
