/**
 * Backlog API Service for Backlog2Redmine Extension.
 * Handles operations with Backlog API: sending comments.
 */

async function handleSendToBacklog({ backlogIssueKey, content, notifiedUserId }) {
  const settings = await getSettings();
  if (!settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }

  const domain = settings.backlogDomain || TB.BACKLOG_DOMAIN;
  const url = new URL(`api/v2/issues/${backlogIssueKey}/comments`, domain);
  url.searchParams.set("apiKey", settings.backlogApiKey);

  const body = new URLSearchParams();
  body.append("content", content);
  if (Array.isArray(notifiedUserId)) {
    notifiedUserId.forEach((id) => body.append("notifiedUserId[]", id));
  } else if (notifiedUserId) {
    notifiedUserId.split(",").forEach((id) => body.append("notifiedUserId[]", id.trim()));
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(
      `${TB.MESSAGES.BACKLOG.POST_FAILED}: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
  }

  const result = await response.json();
  const backlogUrl = `${domain.endsWith("/") ? domain : domain + "/"}view/${backlogIssueKey}#comment-${result.id}`;

  return {
    message: TB.MESSAGES.TOAST.SEND_BACKLOG_SUCCESS,
    backlogUrl,
  };
}

async function downloadBacklogFile(domain, attachmentId, filename = "", issueKey = "") {
  const settings = await getSettings();

  // Try API first if we have a key and issueKey
  if (settings.backlogApiKey && issueKey) {
    try {
      const apiUrl = new URL(
        `api/v2/issues/${issueKey}/attachments/${attachmentId}`,
        settings.backlogDomain || TB.BACKLOG_DOMAIN
      );
      apiUrl.searchParams.set("apiKey", settings.backlogApiKey);

      const apiRes = await fetch(apiUrl.toString());
      if (apiRes.ok) {
        return await apiRes.blob();
      }
      console.warn(
        `[BacklogService] API download failed (${apiRes.status}), falling back to web URL.`
      );
    } catch (e) {
      console.warn("[BacklogService] API download error, falling back to web URL:", e);
    }
  }

  // Fallback to web download URL (requires user session)
  const webUrl = `https://${domain}/downloadAttachment/${attachmentId}/${encodeURIComponent(filename)}`;
  const response = await fetch(webUrl, { credentials: "include" });

  if (!response.ok) {
    throw new Error(`Backlog file download failed: ${response.status}`);
  }

  return await response.blob();
}
