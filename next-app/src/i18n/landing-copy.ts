import { text } from "./copy";
import { pickText } from "./copy";
import type { Locale } from "./config";
import { brandConfig } from "@/lib/brand";

export const landingPageCopy = {
  pillars: [
    {
      id: "ai-engine",
      badge: text("AI Engine", "AI Engine"),
      title: text("让内容自己生成", "Content that writes itself"),
      body: text(
        "一套房源，产出几十份可直接发布的素材。AI 会按平台生成房源描述、社媒内容、邮件文案和广告创意，并同时支持中英文。",
        "One listing -> dozens of ready-to-publish assets. Our AI generates property descriptions, social posts, email copy, and ad creatives tailored to each platform - in English and Chinese.",
      ),
      gradient: "from-amber-500 to-orange-600",
    },
    {
      id: "cross-border",
      badge: text("Cross-Border", "Cross-Border"),
      title: text("跨洋触达买家", "Reach buyers across the Pacific"),
      body: text(
        "内置微信能力、文化适配表达和双语内容生产，让你可以在不切换工具的前提下，把北美房源卖给华语买家。",
        "Built-in WeChat integration, culturally-adapted messaging, and bilingual content let you market North American properties to Chinese buyers - without switching tools.",
      ),
      gradient: "from-blue-500 to-cyan-600",
    },
    {
      id: "intelligence",
      badge: text("Intelligence", "Intelligence"),
      title: text("智能匹配，不靠人工翻找", "Smart matching, not manual searching"),
      body: text(
        "AI 买家匹配、自动带看路线和市场洞察，会自动把最合适的机会浮出来给每一个客户。",
        "AI-powered buyer-listing matching, automated showing tours, and market insights surface the right opportunities for each client automatically.",
      ),
      gradient: "from-emerald-500 to-teal-600",
    },
  ],
  tools: [
    { id: "content-factory", name: text("Content Factory", "Content Factory"), desc: text("AI 房源文案、社媒内容和邮件营销", "AI listing copy, social posts & email campaigns") },
    { id: "flyer-studio", name: text("Flyer Studio", "Flyer Studio"), desc: text("拖拽式印刷与数字海报制作", "Drag-and-drop print & digital flyer builder") },
    { id: "cma-studio", name: text("CMA Studio", "CMA Studio"), desc: text("市场比较分析与估价报告", "Comparative Market Analysis reports") },
    { id: "smart-match", name: text("Smart Match", "Smart Match"), desc: text("AI 买家与房源匹配引擎", "AI buyer ↔ listing matching engine") },
    { id: "magic-share", name: text("Magic Share", "Magic Share"), desc: text("一键生成美观的房源分享页", "One-click beautiful listing share pages") },
    { id: "showing-tour", name: text("Showing Tour", "Showing Tour"), desc: text("自动优化带看路线", "Route-optimized showing itineraries") },
    { id: "ads", name: text("广告投放", "Ad Campaigns"), desc: text("多平台付费广告管理", "Multi-platform paid ad management") },
    { id: "drip", name: text("Drip 自动化", "Drip Campaigns"), desc: text("自动邮件培育序列", "Automated email nurture sequences") },
    { id: "neighborhood", name: text("社区洞察", "Neighborhood Intel"), desc: text("本地市场数据与学校信息", "Local market data & school info") },
    { id: "listing-management", name: text("房源管理", "Listing Management"), desc: text("统一的 MLS 房源工作台", "Centralized MLS listing dashboard") },
    { id: "wechat", name: text("微信营销", "WeChat Marketing"), desc: text("原生微信内容与小程序能力", "Native WeChat content & mini-programs") },
    { id: "cultural", name: text("文化适配", "Cultural Intelligence"), desc: text("文化语境友好的营销指南", "Culturally-adapted marketing guides") },
    { id: "cross-border-tools", name: text("跨境工具", "Cross-Border Tools"), desc: text("服务国际买家的双语营销工具", "Bilingual campaigns for international buyers") },
  ],
  stats: [
    { value: "10×", label: text("内容生产更快", "faster content creation") },
    { value: "13+", label: text("集成营销工具", "integrated marketing tools") },
    { value: "2", label: text("种语言，一套平台", "languages, one platform") },
  ],
  crossBorderChecklist: [
    text("原生微信文章与小程序分享", "Native WeChat article & mini-program sharing"),
    text("面向中文买家的文化适配房源描述", "Culturally-adapted property descriptions in Chinese"),
    text("双语海报、社媒内容和邮件营销", "Bilingual flyers, social posts & email campaigns"),
    text("跨境买家匹配与带看路线", "Cross-border buyer matching & showing tours"),
  ],
  crossBorderCards: [
    {
      id: "wechat",
      title: text("微信营销", "WeChat Marketing"),
      desc: text("直接把房源发布到微信生态", "Publish listings directly into WeChat ecosystem"),
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      id: "cultural",
      title: text("文化适配", "Cultural Intelligence"),
      desc: text("风水说明、幸运数字和文化语境友好的文案", "Feng shui notes, lucky numbers & culturally-aware copy"),
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      id: "campaigns",
      title: text("跨境营销活动", "Cross-Border Campaigns"),
      desc: text("面向国际买家的地理定向广告", "Target international buyers with geo-aware ads"),
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      id: "bilingual-ai",
      title: text("双语 AI 内容", "Bilingual AI Content"),
      desc: text("一键生成中英文内容", "English ↔ Chinese content generated in one click"),
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
  ],
  header: {
    signIn: text("登录", "Sign in"),
    getStartedShort: text("免费开始", "Get started free"),
  },
  hero: {
    badge: text("为房地产打造的 AI 营销平台", "The AI marketing platform built for real estate"),
    line1: text("一套房源。", "One listing."),
    line2: text("全渠道触达。", "Every channel."),
    line3: text("每一种语言。", "Every language."),
    body: text(
      `${brandConfig.appName} 可以把你的 MLS 房源转成 AI 海报、社媒营销、微信内容和 CMA 报告，并同时支持中文与英文。专为服务跨境买家的北美地产经纪人打造。`,
      `${brandConfig.appName} turns your MLS listings into AI-powered flyers, social campaigns, WeChat content, and CMA reports - in English and Chinese. Built for North American agents who sell across borders.`,
    ),
    primaryCta: text("免费开始", "Start for free"),
    secondaryCta: text("了解 Kevv AI", "About Kevv AI"),
  },
  whyKevv: {
    eyebrow: text("为什么是 Kevv", "Why Kevv"),
    title: text("AI、自动化与跨境营销，一套平台全部打通", "AI, automation, and cross-border - in one platform"),
  },
  toolkit: {
    eyebrow: text("全套工具", "Full toolkit"),
    title: text("13 个工具，不再来回切换。", "13 tools. Zero context-switching."),
    body: text(
      "从第一张房源照片到最后签约，顶尖经纪人需要的一切都在一个标签页里完成。",
      "Everything a top-producing agent needs - from first listing photo to signed contract - in a single tab.",
    ),
  },
  crossBorder: {
    badge: text("跨境营销", "Cross-Border"),
    titlePrefix: text("真正为", "The only platform built for"),
    titleAccent: text("中美地产场景", "Chinese-North American"),
    titleSuffix: text("设计的平台", "real estate"),
    body: text(
      `${brandConfig.shortName} 不是后补的翻译层。我们从第一天起就把微信原生内容、文化适配表达和双语营销工具做进系统，因为你的市场本来就需要这些能力。`,
      `${brandConfig.shortName} isn't bolted-on translation. We built WeChat-native content publishing, culturally-adapted messaging, and bilingual campaign tools from day one - because your market demands it.`,
    ),
  },
  closing: {
    title: text("别再切来切去，直接把交易推到成交。", "Stop juggling tools. Start closing deals."),
    body: text(
      "用一套工作台，跨所有渠道，用中英文更聪明地做营销。",
      "Join agents who market smarter with AI - in English and Chinese, across every channel, from a single dashboard.",
    ),
    primaryCta: text("免费开始", "Get started free"),
    secondaryCta: text("联系团队", "Talk to us"),
  },
  footer: {
    rights: text("本产品代码已开源。", "Source code available under the MIT License."),
    privacy: text("隐私", "Privacy"),
    terms: text("条款", "Terms"),
  },
} as const;

export function getLandingPageCopy(locale: Locale) {
  return {
    pillars: landingPageCopy.pillars.map((item) => ({
      ...item,
      badge: pickText(locale, item.badge),
      title: pickText(locale, item.title),
      body: pickText(locale, item.body),
    })),
    tools: landingPageCopy.tools.map((item) => ({
      ...item,
      name: pickText(locale, item.name),
      desc: pickText(locale, item.desc),
    })),
    stats: landingPageCopy.stats.map((item) => ({
      ...item,
      label: pickText(locale, item.label),
    })),
    crossBorderChecklist: landingPageCopy.crossBorderChecklist.map((item) => pickText(locale, item)),
    crossBorderCards: landingPageCopy.crossBorderCards.map((item) => ({
      ...item,
      title: pickText(locale, item.title),
      desc: pickText(locale, item.desc),
    })),
    header: {
      signIn: pickText(locale, landingPageCopy.header.signIn),
      getStartedShort: pickText(locale, landingPageCopy.header.getStartedShort),
    },
    hero: {
      badge: pickText(locale, landingPageCopy.hero.badge),
      line1: pickText(locale, landingPageCopy.hero.line1),
      line2: pickText(locale, landingPageCopy.hero.line2),
      line3: pickText(locale, landingPageCopy.hero.line3),
      body: pickText(locale, landingPageCopy.hero.body),
      primaryCta: pickText(locale, landingPageCopy.hero.primaryCta),
      secondaryCta: pickText(locale, landingPageCopy.hero.secondaryCta),
    },
    whyKevv: {
      eyebrow: pickText(locale, landingPageCopy.whyKevv.eyebrow),
      title: pickText(locale, landingPageCopy.whyKevv.title),
    },
    toolkit: {
      eyebrow: pickText(locale, landingPageCopy.toolkit.eyebrow),
      title: pickText(locale, landingPageCopy.toolkit.title),
      body: pickText(locale, landingPageCopy.toolkit.body),
    },
    crossBorder: {
      badge: pickText(locale, landingPageCopy.crossBorder.badge),
      titlePrefix: pickText(locale, landingPageCopy.crossBorder.titlePrefix),
      titleAccent: pickText(locale, landingPageCopy.crossBorder.titleAccent),
      titleSuffix: pickText(locale, landingPageCopy.crossBorder.titleSuffix),
      body: pickText(locale, landingPageCopy.crossBorder.body),
    },
    closing: {
      title: pickText(locale, landingPageCopy.closing.title),
      body: pickText(locale, landingPageCopy.closing.body),
      primaryCta: pickText(locale, landingPageCopy.closing.primaryCta),
      secondaryCta: pickText(locale, landingPageCopy.closing.secondaryCta),
    },
    footer: {
      rights: pickText(locale, landingPageCopy.footer.rights),
      privacy: pickText(locale, landingPageCopy.footer.privacy),
      terms: pickText(locale, landingPageCopy.footer.terms),
    },
  };
}
