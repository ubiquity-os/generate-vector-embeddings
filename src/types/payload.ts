import { EmitterWebhookEvent as WebhookEvent } from "@octokit/webhooks";
export type CommentPayload = WebhookEvent<"issue_comment">["payload"];
export type IssuePayload = WebhookEvent<"issues">["payload"];
