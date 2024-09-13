import { IssueSimilaritySearchResult } from "../adapters/supabase/helpers/issues";
import { Context } from "../types";
const MATCH_THRESHOLD = 0.95;
const WARNING_THRESHOLD = 0.5;

export interface IssueGraphqlResponse {
  node: {
    title: string;
    url: string;
  };
}

/**
 * Check if an issue is similar to any existing issues in the database
 * @param context
 * @returns true if the issue is similar to an existing issue, false otherwise
 */
export async function issueChecker(context: Context): Promise<boolean> {
  const {
    logger,
    payload,
    adapters: { supabase },
  } = context;

  const issue = payload.issue;

  //First Check if an issue with more than MATCH_THRESHOLD similarity exists (Very Similar)
  const similarIssue = await supabase.issue.findSimilarIssues(issue.body + issue.title, MATCH_THRESHOLD, issue.node_id);
  if (similarIssue && similarIssue?.length > 0) {
    logger.info(`Similar issue which matches more than ${MATCH_THRESHOLD} already exists`);
    //Close the issue as "unplanned"
    await context.octokit.issues.update({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: issue.number,
      state: "closed",
      labels: ["unplanned"],
    });
    return true;
  }

  //Second Check if an issue with more than WARNING_THRESHOLD similarity exists (Warning)
  const warningIssue = await supabase.issue.findSimilarIssues(issue.body + issue.title, WARNING_THRESHOLD, issue.node_id);
  if (warningIssue && warningIssue?.length > 0) {
    logger.info(`Similar issue which matches more than ${WARNING_THRESHOLD} already exists`);
    //Add a comment immediately next to the issue
    //Build a list of similar issues url
    const issueList: IssueGraphqlResponse[] = await Promise.all(
      warningIssue.map(async (issue: IssueSimilaritySearchResult) => {
        //fetch the issue url and title using globalNodeId
        const issueUrl: IssueGraphqlResponse = await context.octokit.graphql(
          `query($issueNodeId: ID!) {
                    node(id: $issueNodeId) {
                        ... on Issue {
                        title
                        url
                        }
                    }
                    }`,
          {
            issueNodeId: issue.issue_id,
          }
        );
        return issueUrl;
      })
    );

    // Reopen the issue
    await context.octokit.issues.update({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: issue.number,
      state: "open",
    });
    //Remove the "unplanned" label
    await context.octokit.issues.removeLabel({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: issue.number,
      name: "unplanned",
    });
    // Check if there is already a comment on the issue
    const existingComment = await context.octokit.issues.listComments({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: issue.number,
    });
    if (existingComment.data.length > 0) {
      // Find the comment that lists the similar issues
      const commentToUpdate = existingComment.data.find(
        (comment) => comment && comment.body && comment.body.includes("This issue seems to be similar to the following issue(s)")
      );

      if (commentToUpdate) {
        // Update the comment with the latest list of similar issues
        const body = issueList.map((issue) => `- [${issue.node.title}](${issue.node.url})`).join("\n");
        const updatedBody = `This issue seems to be similar to the following issue(s):\n\n${body}`;
        await context.octokit.issues.updateComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          comment_id: commentToUpdate.id,
          body: updatedBody,
        });
      } else {
        // Add a new comment to the issue
        await createNewComment(context, issueList);
      }
    } else {
      // Add a new comment to the issue
      await createNewComment(context, issueList);
    }
    return true;
  }

  logger.info("No similar issue found");
  return false;
}

/**
 * Create a new comment on the issue with the list of similar issues
 * @param context
 * @param resolvedIssueList
 */
async function createNewComment(context: Context, resolvedIssueList: IssueGraphqlResponse[]) {
  let body = "This issue seems to be similar to the following issue(s):\n\n";
  resolvedIssueList.forEach((issue) => {
    const issueLine = `- [${issue.node.title}](${issue.node.url})\n`;
    body += issueLine;
  });
  await context.octokit.issues.createComment({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    issue_number: context.payload.issue.number,
    body: body,
  });
}
