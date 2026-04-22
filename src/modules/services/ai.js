/**
 * AI Translation Service using Gemini and Cerebras.
 */

/**
 * Main translation function with fallback support.
 * @param {string} commentText - Text to translate
 * @param {object} settings - Extension settings
 * @param {string|null} commentUrl - Optional comment URL for attribution
 * @param {function} promptFn - Prompt builder function
 * @returns {Promise<string>} Translated text
 */
async function translateText(commentText, settings, commentUrl = null, promptFn = TB.PROMPTS.USER) {
  const primaryProvider = settings.primaryProvider || TB.DEFAULT_PRIMARY_PROVIDER;
  const primaryModel = settings.primaryModel || TB.DEFAULT_PRIMARY_MODEL;
  const fallbackProvider = settings.fallbackProvider || TB.DEFAULT_FALLBACK_PROVIDER;
  const fallbackModel = settings.fallbackModel || TB.DEFAULT_FALLBACK_MODEL;

  try {
    // Attempt Primary Translation
    return await callAIsByProvider(
      primaryProvider,
      primaryModel,
      settings,
      commentText,
      commentUrl,
      promptFn
    );
  } catch (error) {
    // Check if we should fallback (429 or general failure)
    const isRateLimit = error.message.includes("429") || error.message.includes("rate limit");
    const hasFallback = fallbackProvider && fallbackProvider !== TB.PROVIDERS.NONE;

    if (isRateLimit && hasFallback) {
      console.warn(
        `[TB-AI] Primary (${primaryProvider}) rate limited. Falling back to ${fallbackProvider}...`
      );
      try {
        return await callAIsByProvider(
          fallbackProvider,
          fallbackModel,
          settings,
          commentText,
          commentUrl,
          promptFn
        );
      } catch (fallbackError) {
        throw new Error(TB.MESSAGES.TOAST.RATE_LIMIT_FAILED);
      }
    }
    throw error;
  }
}

/**
 * Helper to route call to the correct provider function.
 * @param {string} provider - Provider name (gemini|cerebras)
 * @param {string} model - Model identifier
 * @param {object} settings - Extension settings
 * @param {string} text - Text to translate
 * @param {string|null} url - Optional comment URL
 * @param {function} promptFn - Prompt builder function
 * @returns {Promise<string>} Translated text
 */
async function callAIsByProvider(provider, model, settings, text, url, promptFn) {
  if (provider === TB.PROVIDERS.GEMINI) {
    return await callGeminiAPI(settings.geminiApiKey, text, model, null, promptFn, url);
  } else if (provider === TB.PROVIDERS.CEREBRAS) {
    return await callCerebrasAPI(settings.cerebrasApiKey, text, model, promptFn, url);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function translateWithGemini(
  apiKey,
  commentText,
  model,
  fallbackModel = null,
  commentUrl = null,
  promptFn = TB.PROMPTS.USER
) {
  try {
    return await callGeminiAPI(apiKey, commentText, model, null, promptFn, commentUrl);
  } catch (error) {
    if (error.message.includes("429") || error.message.includes("rate limit")) {
      if (fallbackModel && fallbackModel !== model) {
        try {
          return await callGeminiAPI(apiKey, commentText, fallbackModel, null, promptFn);
        } catch (fallbackError) {
          throw new Error(TB.MESSAGES.TOAST.RATE_LIMIT_FAILED);
        }
      }
    }
    throw error;
  }
}

async function callGeminiAPI(
  apiKey,
  commentText,
  model,
  fallbackModel = null,
  promptFn = TB.PROMPTS.USER,
  commentUrl = null
) {
  // Call Gemini API with timeout to avoid hanging connections
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await timeoutFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: TB.PROMPTS.SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: promptFn(commentText) }] }],
        generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 2048 },
      }),
    },
    15000
  ); // 15s timeout cho Gemini

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Gemini (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? "")
    .join("")
    .trim();

  if (!rawText) {
    throw new Error(TB.MESSAGES.GEMINI.EMPTY_TRANSLATION);
  }

  const cleaned = normalizeTranslationOutput(rawText);
  if (promptFn === TB.PROMPTS.USER) {
    return formatTranslation(commentText, cleaned, commentUrl);
  }
  return cleaned;
}

async function translateWithCerebras(
  apiKey,
  commentText,
  model,
  commentUrl = null,
  promptFn = TB.PROMPTS.USER
) {
  return callCerebrasAPI(apiKey, commentText, model, promptFn, commentUrl);
}

async function callCerebrasAPI(
  apiKey,
  commentText,
  model,
  promptFn = TB.PROMPTS.USER,
  commentUrl = null
) {
  // Call Cerebras API with timeout
  const response = await timeoutFetch(
    "https://api.cerebras.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: TB.PROMPTS.SYSTEM },
          { role: "user", content: promptFn(commentText) },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    },
    15000
  ); // 15s timeout cho Cerebras

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Cerebras (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.choices?.[0]?.message?.content?.trim();
  if (!rawText) {
    throw new Error("AI returned no content.");
  }

  const cleaned = normalizeTranslationOutput(rawText);
  if (promptFn === TB.PROMPTS.USER) {
    return formatTranslation(commentText, cleaned, commentUrl);
  }
  return cleaned;
}

