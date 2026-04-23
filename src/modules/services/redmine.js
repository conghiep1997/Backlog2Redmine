/* global downloadBacklogFile, TB_LOGGER */
/**
 * Redmine API Service for Backlog2Redmine Extension.
 * Handles operations with Redmine API: finding issues, sending notes, and uploading files.
 */

/**
 * Finds Redmine issue by searching HTML first, then falling back to API.
 * @param {string} redmineDomain - Redmine domain
 * @param {string} apiKey - Redmine API key
 * @param {string} issueKey - Issue key (e.g., CP-123)
 * @param {string} issueSummary - Issue summary/title
 * @returns {Promise<{id: string, title: string}>} Matched issue info
 */
async function findRedmineIssue(redmineDomain, apiKey, issueKey, issueSummary = "") {
  const normalizedIssueKey = normalizeLoose(issueKey);
  const normalizedIssueSummary = normalizeLoose(issueSummary);
  const searchQuery = [issueKey, issueSummary].filter(Boolean).join(" ");
  const searchUrl = buildRedmineUrl(
    redmineDomain,
    `/search?${new URLSearchParams({
      q: searchQuery,
      scope: "all",
      titles_only: "1",
      issues: "1",
      commit: "Search",
    }).toString()}`
  );

  try {
    // Attempt to search HTML first for the best match
    const html = await fetchRedmineSearchHtml(searchUrl);
    const searchResults = extractRedmineSearchResults(html);
    const bestMatch = pickBestRedmineSearchResult(
      searchResults,
      normalizedIssueKey,
      normalizedIssueSummary
    );

    if (bestMatch) {
      return { id: String(bestMatch.id), title: bestMatch.subject };
    }
  } catch (error) {
    console.warn("[RedmineService] Search HTML failed, falling back to API:", error.message);
  }

  // Fallback to API if HTML search failed
  return findRedmineIssueViaApi(redmineDomain, apiKey, issueKey, issueSummary);
}

/**
 * Finds issues based on a set of criteria.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @param {object} params - An object of query parameters (e.g., { project_id, tracker_id, subject }).
 * @returns {Promise<Array<object>>} A promise that resolves to an array of issue objects.
 */
