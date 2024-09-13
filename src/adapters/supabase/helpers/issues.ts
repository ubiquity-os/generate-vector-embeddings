import { SupabaseClient } from "@supabase/supabase-js";
import { SuperSupabase } from "./supabase";
import { Context } from "../../../types/context";

export interface IssueType {
  id: string;
  plaintext?: string;
  author_id: number;
  created_at: string;
  modified_at: string;
  payloadObject: Record<string, unknown> | null;
  embedding: number[];
}

export class Issues extends SuperSupabase {
  constructor(supabase: SupabaseClient, context: Context) {
    super(supabase, context);
  }

  async createIssue(issueNodeId: string, payload: Record<string, unknown> | null, isPrivate: boolean, plaintext: string | null, authorId: number) {
    //First Check if the issue already exists
    const { data, error } = await this.supabase.from("issues").select("*").eq("id", issueNodeId);
    if (error) {
      this.context.logger.error("Error creating issue", error);
      return;
    }
    if (data && data.length > 0) {
      this.context.logger.info("Issue already exists");
      return;
    } else {
      const embedding = await this.context.adapters.voyage.embedding.createEmbedding(plaintext);
      if (isPrivate) {
        payload = null;
        plaintext = null;
      }
      const { error } = await this.supabase.from("issues").insert([{ id: issueNodeId, payload, type: "issue", plaintext, author_id: authorId, embedding }]);
      if (error) {
        this.context.logger.error("Error creating issue", error);
        return;
      }
    }
    this.context.logger.info("Issue created successfully");
  }

  async updateIssue(plaintext: string | null, issueNodeId: string, payload: Record<string, unknown> | null, isPrivate: boolean) {
    //Create the embedding for this comment
    const embedding = Array.from(await this.context.adapters.voyage.embedding.createEmbedding(plaintext));
    if (isPrivate) {
      plaintext = null as string | null;
      payload = null as Record<string, unknown> | null;
    }
    const { error } = await this.supabase.from("issues").update({ plaintext, embedding: embedding, payload, modified_at: new Date() }).eq("id", issueNodeId);
    if (error) {
      this.context.logger.error("Error updating comment", error);
    }
  }

  async deleteIssue(issueNodeId: string) {
    const { error } = await this.supabase.from("issues").delete().eq("id", issueNodeId);
    if (error) {
      this.context.logger.error("Error deleting comment", error);
    }
  }

  async findSimilarIssues(plaintext: string, threshold: number): Promise<IssueType[] | null> {
    const embedding = await this.context.adapters.voyage.embedding.createEmbedding(plaintext);
    const { data, error } = await this.supabase
      .from("issues")
      .select("*")
      .eq("type", "issue")
      .textSearch("embedding", embedding.join(","))
      .order("embedding", { foreignTable: "issues", ascending: false })
      .lte("embedding", threshold);
    if (error) {
      this.context.logger.error("Error finding similar issues", error);
      return [];
    }
    return data;
  }
}
