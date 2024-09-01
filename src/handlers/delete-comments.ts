import { Context } from "../types";

export async function deleteComment(context: Context) {
  const {
    logger,
    payload,
    adapters: { supabase },
  } = context;

  const sender = payload.comment.user?.login;
  const repo = payload.repository.name;
  const issueNumber = payload.issue.number;
  const owner = payload.repository.owner.login;

  // Log the payload
  logger.debug(`Executing deleteComment:`, { sender, repo, issueNumber, owner });

  // Add the comment to the database
  try {
    await supabase.comment.deleteComment(payload.comment.id);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error deleting comment:`, { error: error, stack: error.stack });
      throw error;
    } else {
      logger.error(`Error deleting comment:`, { err: error, error: new Error() });
      throw error;
    }
  }

  logger.ok(`Successfully deleted comment!`);
  logger.verbose(`Exiting deleteComments`);
}
