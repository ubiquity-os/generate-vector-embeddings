import { VoyageAIClient } from "voyageai";
import { Context } from "../../../types";
import { SuperVoyage } from "./voyage";
import { EmbedRequestInputType } from "voyageai/api/types/EmbedRequestInputType";
const VECTOR_SIZE = 1024;

export class Embedding extends SuperVoyage {
  protected context: Context;

  constructor(client: VoyageAIClient, context: Context) {
    super(client, context);
    this.context = context;
  }

  async createEmbedding(text: string | null, inputType: EmbedRequestInputType = "document"): Promise<number[]> {
    if (text === null) {
      return new Array(VECTOR_SIZE).fill(0);
    } else {
      const response = await this.client.embed({
        input: text,
        model: "voyage-large-2-instruct",
        inputType,
      });
      return (response.data && response.data[0]?.embedding) || [];
    }
  }
}
