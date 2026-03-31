import type { Locale } from "@/i18n";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookImage,
  Building2,
  Calendar,
  Clapperboard,
  Compass,
  Copy,
  Eye,
  FileText,
  Flame,
  Globe2,
  Home,
  LayoutDashboard,
  Mailbox,
  MessageCircle,
  Navigation,
  MapPin,
  Plane,
  Search,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";

export type LocalizedText = {
  zh: string;
  en: string;
};

export type MarketingCapabilityStatus = "ready" | "partial" | "planned";
export type MarketingCapabilityAlignment = "matched" | "adapted" | "gap";
export type MarketingCapabilityCategoryId =
  | "search-distribution"
  | "content-production"
  | "growth-community";

export type MarketingCapability = {
  id: string;
  order: number;
  label: LocalizedText;
  category: MarketingCapabilityCategoryId;
  icon: LucideIcon;
  description: LocalizedText;
  currentModule: LocalizedText;
  compareNote: LocalizedText;
  route?: string;
  routeLabel?: LocalizedText;
  status: MarketingCapabilityStatus;
  alignment: MarketingCapabilityAlignment;
};

export type MarketingMenuItem = {
  id: string;
  icon: LucideIcon;
  label: LocalizedText;
  path: string;
};

export type MarketingMenuSection = {
  id: string;
  label: LocalizedText;
  items: MarketingMenuItem[];
};

export type MarketingExtensionModule = {
  id: string;
  icon: LucideIcon;
  label: LocalizedText;
  description: LocalizedText;
  path: string;
};

export const marketingCapabilityCategories: Array<{
  id: MarketingCapabilityCategoryId;
  label: LocalizedText;
  description: LocalizedText;
}> = [
  {
    id: "search-distribution",
    label: { zh: "房源与触达", en: "Inventory & Reach" },
    description: {
      zh: "围绕房源发现、订阅提醒与客户触达的日常动作。",
      en: "Daily listing discovery, saved alerts, and outbound client reach.",
    },
  },
  {
    id: "content-production",
    label: { zh: "展示与内容", en: "Presentation & Content" },
    description: {
      zh: "围绕客户展示、品牌内容和多渠道素材生成。",
      en: "Client-ready presentations, branded assets, and cross-channel content creation.",
    },
  },
  {
    id: "growth-community",
    label: { zh: "团队与洞察", en: "Team & Insight" },
    description: {
      zh: "围绕访客信号、团队目录和后台洞察。",
      en: "Visitor signals, team directory, and operating insight for the brokerage.",
    },
  },
];

