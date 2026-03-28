import type { Locale } from "./config";
import { createTranslator } from "./messages";

const workspaceModules = {
  funnels: ["agentSite", "homeValue", "areaMagnet"],
  leads: ["leads", "insight", "score"],
  campaigns: ["magicShare", "postcards", "subscriptions"],
  dealTools: ["listings", "smartMatch", "cmaStudio"],
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
    cmaStudio: {
      fallbackPrice: t("dashboardPages.cmaStudio.fallbackPrice"),
      unnamedListing: t("dashboardPages.cmaStudio.unnamedListing"),
      sourceLabels: {
        vector: t("dashboardPages.cmaStudio.sourceLabels.vector"),
        sqlFallback: t("dashboardPages.cmaStudio.sourceLabels.sqlFallback"),
      },
      heroTitle: t("dashboardPages.cmaStudio.heroTitle"),
      heroDescription: t("dashboardPages.cmaStudio.heroDescription"),
      prefillLabel: t("dashboardPages.cmaStudio.prefillLabel"),
      embedding: {
        pendingSummary: t("dashboardPages.cmaStudio.embedding.pendingSummary"),
        processing: t("dashboardPages.cmaStudio.embedding.processing"),
        runNow: t("dashboardPages.cmaStudio.embedding.runNow"),
        running: t("dashboardPages.cmaStudio.embedding.running"),
        triggerFailed: t("dashboardPages.cmaStudio.embedding.triggerFailed"),
      },
      subjectCard: {
        title: t("dashboardPages.cmaStudio.subjectCard.title"),
        description: t("dashboardPages.cmaStudio.subjectCard.description"),
        searchPlaceholder: t("dashboardPages.cmaStudio.subjectCard.searchPlaceholder"),
        currentSubject: t("dashboardPages.cmaStudio.subjectCard.currentSubject"),
        notSelected: t("dashboardPages.cmaStudio.subjectCard.notSelected"),
        comparableCount: t("dashboardPages.cmaStudio.subjectCard.comparableCount"),
        generating: t("dashboardPages.cmaStudio.subjectCard.generating"),
        generate: t("dashboardPages.cmaStudio.subjectCard.generate"),
        loadingProperties: t("dashboardPages.cmaStudio.subjectCard.loadingProperties"),
        noProperties: t("dashboardPages.cmaStudio.subjectCard.noProperties"),
        mlsFallback: t("dashboardPages.cmaStudio.subjectCard.mlsFallback"),
      },
      outputCard: {
        title: t("dashboardPages.cmaStudio.outputCard.title"),
        description: t("dashboardPages.cmaStudio.outputCard.description"),
        empty: t("dashboardPages.cmaStudio.outputCard.empty"),
        subject: t("dashboardPages.cmaStudio.outputCard.subject"),
        comparables: t("dashboardPages.cmaStudio.outputCard.comparables"),
        unknownStatus: t("dashboardPages.cmaStudio.outputCard.unknownStatus"),
        score: t("dashboardPages.cmaStudio.outputCard.score"),
        propertyFallback: t("dashboardPages.cmaStudio.outputCard.propertyFallback"),
        openShare: t("dashboardPages.cmaStudio.outputCard.openShare"),
        shareTitlePrefix: t("dashboardPages.cmaStudio.outputCard.shareTitlePrefix"),
      },
      historyCard: {
        title: t("dashboardPages.cmaStudio.historyCard.title"),
        description: t("dashboardPages.cmaStudio.historyCard.description"),
        loading: t("dashboardPages.cmaStudio.historyCard.loading"),
        empty: t("dashboardPages.cmaStudio.historyCard.empty"),
        comparableCount: t("dashboardPages.cmaStudio.historyCard.comparableCount"),
        openShare: t("dashboardPages.cmaStudio.historyCard.openShare"),
        setSubject: t("dashboardPages.cmaStudio.historyCard.setSubject"),
        setSubjectSuccess: t("dashboardPages.cmaStudio.historyCard.setSubjectSuccess"),
      },
      toasts: {
        generated: t("dashboardPages.cmaStudio.toasts.generated"),
        generatedDescription: (count: number, sourceLabel: string) =>
          t("dashboardPages.cmaStudio.toasts.generatedDescription", {
            count,
            sourceLabel,
          }),
        failed: t("dashboardPages.cmaStudio.toasts.failed"),
        selectSubject: t("dashboardPages.cmaStudio.toasts.selectSubject"),
        noShareListings: t("dashboardPages.cmaStudio.toasts.noShareListings"),
      },
    },
    aiRecommend: {
      titles: {
        smartMatch: t("dashboardPages.aiRecommend.titles.smartMatch"),
        smartMatchDescription: t(
          "dashboardPages.aiRecommend.titles.smartMatchDescription",
        ),
        summaryCopy: t("dashboardPages.aiRecommend.titles.summaryCopy"),
        summaryCopyDescription: t(
          "dashboardPages.aiRecommend.titles.summaryCopyDescription",
        ),
      },
      section: {
        clientInfo: t("dashboardPages.aiRecommend.section.clientInfo"),
        clientInfoDescription: t(
          "dashboardPages.aiRecommend.section.clientInfoDescription",
        ),
        clientName: t("dashboardPages.aiRecommend.section.clientName"),
        clientNamePlaceholder: t(
          "dashboardPages.aiRecommend.section.clientNamePlaceholder",
        ),
        budget: t("dashboardPages.aiRecommend.section.budget"),
        budgetMinPlaceholder: t(
          "dashboardPages.aiRecommend.section.budgetMinPlaceholder",
        ),
        budgetMaxPlaceholder: t(
          "dashboardPages.aiRecommend.section.budgetMaxPlaceholder",
        ),
        budgetHint: t("dashboardPages.aiRecommend.section.budgetHint"),
        budgetSummary: ({ min, max }: { min?: string; max?: string }) => {
          if (min && max) {
            return t("dashboardPages.aiRecommend.section.budgetSummaryRange", {
              min,
              max,
            });
          }
          if (min) {
            return t("dashboardPages.aiRecommend.section.budgetSummaryMinOnly", {
              min,
            });
          }
          if (max) {
            return t("dashboardPages.aiRecommend.section.budgetSummaryMaxOnly", {
              max,
            });
          }
          return "";
        },
        requirements: t("dashboardPages.aiRecommend.section.requirements"),
        requirementsPlaceholder: t(
          "dashboardPages.aiRecommend.section.requirementsPlaceholder",
        ),
        submit: t("dashboardPages.aiRecommend.section.submit"),
        submitting: t("dashboardPages.aiRecommend.section.submitting"),
        resultsJump: t("dashboardPages.aiRecommend.section.resultsJump"),
        emptyTitle: t("dashboardPages.aiRecommend.section.emptyTitle"),
        emptyDescription: t("dashboardPages.aiRecommend.section.emptyDescription"),
        resultsTitle: t("dashboardPages.aiRecommend.section.resultsTitle"),
        selectedCount: t("dashboardPages.aiRecommend.section.selectedCount"),
        selectedCountSuffix: t(
          "dashboardPages.aiRecommend.section.selectedCountSuffix",
        ),
        matchScore: t("dashboardPages.aiRecommend.section.matchScore"),
        viewDetails: t("dashboardPages.aiRecommend.section.viewDetails"),
        aiPitch: t("dashboardPages.aiRecommend.section.aiPitch"),
        copyPitch: t("dashboardPages.aiRecommend.section.copyPitch"),
        copied: t("dashboardPages.aiRecommend.section.copied"),
        generateCma: t("dashboardPages.aiRecommend.section.generateCma"),
        openShare: t("dashboardPages.aiRecommend.section.openShare"),
        pitchEmpty: t("dashboardPages.aiRecommend.section.pitchEmpty"),
        beds: t("dashboardPages.aiRecommend.section.beds"),
        baths: t("dashboardPages.aiRecommend.section.baths"),
        sqft: t("dashboardPages.aiRecommend.section.sqft"),
        notAvailable: t("dashboardPages.aiRecommend.section.notAvailable"),
      },
      summary: {
        found: (count: number, seconds: string) =>
          t("dashboardPages.aiRecommend.summary.found", { count, seconds }),
        shareTitle: (name: string) =>
          t("dashboardPages.aiRecommend.summary.shareTitle", { name }),
      },
      toasts: {
        recommendFailed: t("dashboardPages.aiRecommend.toasts.recommendFailed"),
        feedbackSubmitted: t(
          "dashboardPages.aiRecommend.toasts.feedbackSubmitted",
        ),
        feedbackDescription: t(
          "dashboardPages.aiRecommend.toasts.feedbackDescription",
        ),
        requiredFields: t("dashboardPages.aiRecommend.toasts.requiredFields"),
        requiredFieldsDescription: t(
          "dashboardPages.aiRecommend.toasts.requiredFieldsDescription",
        ),
        copied: t("dashboardPages.aiRecommend.toasts.copied"),
        selectOneListing: t(
          "dashboardPages.aiRecommend.toasts.selectOneListing",
        ),
      },
      feedbackNotes: {
        approved: t("dashboardPages.aiRecommend.feedbackNotes.approved"),
        rejected: t("dashboardPages.aiRecommend.feedbackNotes.rejected"),
      },
    },
    agentDirectory: {
      accessDeniedTitle: t("dashboardPages.agentDirectory.accessDeniedTitle"),
      accessDeniedDescription: t(
        "dashboardPages.agentDirectory.accessDeniedDescription",
      ),
      loadFailedTitle: t("dashboardPages.agentDirectory.loadFailedTitle"),
      loadFailedDescription: t(
        "dashboardPages.agentDirectory.loadFailedDescription",
      ),
      reload: t("dashboardPages.agentDirectory.reload"),
      title: t("dashboardPages.agentDirectory.title"),
      totalAgents: (count: string) =>
        t("dashboardPages.agentDirectory.totalAgents", { count }),
      loadingTotal: t("dashboardPages.agentDirectory.loadingTotal"),
      syncAgents: t("dashboardPages.agentDirectory.syncAgents"),
      syncingAgents: t("dashboardPages.agentDirectory.syncingAgents"),
      refreshStats: t("dashboardPages.agentDirectory.refreshStats"),
      buildStats: t("dashboardPages.agentDirectory.buildStats"),
      exportCsv: t("dashboardPages.agentDirectory.exportCsv"),
      statsStatusTitle: t("dashboardPages.agentDirectory.statsStatusTitle"),
      statsMessages: {
        refreshingReady: t(
          "dashboardPages.agentDirectory.statsMessages.refreshingReady",
        ),
        refreshingCold: t(
          "dashboardPages.agentDirectory.statsMessages.refreshingCold",
        ),
        notReady: t("dashboardPages.agentDirectory.statsMessages.notReady"),
        stale: t("dashboardPages.agentDirectory.statsMessages.stale"),
      },
      lastUpdatedPrefix: t("dashboardPages.agentDirectory.lastUpdatedPrefix"),
      noStatsSnapshot: t("dashboardPages.agentDirectory.noStatsSnapshot"),
      searchPlaceholder: t("dashboardPages.agentDirectory.searchPlaceholder"),
      pageSizeSuffix: t("dashboardPages.agentDirectory.pageSizeSuffix"),
      emptySearch: t("dashboardPages.agentDirectory.emptySearch"),
      emptySync: t("dashboardPages.agentDirectory.emptySync"),
      columns: {
        agent: t("dashboardPages.agentDirectory.columns.agent"),
        email: t("dashboardPages.agentDirectory.columns.email"),
        phone: t("dashboardPages.agentDirectory.columns.phone"),
        company: t("dashboardPages.agentDirectory.columns.company"),
        companyContact: t(
          "dashboardPages.agentDirectory.columns.companyContact",
        ),
        status: t("dashboardPages.agentDirectory.columns.status"),
        listingDeals: t("dashboardPages.agentDirectory.columns.listingDeals"),
        buyingDeals: t("dashboardPages.agentDirectory.columns.buyingDeals"),
        totalDeals: t("dashboardPages.agentDirectory.columns.totalDeals"),
        license: t("dashboardPages.agentDirectory.columns.license"),
        mlsId: t("dashboardPages.agentDirectory.columns.mlsId"),
        preferred: t("dashboardPages.agentDirectory.columns.preferred"),
        mobile: t("dashboardPages.agentDirectory.columns.mobile"),
        direct: t("dashboardPages.agentDirectory.columns.direct"),
      },
      pagination: {
        summary: (page: number, totalPages: number, total: string) =>
          t("dashboardPages.agentDirectory.pagination.summary", {
            page,
            totalPages,
            total,
          }),
      },
    },
  };
}
