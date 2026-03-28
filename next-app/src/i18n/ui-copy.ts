import { brandConfig } from "@/lib/brand";

import type { Locale } from "./config";
import { createTranslator } from "./messages";

export function getUiCopy(locale: Locale) {
  const t = createTranslator(locale);
  const brandVars = {
    appName: brandConfig.appName,
    supportEmail: brandConfig.supportEmail,
  };

  return {
    map: {
      providerDisabled: t("map.providerDisabled"),
      missingApiKey: t("map.missingApiKey"),
      containerMissing: t("map.containerMissing"),
      apiUnavailable: t("map.apiUnavailable"),
      initFailed: t("map.initFailed"),
      scriptLoadFailed: t("map.scriptLoadFailed"),
      loading: t("map.loading"),
      loadFailedPrefix: t("map.loadFailedPrefix"),
    },
    loginAuthHub: {
      providerNotConfigured: (providerLabel: string) =>
        t("loginAuth.providerAction.notConfigured", { provider: providerLabel }),
      providerStartFailed: (providerLabel: string) =>
        t("loginAuth.providerAction.startFailed", { provider: providerLabel }),
      enterEmail: t("loginAuth.enterEmail"),
      magicLinkNotConfigured: t("loginAuth.magicLinkNotConfigured"),
      magicLinkFailed: t("loginAuth.magicLinkFailed"),
      magicLinkInbox: t("loginAuth.magicLinkInbox"),
      securityBadge: t("loginAuth.securityBadge"),
      heroTitleNewWorkspace: t("loginAuth.heroTitleNewWorkspace"),
      heroTitleDefault: t("loginAuth.heroTitleDefault", brandVars),
      heroDescription: t("loginAuth.heroDescription", brandVars),
      featureCards: [
        {
          id: "identity",
          title: t("loginAuth.featureCards.identity.title"),
          body: t("loginAuth.featureCards.identity.body", brandVars),
        },
        {
          id: "providers",
          title: t("loginAuth.featureCards.providers.title"),
          body: t("loginAuth.featureCards.providers.body"),
        },
        {
          id: "tools",
          title: t("loginAuth.featureCards.tools.title"),
          body: t("loginAuth.featureCards.tools.body"),
        },
      ],
      authCardPromptNewWorkspace: t("loginAuth.authCardPromptNewWorkspace"),
      authCardPromptDefault: t("loginAuth.authCardPromptDefault"),
      noPasswordsTitle: t("loginAuth.noPasswordsTitle"),
      noPasswordsBody: t("loginAuth.noPasswordsBody"),
      continueWith: (providerLabel: string) =>
        t("loginAuth.providerAction.continueWith", { provider: providerLabel }),
      statusLive: t("loginAuth.providerStatus.live"),
      statusNotConfigured: t("loginAuth.providerStatus.notConfigured"),
      passwordlessDivider: t("loginAuth.passwordlessDivider"),
      magicLinkTitle: t("loginAuth.magicLinkTitle"),
      magicLinkDescription: t("loginAuth.magicLinkDescription"),
      sendingLink: t("loginAuth.sendingLink"),
      sendLink: t("loginAuth.sendLink"),
      sentPrefix: t("loginAuth.sentPrefix"),
      sentSuffix: t("loginAuth.sentSuffix"),
      helpTitle: t("loginAuth.helpTitle"),
      helpChecklist: [
        t("loginAuth.helpChecklist.provider"),
        t("loginAuth.helpChecklist.magicLink"),
        t("loginAuth.helpChecklist.microsoft"),
      ],
      needHelpPrefix: t("loginAuth.needHelpPrefix"),
      privacy: t("loginAuth.privacy"),
      terms: t("loginAuth.terms"),
      returnHome: t("loginAuth.returnHome"),
    },
    authUx: {
      accessDenied: {
        title: (providerLabel: string) =>
          t("authIssue.accessDenied.title", { provider: providerLabel }),
        description: t("authIssue.accessDenied.description"),
        checklist: [
          t("authIssue.accessDenied.checklist.retry"),
          t("authIssue.accessDenied.checklist.google"),
          t("authIssue.accessDenied.checklist.microsoft"),
        ],
      },
      missingEmail: {
        title: (providerLabel: string) =>
          t("authIssue.missingEmail.title", { provider: providerLabel }),
        description: t("authIssue.missingEmail.description", brandVars),
        checklist: [
          t("authIssue.missingEmail.checklist.mailbox"),
          t("authIssue.missingEmail.checklist.microsoft"),
          t("authIssue.missingEmail.checklist.provider"),
        ],
      },
      accountSyncFailed: {
        title: t("authIssue.accountSyncFailed.title"),
        description: t("authIssue.accountSyncFailed.description", brandVars),
        checklist: [
          t("authIssue.accountSyncFailed.checklist.retry"),
          t("authIssue.accountSyncFailed.checklist.logs"),
          t("authIssue.accountSyncFailed.checklist.providers"),
        ],
      },
      oauthCallback: {
        title: (providerLabel: string) =>
          t("authIssue.oauthCallback.title", { provider: providerLabel }),
        description: t("authIssue.oauthCallback.description"),
        checklist: [
          t("authIssue.oauthCallback.checklist.redirect"),
          t("authIssue.oauthCallback.checklist.credentials"),
          t("authIssue.oauthCallback.checklist.logs"),
        ],
      },
      configuration: {
        title: t("authIssue.configuration.title"),
        description: t("authIssue.configuration.description", brandVars),
        checklist: [
          t("authIssue.configuration.checklist.railway"),
          t("authIssue.configuration.checklist.redirect"),
          t("authIssue.configuration.checklist.disable"),
        ],
      },
      verification: {
        title: t("authIssue.verification.title"),
        description: t("authIssue.verification.description"),
        checklist: [
          t("authIssue.verification.checklist.restart", brandVars),
          t("authIssue.verification.checklist.history"),
        ],
      },
      defaultError: {
        title: t("authIssue.defaultError.title"),
        description: t("authIssue.defaultError.description", brandVars),
        checklist: [
          t("authIssue.defaultError.checklist.retry"),
          t("authIssue.defaultError.checklist.cookies"),
          t("authIssue.defaultError.checklist.logs"),
        ],
      },
    },
  };
}
