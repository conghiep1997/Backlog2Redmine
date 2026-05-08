/**
 * AI Translation Service using Gemini and Cerebras.
 */

// Global state for round-robin index. This persists for the service worker's lifetime.
let lastUsedGeminiIndex = 0;

/**
 * Fetches the list of available models from a provider.
 * @param {string} provider - The AI provider (e.g., 'gemini', 'groq').
 * @param {string} apiKey - The API key for the provider.
 * @returns {Promise<Array<{value: string, label: string}>>} A list of models.
 */
async function listProviderModels(provider, apiKey) {
  switch (provider) {
  case TB.PROVIDERS.GEMINI:
    return _listGeminiModels(apiKey);
  case TB.PROVIDERS.GROQ:
    return _listGroqModels(apiKey);
  case TB.PROVIDERS.CEREBRAS:
    // Cerebras does not have a public model listing API, return hardcoded list.
    return Promise.resolve(TB.CEREBRAS_MODELS);
  case TB.PROVIDERS.GEM:
    // Custom GEM does not support dynamic listing, return hardcoded list.
    return Promise.resolve(TB.GEM_MODELS);
  default:
    return Promise.resolve([]);
  }
}

async function _listGeminiModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const response = await timeoutFetch(url, { method: "GET" }, 5000);
  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch Gemini models: ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }
  const data = await safeReadJson(response);
  return data.models
    .filter((model) => model.supportedGenerationMethods.includes("generateContent"))
    .map((model) => ({
      value: model.name.replace("models/", ""),
      label: model.displayName || model.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Sort for better UX
}

async function _listGroqModels(apiKey) {
  const url = "https://api.groq.com/openai/v1/models";
  const response = await timeoutFetch(
    url,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    5000
  );
  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch Groq models: ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }
  const data = await safeReadJson(response);
  return data.data
    .map((model) => ({
      value: model.id,
      label: model.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Tests the availability of a specific model by sending a minimal request.
 * @param {string} provider The AI provider.
 * @param {string} modelId The ID of the model to test.
 * @param {object} settings The extension settings.
 * @returns {Promise<{ok: boolean, message: string}>} Test result.
 */
async function testModelAvailability(provider, modelId, settings) {
  const testText = "Hello";
  try {
    switch (provider) {
    case TB.PROVIDERS.GEMINI: {
      // Find any valid Gemini key to use for testing
      const apiKey = settings.geminiApiKeys?.[0] || settings.geminiApiKey;
      if (!apiKey) throw new Error("No Gemini API key found for testing.");
      await callGeminiAPI(apiKey, testText, modelId, () => "Just say \"ok\"");
      break;
    }
    case TB.PROVIDERS.GROQ:
      if (!settings.groqApiKey) throw new Error("No Groq API key found for testing.");
      await callGroqAPI(settings.groqApiKey, testText, modelId, () => "Just say \"ok\"");
      break;
    case TB.PROVIDERS.CEREBRAS:
      if (!settings.cerebrasApiKey) throw new Error("No Cerebras API key found for testing.");
      await callCerebrasAPI(settings.cerebrasApiKey, testText, modelId, () => "Just say \"ok\"");
      break;
    case TB.PROVIDERS.GEM:
      if (!settings.gemEndpoint) throw new Error("No Custom GEM endpoint configured.");
      await callGemAPI(settings.gemEndpoint, settings.gemApiKey, testText, modelId, () => "Just say \"ok\"");
      break;
    default:
      throw new Error(`Unsupported provider for testing: ${provider}`);
    }
    return { ok: true, message: "Model is responsive." };
  } catch (error) {
    console.warn(`[TB-AI] Model test failed for ${modelId}:`, error);
    return { ok: false, message: error.message };
  }
}

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
    // Fallback on rate limit and temporary provider overloads such as Gemini 503 high demand.
    const isRetryableProviderFailure =
      error.message.includes("429") ||
      error.message.includes("rate limit") ||
      error.message.includes("503") ||
      error.message.toLowerCase().includes("high demand") ||
      error.message.toLowerCase().includes("try again later");
    const hasFallback = fallbackProvider && fallbackProvider !== TB.PROVIDERS.NONE;

    if (isRetryableProviderFailure && hasFallback) {
      console.warn(
        `[TB-AI] Primary (${primaryProvider}) temporarily unavailable. Falling back to ${fallbackProvider}...`
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
        throw new Error(
          `${TB.MESSAGES.TOAST.RATE_LIMIT_FAILED} Primary: ${error.message} | Fallback: ${fallbackError.message}`
        );
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
function getRandomGeminiKey(apiKeys) {
  if (!apiKeys || apiKeys.length === 0) return null;
  const idx = Math.floor(Math.random() * apiKeys.length);
  return apiKeys[idx].trim();
}

function getRandomGeminiModel(models) {
  if (!models || models.length === 0) return null;
  const idx = Math.floor(Math.random() * models.length);
  return models[idx].trim();
}

async function callAIsByProvider(provider, model, settings, text, url, promptFn) {
  if (provider === TB.PROVIDERS.GEMINI) {
    // Use settings models if available, otherwise use all official models, otherwise fallback to the passed model
    let models = [];
    if (settings.geminiModels?.length > 0) {
      models = settings.geminiModels;
    } else if (TB.GEMINI_MODELS?.length > 0) {
      models = TB.GEMINI_MODELS.map((m) => m.value);
    } else {
      models = [model];
    }

    const apiKeys =
      (settings.geminiApiKeys?.length > 0
        ? settings.geminiApiKeys
        : [settings.geminiApiKey]
      ).filter(Boolean);

    // Create a flat list of all [model, key] combinations
    const combinations = [];
    for (const m of models) {
      for (const key of apiKeys) {
        combinations.push({ model: m, key });
      }
    }

    if (combinations.length === 0) {
      throw new Error("No Gemini models or API keys are configured.");
    }

    let lastError = null;
    const startIndex = lastUsedGeminiIndex % combinations.length;

    // Iterate through combinations in a round-robin fashion for failover
    for (let i = 0; i < combinations.length; i++) {
      const currentIndex = (startIndex + i) % combinations.length;
      const { model: currentModel, key: currentKey } = combinations[currentIndex];

      try {
        console.log(`[TB-AI] Attempting call with model: ${currentModel} (Round-Robin)`);
        const result = await callGeminiAPI(currentKey, text, currentModel, promptFn, url);

        // Success! Update the index for the next call and return.
        lastUsedGeminiIndex = (currentIndex + 1) % combinations.length;
        return result;
      } catch (error) {
        const isRetryable =
          error.message.includes("429") ||
          error.message.includes("rate limit") ||
          error.message.includes("503") ||
          error.message.toLowerCase().includes("high demand") ||
          error.message.toLowerCase().includes("try again later");

        if (!isRetryable) {
          // For non-retryable errors, fail immediately.
          throw error;
        }
        lastError = error;
        console.warn(`[TB-AI] Gemini (${currentModel}) failed with ${error.message}, trying next...`);
      }
    }

    // If all combinations were exhausted, throw the last captured error.
    throw lastError || new Error("All Gemini model/key combinations failed.");
  } else if (provider === TB.PROVIDERS.CEREBRAS) {
    return await callCerebrasAPI(settings.cerebrasApiKey, text, model, promptFn, url);
  } else if (provider === TB.PROVIDERS.GROQ) {
    return await callGroqAPI(settings.groqApiKey, text, model, promptFn);
  } else if (provider === TB.PROVIDERS.GEM) {
    return await callGemAPI(settings.gemEndpoint, settings.gemApiKey, text, model, promptFn);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function callGemAPI(endpoint, apiKey, commentText, model, promptFn = TB.PROMPTS.USER) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await timeoutFetch(
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model || "custom-gem",
        messages: [
          { role: "system", content: TB.PROMPTS.SYSTEM },
          { role: "user", content: promptFn(commentText) },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    },
    15000
  ); // 15s timeout

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Custom GEM (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.choices?.[0]?.message?.content?.trim();
  if (!rawText) {
    throw new Error("Custom GEM returned no content.");
  }

  const cleaned = normalizeTranslationOutput(rawText);
  if (promptFn === TB.PROMPTS.USER) {
    return formatTranslation(commentText, cleaned, null);
  }
  return cleaned;
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
  promptFn = TB.PROMPTS.USER,
  commentUrl = null
) {
  // Call Gemini API with timeout to avoid hanging connections
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const isGemma = model.toLowerCase().includes("gemma");
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: isGemma
              ? `${TB.PROMPTS.SYSTEM}\n\n${promptFn(commentText)}`
              : promptFn(commentText),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  };

  // Only Gemini models support system_instruction parameter
  if (!isGemma) {
    payload.system_instruction = {
      parts: [{ text: TB.PROMPTS.SYSTEM }],
    };
  }

  const response = await timeoutFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    10000
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
    10000
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

async function callGroqAPI(apiKey, commentText, model, promptFn = TB.PROMPTS.USER) {
  // Call Groq API with timeout
  const response = await timeoutFetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: TB.PROMPTS.SYSTEM },
          { role: "user", content: promptFn(commentText) },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    },
    10000
  );

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Groq (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.choices?.[0]?.message?.content?.trim();
  if (!rawText) {
    throw new Error("AI returned no content.");
  }

  const cleaned = normalizeTranslationOutput(rawText);
  if (promptFn === TB.PROMPTS.USER) {
    return formatTranslation(commentText, cleaned, null);
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
  result = result.replace(
    /\[[^\]]+\.(png|jpg|jpeg|gif)\]\(\[\[TB_IMG:\s*(\d+)\s*\]\]\)/gi,
    "[[TB_IMG:$2]]"
  );

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
