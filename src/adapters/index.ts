import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../types";
import { Comment } from "./supabase/helpers/comment";
import { SuperSupabase } from "./supabase/helpers/supabase";
import { SuperOpenAi } from "./openai/helpers/openai";
import OpenAI from "openai";
import { Embedding } from "./openai/helpers/embedding";

export function createAdapters(supabaseClient: SupabaseClient, openai: OpenAI, context: Context) {
  return {
    supabase: {
      comment: new Comment(supabaseClient, context),
      super: new SuperSupabase(supabaseClient, context),
    },
    openai: {
      embedding: new Embedding(openai, context),
      super: new SuperOpenAi(openai, context),
    },
  };
}
