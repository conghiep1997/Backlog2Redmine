# Skill: AI Provider Integration

## Purpose
Implement and maintain multi-provider AI translation flow (Gemini, Groq, Cerebras, OpenRouter).

## Rules
- Keep provider config normalized by `provider`, `keysStorage`, `modelsStorage`.
- Support multiple keys/models with deterministic fallback order.
- Store keys/models encrypted before writing to storage.
- Do not hardcode deprecated model IDs.
- Preserve current provider names and constants (`TB.PROVIDERS`).

## Validation Checklist
- [ ] Primary and fallback providers both support multi-key/multi-model.
- [ ] Deprecated models removed from defaults and constants.
- [ ] API key masking (`**********`) logic preserved on options page.
- [ ] Provider-specific UI sections toggle correctly.
