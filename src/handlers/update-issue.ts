import { Context } from "../types";
import { removeFootnotes } from "./issue-deduplication";

export async function updateIssue(context: Context<"issues.edited">) {
  const {
    logger,
    adapters: { supabase },
    payload,
  } = context;
  const payloadObject = payload;
  const nodeId = payload.issue.node_id;
  const isPrivate = payload.repository.private;
  const markdown = payload.issue.body + " " + payload.issue.title || null;
  const authorId = payload.issue.user?.id || -1;
  // Fetch the previous issue and update it in the db
  try {
    if (!markdown) {
      logger.error("Issue body is empty");
      return;
    }
    //clean issue by removing footnotes
    const cleanedIssue = removeFootnotes(markdown);
    await supabase.issue.updateIssue(cleanedIssue, nodeId, payloadObject, isPrivate, authorId);
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
  logger.debug(`Exiting updateIssue`);
}
