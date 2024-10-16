import { Context } from "../types";
import { IssueTransferPayload } from "../types/payload";

export async function issueTransfer(context: Context) {
  const {
    logger,
    adapters: { supabase },
  } = context;
  const { changes, issue } = (context as { payload: IssueTransferPayload }).payload;
  const nodeId = issue.node_id;
  const { new_issue, new_repository } = changes;
  //Fetch the new details of the issue
  const newIssueNodeId = new_issue.node_id;
  const markdown = new_issue.body + " " + new_issue.title || null;
  const authorId = new_issue.user?.id || -1;
  const isPrivate = new_repository.private;

  //Delete the issue from the old repository
  //Create the new issue in the new repository
  try {
    await supabase.issue.deleteIssue(nodeId);
    await supabase.issue.createIssue(newIssueNodeId, new_issue, isPrivate, markdown, authorId);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error transferring issue:`, { error: error, stack: error.stack });
      throw error;
    } else {
      logger.error(`Error transferring issue:`, { err: error, error: new Error() });
      throw error;
    }
  }
}
