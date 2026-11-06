/**
 * Utility to convert raw Steam Storefront HTML (BBCode-in-HTML)
 * into clean, readable Markdown compatible with GameVault clients.
 */

const HTML_ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&hellip;": "...",
  "&trade;": "™",
  "&copy;": "©",
  "&reg;": "®",
  "&mdash;": "—",
  "&ndash;": "–",
  "&bull;": "•",
};

export class HtmlToMarkdownUtil {
  /**
   * Cleans and converts Steam Store HTML/BBCode description into Markdown.
   */
  public static convert(rawHtml?: string | null): string {
    if (!rawHtml || typeof rawHtml !== "string") {
      return "";
    }

    let text = rawHtml;

    // 1. Remove dangerous or non-display tags
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    // 2. Handle Steam video blocks: extract poster as Markdown image if present
    text = text.replace(
      /<video[^>]+poster=["']([^"']+)["'][^>]*>[\s\S]*?<\/video>/gi,
      (_match, poster) => (poster ? `\n\n![preview](${poster})\n\n` : ""),
    );
    text = text.replace(/<video[^>]*>[\s\S]*?<\/video>/gi, "");

    // 3. Headings
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
    text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");

    // 4. Bold & Italics
    text = text.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");
    text = text.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");

    // 5. Lists
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
    text = text.replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n");

    // 6. Paragraphs and breaks
    text = text.replace(/<p[^>]*>/gi, "\n\n");
    text = text.replace(/<\/p>/gi, "");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

    // 7. Images
    text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (_match, src) => {
      return src ? `![artwork](${src})` : "";
    });

    // 8. Hyperlinks
    text = text.replace(
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_match, url, label) => {
        const cleanLabel = (label || "").trim();
        return cleanLabel ? `[${cleanLabel}](${url})` : url;
      },
    );

    // 9. Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // 10. Decode HTML entities
    for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
      text = text.replaceAll(entity, replacement);
    }
    // Numeric entities (e.g. &#8217; or &#x2019;)
    text = text.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(Number(dec)));
    text = text.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );

    // 11. Normalize excess blank lines and whitespace
    text = text
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n");
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
  }
}
