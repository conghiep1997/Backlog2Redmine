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

async function downloadBacklogImage(domain, attachmentId) {
  const url = `https://${domain}/ViewAttachmentImage.action?attachmentId=${attachmentId}`;
  const response = await fetch(url, { credentials: "include" });

  if (!response.ok) {
    throw new Error(`Backlog image download failed: ${response.status}`);
  }

  return await response.blob();
}
