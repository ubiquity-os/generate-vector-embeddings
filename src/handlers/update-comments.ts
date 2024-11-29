import { Context } from "../types";
import { addIssue } from "./add-issue";

export async function updateComment(context: Context<"issue_comment.edited">) {
  const {
    logger,
    adapters: { supabase },
    payload,
  } = context;
  const markdown = payload.comment.body;
  const authorId = payload.comment.user?.id || -1;
  const id = payload.comment.node_id;
  const isPrivate = payload.repository.private;
  const issueId = payload.issue.node_id;

  // Fetch the previous comment and update it in the db
  try {
    if (!markdown) {
      logger.error("Comment body is empty");
    }
    if (context.payload.issue.pull_request) {
      logger.error("Comment is on a pull request");
    }
    if ((await supabase.issue.getIssue(issueId)) === null) {
      logger.info("Parent issue not found, creating new issue");
      await addIssue(context as unknown as Context<"issues.opened">);
    }
    await supabase.comment.updateComment({ markdown, id, author_id: authorId, payload, isPrivate, issue_id: issueId });
    logger.ok(`Successfully updated comment! ${payload.comment.id}`, payload.comment);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error updating comment:`, { error: error, stack: error.stack, comment: payload.comment });
      throw error;
    } else {
      logger.error(`Error updating comment:`, { err: error, comment: payload.comment });
      throw error;
    }
  }

  logger.debug(`Exiting updateComment`);
}
