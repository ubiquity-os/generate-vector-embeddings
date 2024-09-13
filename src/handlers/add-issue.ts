import { Context } from "../types";

export async function addIssue(context: Context) {
  const {
    logger,
    payload,
    adapters: { supabase },
  } = context;
  const payloadObject = payload;
  const plaintext = payload.issue.body + payload.issue.title || "";
  const authorId = payload.issue.user?.id || -1;
  const nodeId = payload.issue.node_id;
  const isPrivate = payload.repository.private;

  try {
    await supabase.issue.createIssue(nodeId, payloadObject, isPrivate, plaintext, authorId);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error creating issue:`, { error: error, stack: error.stack });
      throw error;
    } else {
      logger.error(`Error creating issue:`, { err: error, error: new Error() });
      throw error;
    }
  }

  logger.ok(`Successfully created issue!`);
  logger.verbose(`Exiting addIssue`);
}
