import { Context } from "../types";
import { IssuePayload } from "../types/payload";

export async function issueMatching(context: Context) {
  const {
    logger,
    adapters: { supabase },
    octokit,
  } = context;
  const { payload } = context as { payload: IssuePayload };
  const issue = payload.issue;
  const issueContent = issue.body + issue.title;
  const commentStart = "The following users have completed similar tasks to this issue:";

  // On Adding the labels to the issue, the bot should
  // create a new comment with users who completed task most similar to the issue
  // if the comment already exists, it should update the comment with the new users
  const matchResultArray: Array<string> = [];
  const similarIssues = await supabase.issue.findSimilarIssues(issueContent, context.config.jobMatchingThreshold, issue.node_id);
  if (similarIssues && similarIssues.length > 0) {
    // Find the most similar issue and the users who completed the task
    similarIssues.sort((a, b) => b.similarity - a.similarity);
    similarIssues.forEach(async (issue) => {
      const data = await supabase.issue.getIssue(issue.issue_id);
      if (data) {
        const issuePayload = (data[0].payload as IssuePayload) || [];
        const users = issuePayload?.issue.assignees;
        //Make the string
        // ## [User Name](Link to User Profile)
        // - [Issue] X% Match
        users.forEach(async (user) => {
          if (user && user.login && user.html_url) {
            const similarityPercentage = Math.round(issue.similarity * 100);
            const githubUserLink = user.html_url.replace(/https?:\/\//, "https://www.");
            const issueLink = issuePayload.issue.html_url.replace(/https?:\/\//, "https://www.");
            matchResultArray.push(`## [${user.login}](${githubUserLink})\n- [Issue](${issueLink}) ${similarityPercentage}% Match`);
          }
        });
      }
    });

    // Fetch if any previous comment exists
    const listIssues = await octokit.issues.listComments({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: issue.number,
    });
    //Check if the comment already exists
    const existingComment = listIssues.data.find((comment) => comment.body && comment.body.startsWith(commentStart));

    //Check if matchResultArray is empty
    if (matchResultArray.length === 0) {
      if (existingComment) {
        // If the comment already exists, delete it
        await octokit.issues.deleteComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          comment_id: existingComment.id,
        });
      }
      logger.debug("No similar issues found");
      return;
    }

    if (existingComment) {
      await context.octokit.issues.updateComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        comment_id: existingComment.id,
        body: commentStart + "\n\n" + matchResultArray.join("\n"),
      });
    } else {
      await context.octokit.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        body: commentStart + "\n\n" + matchResultArray.join("\n"),
      });
    }
  }

  logger.ok(`Successfully created issue!`);
  logger.debug(`Exiting addIssue`);
}
