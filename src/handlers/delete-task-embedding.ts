import { CallbackResult } from "../proxy-callbacks";
import { Context } from "../types";

export async function deleteTaskEmbedding(context: Context<"issues.deleted">): Promise<CallbackResult> {
  const {
    logger,
    adapters: { supabase },
  } = context;

  try {
    await supabase.embeddings.deleteEmbedding(context.payload.issue.node_id);
    logger.ok(`Successfully deleted issue!`);
  } catch (error) {
    throw error;
  }

  return { status: 200, reason: "success" };
}
