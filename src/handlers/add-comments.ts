import { Context } from "../types";

export async function addComments(context: Context) {
  const {
    logger,
    payload,
    adapters: { supabase },
  } = context;

  const sender = payload.comment.user?.login;
  const repo = payload.repository.name;
  const issueNumber = payload.issue.number;
  const issueBody = payload.issue.body || "";
  const owner = payload.repository.owner.login;
  const body = payload.comment.body;

  // Log the payload
  logger.info(`Executing addComments:`, { sender, repo, issueNumber, owner });

  // Add the comment to the database
  try {
    await supabase.comment.createComment(body, payload.comment.id, issueBody);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error creating comment:`, { error: error, stack: error.stack });
      throw error;
    } else {
      logger.error(`Error creating comment:`, { err: error, error: new Error() });
      throw error;
    }
  }

  logger.ok(`Successfully created comment!`);
  logger.verbose(`Exiting addComments`);
}
