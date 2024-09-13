import markdownit from "markdown-it";
import plainTextPlugin from "markdown-it-plain-text";

/**
 * Converts a Markdown string to plain text.
 * @param markdown
 * @returns
 */
export function markdownToPlainText(markdown: string | null): string | null {
  if (!markdown) {
    return markdown;
  }
  const md = markdownit();
  md.use(plainTextPlugin);
  md.render(markdown);
  //Package markdown-it-plain-text does not have types
  return (md as any).plainText;
}
