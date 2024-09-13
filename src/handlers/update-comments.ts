import { Context } from "../types";
import { CommentPayload } from "../types/payload";

export async function updateComment(context: Context) {
  const {
    logger,
    adapters: { supabase },
  } = context;
  const { payload } = context as { payload: CommentPayload };
  const nodeId = payload.comment.node_id;
  const isPrivate = payload.repository.private;
  const plaintext = payload.comment.body;
  // Fetch the previous comment and update it in the db
  try {
    await supabase.comment.updateComment(plaintext, nodeId, payload, isPrivate);
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
