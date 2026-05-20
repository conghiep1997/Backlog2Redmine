# name
cross-platform-sync

# description
Guidance for Backlog, Redmine, and Google Sheets API flows used to sync comments, issues, attachments, logs, and testcase data.

# when to use
- Editing `src/modules/services/backlog.js`, `redmine.js`, `sheetsApi.js`, `report-log-time.js`, or `testcaseConverter.js`.
- Changing sync logic in `src/background.js`, `src/content.js`, `src/redmine_content.js`, or Sheets/testcase entrypoints.
- Debugging issue lookup, comment posting, attachment transfer, metadata loading, or project/user sync.

# concise rules
- Use Backlog API keys as `apiKey` query parameters where existing service methods do.
- Use Redmine `X-Redmine-API-Key` headers for Redmine REST calls.
- Never log raw URLs or error payloads that may include `apiKey` or authorization tokens.
- Build external URLs with `URL`, `URLSearchParams`, or existing helpers.
- Preserve Backlog issue-key parsing and Redmine matching heuristics unless intentionally changing behavior.
- Keep attachment download/upload paths explicit about source credentials and target API requirements.
- Sanitize API error messages before showing users or storing logs.
- Keep service code separate from DOM rendering; route UI work through content/options modules.

# validation checklist
- Decrypted settings are used only inside privileged/background or service flows.
- Backlog, Redmine, and Sheets host permissions cover any new endpoint.
- Comment markdown and attachment links remain usable after sync.
- Success/error toasts or modal states still fire for user actions.
- Network failures produce clear errors without exposing credentials.
- Backlog and Redmine credentials are sent only to their matching APIs.