export const marketingCapabilities: MarketingCapability[] = [
  {
    id: "listing-search",
    order: 1,
    label: { zh: "房源搜索", en: "Listing Search" },
    category: "search-distribution",
    icon: Search,
    description: {
      zh: "按地址、MLS 和列表视图搜索房源，后续应补齐地图融合。",
      en: "Search by address, MLS, and list views, with map fusion still pending.",
    },
    currentModule: { zh: "Listings / New Listings", en: "Listings / New Listings" },
    compareNote: {
      zh: "列表检索已接入，但 OneKey 地图视窗查询与地图联动还没落地。",
      en: "List-based search exists, but OneKey bounds queries and map syncing are still missing.",
    },
    route: "/listings",
    routeLabel: { zh: "打开 Listings", en: "Open Listings" },
    status: "partial",
    alignment: "adapted",
  },
  {
    id: "bulk-share",
    order: 2,
    label: { zh: "批量分享", en: "Bulk Share" },
    category: "search-distribution",
    icon: Share2,
    description: {
      zh: "批量选房、生成分享链接并做分享前包装。",
      en: "Batch-select listings, generate share links, and package them for outbound sharing.",
    },
    currentModule: { zh: "Magic Share Studio", en: "Magic Share Studio" },
    compareNote: {
      zh: "和需求基本一致，是当前最完整的分发能力。",
      en: "Directly matches the requirement and is one of the most complete sharing flows today.",
    },
    route: "/magic-share",
    routeLabel: { zh: "打开 Magic Share", en: "Open Magic Share" },
    status: "ready",
    alignment: "matched",
  },
  {
    id: "area-magnet",
    order: 3,
    label: { zh: "地区诱饵", en: "Area Magnet" },
    category: "search-distribution",
    icon: MapPin,
    description: {
      zh: "按邮编、社区或楼盘生成可留资的区域报告分享页。",
      en: "Generate lead-capture share pages by ZIP, neighborhood, or building.",
    },
    currentModule: { zh: "Area Magnet", en: "Area Magnet" },
    compareNote: {
      zh: "和 Magic Share 平行，但底层复用同一套 share session、公开页和互动追踪。",
      en: "Runs parallel to Magic Share while reusing the same share session, public route, and engagement tracking stack.",
    },
    route: "/area-magnet",
    routeLabel: { zh: "打开 Area Magnet", en: "Open Area Magnet" },
    status: "ready",
    alignment: "matched",
  },
  {
    id: "listing-subscription",
    order: 4,
    label: { zh: "房源订阅", en: "Listing Subscription" },
    category: "search-distribution",
    icon: Bell,
    description: {
      zh: "为客户保存检索条件并持续推送房源更新。",
      en: "Save client criteria and continuously push relevant listing updates.",
    },
    currentModule: { zh: "Subscriptions", en: "Subscriptions" },
    compareNote: {
      zh: "已具备创建、暂停、恢复和通知历史能力。",
      en: "Create, pause, resume, and notification-history flows are already in place.",
    },
    route: "/subscriptions",
    routeLabel: { zh: "打开订阅中心", en: "Open Subscriptions" },
    status: "ready",
    alignment: "matched",
  },
  {
    id: "summary-copy",
    order: 5,
    label: { zh: "复制摘要", en: "Summary Copy" },
    category: "search-distribution",
    icon: Copy,
    description: {
      zh: "从推荐结果中复制 AI 推荐摘要和跟进话术。",
      en: "Copy AI summaries and follow-up pitch copy from recommendation results.",
    },
    currentModule: { zh: "Smart Match / AIRecommend", en: "Smart Match / AIRecommend" },
    compareNote: {
      zh: "复制摘要能力存在，但绑定在 Smart Match 页面里，仍需抽成独立工作流。",
      en: "The summary-copy action exists inside Smart Match, but it still needs a clearer standalone workflow.",
    },
    route: "/summary-copy",
    routeLabel: { zh: "打开复制摘要", en: "Open Summary Copy" },
    status: "partial",
    alignment: "adapted",
  },
  {
    id: "flyer-studio",
    order: 6,
    label: { zh: "制作海报", en: "Flyer Creation" },
    category: "content-production",
    icon: FileText,
    description: {
      zh: "根据房源信息快速生成中英双语营销海报。",
      en: "Generate bilingual property marketing flyers from listing data.",
    },
    currentModule: { zh: "Flyer Studio", en: "Flyer Studio" },
    compareNote: {
      zh: "模板、字段编辑和预览已经到位。",
      en: "Templates, editable fields, and previews are already usable.",
    },
    route: "/flyer-studio",
    routeLabel: { zh: "打开海报工坊", en: "Open Flyer Studio" },
    status: "ready",
    alignment: "matched",
  },
  {
    id: "video-studio",
    order: 7,
    label: { zh: "制作视频", en: "Video Creation" },
    category: "content-production",
    icon: Clapperboard,
    description: {
      zh: "基于房源图文和提示词生成营销视频。",
      en: "Generate marketing videos from listing media and prompts.",
    },
    currentModule: { zh: "Studios", en: "Studios" },
    compareNote: {
      zh: "视频工坊已存在，但云端 provider 和稳定性仍依赖环境配置。",
      en: "The studio exists, but cloud providers and production reliability still depend on environment setup.",
    },
    route: "/studios",
    routeLabel: { zh: "打开视频工坊", en: "Open Video Studio" },
    status: "partial",
    alignment: "adapted",
  },
  {
    id: "visitor-insights",
    order: 8,
    label: { zh: "访客", en: "Visitors" },
    category: "growth-community",
    icon: Eye,
    description: {
      zh: "沉淀访客行为、访问轨迹和跟进线索。",
      en: "Capture visitor behavior, activity history, and follow-up signals.",
    },
    currentModule: { zh: "访客洞察骨架", en: "Visitor insight scaffold" },
    compareNote: {
      zh: "后端有 tracking / insight 雏形，但没有真正可用的访客工作台。",
      en: "There is backend tracking scaffolding, but no usable visitor-facing workbench yet.",
    },
    status: "planned",
    alignment: "gap",
  },
  {
    id: "xhs-notes",
    order: 9,
    label: { zh: "小红书笔记", en: "Xiaohongshu Notes" },
    category: "content-production",
    icon: BookImage,
    description: {
      zh: "从房源素材生成适配小红书的图文笔记。",
      en: "Generate listing-driven Xiaohongshu-style posts and note copy.",
    },
    currentModule: { zh: "XHS Share", en: "XHS Share" },
    compareNote: {
      zh: "当前模块和目标需求基本一致。",
      en: "The current module is already closely aligned with the requirement.",
    },
    route: "/xhs-share",
    routeLabel: { zh: "打开小红书工坊", en: "Open XHS Studio" },
    status: "ready",
    alignment: "matched",
  },
];

