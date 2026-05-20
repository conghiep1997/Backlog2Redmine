/**
 * AI Model configurations and definitions.
 */
(function (global) {
  const GEMINI_MODELS = [
    {
      value: "gemini-3.1-flash-lite",
      label: "Gemini 3.1 Flash Lite (RPD 500) \u2B50 M\u1EB7c \u0111\u1ECBnh",
      default: true,
    },
    {
      value: "gemma-4-31b-it",
      label: "Gemma 4 31B IT (RPD 1.5K) \u2728 Ch\u1EA5t l\u01B0\u1EE3ng cao",
    },
    {
      value: "gemma-4-26b-a4b-it",
      label: "Gemma 4 26B A4B IT (RPD 1.5K) \uD83D\uDC8E MoE Stable",
    },
  ];

  const CEREBRAS_MODELS = [
    { value: "gpt-oss-120b", label: "GPT OSS 120B (High Quality)", default: true },
    {
      value: "qwen-3-235b-a22b-instruct-2507",
      label: "Qwen 3 235B A22B Instruct (Smartest Multilingual, Preview)",
    },
    { value: "zai-glm-4.7", label: "ZAI GLM 4.7 (Strong Multilingual, Preview)" },
  ];

  const OPENROUTER_MODELS = [
    { value: "openrouter/free", label: "OpenRouter Free Router (auto free model)", default: true },
    { value: "qwen/qwen3-coder:free", label: "Qwen3 Coder 480B A35B (Free, long context)" },
    { value: "meta-llama/llama-3.2-3b-instruct:free", label: "Llama 3.2 3B Instruct (Free)" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (Paid, fast multilingual)" },
    {
      value: "meta-llama/llama-3.1-70b-instruct",
      label: "Meta Llama 3.1 70B (Paid, strong multilingual)",
    },
    { value: "mistralai/mistral-7b-instruct-v0.3", label: "Mistral 7B Instruct v0.3 (Efficient)" },
    { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (Lightweight)" },
  ];

  const GROQ_MODELS = [
    {
      value: "llama-3.3-70b-versatile",
      label: "Llama 3.3 70B Versatile (Best Multilingual)",
      default: true,
    },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (High free RPD)" },
    {
      value: "meta-llama/llama-4-scout-17b-16e-instruct",
      label: "Llama 4 Scout 17B 16E (Good free RPD)",
    },
    { value: "qwen/qwen3-32b", label: "Qwen 3 32B (Higher RPM, multilingual)" },
    { value: "openai/gpt-oss-120b", label: "GPT OSS 120B (High Quality)" },
    { value: "openai/gpt-oss-20b", label: "GPT OSS 20B (Balanced & Fast)" },
  ];

  global.TB_PROVIDERS = {
    GEMINI: "gemini",
    CEREBRAS: "cerebras",
    GROQ: "groq",
    OPENROUTER: "openrouter",
    NONE: "none",
  };

  global.TB_MODELS = {
    GEMINI_MODELS,
    CEREBRAS_MODELS,
    GROQ_MODELS,
    OPENROUTER_MODELS,
    GEMINI: "gemini-3.1-flash-lite-preview",
    GEMINI_FALLBACK: "gemma-4-31b-it",
    CEREBRAS: "gpt-oss-120b",
    GROQ: "llama-3.3-70b-versatile",
    OPENROUTER: "openrouter/free",
  };
})(globalThis);
