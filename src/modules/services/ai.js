/**
 * AI Translation Service using Gemini and Cerebras.
 */


async function translateText(commentText, settings, commentUrl = null, promptFn = TB.PROMPTS.USER) {
  const provider = settings.aiProvider || TB.PROVIDERS.CEREBRAS;

  try {
    if (provider === TB.PROVIDERS.CEREBRAS) {
      return await translateWithCerebras(
        settings.cerebrasApiKey,
        commentText,
        settings.cerebrasModel,
        commentUrl,
        promptFn
      );
    } else {
      return await translateWithGemini(
        settings.geminiApiKey,
        commentText,
        settings.geminiModel,
        settings.geminiFallbackModel,
        commentUrl,
        promptFn
      );
    }
  } catch (error) {
    if ((error.message.includes("429") || error.message.includes("rate limit")) && settings.geminiApiKey) {
      if (settings.geminiModel !== TB.GEMINI_FALLBACK_MODEL || provider === TB.PROVIDERS.CEREBRAS) {
          try {
            return await callGeminiAPI(settings.geminiApiKey, commentText, TB.GEMINI_FALLBACK_MODEL, null, promptFn, commentUrl);
          } catch (failoverError) {
            throw new Error(TB.MESSAGES.TOAST.RATE_LIMIT_FAILED);
          }
      }
    }
    throw error;
  }
}

async function translateWithGemini(apiKey, commentText, model, fallbackModel = null, commentUrl = null, promptFn = TB.PROMPTS.USER) {
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

async function callGeminiAPI(apiKey, commentText, model, fallbackModel = null, promptFn = TB.PROMPTS.USER, commentUrl = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: TB.PROMPTS.SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: promptFn(commentText) }] }],
      generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Gemini (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text ?? "").join("").trim();

  if (!rawText) throw new Error(TB.MESSAGES.GEMINI.EMPTY_TRANSLATION);

  const cleaned = normalizeTranslationOutput(rawText);
  if (promptFn === TB.PROMPTS.USER) {
    return formatTranslation(commentText, cleaned, commentUrl);
  }
  return cleaned;
}

async function translateWithCerebras(apiKey, commentText, model, commentUrl = null, promptFn = TB.PROMPTS.USER) {
  return callCerebrasAPI(apiKey, commentText, model, promptFn, commentUrl);
}

async function callCerebrasAPI(apiKey, commentText, model, promptFn = TB.PROMPTS.USER, commentUrl = null) {
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
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
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Cerebras (${model}): ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const data = await safeReadJson(response);
  const rawText = data?.choices?.[0]?.message?.content?.trim();
  if (!rawText) throw new Error("AI khong tra ve noi dung.");

  const cleaned = normalizeTranslationOutput(rawText);
  if (promptFn === TB.PROMPTS.USER) {
    return formatTranslation(commentText, cleaned, commentUrl);
  }
  return cleaned;
}

function normalizeTranslationOutput(rawText) {
  let cleaned = rawText.trim();
  const resultPatterns = [
    /<result>([\s\S]*?)<\/result>/i,
    /\[result\]([\s\S]*?)\[\/result\]/i,
    /result:([\s\S]*)/i
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
    cleaned = cleaned.replace(/^```[\w-]*\n?/g, "").replace(/\n?```$/g, "").trim();
    const noiseMarkers = ["CÁC QUY TẮC PHẢI TUÂN THỦ:", "QUY TẮC BẮT BUỘC:", "BẢN DỊCH:", "NHIỆM VỤ:", "[TB_START]", "[TB_END]"];
    let lines = cleaned.split("\n");
    let firstValidLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const isNoise = noiseMarkers.some(marker => line.toUpperCase().includes(marker.toUpperCase()));
      if (isNoise || /^\d+\.\s+[A-Z\s]+/.test(line)) {
        firstValidLineIndex = i + 1;
        continue;
      }
      break;
    }
    cleaned = lines.slice(firstValidLineIndex).join("\n").trim();
  }

  cleaned = cleaned.replace(/\[TB_END\]\s*$/g, "").replace(/\[TB_START\]\s*$/g, "").replace(/\[\/?result\]/gi, "").replace(/<\/?result>/gi, "").trim();
  if (!cleaned || cleaned.length < 2) cleaned = rawText.trim(); 
  
  return cleaned;
}

function formatTranslation(originalText, cleanedText, commentUrl = null) {
  const prefix = commentUrl ? `${commentUrl}\n\n` : "";
  return `${prefix}${originalText.trim()}\n\n---\n\n${cleanedText}`;
}

function sanitizeErrorMessage(message, status) {
  let displayMessage = message;
  try {
    const errorJson = JSON.parse(message);
    displayMessage = errorJson.error?.message || errorJson.error || errorJson.message || message;
  } catch (e) {}
  return `Lỗi ${status}: ${displayMessage.replace(/https?:\/\/[^\s]+/g, "[URL]").slice(0, 200)}`;
}
