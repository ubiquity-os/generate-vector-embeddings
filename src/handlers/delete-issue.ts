import { Context } from "../types";

export async function deleteIssues(context: Context<"issues.deleted">) {
  const {
    logger,
    adapters: { supabase },
    payload,
  } = context;
  const nodeId = payload.issue.node_id;

  try {
    await supabase.issue.deleteIssue(nodeId);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error deleting issue:`, { error: error, stack: error.stack });
      throw error;
    } else {
      logger.error(`Error deleting issue:`, { err: error, error: new Error() });
      throw error;
    }
  }

  logger.ok(`Successfully deleted issue!`);
  logger.debug(`Exiting deleteIssue`);
}
