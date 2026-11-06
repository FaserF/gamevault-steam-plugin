import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HtmlToMarkdownUtil } from "../dist/client/html-to-markdown.util.js";

describe("HtmlToMarkdownUtil", () => {
  it("converts Steam BBCode HTML with paragraphs and strong tags into Markdown", () => {
    const raw = `<p class="bb_paragraph" ><strong>Balatro ist ein vom Poker inspirierter Deckbuilder</strong></p><p class="bb_paragraph" >Kombiniere Pokerblätter mit Jokern.</p>`;
    const markdown = HtmlToMarkdownUtil.convert(raw);

    assert.ok(markdown.includes("**Balatro ist ein vom Poker inspirierter Deckbuilder**"));
    assert.ok(markdown.includes("Kombiniere Pokerblätter mit Jokern."));
    assert.ok(!markdown.includes("<p"));
    assert.ok(!markdown.includes("bb_paragraph"));
  });

  it("extracts video poster as preview image and strips video elements", () => {
    const raw = `<span class="bb_img_ctn"><video class="bb_img" autoplay muted loop poster="https://shared.akamai.steamstatic.com/poster.avif"><source src="video.webm"></video></span>`;
    const markdown = HtmlToMarkdownUtil.convert(raw);

    assert.ok(markdown.includes("![preview](https://shared.akamai.steamstatic.com/poster.avif)"));
    assert.ok(!markdown.includes("<video"));
    assert.ok(!markdown.includes("<source"));
  });

  it("converts headings, lists, links and decodes entities correctly", () => {
    const raw = `<h2>Features</h2><ul class="bb_ul"><li>150+ Jokers &amp; Decks</li><li>&quot;Special&quot; cards</li></ul><a href="https://balatro.game">Official Site</a>`;
    const markdown = HtmlToMarkdownUtil.convert(raw);

    assert.ok(markdown.includes("## Features"));
    assert.ok(markdown.includes("- 150+ Jokers & Decks"));
    assert.ok(markdown.includes('- "Special" cards'));
    assert.ok(markdown.includes("[Official Site](https://balatro.game)"));
  });

  it("handles null and empty input gracefully", () => {
    assert.equal(HtmlToMarkdownUtil.convert(null), "");
    assert.equal(HtmlToMarkdownUtil.convert(undefined), "");
    assert.equal(HtmlToMarkdownUtil.convert(""), "");
  });
});
