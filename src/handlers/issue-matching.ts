import { Context } from "../types";
import { IssuePayload } from "../types/payload";

export interface IssueGraphqlResponse {
  node: {
    title: string;
    url: string;
    state: string;
    stateReason: string;
    closed: boolean;
    repository: {
      owner: {
        login: string;
      };
      name: string;
    };
    assignees: {
      nodes: Array<{
        login: string;
        url: string;
      }>;
    };
  };
  similarity: number;
}

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
  const matchResultArray: Map<string, Array<string>> = new Map();
  const similarIssues = await supabase.issue.findSimilarIssues(issueContent, context.config.jobMatchingThreshold, issue.node_id);
  if (similarIssues && similarIssues.length > 0) {
    // Find the most similar issue and the users who completed the task
    console.log(similarIssues);
    similarIssues.sort((a, b) => b.similarity - a.similarity);
    const fetchPromises = similarIssues.map(async (issue) => {
      logger.info("Issue ID: " + issue.issue_id);
      logger.info("Before query");
      const issueObject: IssueGraphqlResponse = await context.octokit.graphql(
        `query ($issueNodeId: ID!) {
            node(id: $issueNodeId) {
              ... on Issue {
                title
                url
                state
                repository{
                  name
                  owner {
                    login
                  }
                }
                stateReason
                closed
                assignees(first: 10) {
                  nodes {
                    login
                    url
                  }
                }
              }
            }
          }`,
        { issueNodeId: issue.issue_id }
      );
      issueObject.similarity = issue.similarity;
      return issueObject;
    });

    const issueList = await Promise.all(fetchPromises);
    issueList.forEach((issue) => {
      if (issue.node.closed && issue.node.stateReason === "COMPLETED" && issue.node.assignees.nodes.length > 0) {
        const assignees = issue.node.assignees.nodes;
        assignees.forEach((assignee) => {
          const similarityPercentage = Math.round(issue.similarity * 100);
          const githubUserLink = assignee.url.replace(/https?:\/\/github.com/, "https://www.github.com");
          const issueLink = issue.node.url.replace(/https?:\/\/github.com/, "https://www.github.com");
          if (matchResultArray.has(assignee.login)) {
            matchResultArray
              .get(assignee.login)
              ?.push(
                `## [${assignee.login}](${githubUserLink})\n- [${issue.node.repository.owner.login}/${issue.node.repository.name}#${issue.node.url.split("/").pop()}](${issueLink}) ${similarityPercentage}% Match`
              );
          } else {
            matchResultArray.set(assignee.login, [
              `## [${assignee.login}](${githubUserLink})\n- [${issue.node.repository.owner.login}/${issue.node.repository.name}#${issue.node.url.split("/").pop()}](${issueLink}) ${similarityPercentage}% Match`,
            ]);
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
    if (matchResultArray && matchResultArray.size === 0) {
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
        body:
          commentStart +
          "\n\n" +
          Array.from(matchResultArray.values())
            .map((arr) => arr.join("\n"))
            .join("\n"),
      });
    } else {
      await context.octokit.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        body:
          commentStart +
          "\n\n" +
          Array.from(matchResultArray.values())
            .map((arr) => arr.join("\n"))
            .join("\n"),
      });
    }
  }

  logger.ok(`Successfully created issue!`);
  logger.debug(`Exiting addIssue`);
}