async function findIssues(redmineDomain, apiKey, params) {
  const query = new URLSearchParams(params).toString();
  const url = buildRedmineUrl(redmineDomain, `/issues.json?${query}`);

  const response = await fetch(url, {
    headers: {
      "X-Redmine-API-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to find issues: ${errorMsg}`);
  }

  const data = await response.json();
  return data.issues || [];
}

/**
 * Finds issue via Redmine REST API.
 * Fallback method when HTML search is unsuccessful.
 */
async function findRedmineIssueViaApi(redmineDomain, apiKey, issueKey, issueSummary = "") {
  const url = buildRedmineUrl(
    redmineDomain,
    `/issues.json?subject=${encodeURIComponent(issueKey)}&limit=5`
  );
  const response = await fetch(url, {
    headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`${TB.MESSAGES.REDMINE.LOOKUP_FAILED}: ${response.status}`);
  }

  const data = await safeReadJson(response);
  const issues = Array.isArray(data?.issues) ? data.issues : [];
  if (issues.length === 0) {
    return null;
  }

  const bestMatch = pickBestRedmineSearchResult(
    issues.map((i) => ({ id: i.id, subject: i.subject })),
    normalizeLoose(issueKey),
    normalizeLoose(issueSummary)
  );

  const result = bestMatch ?? issues[0];
  return { id: String(result.id), title: result.subject };
}

async function handleSendToRedmine(
  { redmineIssueId, notes, backlogIssueKey, processedAttachments = null },
  sender
) {
  // Send note to Redmine issue, including image processing
  const settings = await getSettings();
  const backlogDomain = sender?.tab?.url ? new URL(sender.tab.url).hostname : null;
  // Process attachments: download from Backlog, upload to Redmine
  const { updatedNotes, uploads } = await processNotesAttachments(
    notes,
    backlogDomain,
    settings,
    backlogIssueKey,
    processedAttachments
  );

  const endpoint = buildRedmineUrl(settings.redmineDomain, `/issues/${redmineIssueId}.json`);
  const payload = {
    issue: {
      notes: updatedNotes,
      uploads: uploads.length > 0 ? uploads : undefined,
    },
  };

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Redmine-API-Key": settings.redmineApiKey,
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    if (typeof TB_LOGGER !== "undefined") {
      TB_LOGGER.logError("RedmineService", `API Error during comment submission: ${errorMsg}`, {
        requestPayload: payload,
        redmineResponse: errorMsg,
      });
    }
    throw new Error(
      `${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR}: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
  }

  const responseData = await safeReadJson(response);
  const journalId = responseData?.journal?.id;
  return {
    message: TB.MESSAGES.TOAST.SEND_SUCCESS,
    redmineUrl: buildRedmineUrl(
      settings.redmineDomain,
      `/issues/${redmineIssueId}${journalId ? `#note-${journalId}` : ""}`
    ),
  };
}

async function handleCreateRedmineIssue({ issueData, comments }) {
  // Create new issue on Redmine with description and comments from Backlog
  const settings = await getSettings();
  // Shared map to track already uploaded attachments during this migration session
  // Key: attachmentId (string), Value: markup (string)
  const processedAttachments = new Map();

  // Process attachments in description
  const { updatedNotes: updatedDescription, uploads: descUploads } = await processNotesAttachments(
    issueData.description || "",
    null,
    settings,
    issueData.backlogIssueKey,
    processedAttachments
  );

  const createUrl = buildRedmineUrl(settings.redmineDomain, "/issues.json");
  const payload = {
    issue: {
      project_id: issueData.project_id,
      tracker_id: issueData.tracker_id,
      priority_id: issueData.priority_id,
      subject: issueData.subject,
      description: updatedDescription,
      due_date: issueData.due_date || undefined,
      category_id: issueData.category_id || undefined,
      uploads: descUploads.length > 0 ? descUploads : undefined,
      custom_fields: issueData.custom_fields || [],
    },
  };

  const response = await fetch(createUrl, {
    method: "POST",
    headers: {
      "X-Redmine-API-Key": settings.redmineApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    if (typeof TB_LOGGER !== "undefined") {
      TB_LOGGER.logError("RedmineService", `API Error during issue creation: ${errorMsg}`, {
        requestPayload: payload,
        redmineResponse: errorMsg,
      });
    }
    throw new Error(
      `${TB.MESSAGES.REDMINE.API_REQUEST_FAILED}: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
  }

  const result = await response.json();
  const newIssueId = result.issue.id;

  // Send each comment sequentially after successful issue creation
  if (Array.isArray(comments) && comments.length > 0) {
    for (const commentText of comments) {
      try {
        await handleSendToRedmine(
          {
            redmineIssueId: newIssueId,
            notes: commentText,
            backlogIssueKey: issueData.backlogIssueKey,
            processedAttachments, // Reuse the map to avoid duplicate uploads
          },
          null
        );
      } catch (e) {
        console.error("Comment migration failed", e);
        if (typeof TB_LOGGER !== "undefined") {
          TB_LOGGER.logError("RedmineService", `Failed to migrate comment: ${e.message}`, {
            commentText,
          });
        }
      }
    }
  }

  return {
    issueId: newIssueId,
    redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${newIssueId}`),
  };
}

// ============================================================================\
// HELPERS FOR SEARCHING AND PROCESSING\
// ============================================================================\

/**
 * Fetch Redmine search page HTML.
 */
async function fetchRedmineSearchHtml(searchUrl) {
  const response = await fetch(searchUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR} ${response.status}`);
  }
  const html = await response.text();
  if (!html || html.length < 100) {
    throw new Error(TB.MESSAGES.REDMINE.SEARCH_EMPTY_HTML);
  }
  return html;
}

/**
 * Extract search results from Redmine HTML.
 */
function extractRedmineSearchResults(html) {
  const results = [];
  const anchorPattern = /<a\b[^>]*href="([^"]*\/issues\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    results.push({
      id: match[2],
      href: decodeHtmlText(match[1]),
      subject: decodeHtmlText(stripHtml(match[3])).replace(/\s+/g, " ").trim(),
    });
  }
  return results;
}

