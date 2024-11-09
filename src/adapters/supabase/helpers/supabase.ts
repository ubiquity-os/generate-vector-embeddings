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
    const { error } = await this.supabase.rpc("pg_catalog.current_database");
    // If there's no error, the connection is working
    if (!error) {
      return true;
    } else {
      throw new Error("Error connecting to Supabase");
    }
  }
}
