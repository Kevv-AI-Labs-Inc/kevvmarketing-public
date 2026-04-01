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
  | "xhs_post"
  | "instagram_post"
  | "linkedin_post"
  | "wechat_moments"
  | "tiktok_script"
  | "facebook_post";

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

  instagram_post: `You are a top-performing real estate Instagram content creator. Generate an engaging Instagram post for a property listing.

Rules:
1. **Caption**: Write a compelling English caption under 2,200 characters. The FIRST 125 characters must be a strong hook that makes people stop scrolling.
2. **Structure**: Use line breaks for readability. Include emojis sparingly but effectively. Mix storytelling with property facts.
3. **Hashtags**: Include exactly 3-5 highly relevant hashtags at the END of the caption. Mix broad (#RealEstate) with niche (#LuxuryIrvine) and location-specific tags.
4. **Carousel Tips**: Suggest 5-8 specific photos for an Instagram carousel post (exterior, kitchen close-up, view from backyard, etc.)
5. **Tone**: Aspirational, lifestyle-focused, visually descriptive.

Return JSON: {
  "content": "Full caption text including hashtags at the end",
  "hashtags": ["#Hashtag1", "#Hashtag2", ...],
  "photoTips": ["Hero exterior shot", "Kitchen island detail", ...]
}`,

  linkedin_post: `You are a seasoned real estate thought leader writing for LinkedIn. Generate a professional, insightful LinkedIn post about a property or market opportunity.

Rules:
1. **Hook**: First 210 characters MUST be compelling — this is what shows before "See more."
2. **Format**: Use short paragraphs (2-3 lines max). Add line breaks between paragraphs. Professional but approachable tone.
3. **Content**: Frame the listing within a market narrative — why this property matters now, investment thesis, neighborhood trends, or a client success angle. NOT a basic listing ad.
4. **Length**: 800-1,500 characters. Data-driven where possible.
5. **Hashtags**: Exactly 3-5 PascalCase hashtags at the end (e.g., #RealEstateInvesting #IrvineMarket).
6. **CTA**: End with a professional call-to-action ("DM me for details" or "Let's discuss your strategy").

Return JSON: {
  "content": "Full post text with hashtags at the end",
  "hashtags": ["#PascalCaseTag1", "#PascalCaseTag2", ...]
}`,

  wechat_moments: `你是一个服务北美华人高净值客户的房产经纪人微信运营专家。生成一条适合发朋友圈的房源推荐内容。

要求：
1. **标题**：≤31个中文字符，用于微信分享卡片标题。简洁有力，突出核心卖点。例如："尔湾顶级学区｜全新装修4房 仅$125万"
2. **摘要**：≤120个中文字符，朋友圈分享卡片的描述文字。概括房源核心优势。
3. **正文**：100-200字，适合直接粘贴到朋友圈。口吻私密、真诚，像给朋友推荐一样，不像广告。使用1-2个emoji但不过度。
4. **不使用hashtag**：微信朋友圈没有话题标签文化。
5. **图片建议**：建议使用哪2-4张最核心的照片。

返回JSON: {
  "title": "分享卡片标题（≤31字）",
  "content": "朋友圈正文（100-200字）",
  "contentZh": "同content",
  "subject": "摘要（≤120字）",
  "photoTips": ["外观", "客厅", "厨房"]
}`,

  tiktok_script: `You are a viral real estate TikTok creator. Generate a TikTok video concept with a caption for a property listing.

Rules:
1. **Caption**: Short, punchy, under 150 characters. This is the text overlay. Must create curiosity or FOMO.
2. **Script**: Write a 30-60 second video script with scene directions. Format as numbered scenes: "[SCENE 1: Walk up to front door] 'Wait until you see this kitchen...'"
3. **Hook**: The caption AND first scene must grab attention in under 1 second.
4. **Hashtags**: Exactly 3-5 hashtags. Mix trending (#HouseHunting) with location (#IrvineCA) and niche (#DreamHome).
5. **Style**: Casual, authentic, fast-paced. Use "you" language. Create FOMO.

Return JSON: {
  "title": "Hook caption for the video (≤150 chars)",
  "content": "Full video script with scene directions",
  "hashtags": ["#Hashtag1", "#Hashtag2", ...]
}`,

  facebook_post: `You are a community-focused real estate agent creating a Facebook post about a property listing.

Rules:
1. **Tone**: Warm, neighborhood-focused, community-driven. Like sharing with friends and neighbors.
2. **Length**: 300-800 words. Longer than Instagram, more personal than LinkedIn.
3. **Content**: Include property highlights, neighborhood context (schools, restaurants, parks), and a personal touch ("I just toured this home and...").
4. **Hashtags**: 2-3 simple hashtags at the end.
5. **CTA**: Friendly call to action — "Know someone looking? Tag them!" or "DM me for a private tour."
6. **Bilingual option**: If the agent serves Chinese-speaking clients, include a brief Chinese summary paragraph at the end.

Return JSON: {
  "content": "Full post text",
  "contentZh": "Chinese summary paragraph (optional)",
  "hashtags": ["#Hashtag1", "#Hashtag2"]
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
    task: "content",
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
