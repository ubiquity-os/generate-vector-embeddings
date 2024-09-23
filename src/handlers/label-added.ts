import { Context } from "../types";
import { IssuePayload } from "../types/payload";

interface IssueGraphqlResponse {
  node: {
    title: string;
    url: string;
  };
}

export async function labelAdded(context: Context) {
  const {
    logger,
    adapters: { supabase },
    octokit,
  } = context;
  const { payload } = context as { payload: IssuePayload };
  const issue = payload.issue;
  const issueContent = issue.body + issue.title;

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
      const issuePayload = (data?.payload as IssuePayload) || [];
      const users = issuePayload?.issue.assignees;
      //Make the string
      // ## [User Name](Link to User Profile)
      // - [Issue] X% Match
      users.forEach(async (user) => {
        if (user && user.name && user.url) {
          matchResultArray.push(`## [${user.name}](${user.url})\n- [Issue] ${issue.similarity}% Match`);
        }
      });
    });
    // Fetch if any previous comment exists
    const issueResponse: IssueGraphqlResponse = await octokit.graphql(
      `query($issueId: ID!) {
                    node(id: $issueId) {
                    ... on Issue {
                        comments(first: 100) {
                        nodes {
                            id
                            body
                        }
                        }
                    }
                    }
                }
                `,
      { issueId: issue.node_id }
    );
    console.log(issueResponse);

    // if(issueResponse.node.comments.nodes.length > 0) {
    //     const commentId = issueResponse.node.comments.nodes[0].id
    //     const previousComment = issueResponse.node.comments.nodes[0].body
    //     const newComment = previousComment + "\n" + matchResultArray.join("\n")
    //     await octokit.issues.updateComment({
    //         owner: payload.repository.owner.login,
    //         repo: payload.repository.name,
    //         comment_id: commentId,
    //         body: newComment
    //     })
    // }
    console.log(matchResultArray);
  }

  logger.ok(`Successfully created issue!`);
  logger.debug(`Exiting addIssue`);
}
