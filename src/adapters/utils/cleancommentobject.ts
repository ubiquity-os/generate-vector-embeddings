import { EmitterWebhookEvent as WebhookEvent } from "@octokit/webhooks";
import { Type } from "@sinclair/typebox";

const commentObjectSchema = Type.Object({
  action: Type.String(),
  issue: Type.Object({
    id: Type.Number(),
    number: Type.Number(),
    title: Type.String(),
    body: Type.String(),
    user: Type.Object({
      login: Type.String(),
      id: Type.Number(),
    }),
  }),
  comment: Type.Object({
    author_association: Type.String(),
    id: Type.Number(),
    html_url: Type.String(),
    issue_url: Type.String(),
    user: Type.Object({
      login: Type.String(),
      id: Type.Number(),
    }),
  }),
});

/**
 * Cleans the comment object.
 *
 * @param commentObject - The comment object.
 * @returns The cleaned comment object.
 */
export const cleanCommentObject = (commentObject: WebhookEvent["payload"]): JSON => {
  // Apply the schema to the comment object
  return commentObjectSchema.parse(commentObject);
};