export const marketingExtensions: MarketingExtensionModule[] = [
  {
    id: "smart-match",
    icon: Sparkles,
    label: { zh: "Smart Match", en: "Smart Match" },
    description: {
      zh: "基于客户需求做 AI 推荐、选房和分享衔接。",
      en: "AI recommendation workflow for client matching, property selection, and downstream sharing.",
    },
    path: "/smart-match",
  },
  {
    id: "showing-tour",
    icon: Navigation,
    label: { zh: "带看路线", en: "Showing Tour" },
    description: {
      zh: "自动规划带看顺序和路书，承接成交前流程。",
      en: "Plan showing routes and route packs before the closing workflow.",
    },
    path: "/showing-tour",
  },
  {
    id: "cma-studio",
    icon: BarChart3,
    label: { zh: "CMA Studio", en: "CMA Studio" },
    description: {
      zh: "做估价分析和报告，但 PDF 交付链路还需补齐。",
      en: "Run CMA analysis and reports, with the PDF delivery pipeline still incomplete.",
    },
    path: "/cma-studio",
  },
  {
    id: "new-listings",
    icon: Flame,
    label: { zh: "新房源", en: "New Listings" },
    description: {
      zh: "作为新增房源入口，和标准搜索形成补充。",
      en: "Acts as a new-listings feed that complements the main search flow.",
    },
    path: "/new-listings",
  },
];

