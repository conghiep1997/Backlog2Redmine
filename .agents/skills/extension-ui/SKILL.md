# name
extension-ui

# description
Guidance for Backlog2Redmine options UI, injected Backlog/Redmine controls, shared modal/toast styling, and Sheets/testcase extension pages.

# when to use
- Editing `src/options.html`, `src/options.js`, content-script UI, or `src/modules/ui/*`.
- Changing injected Backlog buttons, modals, toasts, Redmine controls, Sheets sidebar, or testcase converter pages.
- Updating i18n messages or UI text surfaced through `TB.MESSAGES`.

# concise rules
- Keep DOM injection scoped to matched pages and stable selectors.
- Use existing UI helpers in `src/modules/ui/` before adding new patterns.
- Keep options UI settings aligned with encrypted storage keys and background `getSettings`.
- Avoid API/user/page data in `innerHTML`; sanitize, use `textContent`, `new Option`, or DOM nodes.
- Keep markdown preview links limited to safe protocols.
- Preserve SPA navigation handling and observer cleanup in content scripts.
- Keep Vietnamese/i18n fallbacks consistent with `_locales/` and `src/constants.js`.
- Do not move privileged API calls into page-facing UI code.

# validation checklist
- Options save/load still masks saved API keys.
- UI controls do not duplicate on repeated scans or SPA navigation.
- Toasts/modals report success and failure states clearly.
- Added UI text has matching message keys or intentional fallback.
- API-provided labels and names are escaped before rendering.
- Layout changes are checked in the relevant extension page/context.
