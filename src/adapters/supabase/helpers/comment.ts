import { SupabaseClient } from "@supabase/supabase-js";
import { SuperSupabase } from "./supabase";
import { Context } from "../../../types/context";

export interface CommentType {
  id: string;
  plaintext?: string;
  author_id: number;
  created_at: string;
  modified_at: string;
  embedding: number[];
}

export class Comment extends SuperSupabase {
  constructor(supabase: SupabaseClient, context: Context) {
    super(supabase, context);
  }

  async createComment(plaintext: string | null, commentNodeId: string, authorId: number, commentobject: JSON | null, isPrivate: boolean) {
    //First Check if the comment already exists
    const { data, error } = await this.supabase.from("issue_comments").select("*").eq("id", commentNodeId);
    if (error) {
      this.context.logger.error("Error creating comment", error);
      return;
    }
    if (data && data.length > 0) {
      this.context.logger.info("Comment already exists");
      return;
    } else {
      //Create the embedding for this comment
      const embedding = await this.context.adapters.voyage.embedding.createEmbedding(plaintext);
      //If embedding is smaller than 3072, pad it with 0s
      if (embedding.length < 3072) {
        embedding.push(...new Array(3072 - embedding.length).fill(0));
      }
      if (isPrivate) {
        plaintext = null as string | null;
      }
      const { error } = await this.supabase
        .from("issue_comments")
        .insert([{ id: commentNodeId, plaintext, author_id: authorId, commentobject, embedding: embedding }]);
      if (error) {
        this.context.logger.error("Error creating comment", error);
        return;
      }
    }
    this.context.logger.info("Comment created successfully");
  }

  async updateComment(plaintext: string | null, commentNodeId: string, commentobject: JSON, isPrivate: boolean) {
    //Create the embedding for this comment
    const embedding = Array.from(await this.context.adapters.voyage.embedding.createEmbedding(plaintext));
    if (embedding.length < 3072) {
      embedding.push(...new Array(3072 - embedding.length).fill(0));
    }
    if (isPrivate) {
      plaintext = null as string | null;
    }
    const { error } = await this.supabase
      .from("issue_comments")
      .update({ plaintext, embedding: embedding, commentobject, modified_at: new Date() })
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
