import { Context } from "../types";
const MATCH_THRESHOLD = 0.95;
const WARNING_THRESHOLD = 0.75;

export interface IssueGraphqlResponse {
  id: string;
  title: string;
  url: string;
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
  const similarIssue = await supabase.issue.findSimilarIssues(issue.body + issue.title, MATCH_THRESHOLD);
  if (similarIssue) {
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
  const warningIssue = await supabase.issue.findSimilarIssues(issue.body + issue.title, WARNING_THRESHOLD);
  if (warningIssue) {
    logger.info(`Similar issue which matches more than ${WARNING_THRESHOLD} already exists`);
    //Add a comment immediately next to the issue
    //Build a list of similar issues url
    const issueList = warningIssue.map(async (issue) => {
      //fetch the issue url and title using globalNodeId
      const issueUrl: IssueGraphqlResponse = await context.octokit.graphql(
        `query($issueNodeId: String!) {
                node(id: $issueNodeId) {
                    ... on Issue {
                        title
                        url
                    }
                }
            }`,
        {
          issueNodeId: issue.id,
        }
      );
      return issueUrl;
    });
    //Add a comment to the issue
    const resolvedIssueList = await Promise.all(issueList);
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
        await context.octokit.issues.updateComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          comment_id: commentToUpdate.id,
          body: `This issue seems to be similar to the following issue(s) ${resolvedIssueList.map((issue) => issue.url).join(", ")}`,
        });
      } else {
        // Add a new comment to the issue
        await createNewComment(context, resolvedIssueList);
      }
    } else {
      // Add a new comment to the issue
      await createNewComment(context, resolvedIssueList);
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
  await context.octokit.issues.createComment({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    issue_number: context.payload.issue.number,
    body: `This issue seems to be similar to the following issue(s) ${resolvedIssueList.map((issue) => issue.url).join(", ")}`,
  });
}
