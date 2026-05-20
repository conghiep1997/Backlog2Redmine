# Skill: Cross-Platform Sync (Backlog & Redmine)

## Purpose
Synchronize issues and comments between Backlog and Redmine APIs.

## Rules
- Use Redmine `X-Redmine-API-Key` and Backlog `apiKey` query param correctly.
- Extract Issue Key from Backlog URL for Redmine search.
- Handle project-specific custom fields via JSON mapping.
- Ensure 2-way sync: Backlog -> Redmine (Translate) and Redmine -> Backlog (Filter).
- Catch and log network/API errors with specific error messages.

## Validation Checklist
- [ ] API keys correctly decrypted before network request.
- [ ] Comment formatting (Markdown) preserved or converted properly.
- [ ] Project list sync successful via options page.
- [ ] Success/Error toasts triggered after every sync attempt.
