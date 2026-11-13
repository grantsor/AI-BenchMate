# AI BenchMate — Google Antigravity Project Context

This file is automatically read by Google Antigravity whenever this workspace is opened on any PC.

## Documentation & Cross-PC Continuity Rules

To keep this project 100% portable between PCs (whether transferred via GitHub or copy-pasted directly as a folder):

1. **Always read first on a new session or PC:**
   - [docs/HANDOFF.md](./docs/HANDOFF.md) — Current project status, environment info, architecture, and next steps.
   - [docs/PROMPT_HISTORY.md](./docs/PROMPT_HISTORY.md) — Chronological log of user prompts, design decisions, and completed milestones.

2. **Always update after every meaningful prompt or milestone:**
   - Append the user's prompt summary (or exact requirements), key design decisions, files created/modified, and verification results to `docs/PROMPT_HISTORY.md`.
   - Update `docs/HANDOFF.md` with the latest architecture, tech stack, setup instructions, environment dependencies, and remaining TODOs.

3. **Strict Single-Folder Portability Rule:**
   - Every file related to this project and conversation—including source code, implementation plans (`docs/plans/`), walkthroughs, architecture docs, scratch scripts, and full prompt/response logs (`docs/PROMPT_HISTORY.md`)—MUST be written inside `C:\Users\GadgetPilipinas\Documents\AI BenchMate` (relative to the repository root).
   - Never rely on or require copying files from `C:\Users\<User>\.gemini\...` or any path outside `C:\Users\GadgetPilipinas\Documents\AI BenchMate`, nor rely on ephemeral chat history for critical context.
   - Document any required tools, environment variables (use `.env.example`, never commit real secrets), and run/build commands inside `README.md` and `docs/HANDOFF.md`.

## Current Project Status

- **Stage:** Both editions built (`portable/` Zero-Server Static Edition and root React + Vite Edition) with universal `localStorage` + `IndexedDB` persistence and BrewedOps Motion Library Dark/Light UI.
- **Repositories:**
  - Main Repo (React + Vite + Portable + Docs): `https://github.com/grantsor/AI-BenchMate` (Public, `main`)
  - Standalone Portable Repo: `https://github.com/grantsor/AI-BenchMate-Portable` (Public, `main`)
