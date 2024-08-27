import { Context } from "../types";

export async function updateComment(context: Context) {
  const {
    logger,
    payload,
    adapters: { supabase },
  } = context;

  const sender = payload.comment.user?.login;
  const repo = payload.repository.name;
  const issueNumber = payload.issue.number;
  const owner = payload.repository.owner.login;
  const body = payload.comment.body;

  // Log the payload
  logger.debug(`Executing updateComment:`, { sender, repo, issueNumber, owner });

  // Fetch the previous comment and update it in the db
  try {
    await supabase.comment.updateComment(body, payload.comment.id);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error updating comment:`, { error: error, stack: error.stack });
      throw error;
    } else {
      logger.error(`Error updating comment:`, { err: error, error: new Error() });
      throw error;
    }
  }

  logger.ok(`Successfully updated comment!`);
  logger.verbose(`Exiting updateComment`);
}
