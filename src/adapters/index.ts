import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../types";
import { Comment } from "./supabase/helpers/comment";
import { SuperSupabase } from "./supabase/helpers/supabase";
import { SuperOpenAi } from "./openai/helpers/openai";
import OpenAI from "openai";
import { Embedding as OpenAiEmbedding } from "./openai/helpers/embedding";
import { Embedding as VoyageEmbedding } from "./voyage/helpers/embedding";
import { SuperVoyage } from "./voyage/helpers/voyage";
import { VoyageAIClient } from "voyageai";

export function createAdapters(supabaseClient: SupabaseClient, openai: OpenAI, voyage: VoyageAIClient, context: Context) {
  return {
    supabase: {
      comment: new Comment(supabaseClient, context),
      super: new SuperSupabase(supabaseClient, context),
    },
    openai: {
      embedding: new OpenAiEmbedding(openai, context),
      super: new SuperOpenAi(openai, context),
    },
    voyage: {
      embedding: new VoyageEmbedding(voyage, context),
      super: new SuperVoyage(voyage, context),
    },
  };
}
