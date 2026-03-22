import type { Locale } from "@/i18n";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookImage,
  Building2,
  Clapperboard,
  Copy,
  Eye,
  FileText,
  Flame,
  LayoutDashboard,
  Navigation,
  Search,
  Share2,
  Sparkles,
  Star,
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
    label: { zh: "搜索与触达", en: "Search & Reach" },
    description: {
      zh: "围绕房源发现、分享分发与订阅跟进。",
      en: "Discovery, outbound sharing, and subscription follow-up.",
    },
  },
  {
    id: "content-production",
    label: { zh: "内容生产", en: "Content Production" },
    description: {
      zh: "围绕海报、视频和平台化内容生成。",
      en: "Flyers, video workflows, and platform-native content generation.",
    },
  },
  {
    id: "growth-community",
    label: { zh: "增长与社区", en: "Growth & Community" },
    description: {
      zh: "围绕专家 IP、访客洞察和经纪人网络。",
      en: "Expert branding, visitor insight, and agent network operations.",
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
    id: "listing-subscription",
    order: 3,
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
    order: 4,
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
    order: 5,
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
    order: 6,
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
    id: "expert-ip",
    order: 7,
    label: { zh: "房大咖", en: "Expert IP" },
    category: "growth-community",
    icon: Star,
    description: {
      zh: "打造经纪人专家 IP、栏目或主题输出。",
      en: "Build an agent expert brand with recurring themes and authority content.",
    },
    currentModule: { zh: "暂无对应模块", en: "No mapped module yet" },
    compareNote: {
      zh: "当前代码库没有与“房大咖”对应的独立模块，需要单独设计。",
      en: "There is no dedicated expert-IP module in the current codebase yet.",
    },
    status: "planned",
    alignment: "gap",
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
    id: "agent-community",
    order: 9,
    label: { zh: "经纪人社区", en: "Agent Community" },
    category: "growth-community",
    icon: Users,
    description: {
      zh: "围绕经纪人网络、协作和资源连接形成社区能力。",
      en: "Enable a community layer around agent collaboration and network visibility.",
    },
    currentModule: { zh: "Agent Directory", en: "Agent Directory" },
    compareNote: {
      zh: "目前更像目录/后台，不是完整社区，但可以作为第一阶段承载。",
      en: "Today it behaves more like a directory/admin panel than a community, but it can serve as phase one.",
    },
    route: "/agent-directory",
    routeLabel: { zh: "打开经纪人目录", en: "Open Agent Directory" },
    status: "partial",
    alignment: "adapted",
  },
  {
    id: "xhs-notes",
    order: 10,
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
    label: { zh: "概览", en: "Overview" },
    items: [
      {
        id: "dashboard",
        icon: LayoutDashboard,
        label: { zh: "工作台", en: "Dashboard" },
        path: "/dashboard",
      },
    ],
  },
  {
    id: "search-reach",
    label: { zh: "搜索与触达", en: "Search & Reach" },
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
        id: "subscriptions",
        icon: Bell,
        label: { zh: "房源订阅", en: "Subscriptions" },
        path: "/subscriptions",
      },
      {
        id: "magic-share",
        icon: Share2,
        label: { zh: "批量分享", en: "Magic Share" },
        path: "/magic-share",
      },
    ],
  },
  {
    id: "conversion",
    label: { zh: "匹配与成交", en: "Match & Conversion" },
    items: [
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
];

export const ownerDashboardSection: MarketingMenuSection = {
  id: "network",
  label: { zh: "社区与管理", en: "Community & Admin" },
  items: [
    {
      id: "agent-directory",
      icon: Users,
      label: { zh: "经纪人目录", en: "Agent Directory" },
      path: "/agent-directory",
    },
  ],
};

export function getLocalizedText(locale: Locale, text: LocalizedText): string {
  return text[locale];
}

export function getCapabilityStatusLabel(
  locale: Locale,
  status: MarketingCapabilityStatus,
): string {
  switch (status) {
    case "ready":
      return locale === "zh" ? "已到位" : "Ready";
    case "partial":
      return locale === "zh" ? "部分到位" : "Partial";
    case "planned":
      return locale === "zh" ? "待补齐" : "Planned";
  }
}

export function getCapabilityAlignmentLabel(
  locale: Locale,
  alignment: MarketingCapabilityAlignment,
): string {
  switch (alignment) {
    case "matched":
      return locale === "zh" ? "需求匹配" : "Requirement Matched";
    case "adapted":
      return locale === "zh" ? "适配承接" : "Adapted Module";
    case "gap":
      return locale === "zh" ? "能力缺口" : "Gap";
  }
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
