# Skill: Chrome Extension (Manifest V3)

## Purpose
Manage Chrome Extension lifecycle, messaging, and storage using Manifest V3 standards.

## Rules
- Use `chrome.storage.local` for settings and API keys.
- Prefer `importScripts` in `background.js` (Service Worker).
- Ensure Content Scripts only run on matched domains (Backlog/Redmine).
- Use `chrome.runtime.sendMessage` for async communication between components.
- Keep `manifest.json` permissions minimal (Least Privilege).

## Validation Checklist
- [ ] No `eval()` or unsafe-inline in scripts.
- [ ] Service worker successfully handles alarms and notifications.
- [ ] Content scripts do not leak sensitive data to the page DOM.
- [ ] Version in `manifest.json` matches `package.json`.
