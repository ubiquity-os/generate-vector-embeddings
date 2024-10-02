import { IssueSimilaritySearchResult } from "../adapters/supabase/helpers/issues";
import { Context } from "../types";
import { IssuePayload } from "../types/payload";

export interface IssueGraphqlResponse {
  node: {
    title: string;
    url: string;
    repository: {
      name: string;
      owner: {
        login: string;
      };
    };
  };
  similarity: string;
}

/**
 * Check if an issue is similar to any existing issues in the database
 * @param context
 * @returns true if the issue is similar to an existing issue, false otherwise
 */
export async function issueChecker(context: Context): Promise<boolean> {
  const {
    logger,
    adapters: { supabase },
    octokit,
  } = context;
  const { payload } = context as { payload: IssuePayload };
  const issue = payload.issue;
  const issueContent = issue.body + issue.title;
  // Fetch all similar issues based on settings.warningThreshold
  const similarIssues = await supabase.issue.findSimilarIssues(issueContent, context.config.warningThreshold, issue.node_id);
  if (similarIssues && similarIssues.length > 0) {
    const matchIssues = similarIssues.filter((issue) => issue.similarity >= context.config.matchThreshold);

    // Handle issues that match the MATCH_THRESHOLD (Very Similar)
    if (matchIssues.length > 0) {
      logger.info(`Similar issue which matches more than ${context.config.matchThreshold} already exists`);
      await octokit.issues.update({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: issue.number,
        state: "closed",
        state_reason: "not_planned",
      });
    }

    // Handle issues that match the settings.warningThreshold but not the MATCH_THRESHOLD
    if (similarIssues.length > 0) {
      logger.info(`Similar issue which matches more than ${context.config.warningThreshold} already exists`);
      await handleSimilarIssuesComment(context, payload, issue.number, similarIssues);
      return true;
    }
  }

  return false;
}

/**
 * Compare the repository and issue name to the similar issue repository and issue name
 * @param repoOrg
 * @param similarIssueRepoOrg
 * @param repoName
 * @param similarIssueRepoName
 * @returns
 */
function matchRepoOrgToSimilarIssueRepoOrg(repoOrg: string, similarIssueRepoOrg: string, repoName: string, similarIssueRepoName: string): boolean {
  return repoOrg === similarIssueRepoOrg && repoName === similarIssueRepoName;
}

/**
 * Handle commenting on an issue with similar issues information
 * @param context
 * @param payload
 * @param issueNumber
 * @param similarIssues
 */
async function handleSimilarIssuesComment(context: Context, payload: IssuePayload, issueNumber: number, similarIssues: IssueSimilaritySearchResult[]) {
  const issueList: IssueGraphqlResponse[] = await Promise.all(
    similarIssues.map(async (issue: IssueSimilaritySearchResult) => {
      const issueUrl: IssueGraphqlResponse = await context.octokit.graphql(
        `query($issueNodeId: ID!) {
          node(id: $issueNodeId) {
            ... on Issue {
              title
              url
              repository {
                name
                owner {
                  login
                }
              }
            }
          }
        }`,
        { issueNodeId: issue.issue_id }
      );
      issueUrl.similarity = Math.round(issue.similarity * 100).toString();
      return issueUrl;
    })
  );

  const commentBody = issueList
    .filter((issue) =>
      matchRepoOrgToSimilarIssueRepoOrg(payload.repository.owner.login, issue.node.repository.owner.login, payload.repository.name, issue.node.repository.name)
    )
    .map((issue) => {
      const modifiedUrl = issue.node.url.replace("github.com", "www.github.com");
      return `* \`${issue.similarity}%\` [${issue.node.title}](${modifiedUrl})`;
    })
    .join("\n");
  const body = `>[!NOTE]\n>#### Similar Issues:\n>\n>${commentBody}`;

  const existingComments = await context.octokit.issues.listComments({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: issueNumber,
  });
  const existingComment = existingComments.data.find((comment) => comment.body && comment.body.includes(">[!NOTE]\n>#### Similar Issues:\n>"));
  if (existingComment) {
    await context.octokit.issues.updateComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      comment_id: existingComment.id,
      body: body,
    });
  } else {
    await context.octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: issueNumber,
      body: body,
    });
  }
}
