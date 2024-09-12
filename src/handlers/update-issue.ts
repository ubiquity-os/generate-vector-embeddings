import { Context } from "../types";

export async function updateIssue(context: Context) {
  const {
    logger,
    payload,
    adapters: { supabase },
  } = context;
  const payloadObject = payload;
  const nodeId = payload.issue.node_id;
  const isPrivate = payload.repository.private;
  const plaintext = payload.issue.body + payload.issue.title || "";
  // Fetch the previous comment and update it in the db
  try {
    await supabase.issue.updateIssue(plaintext, nodeId, payloadObject, isPrivate);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error updating issue:`, { error: error, stack: error.stack });
      throw error;
    } else {
      logger.error(`Error updating issue:`, { err: error, error: new Error() });
      throw error;
    }
  }

  logger.ok(`Successfully updated issue!`);
  logger.verbose(`Exiting updateIssue`);
}
