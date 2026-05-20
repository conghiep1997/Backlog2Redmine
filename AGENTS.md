# Agent Context: Backlog2Redmine

## Project Routing
- **Manifest/Core**: Use `chrome-extension` skill.
- **AI/LLM Flow**: Use `ai-integration` skill.
- **API/Sync Logic**: Use `cross-platform-sync` skill.
- **Review/Refactor**: Use `code-review` skill.

## Key Files
- `src/constants.js`: System configuration.
- `src/options.js`: Management UI logic.
- `src/background.js`: Main service worker.
- `src/modules/`: Domain-specific business logic.

## Workflow
1. Perform task using domain skills.
2. Run `npm run lint:fix` and `npm run format`.
3. Use `code-review` skill to validate final changes.
