# Agent Guidance: Backlog2Redmine

## Purpose
- Backlog2Redmine is a Manifest V3 Chrome extension for translating and syncing Backlog, Redmine, and Google Sheets workflows.
- Keep this file routing-focused. Put implementation details in `.agents/skills/*/SKILL.md`.
- Do not load all skills by default; load only the skill files relevant to the current task.

## Repo Map
- `manifest.json`: MV3 manifest, permissions, host permissions, content script ordering, options page, web accessible resources.
- `src/background.js`: service worker, lifecycle hooks, update checks, message routing, decrypted settings cache.
- `src/content.js`: Backlog content script and DOM injection.
- `src/redmine_content.js`: Redmine content script for report/log-time workflow.
- `src/sheets-content.js`, `src/sheets-sidebar.*`, `src/testcase-converter.*`: Google Sheets/testcase tools.
- `src/options.*`: extension options UI and encrypted settings persistence.
- `src/modules/services/`: AI, Backlog, Redmine, Sheets, version, report-log-time services.
- `src/modules/utils/`: crypto, logging, markdown, helper utilities.
- `src/modules/ui/`: shared injected UI helpers.
- `src/modules/constants/`, `src/constants.js`, `_locales/`: constants, prompts, models, icons, i18n fallback.
- `scripts/`: version sync, build, zip, release helper scripts.
- `.github/workflows/deploy.yml`: lint/build/zip/release/version registration workflow.

## Skill Routing
- `chrome-extension`: manifest, service worker, content scripts, permissions, messaging, storage, web accessible resources.
- `extension-ui`: options page, injected Backlog/Redmine UI, modal/toast/styles, Sheets sidebar/testcase pages.
- `ai-integration`: provider/model/key handling, translation prompts, fallback and retry behavior.
- `cross-platform-sync`: Backlog, Redmine, Sheets, issue/comment/file sync and API behavior.
- `deployment`: build scripts, version sync, zip packaging, GitHub release workflow.
- `token-optimization`: focused discovery before broad reading or large edits.
- `code-review`: final review, changed-file-first checks, security and architecture validation.

## Core Guardrails
- Inspect changed files first before broad review or refactor.
- Avoid unnecessary full repo scans; search targeted paths before opening files.
- Do not read or edit generated/heavy outputs unless the task specifically requires it: `node_modules/`, `dist/`, `Backlog2Redmine-v*.zip`.
- Do not create `.rules/` unless explicitly requested.
- Do not hardcode secrets, tokens, credentials, account IDs, production URLs, or API keys.
- Preserve Manifest V3 constraints and content script load order from `manifest.json`.
- Keep settings and API keys encrypted with existing `encryptData`/`decryptData` flows.
- Keep `package.json` and `manifest.json` versions synchronized when changing versions.
- Use existing scripts when validating: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`, `npm run check:version-sync`, `npm run build`, `npm run build:zip`.
