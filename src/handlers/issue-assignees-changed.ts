import { Context } from "../types";
import { IssuePayload } from "../types/payload";

export async function updateAssignees(context: Context) {
  const {
    logger,
    adapters: { supabase },
  } = context;
  const { payload } = context as { payload: IssuePayload };
  const issue = payload.issue;

  try {
    await supabase.issue.updatePayload(issue.node_id, payload);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error updating assignees:`, { error: error, stack: error.stack });
      throw error;
    } else {
      logger.error(`Error updating assignees:`, { err: error, error: new Error() });
      throw error;
    }
  }

  logger.ok(`Successfully updated assignees!`);
  logger.debug(`Exiting updateAssignees`);
}
