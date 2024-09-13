import { Context } from "../types";
import { CommentPayload } from "../types/payload";

export async function deleteComment(context: Context) {
  const {
    logger,
    adapters: { supabase },
  } = context;
  const { payload } = context as { payload: CommentPayload };
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
  logger.verbose(`Exiting deleteComments`);
}
