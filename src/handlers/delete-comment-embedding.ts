import { CallbackResult } from "../proxy-callbacks";
import { Context } from "../types";

export async function deleteCommentEmbedding(context: Context<"issue_comment.deleted">): Promise<CallbackResult> {
  const {
    logger,
    adapters: { supabase },
  } = context;

  try {
    await supabase.embeddings.deleteEmbedding(context.payload.comment.node_id);
    logger.ok(`Successfully deleted comment!`, { commentId: context.payload.comment.node_id });
  } catch (error) {
    throw error;
  }

  return { status: 200, reason: "success" };
}
