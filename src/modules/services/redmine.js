/**
 * Redmine API Service for Backlog2Redmine Extension.
 */


async function findRedmineIssue(redmineDomain, apiKey, issueKey, issueSummary = "") {
  const normalizedIssueKey = normalizeLoose(issueKey);
  const normalizedIssueSummary = normalizeLoose(issueSummary);
  const searchQuery = [issueKey, issueSummary].filter(Boolean).join(" ");
  const searchUrl = buildRedmineUrl(redmineDomain, `/search?${new URLSearchParams({
    q: searchQuery, scope: "all", titles_only: "1", issues: "1", commit: "Search"
  }).toString()}`);

  try {
    const html = await fetchRedmineSearchHtml(searchUrl);
    const searchResults = extractRedmineSearchResults(html);
    const bestMatch = pickBestRedmineSearchResult(searchResults, normalizedIssueKey, normalizedIssueSummary);

    if (bestMatch) {
      return { id: String(bestMatch.id), title: bestMatch.subject };
    }
  } catch (error) {
    console.warn("[RedmineService] Search HTML failed, falling back to API:", error.message);
  }

  return findRedmineIssueViaApi(redmineDomain, apiKey, issueKey, issueSummary);
}

async function findRedmineIssueViaApi(redmineDomain, apiKey, issueKey, issueSummary = "") {
  const url = buildRedmineUrl(redmineDomain, `/issues.json?subject=${encodeURIComponent(issueKey)}&limit=10`);
  const response = await fetch(url, {
    headers: { "X-Redmine-API-Key": apiKey, Accept: "application/json" }
  });

  if (!response.ok) throw new Error(`${TB.MESSAGES.REDMINE.LOOKUP_FAILED}: ${response.status}`);

  const data = await safeReadJson(response);
  const issues = Array.isArray(data?.issues) ? data.issues : [];
  if (issues.length === 0) return null;

  const bestMatch = pickBestRedmineSearchResult(
    issues.map(i => ({ id: i.id, subject: i.subject })),
    normalizeLoose(issueKey),
    normalizeLoose(issueSummary)
  );

  const result = bestMatch ?? issues[0];
  return { id: String(result.id), title: result.subject };
}

async function handleSendToRedmine({ redmineIssueId, notes }, sender) {
  const settings = await getSettings();
  const backlogDomain = sender?.tab?.url ? new URL(sender.tab.url).hostname : null;
  const { updatedNotes, uploads } = await processNotesImages(notes, backlogDomain, settings);

  const endpoint = buildRedmineUrl(settings.redmineDomain, `/issues/${redmineIssueId}.json`);
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Redmine-API-Key": settings.redmineApiKey,
      Accept: "application/json",
    },
    body: JSON.stringify({
      issue: {
        notes: updatedNotes,
        uploads: uploads.length > 0 ? uploads : undefined,
      },
    }),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR}: ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const responseData = await safeReadJson(response);
  const journalId = responseData?.journal?.id;
  return { 
    message: TB.MESSAGES.TOAST.SEND_SUCCESS,
    redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${redmineIssueId}${journalId ? `#note-${journalId}` : ''}`),
  };
}

async function handleCreateRedmineIssue({ issueData, comments }) {
  const settings = await getSettings();
  const { updatedNotes: updatedDescription, uploads: descUploads } = await processNotesImages(issueData.description || "", null, settings);

  const createUrl = buildRedmineUrl(settings.redmineDomain, "/issues.json");
  const response = await fetch(createUrl, {
    method: "POST",
    headers: {
      "X-Redmine-API-Key": settings.redmineApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      issue: {
        project_id: issueData.project_id,
        tracker_id: issueData.tracker_id,
        priority_id: issueData.priority_id,
        subject: issueData.subject,
        description: updatedDescription,
        uploads: descUploads.length > 0 ? descUploads : undefined,
      },
    }),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(`${TB.MESSAGES.REDMINE.API_REQUEST_FAILED}: ${sanitizeErrorMessage(errorMsg, response.status)}`);
  }

  const result = await response.json();
  const newIssueId = result.issue.id;

  if (Array.isArray(comments) && comments.length > 0) {
    for (const commentText of comments) {
      try {
        await handleSendToRedmine({ redmineIssueId: newIssueId, notes: commentText }, null);
      } catch (e) {
        console.error("Comment migration failed", e);
      }
    }
  }

  return {
    issueId: newIssueId,
    redmineUrl: buildRedmineUrl(settings.redmineDomain, `/issues/${newIssueId}`),
  };
}

// Helpers for searching and processing
async function fetchRedmineSearchHtml(searchUrl) {
  const response = await fetch(searchUrl, { credentials: "include" });
  if (!response.ok) throw new Error(`${TB.MESSAGES.REDMINE.SEARCH_PAGE_ERROR} ${response.status}`);
  const html = await response.text();
  if (!html || html.length < 100) throw new Error(TB.MESSAGES.REDMINE.SEARCH_EMPTY_HTML);
  return html;
}

function extractRedmineSearchResults(html) {
  const results = [];
  const anchorPattern = /<a\b[^>]*href="([^"]*\/issues\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    results.push({
      id: match[2],
      href: decodeHtmlText(match[1]),
      subject: decodeHtmlText(stripHtml(match[3])).replace(/\s+/g, " ").trim()
    });
  }
  return results;
}

function pickBestRedmineSearchResult(results, normalizedIssueKey, normalizedIssueSummary) {
  if (!results?.length) return null;
  const scored = results.map(item => {
    const normalizedSubject = normalizeLoose(item.subject);
    let score = 0;
    if (normalizedIssueKey && normalizedSubject.includes(normalizedIssueKey)) score += 10;
    if (normalizedIssueSummary && normalizedSubject.includes(normalizedIssueSummary)) score += 5;
    return { item, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].item : results[0];
}

async function processNotesImages(notes, backlogDomain, settings) {
  let updatedNotes = notes;
  const uploads = [];
  const imageMatches = [...notes.matchAll(/\[\[TB_IMG:(\d+)\]\]/g)];
  for (const match of imageMatches) {
    const attachmentId = match[1];
    try {
      const imgBlob = await downloadBacklogImage(backlogDomain, attachmentId);
      const filename = `image_${attachmentId}.png`;
      const token = await uploadToRedmine(settings.redmineDomain, settings.redmineApiKey, imgBlob, filename);
      if (token) {
        uploads.push({ token, filename, content_type: "image/png" });
        updatedNotes = updatedNotes.replace(match[0], `!${filename}!`);
      }
    } catch (e) {
      updatedNotes = updatedNotes.replace(match[0], `[Lỗi tải ảnh: ${attachmentId}]`);
    }
  }
  return { updatedNotes, uploads };
}

async function uploadToRedmine(domain, apiKey, blob, filename) {
  const url = buildRedmineUrl(domain, "/uploads.json");
  const response = await fetch(url, {
    method: "POST",
    headers: { "X-Redmine-API-Key": apiKey, "Content-Type": "application/octet-stream" },
    body: blob
  });
  if (!response.ok) throw new Error(`Redmine upload failed: ${response.status}`);
  const data = await response.json();
  return data?.upload?.token;
}