function normalizeTranslationOutput(rawText) {
  // Normalize output from AI: remove unnecessary markers and tags
  let cleaned = rawText.trim();
  const resultPatterns = [
    /<result>([\s\S]*?)<\/result>/i,
    /\[result\]([\s\S]*?)\[\/result\]/i,
    /result:([\s\S]*)/i,
  ];

  let foundContent = "";
  for (const pattern of resultPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      foundContent = match[1].trim();
      break;
    }
  }

  if (foundContent) {
    cleaned = foundContent;
  } else {
    cleaned = cleaned
      .replace(/^```[\w-]*\n?/g, "")
      .replace(/\n?```$/g, "")
      .trim();
    const noiseMarkers = [
      "COMPLY RULES:",
      "MANDATORY RULES:",
      "BẢN DỊCH:",
      "DIỄN GIẢI:",
      "BẮT ĐẦU NỘI DUNG",
      "KẾT THÚC NỘI DUNG",
      "TRANSLATION:",
      "TASK:",
      "[TB_START]",
      "[TB_END]",
    ];
    const lines = cleaned.split("\n");
    let firstValidLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      const isNoise = noiseMarkers.some((marker) =>
        line.toUpperCase().includes(marker.toUpperCase())
      );
      if (isNoise || /^\d+\.\s+[A-Z\s]+/.test(line)) {
        firstValidLineIndex = i + 1;
        continue;
      }
      break;
    }
    cleaned = lines.slice(firstValidLineIndex).join("\n").trim();
  }

  // --- Start Added Logic ---
  // Fix mangled markers that AI often generates instead of keeping standard [[TB_IMG:id]]
  cleaned = fixMangledMarkers(cleaned);
  // --- End Added Logic ---

  cleaned = cleaned
    .replace(/\[KẾT THÚC NỘI DUNG\]\s*$/g, "")
    .replace(/\[BẮT ĐẦU NỘI DUNG\]\s*$/g, "")
    .replace(/\[TB_END\]\s*$/g, "")
    .replace(/\[TB_START\]\s*$/g, "")
    .replace(/\[\/?result\]/gi, "")
    .replace(/<\/?result>/gi, "")
    .trim();
  if (!cleaned || cleaned.length < 2) {
    cleaned = rawText.trim();
  }

  return cleaned;
}

/**
 * Fixes common mangled marker formats that AI hallucinations produce.
 * @param {string} text - The translated text to repair.
 * @returns {string} Repaired text.
 */
function fixMangledMarkers(text) {
  if (!text) return "";

  let result = text;

  // 1. Nested mangling: ![image]([[TB_IMG:12345]])
  result = result.replace(/!\[[^\]]*\]\(\[\[TB_IMG:\s*(\d+)\s*\]\]\)/gi, "[[TB_IMG:$1]]");

  // 2. Standard Markdown mangling: ![12345](image) OR ![image](12345)
  result = result.replace(/!\[(\d+)\]\(image\)/gi, "[[TB_IMG:$1]]");
  result = result.replace(/!\[image\]\((\d+)\)/gi, "[[TB_IMG:$1]]");

  // 3. Descriptive mangling: ![Backlog Image](12345)
  result = result.replace(/!\[[^\]]*\]\((\d+)\)/gi, "[[TB_IMG:$1]]");

  // 4. Extra space mangling: [[TB_IMG: 12345]]
  result = result.replace(/\[\[TB_IMG:\s*(\d+)\s*\]\]/gi, "[[TB_IMG:$1]]");

  // 5. Double bracket mangling: [[TB_IMG:[12345]]]
  result = result.replace(/\[\[TB_IMG:\[(\d+)\]\]\]/gi, "[[TB_IMG:$1]]");

  // 6. Inline link mangling: [image_12345.png]([[TB_IMG:12345]])
  result = result.replace(/\[[^\]]+\.(png|jpg|jpeg|gif)\]\(\[\[TB_IMG:\s*(\d+)\s*\]\]\)/gi, "[[TB_IMG:$2]]");

  return result;
}

function formatTranslation(originalText, cleanedText, commentUrl = null) {
  // Format output: add comment URL (if exists) and translation
  const prefix = commentUrl ? `${commentUrl}\n\n` : "";
  return `${prefix}${originalText.trim()}\n\n---\n\n{{collapse(VN)\n\n${cleanedText}\n}}`;
}

function sanitizeErrorMessage(message, status) {
  let displayMessage = message;
  try {
    const errorJson = JSON.parse(message);
    displayMessage = errorJson.error?.message || errorJson.error || errorJson.message || message;
  } catch (e) {
    // Ignore parsing error if message is not JSON
  }
  return `Error ${status}: ${displayMessage.replace(/https?:\/\/[^\s]+/g, "[URL]").slice(0, 200)}`;
}
