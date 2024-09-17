import { CallbackResult } from "../proxy-callbacks";
import { Context } from "../types";

/**
 * Updates embeddings for comments.
 */
export async function updateCommentEmbedding(context: Context<"issue_comment.edited">): Promise<CallbackResult> {
  const {
    logger,
    adapters: { supabase },
  } = context;

  try {
    const updated = await supabase.embeddings.updateConversationEmbeddings(context.payload.comment.node_id, context.payload, "comment");
    logger.ok(`Successfully updated comment!`, { ...updated, embedding: "removed for brevity" });
  } catch (error) {
    throw error;
  }

  return { status: 200, reason: "success" };
}