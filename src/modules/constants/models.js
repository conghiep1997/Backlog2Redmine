/**
 * AI Model configurations and definitions.
 */
(function (global) {
  const GEMINI_MODELS = [
    { value: "gemma-3-27b-it", label: "Gemma 3 27B IT (RPM 15, RPD 31)" },
    { value: "gemma-3-12b-it", label: "Gemma 3 12B IT (RPM 30)" },
    { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (RPM 17)", default: true },
    { value: "gemini-flash-lite-latest", label: "Gemini Flash Lite Latest (Stable)" },
  ];

  const CEREBRAS_MODELS = [
    { value: "gpt-oss-120b", label: "GPT OSS 120B (High Quality)", default: true },
    { value: "qwen-3-235b-a22b-instruct-2507", label: "Qwen 3 235B A22B Instruct (Smartest Multilingual, Preview)" },
    { value: "zai-glm-4.7", label: "ZAI GLM 4.7 (Strong Multilingual, Preview)" },
  ];

  const GROQ_MODELS = [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (Best Multilingual)", default: true },
    { value: "openai/gpt-oss-120b", label: "GPT OSS 120B (High Quality)" },
    { value: "qwen/qwen3-32b", label: "Qwen 3 32B (Good Multilingual, Preview)" },
    { value: "openai/gpt-oss-20b", label: "GPT OSS 20B (Balanced & Fast)" },
  ];

  global.TB_MODELS = {
    GEMINI_MODELS,
    CEREBRAS_MODELS,
    GROQ_MODELS,
    GEMINI: "gemini-3.1-flash-lite-preview",
    GEMINI_FALLBACK: "gemini-flash-lite-latest",
    CEREBRAS: "gpt-oss-120b",
    GROQ: "llama-3.3-70b-versatile",
  };
})(globalThis);
