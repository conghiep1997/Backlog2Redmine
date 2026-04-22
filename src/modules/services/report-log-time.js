/* globals getCurrentUser, getIssueDetails, logTimeEntry */

/**
 * Feature: Automated Time Logging from Report Issues.
 *
 * This module contains the core logic for parsing a Redmine "Report" issue,
 * identifying tasks assigned to the current user, and automatically logging
 * a total of 8 hours spread across those tasks.
 */

/**
 * Main function to automate logging time based on a daily report issue.
 * It performs the following steps:
 * 1. Fetches settings and the current user's login name from Redmine.
 * 2. Fetches the content (description) of the specified report issue.
 * 3. Parses the description to find the "Today's Tasks" section.
 * 4. Finds the row corresponding to the user's login name.
 * 5. Extracts all task IDs (#12345) from that user's row.
 * 6. Calculates the time to log per task (dividing 8 hours equally).
 * 7. Calls the Redmine API to create a time entry for each task.
 *
 * @param {string} reportIssueId The ID of the issue with the "Report" tracker.
 * @param {boolean} [isBatchOperation=false] - If true, suppresses alerts and returns the list of task IDs.
 * @returns {Promise<string[]|void>} A promise that resolves with an array of task IDs if in batch mode, otherwise void.
 * @throws {Error} Throws an error if any step fails, with a user-friendly message.
 */
async function logTimeFromReport(reportIssueId, isBatchOperation = false) {
  try {
    // 1. Get settings and current user info
    const settings = await getSettings(); // Assumes getSettings() is available globally
    const { redmineDomain, redmineApiKey } = settings;

    if (!redmineDomain || !redmineApiKey) {
      throw new Error("Redmine domain or API key is not configured.");
    }

    const currentUser = await getCurrentUser(redmineDomain, redmineApiKey);
    const userLogin = currentUser.login;

    // 2. Get the report issue details
    const reportIssue = await getIssueDetails(redmineDomain, redmineApiKey, reportIssueId);
    const description = reportIssue.description;

    if (!description) {
      throw new Error(`Report issue #${reportIssueId} has no description.`);
    }

    // 3. Parse the description to find the "Today's Tasks" (本日のタスク) section
    const todaysTasksRegex = /1\.\s*本日のタスク([\s\S]*?)(?:\n\n|2\.\s*次のプラン|$)/;
    const todaysTasksMatch = description.match(todaysTasksRegex);

    if (!todaysTasksMatch || !todaysTasksMatch[1]) {
      throw new Error("Could not find the '本日のタスク' (Today's Tasks) section in the description.");
    }
    const todaysTasksSection = todaysTasksMatch[1];

    // 4. Find the user's row within that section and extract tasks
    // eslint-disable-next-line no-useless-escape
    const userRowRegex = new RegExp(`\|\s*${userLogin}\s*\|([^|]+)`);
    const userRowMatch = todaysTasksSection.match(userRowRegex);

    if (!userRowMatch || !userRowMatch[1]) {
      throw new Error(`Could not find a task row for user '${userLogin}' in the 'Today's Tasks' section.`);
    }
    const tasksCell = userRowMatch[1];

    // 5. Extract all task IDs from the cell
    const taskIdsRegex = /#(\d+)/g;
    const taskIds = [...tasksCell.matchAll(taskIdsRegex)].map(m => m[1]);

    if (taskIds.length === 0) {
      if (!isBatchOperation) {
        throw new Error(`No task IDs found for user '${userLogin}'.`);
      }
      return []; // Return empty array in batch mode for days off etc.
    }

    // 6. Calculate hours and log time for each task
    const totalHours = 8;
    const hoursPerTask = Math.round((totalHours / taskIds.length) * 100) / 100;

    const promises = taskIds.map(taskId =>
      logTimeEntry(
        redmineDomain,
        redmineApiKey,
        taskId,
        hoursPerTask,
        `Logged automatically from report #${reportIssueId}`
      )
    );

    await Promise.all(promises);

    // 7. Return task IDs for batch mode or show alert for single mode
    if (isBatchOperation) {
      return taskIds; // Return the array of task IDs
    } else {
      const successMessage = `Successfully logged a total of ${totalHours} hours across ${taskIds.length} tasks: #${taskIds.join(", #")}.`;
      console.log(successMessage);
      alert(successMessage); // Simple feedback for single mode
    }

  } catch (error) {
    console.error("Error during 'Log Time From Report' process:", error);
    if (!isBatchOperation) {
      alert(`An error occurred: ${error.message}`); // Show error to the user
    }
    throw error; // Re-throw to allow for more handling
  }
}
