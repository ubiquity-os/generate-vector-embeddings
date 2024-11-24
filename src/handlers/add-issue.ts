import { Context } from "../types";
import { removeFootnotes } from "./issue-deduplication";

export async function addIssue(context: Context<"issues.opened">) {
  const {
    logger,
    adapters: { supabase },
    payload,
  } = context;
  const issue = payload.issue;
  const markdown = issue.body + " " + issue.title || null;
  const authorId = issue.user?.id || -1;
  const nodeId = issue.node_id;
  const isPrivate = payload.repository.private;

  try {
    if (!markdown) {
      logger.error("Issue body is empty");
      return;
    }
    const cleanedIssue = removeFootnotes(markdown);
    await supabase.issue.createIssue(nodeId, payload, isPrivate, cleanedIssue, authorId);
    logger.ok(`Successfully created issue!`, issue);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error creating issue:`, { error: error, issue: issue });
      throw error;
    } else {
      logger.error(`Error creating issue:`, { err: error, issue: issue });
      throw error;
    }
  }
  logger.debug(`Exiting addIssue`);
}
