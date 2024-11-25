import { Context } from "../types";

export async function deleteComment(context: Context<"issue_comment.deleted">) {
  const {
    logger,
    adapters: { supabase },
    payload,
  } = context;
  const nodeId = payload.comment.node_id;

  try {
    await supabase.comment.deleteComment(nodeId);
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
  logger.debug(`Exiting deleteComments`);
}
