import { text, type LocalizedText } from "./copy";
import { brandConfig } from "@/lib/brand";

export type LegalSectionCopy = {
  heading: LocalizedText;
  paragraphs: LocalizedText[];
};

export type LegalPageCopy = {
  eyebrow: LocalizedText;
  title: LocalizedText;
  summary: LocalizedText;
  updatedAt: LocalizedText;
  sections: LegalSectionCopy[];
};

export const legalPagesCopy: Record<"privacy" | "terms", LegalPageCopy> = {
  privacy: {
    eyebrow: text("法律信息", "Legal"),
    title: text("隐私政策", "Privacy Policy"),
    summary: text(
      `本页说明 ${brandConfig.appName} 如何处理登录信息、产品使用数据和支持沟通信息。`,
      `This page explains how ${brandConfig.appName} handles sign-in information, product usage data, and support communications.`,
    ),
    updatedAt: text("更新于 2026 年 3 月 22 日", "Updated March 22, 2026"),
    sections: [
      {
        heading: text("我们收集什么", "What we collect"),
        paragraphs: [
          text(
            "当你使用 Google、Microsoft 或邮箱魔法链接登录时，我们会处理账户标识、邮箱地址、姓名和头像等最基本的身份信息。",
            "When you sign in with Google, Microsoft, or an email magic link, we process the minimum identity information needed to operate the account, such as email address, name, avatar, and provider identifiers.",
          ),
          text(
            "当你使用营销功能时，我们还会处理你创建的房源分享、订阅、内容生成请求和相关操作日志，用于提供功能、排查问题和防止滥用。",
            "When you use the marketing workflows, we also process the listing shares, subscriptions, content-generation requests, and related activity logs needed to provide the product, troubleshoot issues, and prevent abuse.",
          ),
        ],
      },
      {
        heading: text("我们如何使用数据", "How we use data"),
        paragraphs: [
          text(
            "这些数据用于完成身份验证、保存你的工作区状态、生成营销内容、发送你主动请求的邮件通知，以及保障系统安全与稳定性。",
            "We use this data to authenticate users, preserve workspace state, generate marketing content, send notifications you explicitly request, and maintain platform security and reliability.",
          ),
          text(
            `除非为了完成服务所必需，${brandConfig.appName} 不会把你的内容或客户线索出售给第三方。`,
            `${brandConfig.appName} does not sell your content or client leads to third parties unless a disclosure is strictly required to deliver the service.`,
          ),
        ],
      },
      {
        heading: text("第三方服务", "Third-party services"),
        paragraphs: [
          text(
            "平台依赖第三方服务完成 OAuth 登录、邮件发送、地图和部署托管。相关供应商会在其职责范围内处理必要的数据。",
            "The platform relies on third-party services for OAuth sign-in, email delivery, map services, and hosting. Those vendors process the minimum data required to provide their part of the service.",
          ),
          text(
            "你应同时审阅相应第三方提供商的隐私条款，尤其是在使用 Google、Microsoft 或地图能力时。",
            "You should also review the privacy terms of the relevant providers, especially when using Google, Microsoft, or map-related features.",
          ),
        ],
      },
      {
        heading: text("保留与联系", "Retention and contact"),
        paragraphs: [
          text(
            `我们只在业务需要和合规要求范围内保留数据。若你需要查询、导出或删除与你账户相关的数据，请联系 ${brandConfig.supportEmail}。`,
            `We retain data only for as long as required for business operations and compliance. To request access, export, or deletion of account-related data, contact ${brandConfig.supportEmail}.`,
          ),
        ],
      },
    ],
  },
  terms: {
    eyebrow: text("法律信息", "Legal"),
    title: text("服务条款", "Terms of Service"),
    summary: text(
      `本页说明你在使用 ${brandConfig.appName} 时需要遵守的基本规则、责任边界和服务限制。`,
      `This page describes the core rules, responsibilities, and service limitations that apply when you use ${brandConfig.appName}.`,
    ),
    updatedAt: text("更新于 2026 年 3 月 22 日", "Updated March 22, 2026"),
    sections: [
      {
        heading: text("账户与访问", "Accounts and access"),
        paragraphs: [
          text(
            "你必须使用合法授权的身份提供商账户访问本服务，并对该账户下发生的操作负责。",
            "You must access the service through a valid, authorized identity provider account and remain responsible for the activity performed under that account.",
          ),
          text(
            "如果我们发现异常登录、滥用行为或明显违反政策的使用方式，可以暂停或限制相关账户访问。",
            "We may suspend or restrict access if we detect abusive behavior, suspicious sign-ins, or material policy violations.",
          ),
        ],
      },
      {
        heading: text("可接受使用", "Acceptable use"),
        paragraphs: [
          text(
            `你不得使用 ${brandConfig.appName} 发送垃圾消息、冒充他人、抓取未授权数据，或发布违反适用法律与地产行业规范的内容。`,
            `You may not use ${brandConfig.appName} to send spam, impersonate others, scrape unauthorized data, or publish content that violates applicable law or real-estate industry rules.`,
          ),
          text(
            "你应确保上传或输入到系统中的房源资料、媒体素材和客户信息具备合法使用权。",
            "You must ensure that any listing data, media assets, or client information entered into the system is lawfully obtained and permitted for your intended use.",
          ),
        ],
      },
      {
        heading: text("AI 生成内容", "AI-generated content"),
        paragraphs: [
          text(
            "平台中的文案、摘要、推荐和营销素材可能由 AI 自动生成。你有责任在对外发布前进行人工审核，确认其准确性、合规性和适用性。",
            "Copy, summaries, recommendations, and marketing assets generated by the platform may be AI-assisted. You remain responsible for reviewing all outputs before sharing them externally.",
          ),
          text(
            `${brandConfig.appName} 不构成法律、税务、估价、经纪执业或公平住房合规建议。`,
            `${brandConfig.appName} does not provide legal, tax, appraisal, brokerage-practice, or fair-housing compliance advice.`,
          ),
        ],
      },
      {
        heading: text("服务可用性与责任限制", "Availability and limitation of liability"),
        paragraphs: [
          text(
            "我们会持续改进产品，但不承诺服务永不中断，也不保证所有第三方集成始终可用。",
            "We work to improve the product continuously, but we do not guarantee uninterrupted service or constant availability of every third-party integration.",
          ),
          text(
            `在适用法律允许的最大范围内，${brandConfig.appName} 对因服务中断、第三方依赖故障或 AI 输出错误造成的间接损失不承担责任。`,
            `To the maximum extent permitted by law, ${brandConfig.appName} is not liable for indirect losses arising from service interruptions, third-party outages, or inaccurate AI outputs.`,
          ),
        ],
      },
      {
        heading: text("联系", "Contact"),
        paragraphs: [
          text(
            `如果你对条款有疑问，或需要企业合同与合规支持，请联系 ${brandConfig.supportEmail}。`,
            `If you have questions about these terms or need enterprise contracting and compliance support, contact ${brandConfig.supportEmail}.`,
          ),
        ],
      },
    ],
  },
};
