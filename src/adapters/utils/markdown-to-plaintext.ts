/**
 * Converts a Markdown string to plain text.
 * @param markdown
 * @returns
 */
export function markdownToPlainText(markdown: string | null): string | null {
  if (!markdown) {
    return markdown;
  }
  let text = markdown.replace(/^#{1,6}\s+/gm, ""); // Remove headers
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1"); // Inline links
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1"); // Inline images
  text = text.replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, "").trim()); // Code blocks
  text = text.replace(/`([^`]+)`/g, "$1"); // Inline code
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2"); // Bold
  text = text.replace(/(\*|_)(.*?)\1/g, "$2"); // Italic
  text = text.replace(/~~(.*?)~~/g, "$1"); // Strikethrough
  text = text.replace(/^>\s+/gm, ""); // Block quotes
  text = text.replace(/^\s*[-*]{3,}\s*$/gm, ""); // Horizontal rules
  text = text.replace(/\n{3,}/g, "\n\n"); // Remove extra newlines
  text = text.replace(/\s+/g, " ").trim(); // Remove extra spaces
  return text;
}
