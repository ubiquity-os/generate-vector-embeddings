import { createAdapters } from "../adapters";
import { Env } from "./env";
import { PluginSettings } from "./plugin-input";
import { Context as PluginContext } from "@ubiquity-os/plugin-sdk";

/**
 * Update `manifest.json` with any events you want to support like so:
 *
 * ubiquity:listeners: ["issue_comment.created", ...]
 */
export type SupportedEvents =
  | "issue_comment.created"
  | "issue_comment.deleted"
  | "issue_comment.edited"
  | "issues.opened"
  | "issues.edited"
  | "issues.deleted"
  | "issues.labeled"
  | "issues.transferred"
  | "issues.closed";

export type Context<TEvents extends SupportedEvents = SupportedEvents> = PluginContext<PluginSettings, Env, null, TEvents> & {
  adapters: ReturnType<typeof createAdapters>;
};
