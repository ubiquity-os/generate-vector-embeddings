import { SupportedEvents, SupportedEventsU } from "../../types/context";

/**
 * Extracts only the properties mentioned in the TypeBox schema from the input object.
 *
 * @param commentObject - The comment object.
 * @returns The object containing only the properties defined in the schema.
 */
export function cleanCommentObject<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]>(
  commentObject: TU["payload"]
): Record<string, unknown> {
  // Manually extract properties
  return {
    action: commentObject.action as string,
    issue: {
      id: commentObject.issue.id as number,
      number: commentObject.issue.number as number,
      title: commentObject.issue.title as string,
      body: commentObject.issue.body as string,
      user: {
        login: commentObject.issue.user.login as string,
        id: commentObject.issue.user.id as number,
      },
      author_association: commentObject.issue.author_association as string,
    },
    comment: {
      author_association: commentObject.comment.author_association as string,
      id: commentObject.comment.id as number,
      html_url: commentObject.comment.html_url as string,
      issue_url: commentObject.comment.issue_url as string,
      user: {
        login: (commentObject.comment.user || { login: "" }).login as string,
        id: (commentObject.comment.user || { id: -1 }).id as number,
      },
      body: commentObject.comment.body as string,
      created_at: commentObject.comment.created_at as string,
      updated_at: commentObject.comment.updated_at as string,
    },

    repository: {
      id: commentObject.repository.id as number,
      node_id: commentObject.repository.node_id as string,
      name: commentObject.repository.name as string,
      full_name: commentObject.repository.full_name as string,
      private: commentObject.repository.private as boolean,
      owner: {
        login: commentObject.repository.owner.login as string,
        id: commentObject.repository.owner.id as number,
        avatar_url: commentObject.repository.owner.avatar_url as string,
      },
    },
  } as Record<string, unknown>;
}
