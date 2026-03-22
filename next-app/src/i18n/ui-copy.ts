import { text } from "./copy";
import { brandConfig } from "@/lib/brand";

export const uiCopy = {
  map: {
    providerDisabled: text(
      "地图服务已禁用。请把 NEXT_PUBLIC_MAP_UI_PROVIDER 设为 google。",
      "Map provider is disabled. Set NEXT_PUBLIC_MAP_UI_PROVIDER=google.",
    ),
    missingApiKey: text(
      "缺少 Google Maps API Key。请配置 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY。",
      "Google Maps API key is missing. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.",
    ),
    containerMissing: text("地图容器不存在。", "Map container not found."),
    apiUnavailable: text("Google Maps API 不可用。", "Google Maps API not available."),
    initFailed: text("地图初始化失败。", "Map failed to initialize."),
    scriptLoadFailed: text("Google Maps 脚本加载失败。", "Failed to load Google Maps script."),
    loading: text("正在加载地图...", "Loading map..."),
    loadFailedPrefix: text("地图加载失败：", "Map failed to load: "),
  },
  loginAuthHub: {
    providerNotConfigured: (providerLabel: string) =>
      text(`${providerLabel} 登录暂未配置完成。`, `${providerLabel} sign-in is not configured yet.`),
    providerStartFailed: (providerLabel: string) =>
      text(`${providerLabel} 登录无法启动。`, `${providerLabel} sign-in could not be started.`),
    enterEmail: text("请输入接收登录链接的邮箱地址。", "Enter the email address that should receive the sign-in link."),
    magicLinkNotConfigured: text("邮箱登录链接尚未配置。", "Email sign-in links are not configured yet."),
    magicLinkFailed: text("登录链接发送失败。", "The sign-in link could not be sent."),
    magicLinkInbox: text("请检查邮箱中的安全登录链接。", "Check your inbox for a secure sign-in link."),
    securityBadge: text("安全身份接入", "Secure identity handoff"),
    heroTitleNewWorkspace: text("直接使用你的团队已经信任的身份开始。", "Start with the identity your team already trusts."),
    heroTitleDefault: text(
      `${brandConfig.appName} · AI 房地产营销平台`,
      `${brandConfig.appName} — AI-Powered Real Estate Marketing`,
    ),
    heroDescription: text(
      `使用 Google、Microsoft 或一次性邮箱链接登录。${brandConfig.appName} 不会要求你设置密码。`,
      `Sign in with Google, Microsoft, or a secure one-time email link. ${brandConfig.appName} never asks for a password.`,
    ),
    featureCards: [
      {
        id: "identity",
        title: text("身份归属于外部提供商", "Identity stays with the provider"),
        body: text(
          `${brandConfig.appName} 保持无密码模式，身份来自 Google、Microsoft 或一次性邮箱链接。`,
          `${brandConfig.appName} stays passwordless. Identity comes from Google, Microsoft, or a one-time email link.`,
        ),
      },
      {
        id: "providers",
        title: text("Google、Microsoft 或安全邮箱链接", "Google, Microsoft, or secure email link"),
        body: text(
          "经纪人可以使用任一生态登录，也可以请求一次性链接。",
          "Agents can sign in with either ecosystem or request a one-time link.",
        ),
      },
      {
        id: "tools",
        title: text("专业营销工具", "Professional marketing tools"),
        body: text(
          "提供 AI 房源内容、CMA 报告、社媒营销以及面向华人市场的微信能力。",
          "AI-powered listing content, CMA reports, social campaigns, and WeChat integration for Chinese market agents.",
        ),
      },
    ],
    authCardPromptNewWorkspace: text(
      "选择你已经在使用的身份提供商，我们会自动创建账户。",
      "Pick the provider you already use. We create your account automatically.",
    ),
    authCardPromptDefault: text(
      "选择 Google、Microsoft，或申请一次性邮箱登录链接。",
      "Pick Google, Microsoft, or request a one-time email link.",
    ),
    noPasswordsTitle: text("不存储密码", "No passwords stored"),
    noPasswordsBody: text(
      "身份验证完全交给 Google、Microsoft 或一次性邮箱链接。",
      "Authentication is delegated to Google, Microsoft, or a one-time email link.",
    ),
    continueWith: (providerLabel: string) =>
      text(`使用 ${providerLabel} 继续`, `Continue with ${providerLabel}`),
    statusLive: text("可用", "Live"),
    statusNotConfigured: text("未配置", "Not configured"),
    passwordlessDivider: text("无密码备用方式", "Passwordless fallback"),
    magicLinkTitle: text("给我发送安全登录链接", "Email me a secure sign-in link"),
    magicLinkDescription: text(
      "适合暂时不想走 OAuth 的情况。链接有效期很短，并且只能使用一次。",
      "Best when you do not want to use OAuth right now. The link expires quickly and works once.",
    ),
    sendingLink: text("发送中", "Sending link"),
    sendLink: text("发送登录链接", "Email me a sign-in link"),
    sentPrefix: text("如果邮箱 ", "If "),
    sentSuffix: text(" 可接收邮件，一次性登录链接正在发送。", " is reachable, a one-time sign-in link is on the way."),
    helpTitle: text("重试前请确认", "Before you retry"),
    helpChecklist: [
      text("请使用与你邮箱一致的 Google 或 Microsoft 账号。", "Use the same Google or Microsoft account that owns the mailbox you plan to use."),
      text("Magic Link 只用于系统登录，不需要密码。", "Magic links are system emails only — they help you sign in without a password."),
      text("如果使用 Microsoft 工作账号，首次使用前可能需要租户管理员授权。", "For Microsoft work accounts, tenant consent may be required before first use."),
    ],
    needHelpPrefix: text("需要帮助？联系 ", "Need help? Contact "),
    privacy: text("隐私", "Privacy"),
    terms: text("条款", "Terms"),
    returnHome: text("返回首页", "Return home"),
  },
  authUx: {
    accessDenied: {
      title: (providerLabel: string) =>
        text(`${providerLabel} 授权没有完成`, `${providerLabel} authorization was not completed`),
      description: text(
        "身份提供商没有完成登录请求。通常意味着用户取消了授权、应用仍在测试阶段，或者组织策略阻止了该请求。",
        "The provider did not finish the sign-in request. This usually means consent was cancelled, the app is still in testing, or the organization blocked the request.",
      ),
      checklist: [
        text("在新标签页里重试同一个登录方式。", "Retry the same provider once in a fresh browser tab."),
        text("如果这是 Google 测试应用，确认你的邮箱已被加入测试用户。", "If this is a Google testing app, confirm your email is listed as a test user."),
        text("如果这是 Microsoft 工作账号，请让租户管理员允许应用或授予同意。", "If this is a Microsoft work account, ask the tenant admin to allow the app or grant consent."),
      ],
    },
    missingEmail: {
      title: (providerLabel: string) =>
        text(`${providerLabel} 没有返回可用邮箱`, `${providerLabel} did not return a usable email`),
      description: text(
        `${brandConfig.appName} 依赖已验证邮箱来创建账户。OAuth 虽然完成了，但回调里没有返回可绑定工作区的稳定邮箱地址。`,
        `${brandConfig.appName} provisions accounts by verified email address. The provider completed OAuth, but the callback did not include a stable email we can attach to a workspace.`,
      ),
      checklist: [
        text("请使用真实邮箱账户，而不是仅有别名的身份。", "Use an account with a real mailbox, not an alias-only identity."),
        text("如果使用 Microsoft，优先使用主工作邮箱，而不是外部 guest 身份。", "For Microsoft, prefer the account's primary work mailbox instead of an external guest identity."),
        text("如果问题重复出现，可尝试换一个身份提供商对比结果。", "If the problem repeats, reconnect with another provider and compare the result."),
      ],
    },
    accountSyncFailed: {
      title: text("我们无法完成账户创建", "We could not finish account provisioning"),
      description: text(
        `身份验证虽然成功了，但 ${brandConfig.appName} 无法创建或更新本地工作区记录。这通常是数据库或回调配置的问题。`,
        `Authentication succeeded, but ${brandConfig.appName} could not create or update the local workspace record. This is usually a database or callback configuration issue on our side.`,
      ),
      checklist: [
        text("先重试一次，排除瞬时回调失败。", "Retry once to rule out a transient callback failure."),
        text("如果持续失败，请检查登录回调相关的部署日志。", "If it repeats, review the deployment logs for the sign-in callback."),
        text("在回调错误修复前，不要反复切换不同登录方式。", "Do not keep retrying different providers until the callback error is fixed."),
      ],
    },
    oauthCallback: {
      title: (providerLabel: string) =>
        text(`${providerLabel} 无法完成回调`, `${providerLabel} could not complete the callback`),
      description: text(
        "身份提供商已经回跳，但 OAuth 回调在创建会话前失败了。",
        "The provider redirect returned, but the OAuth callback failed before a session could be created.",
      ),
      checklist: [
        text("核对 Google Cloud 或 Microsoft Entra 里的 redirect URI 是否完全一致。", "Verify the exact redirect URI in Google Cloud or Microsoft Entra."),
        text("确认生产环境已正确配置 provider client ID 和 secret。", "Confirm the provider client ID and secret are set in production."),
        text("查看失败时间点附近的回调路由部署日志。", "Check deployment logs for the callback route around the failed timestamp."),
      ],
    },
    configuration: {
      title: text("认证配置不完整", "Authentication is not configured correctly"),
      description: text(
        `${brandConfig.appName} 收到了一个尚未完整配置的登录方式请求，通常缺少 credentials、redirect URI 或环境变量。`,
        `${brandConfig.appName} received a request for a provider that is missing credentials, redirect URIs, or environment variables.`,
      ),
      checklist: [
        text("确认 Railway 当前环境里已经配置好该 provider。", "Confirm the provider is configured in Railway for this environment."),
        text("确保生产环境 redirect URI 与当前域名完全一致。", "Make sure the production redirect URIs exactly match the current domain."),
        text("未配置完成的登录按钮应直接禁用。", "Disable any provider button that is not fully configured."),
      ],
    },
    verification: {
      title: text("这个登录链接已经失效", "This sign-in link is no longer valid"),
      description: text(
        "一次性验证链接或回调 token 已过期，或者已经被使用过。",
        "A one-time verification or callback token has expired or has already been used.",
      ),
      checklist: [
        text(`请回到 ${brandConfig.appName} 登录页重新发起登录。`, `Start sign-in again from the ${brandConfig.appName} login page.`),
        text("不要从浏览器历史中重新打开旧的登录链接。", "Avoid reopening an old callback link from browser history."),
      ],
    },
    defaultError: {
      title: text("登录没有完成", "Sign-in did not complete"),
      description: text(
        `${brandConfig.appName} 收到了一个未预期的认证错误，请求在创建会话前被中断了。`,
        `${brandConfig.appName} received an unexpected authentication error. The request was stopped before a session was created.`,
      ),
      checklist: [
        text("先重试同一个登录方式一次。", "Retry the same provider once."),
        text("如果只在某个浏览器里发生，清掉站点 cookie 后再试。", "If the issue only happens in one browser, clear the site cookies and try again."),
        text("如果持续失败，请按准确失败时间检查 auth callback 日志。", "If it repeats, inspect the auth callback logs with the exact time of the failure."),
      ],
    },
  },
} as const;
