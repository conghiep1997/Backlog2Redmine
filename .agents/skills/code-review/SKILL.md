# name
code-review

# description
Focused review guidance for Backlog2Redmine changes, emphasizing changed files, extension architecture, security, and project rules.

# when to use
- Always use before finalizing repository guidance or code changes.
- Reviewing a PR, diff, refactor, or generated change.
- Validating edits against `AGENTS.md`, relevant skills, source patterns, and security constraints.

# concise rules
- Start with `git status --short` and changed-file diffs before broader scans.
- Load `AGENTS.md` and only the skill files relevant to changed areas.
- If `.rules/` exists, load only relevant rule files.
- Avoid full repo scans unless changed files reveal a cross-cutting risk.
- Report bugs, regressions, architecture violations, forbidden patterns, and missing validation first.
- Do not rewrite unrelated files during review.
- Check for plaintext secrets, unsafe logging, widened permissions, and insecure DOM injection.
- Validate against module boundaries: background for privileged work, content scripts for DOM, services for APIs, utils for shared helpers.

# validation checklist
- Changed files follow existing naming, globals, formatting, and module patterns.
- Manifest load order and permissions still match code needs.
- Storage schema changes remain backward compatible or clearly migrated.
- API keys and credentials remain encrypted/masked and are not logged.
- Existing npm validation commands relevant to the change are identified or run.
- Findings include file/line references when reporting issues.
