import { SupabaseClient } from "@supabase/supabase-js";
import { SuperSupabase } from "./supabase";
import { Context } from "../../../types/context";
import { htmlToPlainText, markdownToPlainText } from "../../utils/markdown-to-plaintext";

/**
 * `setup_instructions` - Embedding for setup instructions, readme, etc.
 * `dao_info` - Embedding for DAO information. Notion docs, etc.
 * `task` - Embedding for task specifications. Pricing, Duration, etc.
 * `comment` - Embedding for comments. Spans GitHub, Telegram, etc. metadata: {isReview: boolean, isIssue: boolean, isPR: boolean} etc.
 */

export type EmbeddingType = "setup_instructions" | "dao_info" | "task" | "comment";

export interface CommentType {
  source_id: string;
  type: string;
  plaintext: string | null;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
  modified_at: string;
}

export class Comment extends SuperSupabase {
  constructor(supabase: SupabaseClient, context: Context) {
    super(supabase, context);
  }

  // Creates an embedding for comments, issue bodies, etc.
  async createComment(
    markdown: string | null,
    commentNodeId: string,
    authorId: number,
    payload: Context<"issue_comment.created" | "issues.opened">["payload"],
    isPrivate: boolean,
    issueId: string
  ) {
    let author_association: string | null = null;
    let type: EmbeddingType = "comment";

    if (payload.action === "opened") {
      author_association = payload.issue.author_association;
      type = "task";
    } else if (payload.action === "created") {
      author_association = payload.comment.author_association;
    }

    const toStore: CommentType = {
      source_id: commentNodeId,
      type,
      plaintext: htmlToPlainText(markdownToPlainText(markdown)),
      embedding: [],
      metadata: {
        author_id: authorId,
        issue_id: issueId,
        author_association
      },
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    };

    // First Check if the comment already exists
    const { data } = await this.supabase.from("content").select("*").eq("source_id", commentNodeId);

    if (data && data.length > 0) {
      this.context.logger.info("Comment already exists");
      return;
    }

    // Create the embedding for this comment
    toStore.embedding = await this.context.adapters.voyage.embedding.createEmbedding(markdown);

    if (isPrivate) {
      toStore.plaintext = null
      toStore.metadata = {
        ...toStore.metadata,
        isPrivate: true,
      };
    }

    // Insert the comment
    const { error } = await this.supabase.from("content").insert([toStore])

    if (error) {
      throw this.context.logger.error("Error creating comment", error);
    }

    this.context.logger.info("Comment created successfully");
  }

  async updateComment(markdown: string | null, commentNodeId: string, payload: Record<string, unknown> | null, isPrivate: boolean) {
    // Create the embedding for this comment
    const embedding = Array.from(await this.context.adapters.voyage.embedding.createEmbedding(markdown));
    let plaintext: string | null = markdownToPlainText(markdown);
    if (isPrivate) {
      markdown = null as string | null;
      payload = null as Record<string, unknown> | null;
      plaintext = null as string | null;
    }
    const { error } = await this.supabase
      .from("issue_comments")
      .update({ markdown, plaintext, embedding: embedding, payload, modified_at: new Date() })
      .eq("id", commentNodeId);
    if (error) {
      this.context.logger.error("Error updating comment", error);
    }
  }

  async getComment(commentNodeId: string): Promise<CommentType[] | null> {
    const { data, error } = await this.supabase.from("issue_comments").select("*").eq("id", commentNodeId);
    if (error) {
      this.context.logger.error("Error getting comment", error);
    }
    return data;
  }

  async deleteComment(commentNodeId: string) {
    const { error } = await this.supabase.from("issue_comments").delete().eq("id", commentNodeId);
    if (error) {
      this.context.logger.error("Error deleting comment", error);
    }
  }
}