/**
 * Pick best match from search results based on scoring.
 * Selects best result based on score (issue key + summary match).
 */
function pickBestRedmineSearchResult(results, normalizedIssueKey, normalizedIssueSummary) {
  if (!results?.length) {
    return null;
  }
  const scored = results
    .map((item) => {
      const normalizedSubject = normalizeLoose(item.subject);
      let score = 0;
      if (normalizedIssueKey && normalizedSubject.includes(normalizedIssueKey)) {
        score += 10;
      }
      if (normalizedIssueSummary && normalizedSubject.includes(normalizedIssueSummary)) {
        score += 5;
      }
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].item : results[0];
}

/**
 * Process attachments in notes: download from Backlog, upload to Redmine.
 * Replaces [[TB_IMG:id]] and [[TB_FILE:id:filename]] markers with appropriate Redmine markup.
 * This function is optimized to prevent duplicate uploads of the same attachment ID.
 *
 * @param {string} notes - The text containing attachment markers.
 * @param {string} backlogDomain - The Backlog domain for downloading files.
 * @param {object} settings - The extension's settings.
 * @param {string} backlogIssueKey - The Backlog issue key.
 * @param {Map|null} processedAttachments - (Optional) Persistent map of [attachmentId -> markup] to reuse across calls.
 * @returns {Promise<{updatedNotes: string, uploads: Array}>}
 */
async function processNotesAttachments(
  notes,
  backlogDomain,
  settings,
  backlogIssueKey,
  processedAttachments = null
) {
  if (!notes) {
    return { updatedNotes: "", uploads: [] };
  }

  const uploads = [];
  // A map to hold information about each unique attachment ID found.
  // Key: attachmentId (string), Value: { filename: string, markup: string, isImageOnly: boolean }
  const attachmentRegistry = new Map();

  const imagePattern = /\[\[TB_IMG:\s*(\d+)\s*\]\]/g;
  const filePattern = /\[\[TB_FILE:\s*(\d+)\s*:\s*([^\]]+?)\s*\]\]/g;

  // --- Step 1: Scan text and register all unique attachments that need processing ---
  for (const match of notes.matchAll(imagePattern)) {
    const attachmentId = match[1];
    if (!attachmentRegistry.has(attachmentId)) {
      attachmentRegistry.set(attachmentId, {
        filename: `image_${attachmentId}.png`,
        isImageOnly: true, // This was a legacy TB_IMG marker
      });
    }
  }

  for (const match of notes.matchAll(filePattern)) {
    const attachmentId = match[1];
    const filename = match[2].trim();
    if (!attachmentRegistry.has(attachmentId)) {
      // The first encountered filename for an ID is used.
      attachmentRegistry.set(attachmentId, { filename, isImageOnly: false });
    }
  }

  // --- Step 2: Process each unique attachment from the registry ---
  for (const [attachmentId, info] of attachmentRegistry.entries()) {
    try {
      if (processedAttachments && processedAttachments.has(attachmentId)) {
        info.markup = processedAttachments.get(attachmentId);
        continue;
      }

      const { filename } = info;

      const blob = await downloadBacklogFile(
        backlogDomain,
        attachmentId,
        filename,
        backlogIssueKey
      );

      const token = await uploadToRedmine(
        settings.redmineDomain,
        settings.redmineApiKey,
        blob,
        filename
      );

      if (token) {
        uploads.push({
          token,
          filename,
          content_type: blob.type || "application/octet-stream",
        });

        // Determine the correct Redmine markup.
        const ext = filename.split(".").pop().toLowerCase();
        const videoExts = ["mp4", "mov", "webm", "m4v"];
        const imageExts = ["jpg", "jpeg", "png", "gif", "webp"];

        if (videoExts.includes(ext)) {
          info.markup = `{{video(${filename})}}`;
        } else if (imageExts.includes(ext) || info.isImageOnly) {
          info.markup = `!${filename}!`;
        } else {
          info.markup = `attachment:${filename}`;
        }

        // Cache for subsequent calls in the same session
        if (processedAttachments) {
          processedAttachments.set(attachmentId, info.markup);
        }
      } else {
        throw new Error("Upload token was not received.");
      }
    } catch (e) {
      console.error(`[TB] Attachment processing failed for ID ${attachmentId}:`, e.message);
      info.markup = `[Attachment Error: ${info.filename}]`;
    }
  }

  // --- Step 3: Replace all markers in the text with the generated markup ---
  let finalNotes = notes;
  for (const [attachmentId, info] of attachmentRegistry.entries()) {
    if (info.markup) {
      // Regex to find all markers for the current ID and replace them.
      // Space-tolerant to catch AI variations
      const imageMarkerPattern = new RegExp(`\\[\\[TB_IMG:\\s*${attachmentId}\\s*\\]\\]`, "gi");
      const fileMarkerPattern = new RegExp(
        `\\[\\[TB_FILE:\\s*${attachmentId}\\s*:\\s*[^\\]]+\\s*\\]\\]`,
        "gi"
      );

      finalNotes = finalNotes.replace(imageMarkerPattern, info.markup);
      finalNotes = finalNotes.replace(fileMarkerPattern, info.markup);
    }
  }

  return { updatedNotes: finalNotes, uploads };
}

