import { SupabaseClient } from "@supabase/supabase-js";
import { SuperSupabase } from "./supabase";
import { Context } from "../../../types/context";
import { markdownToPlainText } from "../../utils/markdown-to-plaintext";

export interface CommentType {
  id: string;
  markdown?: string;
  author_id: number;
  created_at: string;
  modified_at: string;
  embedding: number[];
}

export class Comment extends SuperSupabase {
  constructor(supabase: SupabaseClient, context: Context) {
    super(supabase, context);
  }

  async createComment(
    markdown: string | null,
    commentNodeId: string,
    authorId: number,
    payload: Record<string, unknown> | null,
    isPrivate: boolean,
    issueId: string
  ) {
    //First Check if the comment already exists
    const { data: existingData, error: existingError } = await this.supabase.from("issue_comments").select("*").eq("id", commentNodeId);
    if (existingError) {
      this.context.logger.error("Error creating comment", { err: existingError });
      return;
    }
    if (existingData && existingData.length > 0) {
      this.context.logger.error("Comment already exists");
      return;
    }
    //Create the embedding for this comment
    const embedding = await this.context.adapters.voyage.embedding.createEmbedding(markdown);
    let plaintext: string | null = markdownToPlainText(markdown);
    if (isPrivate) {
      markdown = null as string | null;
      payload = null as Record<string, unknown> | null;
      plaintext = null as string | null;
    }
    const { data, error } = await this.supabase
      .from("issue_comments")
      .insert([{ id: commentNodeId, markdown, plaintext, author_id: authorId, payload, embedding: embedding, issue_id: issueId }]);
    if (error) {
      this.context.logger.error("Failed to create comment in database", {
        Error: error,
        commentData: {
          id: commentNodeId,
          markdown,
          plaintext,
          author_id: authorId,
          payload,
          embedding,
          issue_id: issueId,
        },
      });
      return;
    }
    this.context.logger.info(`Comment created successfully with id: ${commentNodeId}`, { data });
  }

  async updateComment(
    markdown: string | null,
    commentNodeId: string,
    authorId: number,
    payload: Record<string, unknown> | null,
    isPrivate: boolean,
    issueId: string
  ) {
    //Create the embedding for this comment
    const embedding = Array.from(await this.context.adapters.voyage.embedding.createEmbedding(markdown));
    let plaintext: string | null = markdownToPlainText(markdown);
    if (isPrivate) {
      markdown = null as string | null;
      payload = null as Record<string, unknown> | null;
      plaintext = null as string | null;
    }
    const comments = await this.getComment(commentNodeId);
    if (comments && comments.length == 0) {
      this.context.logger.info("Comment does not exist, creating a new one");
      await this.createComment(markdown, commentNodeId, authorId, payload, isPrivate, issueId);
    } else {
      const { error } = await this.supabase
        .from("issue_comments")
        .update({ markdown, plaintext, embedding: embedding, payload, modified_at: new Date() })
        .eq("id", commentNodeId);
      if (error) {
        this.context.logger.error("Error updating comment", {
          Error: error,
          commentData: {
            id: commentNodeId,
            markdown,
            plaintext,
            embedding,
            payload,
            modified_at: new Date(),
          },
        });
        return;
      }
      this.context.logger.info("Comment updated successfully with id: " + commentNodeId, {
        commentData: {
          id: commentNodeId,
          markdown,
          plaintext,
          embedding,
          payload,
          modified_at: new Date(),
        },
      });
    }
  }

  async getComment(commentNodeId: string): Promise<CommentType[] | null> {
    const { data, error } = await this.supabase.from("issue_comments").select("*").eq("id", commentNodeId);
    if (error) {
      this.context.logger.error("Error getting comment", {
        Error: error,
        commentData: {
          id: commentNodeId,
        },
      });
      return null;
    }
    return data;
  }

  async deleteComment(commentNodeId: string) {
    const { error } = await this.supabase.from("issue_comments").delete().eq("id", commentNodeId);
    if (error) {
      this.context.logger.error("Error deleting comment", {
        Error: error,
        commentData: {
          id: commentNodeId,
        },
      });
      return;
    }
    this.context.logger.info("Comment deleted successfully with id: " + commentNodeId);
  }
}
