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
    logger.ok(`Successfully deleted issue! ${payload.issue.id}`, payload.issue);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error deleting issue:`, { error: error, stack: error.stack, issue: payload.issue });
      throw error;
    } else {
      logger.error(`Error deleting issue:`, { err: error, issue: payload.issue });
      throw error;
    }
  }
  logger.debug(`Exiting deleteIssue`);
}