export const dashboardMenuSections: MarketingMenuSection[] = [
  {
    id: "overview",
    label: { zh: "指挥台", en: "Command Center" },
    items: [
      {
        id: "dashboard",
        icon: LayoutDashboard,
        label: { zh: "指挥台", en: "Command Center" },
        path: "/dashboard",
      },
    ],
  },
  {
    id: "funnels",
    label: { zh: "获客漏斗", en: "Funnels" },
    items: [
      {
        id: "funnels",
        icon: Globe2,
        label: { zh: "Funnels", en: "Funnels" },
        path: "/funnels",
      },
      {
        id: "agent-site",
        icon: Globe2,
        label: { zh: "个人主页", en: "Agent Site" },
        path: "/agent-site",
      },
      {
        id: "home-value",
        icon: Home,
        label: { zh: "房价估值", en: "Home Value" },
        path: "/home-value",
      },
      {
        id: "area-magnet",
        icon: MapPin,
        label: { zh: "地区诱饵", en: "Area Magnet" },
        path: "/area-magnet",
      },
    ],
  },
  {
    id: "leads",
    label: { zh: "线索运营", en: "Leads" },
    items: [
      {
        id: "leads",
        icon: Users,
        label: { zh: "线索工作台", en: "Leads" },
        path: "/leads",
      },
    ],
  },
  {
    id: "campaigns",
    label: { zh: "触达活动", en: "Campaigns" },
    items: [
      {
        id: "magic-share",
        icon: Share2,
        label: { zh: "批量分享", en: "Magic Share" },
        path: "/magic-share",
      },
      {
        id: "postcards",
        icon: Mailbox,
        label: { zh: "明信片", en: "Postcards" },
        path: "/postcards",
      },
      {
        id: "subscriptions",
        icon: Bell,
        label: { zh: "房源订阅", en: "Subscriptions" },
        path: "/subscriptions",
      },
    ],
  },
  {
    id: "content",
    label: { zh: "内容工坊", en: "Content Studio" },
    items: [
      {
        id: "flyer-studio",
        icon: FileText,
        label: { zh: "制作海报", en: "Flyer Studio" },
        path: "/flyer-studio",
      },
      {
        id: "studios",
        icon: Clapperboard,
        label: { zh: "制作视频", en: "Video Studio" },
        path: "/studios",
      },
      {
        id: "xhs-share",
        icon: BookImage,
        label: { zh: "小红书笔记", en: "XHS Notes" },
        path: "/xhs-share",
      },
    ],
  },
  {
    id: "deal-tools",
    label: { zh: "成交支持", en: "Deal Tools" },
    items: [
      {
        id: "listings",
        icon: Building2,
        label: { zh: "房源搜索", en: "Listing Search" },
        path: "/listings",
      },
      {
        id: "new-listings",
        icon: Flame,
        label: { zh: "新房源", en: "New Listings" },
        path: "/new-listings",
      },
      {
        id: "smart-match",
        icon: Sparkles,
        label: { zh: "Smart Match", en: "Smart Match" },
        path: "/smart-match",
      },
      {
        id: "showing-tour",
        icon: Navigation,
        label: { zh: "带看路线", en: "Showing Tour" },
        path: "/showing-tour",
      },
      {
        id: "cma-studio",
        icon: BarChart3,
        label: { zh: "CMA Studio", en: "CMA Studio" },
        path: "/cma-studio",
      },
    ],
  },
  {
    id: "chinese-market",
    label: { zh: "华人市场", en: "Chinese Market" },
    items: [
      {
        id: "cultural",
        icon: Compass,
        label: { zh: "风水 / 黄历", en: "Feng Shui / Calendar" },
        path: "/cultural",
      },
      {
        id: "cross-border",
        icon: Plane,
        label: { zh: "跨境买家", en: "Cross-Border" },
        path: "/cross-border",
      },
      {
        id: "wechat",
        icon: MessageCircle,
        label: { zh: "微信分享", en: "WeChat Share" },
        path: "/wechat",
      },
    ],
  },
];

export function getLocalizedText(locale: Locale, text: LocalizedText): string {
  return text[locale];
}

export function getCapabilityStatusLabel(
  locale: Locale,
  status: MarketingCapabilityStatus,
): string {
  return (
    {
      ready: { zh: "已到位", en: "Ready" },
      partial: { zh: "部分到位", en: "Partial" },
      planned: { zh: "待补齐", en: "Planned" },
    } satisfies Record<MarketingCapabilityStatus, LocalizedText>
  )[status][locale];
}

export function getCapabilityAlignmentLabel(
  locale: Locale,
  alignment: MarketingCapabilityAlignment,
): string {
  return (
    {
      matched: { zh: "需求匹配", en: "Requirement Matched" },
      adapted: { zh: "适配承接", en: "Adapted Module" },
      gap: { zh: "能力缺口", en: "Gap" },
    } satisfies Record<MarketingCapabilityAlignment, LocalizedText>
  )[alignment][locale];
}

export function getCapabilityCounts() {
  return marketingCapabilities.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      return acc;
    },
    { total: 0, ready: 0, partial: 0, planned: 0 },
  );
}

export function getCapabilitiesByCategory(category: MarketingCapabilityCategoryId) {
  return marketingCapabilities.filter((item) => item.category === category);
}
