/**
 * ResearchAgent — Layer 2
 *
 * General-purpose deep research and analysis using Claude Sonnet.
 * Source-agnostic: accepts pre-fetched text or a URL to resolve.
 *
 * URL resolution priority chain:
 *   1. TikTok URL  → check tiktok_analysis for existing transcript (no re-transcribe)
 *   2. Web article → fetch HTML, pass raw to Claude for extraction + analysis
 *   3. YouTube     → unsupported (returns clear error in suggestedNextSteps)
 *
 * Called by:
 *   - pipelines/analyze-tiktok.ts  (passes transcript as type:'text')
 *   - pipelines/research-project.ts (future — Notion project with Research Requested status)
 *   - director.ts (future — when classifier detects a research-worthy knowledge item)
 */

import { askJSON } from "../models/claude.js";
import { getTranscriptForVideo } from "../tiktok-client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchInput {
  type: "text" | "url";
  /** Pre-fetched text content — required when type is 'text' */
  content?: string;
  /** URL to resolve — required when type is 'url' */
  url?: string;
  /** Framing question: "evaluate for blog post", "is this worth a project?", etc. */
  context?: string;
  metadata?: {
    title?: string;
    caption?: string;
    sourceType?: "tiktok" | "article" | "note" | "youtube";
    [key: string]: unknown;
  };
}

export interface ResearchOutput {
  summary: string;
  keyInsights: string[];
  contentOpportunities: string[];
  suggestedContentType: "blog" | "social" | "reference" | null;
  suggestedNextSteps: string[];
  confidence: "high" | "medium" | "low";
  /** What the URL resolved to, if applicable — useful for the audit trail */
  sourceResolved?: string;
}

// ---------------------------------------------------------------------------
// URL resolution helpers
// ---------------------------------------------------------------------------

/**
 * Extract a TikTok video_id from a URL like:
 *   https://www.tiktok.com/@handle/video/7459779252146228497
 */
function extractTiktokVideoId(url: string): string | null {
  const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return match ? match[1] : null;
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

/**
 * Fetch a web page and return its raw HTML.
 * Claude will handle extracting the meaningful content from the HTML noise.
 */
async function fetchWebContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ResearchAgent/1.0)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }

  const html = await res.text();

  // Truncate to 80k chars — well within Sonnet's context window and avoids
  // passing enormous pages that are mostly nav/footer boilerplate.
  return html.slice(0, 80_000);
}

/**
 * Resolve a URL to a content string and a human-readable source description.
 * Returns null content if the URL is unsupported (e.g. YouTube).
 */
async function resolveUrl(url: string): Promise<{
  content: string | null;
  sourceResolved: string;
}> {
  // TikTok video — check DB for existing transcript first
  const tiktokId = extractTiktokVideoId(url);
  if (tiktokId) {
    const transcript = await getTranscriptForVideo(tiktokId);
    if (transcript) {
      return {
        content: transcript,
        sourceResolved: `TikTok video ${tiktokId} (transcript from local DB)`,
      };
    }
    return {
      content: null,
      sourceResolved: `TikTok video ${tiktokId} — no transcript yet. Run analyze-tiktok --id ${tiktokId} first.`,
    };
  }

  // YouTube — not yet supported
  if (isYouTubeUrl(url)) {
    return {
      content: null,
      sourceResolved: `YouTube URL — unsupported. Download the video and run the transcription pipeline first.`,
    };
  }

  // Web article / page — fetch and pass HTML to Claude
  const html = await fetchWebContent(url);
  return {
    content: html,
    sourceResolved: url,
  };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildSystemPrompt(isHtml: boolean): string {
  const contentNote = isHtml
    ? "The content provided is raw HTML from a web page. Extract the meaningful article/body text and ignore navigation, ads, and boilerplate before analyzing."
    : "The content is plain text (transcript, notes, or article body).";

  return `You are a deep research and content analysis assistant. ${contentNote}

Given content and optional framing context, return a JSON object with:
- "summary": 2-4 sentence summary of the core content
- "keyInsights": array of 3-7 specific, actionable insights extracted from the content
- "contentOpportunities": array of 2-5 concrete content angles (e.g. "long-form blog post on X", "short-form hook: Y quote", "reference guide for Z workflow")
- "suggestedContentType": one of "blog", "social", "reference", or null if unclear
  - "blog": substantive enough for a long-form post or tutorial
  - "social": strong hook, punchy, works as short-form content
  - "reference": dense technical or instructional material, best as a saved resource
- "suggestedNextSteps": array of 1-4 next actions (e.g. "research X further", "cross-reference with Y project", "draft outline for Z")
- "confidence": "high" if content is clear and substantial, "medium" if partial, "low" if content is thin or ambiguous

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function research(input: ResearchInput): Promise<ResearchOutput> {
  let content: string;
  let sourceResolved: string | undefined;
  let isHtml = false;

  if (input.type === "url") {
    if (!input.url) throw new Error("ResearchInput type 'url' requires a url field");

    const resolved = await resolveUrl(input.url);

    if (!resolved.content) {
      // Unsupported or missing transcript — return a minimal output explaining why
      return {
        summary: resolved.sourceResolved,
        keyInsights: [],
        contentOpportunities: [],
        suggestedContentType: null,
        suggestedNextSteps: [resolved.sourceResolved],
        confidence: "low",
        sourceResolved: resolved.sourceResolved,
      };
    }

    content = resolved.content;
    sourceResolved = resolved.sourceResolved;
    isHtml = !extractTiktokVideoId(input.url ?? "") && !isYouTubeUrl(input.url ?? "");
  } else {
    if (!input.content) throw new Error("ResearchInput type 'text' requires a content field");
    content = input.content;
  }

  // Build user message — include metadata and context if provided
  const parts: string[] = [];

  if (input.metadata?.title) parts.push(`Title: ${input.metadata.title}`);
  if (input.metadata?.caption) parts.push(`Caption: ${input.metadata.caption}`);
  if (input.metadata?.sourceType) parts.push(`Source type: ${input.metadata.sourceType}`);
  if (input.context) parts.push(`Research context: ${input.context}`);

  parts.push(`\nContent:\n${content}`);

  const userMessage = parts.join("\n");

  const result = await askJSON<ResearchOutput>(
    "claude-sonnet-4-6",
    buildSystemPrompt(isHtml),
    userMessage,
    8192  // research output can be detailed — give it room
  );

  return { ...result, sourceResolved };
}
