import type { Locale } from "./config";
import { createTranslator } from "./messages";

const workspaceModules = {
  funnels: ["agentSite", "areaMagnet"],
  leads: ["leads", "insight", "score"],
  campaigns: ["magicShare", "postcards", "subscriptions"],
  dealTools: ["listings", "showingTour"],
  content: ["flyerStudio", "videoStudio", "xhs"],
} as const;

const platformModelKeys = [
  "funnels",
  "leads",
  "campaigns",
  "dealTools",
  "content",
] as const;

const propertyTypeMap = [
  { value: "Residential", key: "residential" },
  { value: "Condo", key: "condo" },
  { value: "Townhouse", key: "townhouse" },
  { value: "Multi-Family", key: "multiFamily" },
  { value: "Land", key: "land" },
  { value: "Commercial", key: "commercial" },
] as const;

const channelMap = [
  { value: "email", key: "email" },
  { value: "sms", key: "sms" },
  { value: "wechat", key: "wechat" },
  { value: "in_app", key: "inApp" },
  { value: "web_push", key: "webPush" },
] as const;

const frequencyMap = [
  { value: "instant", key: "instant" },
  { value: "daily_digest", key: "dailyDigest" },
  { value: "weekly_digest", key: "weeklyDigest" },
] as const;

export function getDashboardPageCopy(locale: Locale) {
  const t = createTranslator(locale);

  return {
    home: {
      heroBadge: t("dashboardPages.home.heroBadge"),
      heroTitle: t("dashboardPages.home.heroTitle"),
      heroDescription: t("dashboardPages.home.heroDescription"),
      heroFootnote: t("dashboardPages.home.heroFootnote"),
      actions: {
        openLeads: t("dashboardPages.home.actions.openLeads"),
        openFunnels: t("dashboardPages.home.actions.openFunnels"),
        openCampaigns: t("dashboardPages.home.actions.openCampaigns"),
      },
      stats: {
        inventoryTitle: t("dashboardPages.home.stats.inventoryTitle"),
        inventoryDescription: t("dashboardPages.home.stats.inventoryDescription"),
        funnelsTitle: t("dashboardPages.home.stats.funnelsTitle"),
        funnelsDescription: t("dashboardPages.home.stats.funnelsDescription"),
        campaignsTitle: t("dashboardPages.home.stats.campaignsTitle"),
        campaignsDescription: t("dashboardPages.home.stats.campaignsDescription"),
        dealToolsTitle: t("dashboardPages.home.stats.dealToolsTitle"),
        dealToolsDescription: t("dashboardPages.home.stats.dealToolsDescription"),
        contentTitle: t("dashboardPages.home.stats.contentTitle"),
        contentDescription: t("dashboardPages.home.stats.contentDescription"),
        syncLabel: t("dashboardPages.home.stats.syncLabel"),
        syncUnknown: t("dashboardPages.home.stats.syncUnknown"),
      },
      workspacesTitle: t("dashboardPages.home.workspacesTitle"),
      workspacesDescription: t("dashboardPages.home.workspacesDescription"),
      workspaces: {
        funnels: {
          eyebrow: t("dashboardPages.home.workspaces.funnels.eyebrow"),
          title: t("dashboardPages.home.workspaces.funnels.title"),
          description: t("dashboardPages.home.workspaces.funnels.description"),
          actionLabel: t("dashboardPages.home.workspaces.funnels.actionLabel"),
          modules: workspaceModules.funnels.map((key) =>
            t(`dashboardPages.home.workspaces.funnels.modules.${key}`),
          ),
        },
        leads: {
          eyebrow: t("dashboardPages.home.workspaces.leads.eyebrow"),
          title: t("dashboardPages.home.workspaces.leads.title"),
          description: t("dashboardPages.home.workspaces.leads.description"),
          actionLabel: t("dashboardPages.home.workspaces.leads.actionLabel"),
          modules: workspaceModules.leads.map((key) =>
            t(`dashboardPages.home.workspaces.leads.modules.${key}`),
          ),
        },
        campaigns: {
          eyebrow: t("dashboardPages.home.workspaces.campaigns.eyebrow"),
          title: t("dashboardPages.home.workspaces.campaigns.title"),
          description: t("dashboardPages.home.workspaces.campaigns.description"),
          actionLabel: t("dashboardPages.home.workspaces.campaigns.actionLabel"),
          modules: workspaceModules.campaigns.map((key) =>
            t(`dashboardPages.home.workspaces.campaigns.modules.${key}`),
          ),
        },
        dealTools: {
          eyebrow: t("dashboardPages.home.workspaces.dealTools.eyebrow"),
          title: t("dashboardPages.home.workspaces.dealTools.title"),
          description: t("dashboardPages.home.workspaces.dealTools.description"),
          actionLabel: t("dashboardPages.home.workspaces.dealTools.actionLabel"),
          modules: workspaceModules.dealTools.map((key) =>
            t(`dashboardPages.home.workspaces.dealTools.modules.${key}`),
          ),
        },
        content: {
          eyebrow: t("dashboardPages.home.workspaces.content.eyebrow"),
          title: t("dashboardPages.home.workspaces.content.title"),
          description: t("dashboardPages.home.workspaces.content.description"),
          actionLabel: t("dashboardPages.home.workspaces.content.actionLabel"),
          modules: workspaceModules.content.map((key) =>
            t(`dashboardPages.home.workspaces.content.modules.${key}`),
          ),
        },
      },
      platformModelTitle: t("dashboardPages.home.platformModelTitle"),
      platformModelDescription: t("dashboardPages.home.platformModelDescription"),
      platformModel: platformModelKeys.map((key) => ({
        title: t(`dashboardPages.home.platformModel.${key}.title`),
        description: t(`dashboardPages.home.platformModel.${key}.description`),
      })),
      moduleGroupsTitle: t("dashboardPages.home.moduleGroupsTitle"),
      moduleGroupsDescription: t("dashboardPages.home.moduleGroupsDescription"),
    },
    subscriptions: {
      propertyTypes: propertyTypeMap.map((item) => ({
        value: item.value,
        label: t(`dashboardPages.subscriptions.propertyTypes.${item.key}`),
      })),
      channels: channelMap.map((item) => ({
        value: item.value,
        label: t(`dashboardPages.subscriptions.channels.${item.key}`),
      })),
      frequencies: frequencyMap.map((item) => ({
        value: item.value,
        label: t(`dashboardPages.subscriptions.frequencies.${item.key}`),
      })),
      heroBadge: t("dashboardPages.subscriptions.heroBadge"),
      heroTitle: t("dashboardPages.subscriptions.heroTitle"),
      heroDescription: t("dashboardPages.subscriptions.heroDescription"),
      editTitle: t("dashboardPages.subscriptions.editTitle"),
      createTitle: t("dashboardPages.subscriptions.createTitle"),
      formDescription: t("dashboardPages.subscriptions.formDescription"),
      fields: {
        name: t("dashboardPages.subscriptions.fields.name"),
        namePlaceholder: t("dashboardPages.subscriptions.fields.namePlaceholder"),
        cities: t("dashboardPages.subscriptions.fields.cities"),
        citiesPlaceholder: t("dashboardPages.subscriptions.fields.citiesPlaceholder"),
        citiesHint: t("dashboardPages.subscriptions.fields.citiesHint"),
        keywords: t("dashboardPages.subscriptions.fields.keywords"),
        keywordsPlaceholder: t("dashboardPages.subscriptions.fields.keywordsPlaceholder"),
        minPrice: t("dashboardPages.subscriptions.fields.minPrice"),
        maxPrice: t("dashboardPages.subscriptions.fields.maxPrice"),
        minBeds: t("dashboardPages.subscriptions.fields.minBeds"),
        maxBeds: t("dashboardPages.subscriptions.fields.maxBeds"),
        propertyTypes: t("dashboardPages.subscriptions.fields.propertyTypes"),
        channel: t("dashboardPages.subscriptions.fields.channel"),
        frequency: t("dashboardPages.subscriptions.fields.frequency"),
      },
      actions: {
        saveChanges: t("dashboardPages.subscriptions.actions.saveChanges"),
        create: t("dashboardPages.subscriptions.actions.create"),
        cancel: t("dashboardPages.subscriptions.actions.cancel"),
        createNew: t("dashboardPages.subscriptions.actions.createNew"),
        pause: t("dashboardPages.subscriptions.actions.pause"),
        resume: t("dashboardPages.subscriptions.actions.resume"),
        edit: t("dashboardPages.subscriptions.actions.edit"),
        remove: t("dashboardPages.subscriptions.actions.remove"),
        confirmDelete: t("dashboardPages.subscriptions.actions.confirmDelete"),
      },
      listTitle: t("dashboardPages.subscriptions.listTitle"),
      listDescription: t("dashboardPages.subscriptions.listDescription"),
      loading: t("dashboardPages.subscriptions.loading"),
      empty: t("dashboardPages.subscriptions.empty"),
      defaultName: t("dashboardPages.subscriptions.defaultName"),
      status: {
        active: t("dashboardPages.subscriptions.status.active"),
        paused: t("dashboardPages.subscriptions.status.paused"),
        expired: t("dashboardPages.subscriptions.status.expired"),
      },
      meta: {
        unlimited: t("dashboardPages.subscriptions.meta.unlimited"),
        bedroomUnit: t("dashboardPages.subscriptions.meta.bedroomUnit"),
        channel: t("dashboardPages.subscriptions.meta.channel"),
        frequency: t("dashboardPages.subscriptions.meta.frequency"),
        matches: t("dashboardPages.subscriptions.meta.matches"),
        times: t("dashboardPages.subscriptions.meta.times"),
        matchCount: (count: number) =>
          t("dashboardPages.subscriptions.meta.matchCount", { count }),
      },
      toasts: {
        created: t("dashboardPages.subscriptions.toasts.created"),
        createFailed: t("dashboardPages.subscriptions.toasts.createFailed"),
        updated: t("dashboardPages.subscriptions.toasts.updated"),
        updateFailed: t("dashboardPages.subscriptions.toasts.updateFailed"),
        deleted: t("dashboardPages.subscriptions.toasts.deleted"),
        deleteFailed: t("dashboardPages.subscriptions.toasts.deleteFailed"),
      },
    },
  };
}
