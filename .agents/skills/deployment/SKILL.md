# name
deployment

# description
Guidance for Backlog2Redmine build, version sync, zip packaging, GitHub release workflow, and backend version registration script.

# when to use
- Editing `scripts/`, `package.json` scripts, `manifest.json` version, or `.github/workflows/deploy.yml`.
- Changing release packaging, version bump/sync/check behavior, or registration with the backend.
- Debugging CI build, lint, zip artifact, or release publication.

# concise rules
- Keep `manifest.json` and `package.json` versions synchronized.
- Treat `dist/` and `Backlog2Redmine-v*.zip` as generated outputs.
- Preserve CI steps that install dependencies, lint, check version sync, build, zip, and release.
- Do not commit or hardcode `BACKEND_URL`, `BACKEND_API_KEY`, GitHub tokens, OAuth client secrets, or release credentials.
- Use Node-compatible CommonJS style in existing scripts unless refactoring the script set intentionally.
- Keep package output paths compatible with Chrome's "Load unpacked" flow from `dist/`.

# validation checklist
- `npm run check:version-sync` passes after version or manifest edits.
- `npm run lint` remains valid for source changes.
- `npm run build` produces the expected extension structure in `dist/`.
- `npm run build:zip` names artifacts consistently with the version.
- CI env/secret references remain secret-backed, not literal values.
