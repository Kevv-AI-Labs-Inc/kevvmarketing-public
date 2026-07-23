import { ENV } from "@/server/_core/env";
import { searchListings } from "@/server/clients/listingDataClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatSettings = {
  enabled?: boolean;
  widgetLabel?: string;
  greeting?: string;
  systemPrompt?: string;
  style?: "professional" | "friendly" | "bilingual";
  suggestedPrompts?: string[];
};

type ChatProfile = {
  slug: string;
  name: string;
  title: string | null;
  brokerage: string | null;
  bio: string | null;
  bookingUrl: string | null;
  serviceAreas: string[] | null;
  specialties: string[] | null;
  languages: string[] | null;
  yearsExperience: number | null;
  transactions:
    | Array<{ address: string; city: string; price: string; type: string }>
    | null;
  chatSettings?: ChatSettings | null;
};

type ListingSuggestion = {
  listingKey: string;
  address: string;
  city: string;
  price: string;
  status: string;
};

export type AgentSiteChatReply = {
  language: "en" | "zh";
  response: string;
  score: "hot" | "warm" | "cold";
  intent: string;
  area: string | null;
  timeline: string | null;
  summary: string;
  suggestedPrompts: string[];
  listings: ListingSuggestion[];
};

// ─── Language & intent helpers ────────────────────────────────────────────────

const zhChars = /[\u4e00-\u9fff]/;

const defaultSuggestedPrompts = {
  en: [
    "How competitive is your local market right now?",
    "Can you help me plan a seller strategy?",
    "Show me listings that fit my needs",
  ],
  zh: [
    "你所在区域最近的市场节奏怎么样？",
    "如果我要卖房，你会怎么帮我定策略？",
    "可以帮我找符合条件的房源吗？",
  ],
};

function detectLanguage(text: string): "en" | "zh" {
  return zhChars.test(text) ? "zh" : "en";
}

function inferIntent(text: string) {
  const normalized = text.toLowerCase();
  if (/(sell|selling|list|listing|pricing|seller|卖房|定价|挂牌)/.test(normalized)) {
    return "selling";
  }
  if (/(buy|buying|showing|tour|condo|house|school|first[- ]?time|买房|看房|学区)/.test(normalized)) {
    return "buying";
  }
  if (/(invest|investor|1031|cash flow|投资)/.test(normalized)) {
    return "investment";
  }
  if (/(move|moving|relocat|搬家|迁居)/.test(normalized)) {
    return "relocation";
  }
  return "general";
}

function inferScore(text: string) {
  const normalized = text.toLowerCase();
  if (/(this month|next month|asap|urgent|ready|schedule|book|pre[- ]?listing|尽快|马上|本月|定价)/.test(normalized)) {
    return "hot" as const;
  }
  if (/(showing|tour|market|price|school|offer|贷款|市场|价格|学区)/.test(normalized)) {
    return "warm" as const;
  }
  return "cold" as const;
}

function inferTimeline(text: string) {
  const normalized = text.toLowerCase();
  if (/(this week|next week|7 days|本周|下周)/.test(normalized)) return "within 7 days";
  if (/(this month|next month|30 days|本月|下个月)/.test(normalized)) return "within 30 days";
  if (/(90 days|this quarter|quarter|90天|季度)/.test(normalized)) return "30-90 days";
  if (/(year|2027|明年|一年)/.test(normalized)) return "6-12 months";
  return null;
}

function inferArea(text: string, serviceAreas: string[]) {
  const lower = text.toLowerCase();
  return (
    serviceAreas.find((area) => lower.includes(area.toLowerCase())) ?? null
  );
}

function wantsListingSearch(text: string) {
  return /(listing|listings|home|homes|condo|property|properties|bedroom|school|zipcode|zip code|房源|公寓|独栋|学区|邮编)/.test(
    text.toLowerCase()
  );
}

async function findListingSuggestions(message: string, area: string | null) {
  if (!ENV.listingDataServiceUrl) return [];

  try {
    const result = await searchListings({
      search: message.slice(0, 120),
      city: area ?? undefined,
      perPage: 3,
      page: 1,
    });

    return result.data.slice(0, 3).map((item) => ({
      listingKey: item.listingKey,
      address: item.unparsedAddress,
      city: item.city,
      price: item.listPrice,
      status: item.standardStatus,
    }));
  } catch {
    return [];
  }
}

// ─── Style-aware tone modifiers ───────────────────────────────────────────────

function stylePrefix(style: ChatSettings["style"], lang: "en" | "zh"): string {
  if (style === "friendly") {
    return lang === "zh" ? "嗨！" : "Hey! ";
  }
  return "";
}

// ─── Reply builders ───────────────────────────────────────────────────────────

