import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../../../types/context";

export class SuperSupabase {
  protected supabase: SupabaseClient;
  protected context: Context;

  constructor(supabase: SupabaseClient, context: Context) {
    this.supabase = supabase;
    this.context = context;
  }

  async checkConnection(): Promise<boolean> {
    const { logger } = this.context;
    try {
      const { error } = await this.supabase.from("_realtime").select("*").limit(1);

      // If there's no error, the connection is working
      if (!error) {
        return true;
      }

      // Log the error for debugging purposes
      logger.error("Error during Supabase connection check:", error);
      return false;
    } catch (error) {
      logger.error("Error during Supabase connection check:", error || new Error("Unknown error"));
      return false;
    }
  }
}
