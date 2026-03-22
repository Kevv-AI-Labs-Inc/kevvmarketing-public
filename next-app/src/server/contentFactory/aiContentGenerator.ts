/**
 * AI Content Generator — bilingual content for social media, email, market reports.
 *
 * Extends the adCreativeGenerator pattern to non-ad use cases.
 * All content is generated in both English and Chinese where applicable.
 */

import { invokeLLM } from "../_core/llm";
import type { ListingData } from "../clients/types";

// ─── Content Types ─────────────────────────────────────────

export type ContentFormat =
  | "social_post"
  | "email"
  | "market_report"
  | "deal_story"
  | "open_house"
  | "just_listed"
  | "just_sold"
  | "price_drop"
  | "newsletter"
  | "xhs_post";

export interface ContentRequest {
  format: ContentFormat;
  platform?: string;
  language: "en" | "zh" | "zh_en";
  listing?: ListingData;
  agentName: string;
  agentTitle?: string;
  customPrompt?: string;
  tone?: "professional" | "casual" | "luxury" | "friendly";
}

export interface ContentOutput {
  content: string;
  contentZh?: string;
  hashtags?: string[];
  subject?: string;
  title?: string;
  photoTips?: string[];
  format: ContentFormat;
  platform?: string;
  language: string;
}

// ─── Prompt Templates ──────────────────────────────────────

const FORMAT_PROMPTS: Record<ContentFormat, string> = {
  social_post: `Write a social media post for a real estate listing. Make it engaging, include emojis, and add 3-5 relevant hashtags. Keep it under 200 words.`,

  email: `Write a marketing email for a real estate listing. Include a compelling subject line, opening hook, key property highlights, and a clear CTA. Professional but warm tone.`,

  market_report: `Write a brief neighborhood market update. Include price trends, days on market, inventory levels, and a forward-looking commentary. 200-300 words, data-driven.`,

  deal_story: `Write a compelling "just sold" success story. Highlight the journey: how the right match was found, any challenges overcome, and the happy outcome. 150-200 words.`,

  open_house: `Write an open house announcement. Include date/time placeholder, address, key features, and an inviting tone. Create urgency. 100-150 words.`,

  just_listed: `Write a "Just Listed!" announcement. Lead with the most impressive feature, highlight key specs, and create excitement. 100-150 words.`,

  just_sold: `Write a "Just Sold!" celebration post. Congratulate the buyers/sellers, mention the property briefly, and include a soft CTA for those looking to buy/sell. 100-150 words.`,

  price_drop: `Write a "Price Reduced!" alert. Emphasize the value opportunity, highlight original vs new price, and create urgency. 80-120 words.`,

  newsletter: `Write a monthly real estate newsletter section. Include a market overview, featured listing, and a tip for buyers/sellers. Professional tone, 300-400 words.`,

  xhs_post: `你是一个专业的北美华人房地产小红书运营专家。根据房源信息生成一篇小红书笔记。

要求：
1. **标题**：必须 ≤ 20个中文字符（约40字节），吸引眼球，使用emoji开头，例如"🏡 尔湾学区房｜4房3卫 仅$125万"
2. **正文**：200-400字，分段清晰，使用emoji分隔要点，内容包括：
   - 房屋亮点（户型、面积、装修、社区）
   - 周边配套（学校、超市、交通）
   - 适合人群（首次购房者/投资者/学区需求等）
   - 价格优势或市场分析
3. **话题标签**：5-8个小红书风格的中文话题标签，如 #北美买房 #尔湾学区房 #美国房产
4. **图片建议**：建议使用哪些房源照片（如客厅、厨房、外观等），用于提示用户选图

返回JSON格式：{
  "title": "标题（≤20个中文字）",
  "content": "正文内容（带emoji）",
  "contentZh": "同content",
  "hashtags": ["#话题1", "#话题2", ...],
  "photoTips": ["外观照片", "客厅", "厨房", "主卧"]
}`,
};

// ─── Generator ─────────────────────────────────────────────

/**
 * Generate marketing content using AI.
 */
export async function generateContent(
  request: ContentRequest,
): Promise<ContentOutput> {
  const formatPrompt = FORMAT_PROMPTS[request.format];
  const platformNote = request.platform
    ? `\nPlatform: ${request.platform} — adapt style accordingly.`
    : "";

  const listingContext = request.listing
    ? `
## Listing Data
- Address: ${request.listing.unparsedAddress}, ${request.listing.city}, ${request.listing.stateOrProvince}
- Price: $${Number(request.listing.listPrice).toLocaleString()}
- Type: ${request.listing.propertyType}
- Beds/Baths: ${request.listing.bedroomsTotal ?? "N/A"} / ${request.listing.bathroomsTotalInteger ?? "N/A"}
- Living Area: ${request.listing.livingArea} sqft
- Description: ${request.listing.publicRemarks?.substring(0, 300) ?? "N/A"}
${request.listing.yearBuilt ? `- Year Built: ${request.listing.yearBuilt}` : ""}
`
    : "";

  const languageInstructions =
    request.language === "zh"
      ? "Write in simplified Chinese (简体中文). Target Chinese diaspora home buyers in North America."
      : request.language === "zh_en"
        ? 'Write BOTH English and Chinese versions. Separate with "---". Chinese should target Chinese diaspora buyers.'
        : "Write in English.";

  const prompt = `${formatPrompt}${platformNote}
${listingContext}

Agent: ${request.agentName}${request.agentTitle ? ` — ${request.agentTitle}` : ""}
Tone: ${request.tone ?? "professional"}

${languageInstructions}

${request.customPrompt ? `Additional instructions: ${request.customPrompt}` : ""}

Return JSON with: { "content": "...", "contentZh": "..." (if bilingual), "hashtags": [...], "subject": "..." (if email) }`;

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a bilingual real estate content creator. Return ONLY valid JSON. No markdown wrapping.",
      },
      { role: "user", content: prompt },
    ],
    responseFormat: { type: "json_object" },
  });

  const responseText =
    typeof result.choices[0]?.message?.content === "string"
      ? result.choices[0].message.content
      : "";

  try {
    const parsed = JSON.parse(responseText);
    return {
      content: parsed.content ?? "",
      contentZh: parsed.contentZh ?? parsed.content_zh,
      hashtags: parsed.hashtags ?? [],
      subject: parsed.subject,
      title: parsed.title,
      photoTips: parsed.photoTips ?? parsed.photo_tips,
      format: request.format,
      platform: request.platform,
      language: request.language,
    };
  } catch {
    console.error("[aiContentGenerator] Failed to parse LLM response");
    return {
      content: "",
      format: request.format,
      platform: request.platform,
      language: request.language,
    };
  }
}

/**
 * Generate content for multiple platforms at once.
 */
export async function generateMultiPlatform(
  request: Omit<ContentRequest, "platform">,
  platforms: string[],
): Promise<ContentOutput[]> {
  const results = await Promise.allSettled(
    platforms.map((platform) =>
      generateContent({ ...request, platform }),
    ),
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<ContentOutput>).value);
}