function buildEnglishReply(
  profile: ChatProfile,
  intent: string,
  area: string | null,
  listings: ListingSuggestion[],
  settings: ChatSettings
) {
  const style = settings.style ?? "professional";
  const prefix = stylePrefix(style, "en");
  const serviceAreas = profile.serviceAreas?.length
    ? profile.serviceAreas.join(", ")
    : "the markets this agent covers";
  const specialties =
    profile.specialties?.slice(0, 3).join(", ") ||
    "seller strategy, buyer guidance, and launch planning";
  const years = profile.yearsExperience
    ? `${profile.yearsExperience}+ years`
    : "deep local experience";

  // Agent-supplied system prompt injected as opening context
  const agentContext = settings.systemPrompt?.trim()
    ? `${settings.systemPrompt.trim()}\n\n`
    : "";

  const opening = `${agentContext}${prefix}I'm the AI assistant for ${profile.name}${
    profile.brokerage ? ` at ${profile.brokerage}` : ""
  }. ${profile.name.split(" ")[0]} focuses on ${specialties} across ${serviceAreas}.`;

  if (intent === "selling") {
    return [
      opening,
      `If you're thinking about selling, the fastest next step is a direct pricing and positioning consultation with ${profile.name.split(" ")[0]} covering timing, preparation, and launch strategy.`,
      listings.length > 0
        ? `I also pulled a few nearby listings that can help frame the competition:\n${listings.map((item) => `• ${item.address}, ${item.city} — ${item.price} (${item.status})`).join("\n")}`
        : `If you share your address or target neighborhood, I can narrow the seller strategy further.`,
    ].join("\n\n");
  }

  if (intent === "buying") {
    return [
      opening,
      `${profile.name.split(" ")[0]} brings ${years} and a hands-on approach for tours, offer pacing, and neighborhood fit.`,
      listings.length > 0
        ? `I found a few listings that look directionally relevant:\n${listings.map((item) => `• ${item.address}, ${item.city} — ${item.price} (${item.status})`).join("\n")}`
        : `Tell me your budget, neighborhoods, and property type, and I can frame a sharper search brief.`,
    ].join("\n\n");
  }

  return [
    opening,
    profile.bio ||
      `${profile.name.split(" ")[0]} helps clients move from interest to action with clear market framing and high-touch execution.`,
    area
      ? `You mentioned ${area}. That's one of the areas ${profile.name.split(" ")[0]} can speak to directly.`
      : `If you tell me whether you're buying, selling, or relocating, I can make this more specific.`,
    profile.bookingUrl
      ? `If you want a live conversation, you can also book directly: ${profile.bookingUrl}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildChineseReply(
  profile: ChatProfile,
  intent: string,
  area: string | null,
  listings: ListingSuggestion[],
  settings: ChatSettings
) {
  const style = settings.style ?? "professional";
  const prefix = stylePrefix(style, "zh");
  const serviceAreas = profile.serviceAreas?.length
    ? profile.serviceAreas.join("、")
    : "本地重点市场";
  const specialties =
    profile.specialties?.slice(0, 3).join("、") ||
    "卖房策略、买房筛选和上市包装";
  const firstName = profile.name.split(" ")[0];

  // Agent-supplied system prompt injected as opening context
  const agentContext = settings.systemPrompt?.trim()
    ? `${settings.systemPrompt.trim()}\n\n`
    : "";

  const opening = `${agentContext}${prefix}我是 ${profile.name}${
    profile.brokerage ? `（${profile.brokerage}）` : ""
  } 的 AI 助手。${firstName} 主要服务 ${serviceAreas}，擅长 ${specialties}。`;

  if (intent === "selling") {
    return [
      opening,
      `如果你是在考虑卖房，最有效的下一步是直接预约 ${firstName}，一起梳理定价、整备和上市节奏。`,
      listings.length > 0
        ? `我也顺手拉了几套可参考的周边在售房源：\n${listings.map((item) => `• ${item.address}，${item.city} — ${item.price}（${item.status}）`).join("\n")}`
        : `如果你给我地址、社区或者邮编，我可以把卖房建议收得更具体。`,
    ].join("\n\n");
  }

  if (intent === "buying") {
    return [
      opening,
      `${firstName} 可以帮你做选区、看房顺序和出价节奏判断。`,
      listings.length > 0
        ? `我找到几套方向上比较接近的房源：\n${listings.map((item) => `• ${item.address}，${item.city} — ${item.price}（${item.status}）`).join("\n")}`
        : `你告诉我预算、区域和房型偏好，我可以先帮你整理出一个更清晰的筛选方向。`,
    ].join("\n\n");
  }

  return [
    opening,
    profile.bio || `${firstName} 会把市场信息、客户目标和执行动作串成一条清晰路径。`,
    area
      ? `你提到了 ${area}，这正好是 ${firstName} 重点服务的区域之一。`
      : `如果你告诉我是买房、卖房还是换房，我可以直接切到对应的回答。`,
    profile.bookingUrl
      ? `如果你想直接约时间，也可以用这个链接：${profile.bookingUrl}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateAgentSiteChatReply(params: {
  profile: ChatProfile;
  message: string;
}) {
  const settings: ChatSettings = params.profile.chatSettings ?? {};
  const language = detectLanguage(params.message);
  const intent = inferIntent(params.message);
  const score = inferScore(params.message);
  const timeline = inferTimeline(params.message);
  const area = inferArea(params.message, params.profile.serviceAreas ?? []);
  const listings = wantsListingSearch(params.message)
    ? await findListingSuggestions(params.message, area)
    : [];

  const response =
    language === "zh"
      ? buildChineseReply(params.profile, intent, area, listings, settings)
      : buildEnglishReply(params.profile, intent, area, listings, settings);

  // Resolve suggested prompts: agent custom → lang default
  const resolvedPrompts =
    settings.suggestedPrompts?.filter(Boolean).slice(0, 3) ??
    defaultSuggestedPrompts[language];

  return {
    language,
    response,
    score,
    intent,
    area,
    timeline,
    summary: `${intent} lead asking about ${area ?? "general market context"}${timeline ? ` with timeline ${timeline}` : ""}.`,
    suggestedPrompts: resolvedPrompts,
    listings,
  } satisfies AgentSiteChatReply;
}
