import { SupabaseClient } from "@supabase/supabase-js";
import { SuperSupabase } from "./supabase";
import { Context } from "../../../types/context";
import { markdownToPlainText } from "../../utils/markdown-to-plaintext";

export interface IssueSimilaritySearchResult {
  issue_id: string;
  issue_plaintext: string;
  similarity: number;
}

export interface IssueType {
  id: string;
  markdown?: string;
  plaintext?: string;
  payload?: Record<string, unknown>;
  author_id: number;
  created_at: string;
  modified_at: string;
  embedding: number[];
}

export class Issues extends SuperSupabase {
  constructor(supabase: SupabaseClient, context: Context) {
    super(supabase, context);
  }

  async createIssue(issueNodeId: string, payload: Record<string, unknown> | null, isPrivate: boolean, markdown: string | null, authorId: number) {
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
      const embedding = await this.context.adapters.voyage.embedding.createEmbedding(markdown);
      let plaintext: string | null = markdownToPlainText(markdown || "");
      if (isPrivate) {
        payload = null;
        markdown = null;
        plaintext = null;
      }
      const { error } = await this.supabase.from("issues").insert([{ id: issueNodeId, payload, markdown, plaintext, author_id: authorId, embedding }]);
      if (error) {
        this.context.logger.error("Error creating issue", error);
        return;
      }
    }
    this.context.logger.info("Issue created successfully");
  }

  async updateIssue(markdown: string | null, issueNodeId: string, payload: Record<string, unknown> | null, isPrivate: boolean) {
    //Create the embedding for this comment
    const embedding = Array.from(await this.context.adapters.voyage.embedding.createEmbedding(markdown));
    let plaintext: string | null = markdownToPlainText(markdown || "");
    if (isPrivate) {
      markdown = null as string | null;
      payload = null as Record<string, unknown> | null;
      plaintext = null as string | null;
    }
    const { error } = await this.supabase
      .from("issues")
      .update({ markdown, plaintext, embedding: embedding, payload, modified_at: new Date() })
      .eq("id", issueNodeId);
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

  async getIssue(issueNodeId: string): Promise<IssueType[] | null> {
    const { data, error } = await this.supabase
      .from("issues") // Provide the second type argument
      .select("*")
      .eq("id", issueNodeId)
      .returns<IssueType[]>();
    if (error) {
      this.context.logger.error("Error getting issue", error);
      return null;
    }
    return data;
  }

  async findSimilarIssues(markdown: string, threshold: number, currentId: string): Promise<IssueSimilaritySearchResult[] | null> {
    const embedding = await this.context.adapters.voyage.embedding.createEmbedding(markdown);
    const { data, error } = await this.supabase.rpc("find_similar_issues", {
      current_id: currentId,
      query_embedding: embedding,
      threshold: threshold,
    });
    if (error) {
      this.context.logger.error("Error finding similar issues", error);
      return [];
    }
    return data;
  }

  async updatePayload(issueNodeId: string, payload: Record<string, unknown>) {
    const { error } = await this.supabase.from("issues").update({ payload }).eq("id", issueNodeId);
    if (error) {
      this.context.logger.error("Error updating issue payload", error);
    }
  }

  // Edit distance (Number of operations required to convert one string to another)
  calculateEditDistance(query: string, similarIssues: string): number {
    const dp: number[][] = Array(query.length + 1)
      .fill(null)
      .map(() => Array(similarIssues.length + 1).fill(null));

    for (let i = 0; i <= query.length; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= similarIssues.length; j++) {
      dp[0][j] = j;
    }
    for (let i = 1; i <= query.length; i++) {
      for (let j = 1; j <= similarIssues.length; j++) {
        const cost = query[i - 1] === similarIssues[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[query.length][similarIssues.length];
  }

  async fetchSimilarIssueEditDist(markdown: string, threshold: number, currentId: string): Promise<IssueSimilaritySearchResult[] | null> {
    const embedding = await this.context.adapters.voyage.embedding.createEmbedding(markdown);
    const { data, error } = await this.supabase.rpc("find_similar_issues", {
      current_id: currentId,
      query_embedding: embedding,
      threshold: threshold,
    });

    if (error) {
      this.context.logger.error("Error finding similar issues", error);
      return [];
    }

    const similarIssues: string[] = data.map((issue: IssueSimilaritySearchResult) => issue.issue_plaintext);

    // Calculate the maximum edit distance based on the length of the input markdown
    const maxLength = markdown.length;
    const editDistanceThreshold = maxLength * (1 - threshold); // Convert similarity threshold to edit distance threshold

    // Calculate edit distances
    const editDistances = similarIssues.map((issue) => this.calculateEditDistance(markdown, issue));

    // Filter out the issues that are above the edit distance threshold
    return data.filter((index: number) => editDistances[index] <= editDistanceThreshold);
  }
}
