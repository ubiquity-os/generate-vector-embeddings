import { Context } from "../types";
import { IssuePayload } from "../types/payload";

export async function deleteIssues(context: Context) {
  const {
    logger,
    adapters: { supabase },
  } = context;
  const { payload } = context as { payload: IssuePayload };
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
