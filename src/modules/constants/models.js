/**
 * AI Model configurations and definitions.
 */
(function (global) {
  const GEMINI_MODELS = [
    {
      value: "gemini-2.5-flash-lite",
      label: "Gemini 2.5 Flash-Lite (RPM 15, RPD 1000) ⭐ Fastest",
      default: true,
    },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (RPM 10, RPD 250)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (RPM 5, RPD 100) 🔥 Best Quality" },
    { value: "gemma-3-27b-it", label: "Gemma 3 27B IT (RPM 15, RPD 31)" },
    { value: "gemini-3.1-flash-lite-preview-05-20", label: "Gemini 3.1 Flash Lite (Legacy)" },
  ];

  const CEREBRAS_MODELS = [
    { value: "gpt-oss-120b", label: "GPT OSS 120B (High Quality)", default: true },
    {
      value: "qwen-3-235b-a22b-instruct-2507",
      label: "Qwen 3 235B A22B Instruct (Smartest Multilingual, Preview)",
    },
    { value: "zai-glm-4.7", label: "ZAI GLM 4.7 (Strong Multilingual, Preview)" },
  ];

  const GROQ_MODELS = [
    {
      value: "llama-3.3-70b-versatile",
      label: "Llama 3.3 70B Versatile (Best Multilingual)",
      default: true,
    },
    { value: "openai/gpt-oss-120b", label: "GPT OSS 120B (High Quality)" },
    { value: "qwen/qwen3-32b", label: "Qwen 3 32B (Good Multilingual, Preview)" },
    { value: "openai/gpt-oss-20b", label: "GPT OSS 20B (Balanced & Fast)" },
  ];

  global.TB_MODELS = {
    GEMINI_MODELS,
    CEREBRAS_MODELS,
    GROQ_MODELS,
    GEMINI: "gemini-2.5-flash-lite",
    GEMINI_FALLBACK: "gemini-2.5-flash",
    CEREBRAS: "gpt-oss-120b",
    GROQ: "llama-3.3-70b-versatile",
  };
})(globalThis);
