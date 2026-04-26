/**
 * Backlog API Service for Backlog2Redmine Extension.
 * Handles operations with Backlog API: sending comments, fetching issue info.
 */

async function getBacklogUsers(projectKeyOrIssueKey = null) {
  const settings = await getSettings();
  if (!settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }

  const domain = settings.backlogDomain || TB.BACKLOG_DOMAIN;

  // Extract project key from issue key if provided (e.g., CTRIAL-123 → CTRIAL)
  let projectKey = null;
  if (projectKeyOrIssueKey) {
    const match = projectKeyOrIssueKey.match(/^([A-Z0-9_]+)-/);
    if (match) {
      projectKey = match[1];
    }
  }

  // Only use project-specific user API (requires Project Member+, not Admin)
  // https://developer.nulab.com/docs/backlog/api/2/get-project-user-list/
  if (!projectKey) {
    console.warn("[BacklogService] No valid project key provided, cannot fetch users");
    return [];
  }

  const url = new URL(`api/v2/projects/${projectKey}/users`, domain);
  url.searchParams.set("apiKey", settings.backlogApiKey);

  console.log(`[BacklogService] Fetching users from: ${url.toString()}`);
  console.log(`[BacklogService] Domain: ${domain}, Project: ${projectKey}`);

  try {
    const response = await fetch(url.toString());

    console.log(`[BacklogService] Response status: ${response.status}`);

    if (!response.ok) {
      const errorMsg = await readErrorMessage(response);
      console.warn(`[BacklogService] Failed to load users from project ${projectKey}: ${errorMsg}`);
      return [];
    }

    const users = await response.json();
    console.log(`[BacklogService] Loaded ${users.length} users from project ${projectKey}`);
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      userId: u.userId,
      mailAddress: u.mailAddress,
    }));
  } catch (error) {
    console.warn("[BacklogService] Error fetching users:", error);
    return [];
  }
}

async function getBacklogIssueInfo(issueKey) {
  const settings = await getSettings();
  if (!settings.backlogApiKey) {
    throw new Error(TB.MESSAGES.SETTINGS.BACKLOG_API_KEY_REQUIRED);
  }

  const domain = settings.backlogDomain || TB.BACKLOG_DOMAIN;
  const url = new URL(`api/v2/issues/${issueKey}`, domain);
  url.searchParams.set("apiKey", settings.backlogApiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorMsg = await readErrorMessage(response);
    throw new Error(
      `${TB.MESSAGES.BACKLOG.LOOKUP_FAILED}: ${sanitizeErrorMessage(errorMsg, response.status)}`
    );
  }

  const issue = await response.json();
  return {
    id: issue.id,
    key: issue.issueKey,
    keyId: issue.keyId,
    summary: issue.summary,
    description: issue.description,
    projectId: issue.projectId,
  };
}

async function handleSendToBacklog({ backlogIssueKey, content, notifiedUserId, attachments = [] }) {
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

  if (attachments.length > 0) {
    await uploadAttachmentsToBacklog(
      domain,
      settings.backlogApiKey,
      backlogIssueKey,
      result.id,
      attachments
    );
  }

  return {
    message: TB.MESSAGES.TOAST.SEND_BACKLOG_SUCCESS,
    backlogUrl,
  };
}

async function uploadAttachmentsToBacklog(domain, apiKey, issueKey, commentId, attachments) {
  for (const attachment of attachments) {
    try {
      const blob = await downloadRedmineAttachment(attachment.url);
      const uploadUrl = new URL(
        `api/v2/issues/${issueKey}/comments/${commentId}/attachments`,
        domain
      );
      uploadUrl.searchParams.set("apiKey", apiKey);

      const formData = new FormData();
      formData.append("file", blob, attachment.filename);

      const uploadResponse = await fetch(uploadUrl.toString(), {
        method: "POST",
        headers: {
          "X-Redmine-API-Key": apiKey,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        console.warn(`[BacklogService] Failed to upload attachment ${attachment.filename}`);
      }
    } catch (error) {
      console.warn(`[BacklogService] Attachment upload error for ${attachment.filename}:`, error);
    }
  }
}

async function downloadRedmineAttachment(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Redmine attachment download failed: ${response.status}`);
  }
  return await response.blob();
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
