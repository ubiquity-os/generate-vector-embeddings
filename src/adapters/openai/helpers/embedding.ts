import OpenAI from "openai";
import { Context } from "../../../types";
import { SuperOpenAi } from "./openai";
const VECTOR_SIZE = 3072;

export class Embedding extends SuperOpenAi {
  protected context: Context;

  constructor(client: OpenAI, context: Context) {
    super(client, context);
    this.context = context;
  }

  async createEmbedding(text: string): Promise<number[]> {
    const params: OpenAI.EmbeddingCreateParams = {
      model: "text-embedding-3-large",
      input: text,
      dimensions: VECTOR_SIZE,
    };
    const response = await this.client.embeddings.create({
      ...params,
    });
    return response.data[0]?.embedding;
  }
}
