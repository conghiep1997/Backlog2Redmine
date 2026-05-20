# Skill: Focused Code Review

## Purpose
Review changed files for architecture fit, safety, and project conventions before merge.

## Rules
- Review changed files first (`git diff`) before broader scan.
- Match existing module split: `constants`, `services`, `ui`, `utils`.
- Reject risky refactors that mix provider logic with UI rendering.
- Flag any plaintext secret handling or key logging.
- Reuse existing helper/utilities instead of duplicating logic.

## Validation Checklist
- [ ] No secrets exposed in logs, DOM, or committed files.
- [ ] New code follows existing naming (`TB_*`, `camelCase`).
- [ ] Storage schema changes remain backward compatible.
- [ ] Background/options/content responsibilities remain separated.
- [ ] Lint + format pass on modified files.
