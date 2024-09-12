import { Context } from "./context";

/**
 * Typeguards are most helpful when you have a union type and you want to narrow it down to a specific one.
 * In other words, if `SupportedEvents` has multiple types then these restrict the scope
 * of `context` to a specific event payload.
 */

/**
 * Restricts the scope of `context` to the `issue_comment.created`, `issue_comment.deleted`, and `issue_comment.edited` payloads.
 *
 * @param context The context object.
 */
export function isIssueCommentEvent(context: Context): context is Context<"issue_comment.created" | "issue_comment.deleted" | "issue_comment.edited"> {
  return context.eventName === "issue_comment.created" || context.eventName === "issue_comment.deleted" || context.eventName === "issue_comment.edited";
}