/**
 * Upload file to Redmine and get token.
 */
async function uploadToRedmine(domain, apiKey, blob, filename) {
  const url = buildRedmineUrl(domain, "/uploads.json");
  const response = await fetch(url, {
    method: "POST",
    headers: { "X-Redmine-API-Key": apiKey, "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`Redmine upload failed: ${response.status}`);
  }
  const data = await response.json();
  return data?.upload?.token;
}

// ============================================================================\
// NEW FUNCTIONS FOR SPENT TIME LOGGING (ADDITION)
// ============================================================================\

/**
 * Fetches details for a single Redmine issue.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @param {string} issueId - The ID of the issue to fetch.
 * @returns {Promise<object>} The issue object from the API.
 */
async function getIssueDetails(redmineDomain, apiKey, issueId) {
  const url = buildRedmineUrl(redmineDomain, `/issues/${issueId}.json`);
  const response = await fetch(url, {
    headers: {
      "X-Redmine-API-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch issue details for #${issueId}: ${errorMsg}`);
  }

  const data = await response.json();
  return data.issue;
}

/**
 * Logs a time entry (spent time) for a specific issue.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @param {string} issueId - The ID of the issue to log time against.
 * @param {number} hours - The number of hours to log.
 * @param {string} [comments=""] - Optional comments for the time entry.
 * @returns {Promise<object>} The created time entry object from the API.
 */
async function logTimeEntry(redmineDomain, apiKey, issueId, hours, comments = "") {
  const url = buildRedmineUrl(redmineDomain, "/time_entries.json");
  const payload = {
    time_entry: {
      issue_id: issueId,
      hours: hours,
      comments: comments,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Redmine-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to log time for issue #${issueId}: ${errorMsg}`);
  }

  const data = await response.json();
  return data.time_entry;
}

/**
 * Fetches the current user's account information from Redmine.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @returns {Promise<object>} The user object from the API.
 */
async function getCurrentUser(redmineDomain, apiKey) {
  const url = buildRedmineUrl(redmineDomain, "/my/account.json");
  const response = await fetch(url, {
    headers: {
      "X-Redmine-API-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch current user: ${errorMsg}`);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Fetches all available trackers from Redmine.
 * @param {string} redmineDomain - The domain of the Redmine instance.
 * @param {string} apiKey - The user's Redmine API key.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of tracker objects.
 */
async function getTrackers(redmineDomain, apiKey) {
  const url = buildRedmineUrl(redmineDomain, "/trackers.json");
  const response = await fetch(url, {
    headers: { "X-Redmine-API-Key": apiKey, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`Failed to fetch trackers: ${errorMsg}`);
  }
  const data = await response.json();
  return data.trackers || [];
}
