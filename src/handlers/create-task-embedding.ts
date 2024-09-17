import { CallbackResult } from "../proxy-callbacks";
import { Context } from "../types";

export async function addTaskEmbedding(context: Context<"issues.opened">): Promise<CallbackResult> {
  const {
    logger,
    adapters: { supabase },
  } = context;

  try {
    const uploaded = await supabase.embeddings.createConversationEmbeddings(context.payload.issue.node_id, context.payload, "task");
    logger.ok(`Successfully created issue!`, { uploaded });
  } catch (error) {
    throw error;
  }

  return { status: 200, reason: "success" };
}
