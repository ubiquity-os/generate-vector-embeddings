import { SupabaseClient } from "@supabase/supabase-js";
import { SuperSupabase } from "./supabase";
import { Context } from "../../../types/context";

export interface CommentType {
  id: string;
  plaintext: string;
  author_id: number;
  created_at: string;
  modified_at: string;
  embedding: number[];
}

export class Comment extends SuperSupabase {
  constructor(supabase: SupabaseClient, context: Context) {
    super(supabase, context);
  }

  async createComment(plaintext: string, commentNodeId: string, authorId: number, isPrivate: boolean) {
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
      const embedding = await this.context.adapters.openai.embedding.createEmbedding(plaintext);
      if (isPrivate) {
        plaintext = "CENSORED";
      }
      const { error } = await this.supabase.from("issue_comments").insert([{ id: commentNodeId, plaintext, author_id: authorId, embedding: embedding }]);
      if (error) {
        this.context.logger.error("Error creating comment", error);
        return;
      }
    }
    this.context.logger.info("Comment created successfully");
  }

  async updateComment(plaintext: string, commentNodeId: string, isPrivate: boolean) {
    //Create the embedding for this comment
    const embedding = Array.from(await this.context.adapters.openai.embedding.createEmbedding(plaintext));
    if (isPrivate) {
      plaintext = "CENSORED";
    }
    const { error } = await this.supabase.from("issue_comments").update({ plaintext, embedding: embedding, modified_at: new Date() }).eq("id", commentNodeId);
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
