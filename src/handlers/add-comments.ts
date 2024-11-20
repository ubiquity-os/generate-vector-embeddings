import { Context } from "../types";
import { addIssue } from "./add-issue";

export async function addComments(context: Context<"issue_comment.created">) {
  const {
    logger,
    adapters: { supabase },
    payload,
  } = context;
  const markdown = payload.comment.body;
  const authorId = payload.comment.user?.id || -1;
  const nodeId = payload.comment.node_id;
  const isPrivate = payload.repository.private;
  const issueId = payload.issue.node_id;

  try {
    if (!markdown) {
      logger.error("Comment body is empty");
    }
    if (context.payload.issue.pull_request) {
      logger.error("Comment is on a pull request");
    }
    if ((await supabase.issue.getIssue(issueId)) === null) {
      await addIssue(context as unknown as Context<"issues.opened">);
    }
    await supabase.comment.createComment(markdown, nodeId, authorId, payload, isPrivate, issueId);
    logger.ok(`Created Comment with id: ${nodeId}`);
    logger.ok(`Successfully created comment!`);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error creating comment:`, { error: error, stack: error.stack });
    } else {
      logger.error(`Error creating comment:`, { err: error, error: new Error() });
    }
  }
  logger.debug(`Exiting addComments`);
}
