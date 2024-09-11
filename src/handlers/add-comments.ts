import { cleanCommentObject } from "../adapters/utils/cleancommentobject";
import { Context } from "../types";

export async function addComments(context: Context) {
  const {
    logger,
    payload,
    adapters: { supabase },
  } = context;
  const commentobject = cleanCommentObject(payload);
  const plaintext = payload.comment.body;
  const authorId = payload.comment.user?.id || -1;
  const nodeId = payload.comment.node_id;
  const isPrivate = payload.repository.private;

  // Add the comment to the database
  try {
    await supabase.comment.createComment(plaintext, nodeId, authorId, commentobject as JSON, isPrivate);
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
