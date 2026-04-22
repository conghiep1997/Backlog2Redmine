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
    { value: "llama3.1-8b", label: "Llama 3.1 8B (Fastest & Stable)" },
    { value: "qwen-3-235b-instruct-2507", label: "Qwen 3 235B (Smartest & High Quota)" },
    { value: "gpt-oss-120b", label: "GPT OSS 120B (High Quality)", default: true },
    { value: "zai-glm-4.7", label: "ZAI GLM 4.7 (Preview)" },
  ];

  global.TB_MODELS = {
    GEMINI_MODELS,
    CEREBRAS_MODELS,
    GEMINI: "gemini-3.1-flash-lite-preview",
    GEMINI_FALLBACK: "gemini-flash-lite-latest",
    CEREBRAS: "gpt-oss-120b",
  };
})(globalThis);
