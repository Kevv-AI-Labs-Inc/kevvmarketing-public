"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Award,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Edit3,
  ExternalLink,
  Globe,
  Globe2,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Sparkles,
  Star,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { SOCIAL_PLATFORMS } from "@/components/ui/social-icons";
import { useT } from "@/i18n";
import {
  agentSiteTemplateOptions,
  buildAgentSlug,
  parseTestimonialsText,
  parseTransactionsText,
  sanitizeSocialLinks,
  serializeTestimonials,
  serializeTransactions,
  splitAndCleanList,
} from "@/lib/agent-site";
import type { AgentProfile } from "@/lib/db/schema";
import { trpc } from "@/lib/trpc";
import { TemplateRenderer } from "@/components/agent-site/templates";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  slug: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  brokerage: string;
  licenseState: string;
  officeAddress: string;
  bookingUrl: string;
  photoUrl: string;
  heroImageUrl: string;
  bio: string;
  serviceAreasText: string;
  specialtiesText: string;
  languagesText: string;
  awardsText: string;
  testimonialsText: string;
  transactionsText: string;
  yearsExperience: string;
  templateId: string;
  colorScheme: string;
  // Social links — one key per platform (matches SOCIAL_PLATFORMS[].key)
  socialUrls: Record<string, string>;
  showPhone: boolean;
  showEmail: boolean;
  showTransactions: boolean;
  showAwards: boolean;
  showTestimonials: boolean;
  showAddress: boolean;
  // AI assistant persona
  chatEnabled: boolean;
  chatWidgetLabel: string;
  chatGreeting: string;
  chatSystemPrompt: string;
  chatStyle: "professional" | "friendly" | "bilingual";
  chatSuggestedPrompt1: string;
  chatSuggestedPrompt2: string;
  chatSuggestedPrompt3: string;
};

function buildFormState(profile: AgentProfile): FormState {
  const socialUrls: Record<string, string> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const stored = (profile.socialLinks as Record<string, string>)?.[platform.key] ?? "";
    if (stored) socialUrls[platform.key] = stored;
  }
  const cs = profile.chatSettings;
  const prompts = cs?.suggestedPrompts ?? [];
  return {
    slug: profile.slug,
    name: profile.name,
    email: profile.email,
    phone: profile.phone ?? "",
    title: profile.title ?? "",
    brokerage: profile.brokerage ?? "",
    licenseState: profile.licenseState ?? "",
    officeAddress: profile.officeAddress ?? "",
    bookingUrl: profile.bookingUrl ?? "",
    photoUrl: profile.photoUrl ?? "",
    heroImageUrl: profile.heroImageUrl ?? "",
    bio: profile.bio ?? "",
    serviceAreasText: (profile.serviceAreas ?? []).join(", "),
    specialtiesText: (profile.specialties ?? []).join(", "),
    languagesText: (profile.languages ?? []).join(", "),
    awardsText: (profile.awards ?? []).join(", "),
    testimonialsText: serializeTestimonials(profile.testimonials),
    transactionsText: serializeTransactions(profile.transactions),
    yearsExperience: String(profile.yearsExperience ?? 0),
    templateId: profile.templateId ?? "classic",
    colorScheme: profile.colorScheme ?? "gold",
    socialUrls,
    showPhone: profile.visibilitySettings?.showPhone ?? true,
    showEmail: profile.visibilitySettings?.showEmail ?? true,
    showTransactions: profile.visibilitySettings?.showTransactions ?? true,
    showAwards: profile.visibilitySettings?.showAwards ?? true,
    showTestimonials: profile.visibilitySettings?.showTestimonials ?? true,
    showAddress: profile.visibilitySettings?.showAddress ?? true,
    chatEnabled: cs?.enabled ?? true,
    chatWidgetLabel: cs?.widgetLabel ?? "",
    chatGreeting: cs?.greeting ?? "",
    chatSystemPrompt: cs?.systemPrompt ?? "",
    chatStyle: cs?.style ?? "professional",
    chatSuggestedPrompt1: prompts[0] ?? "",
    chatSuggestedPrompt2: prompts[1] ?? "",
    chatSuggestedPrompt3: prompts[2] ?? "",
  };
}

/** Format digits as US phone: (XXX) XXX-XXXX */
function formatUSPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  // Strip leading 1 (country code)
  const d = digits.startsWith("1") && digits.length > 10 ? digits.slice(1) : digits;
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

function createEmptyFormState(): FormState {
  return {
    slug: "",
    name: "",
    email: "",
    phone: "",
    title: "",
    brokerage: "",
    licenseState: "",
    officeAddress: "",
    bookingUrl: "",
    photoUrl: "",
    heroImageUrl: "",
    bio: "",
    serviceAreasText: "",
    specialtiesText: "",
    languagesText: "",
    awardsText: "",
    testimonialsText: "",
    transactionsText: "",
    yearsExperience: "0",
    templateId: "classic",
    colorScheme: "gold",
    socialUrls: {},
    showPhone: true,
    showEmail: true,
    showTransactions: true,
    showAwards: true,
    showTestimonials: true,
    showAddress: true,
    chatEnabled: true,
    chatWidgetLabel: "",
    chatGreeting: "",
    chatSystemPrompt: "",
    chatStyle: "professional",
    chatSuggestedPrompt1: "",
    chatSuggestedPrompt2: "",
    chatSuggestedPrompt3: "",
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border pb-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {description && (
          <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        )}
      </div>
    </div>
  );
}

function FieldGroup({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const tags = splitAndCleanList(value);

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed].join(", "));
      setInput("");
    }
  };

  const remove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag).join(", "));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          className="h-8 text-sm"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
        />
        <Button size="sm" type="button" variant="outline" onClick={add}>
          +
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {tag}
              <button
                className="opacity-60 transition-opacity hover:opacity-100"
                type="button"
                onClick={() => remove(tag)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  option,
  selected,
  onSelect,
}: {
  option: { id: string; label: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const themeColors: Record<string, string> = {
    classic: "from-amber-800 to-stone-950",
    modern: "from-sky-600 to-slate-900",
    bold: "from-fuchsia-600 to-yellow-400",
    elegant: "from-rose-300 to-fuchsia-900",
    minimal: "from-stone-200 to-stone-400",
    urban: "from-cyan-400 to-slate-950",
    luxury: "from-yellow-700 to-neutral-950",
  };
  const gradient = themeColors[option.id] ?? "from-zinc-700 to-zinc-950";

  return (
    <button
      className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all duration-200 ${
        selected
          ? "border-primary shadow-md"
          : "border-border hover:border-primary/40"
      }`}
      type="button"
      onClick={onSelect}
    >
      <div className={`h-16 bg-gradient-to-br ${gradient}`} />
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold">{option.label}</span>
        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
      </div>
    </button>
  );
}

function CompletenessBar({ profile, form }: { profile: AgentProfile | null | undefined; form: FormState }) {
  const checks = [
    !!form.name,
    !!form.bio,
    !!form.photoUrl,
    !!form.title,
    !!form.brokerage,
    splitAndCleanList(form.serviceAreasText).length > 0,
    splitAndCleanList(form.specialtiesText).length > 0,
    !!form.bookingUrl,
    Object.values(form.socialUrls).some(Boolean),
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">资料完整度</span>
        <span className={`text-xs font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-600"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "identity" | "design" | "content" | "social" | "bot";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "identity", label: "基本信息", icon: User },
  { id: "design", label: "页面设计", icon: Sparkles },
  { id: "content", label: "内容板块", icon: Edit3 },
  { id: "social", label: "社交 & 可见性", icon: Globe2 },
  { id: "bot", label: "AI 助手", icon: Bot },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentSiteDashboard() {
  const { t } = useT();
  const query = trpc.profile.getMine.useQuery();
  const saveMutation = trpc.profile.upsertMine.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState>(createEmptyFormState());
  const [activeTab, setActiveTab] = useState<Tab>("identity");
  const [saved, setSaved] = useState(false);
  // Quick-add transaction fields (local, not saved to form)
  const [txAddr, setTxAddr] = useState("");
  const [txCity, setTxCity] = useState("");
  const [txType, setTxType] = useState("");
  const [txPrice, setTxPrice] = useState("");

  useEffect(() => {
    if (query.data?.profile) {
      setForm(buildFormState(query.data.profile));
    }
  }, [query.data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        slug: form.slug || buildAgentSlug(form.name) || "agent-profile",
        name: form.name,
        email: form.email,
        phone: form.phone,
        title: form.title,
        brokerage: form.brokerage,
        licenseState: form.licenseState,
        officeAddress: form.officeAddress,
        bookingUrl: form.bookingUrl,
        photoUrl: form.photoUrl,
        heroImageUrl: form.heroImageUrl,
        bio: form.bio,
        serviceAreas: splitAndCleanList(form.serviceAreasText),
        specialties: splitAndCleanList(form.specialtiesText),
        languages: splitAndCleanList(form.languagesText),
        awards: splitAndCleanList(form.awardsText),
        testimonials: parseTestimonialsText(form.testimonialsText),
        transactions: parseTransactionsText(form.transactionsText),
        socialLinks: sanitizeSocialLinks(form.socialUrls),

        visibilitySettings: {
          showPhone: form.showPhone,
          showEmail: form.showEmail,
          showTransactions: form.showTransactions,
          showAwards: form.showAwards,
          showTestimonials: form.showTestimonials,
          showAddress: form.showAddress,
        },
        yearsExperience: Number(form.yearsExperience) || 0,
        templateId: (form.templateId || "classic") as
          | "classic" | "modern" | "bold" | "elegant" | "minimal" | "urban" | "luxury",
        colorScheme: form.colorScheme,
        chatSettings: {
          enabled: form.chatEnabled,
          widgetLabel: form.chatWidgetLabel,
          greeting: form.chatGreeting,
          systemPrompt: form.chatSystemPrompt,
          style: form.chatStyle,
          suggestedPrompts: [
            form.chatSuggestedPrompt1,
            form.chatSuggestedPrompt2,
            form.chatSuggestedPrompt3,
          ].filter(Boolean),
        },
        status: "active",
        tier: "pro",
      });

      await utils.profile.getMine.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success(t("agentSiteDashboard.updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentSiteDashboard.saveFailed"));
    }
  };

  const profile = query.data?.profile;

  // Build a live-preview profile object from form state
  const previewProfile: AgentProfile = {
    id: profile?.id ?? 0,
    userId: profile?.userId ?? null,
    slug: form.slug || buildAgentSlug(form.name) || "agent-profile",
    email: form.email,
    name: form.name || "Your Name",
    phone: form.phone || null,
    title: form.title || null,
    brokerage: form.brokerage || null,
    licenseState: form.licenseState || null,
    officeAddress: form.officeAddress || null,
    bookingUrl: form.bookingUrl || null,
    photoUrl: form.photoUrl || null,
    logoUrl: profile?.logoUrl ?? null,
    heroImageUrl: form.heroImageUrl || null,
    bio: form.bio || null,
    serviceAreas: splitAndCleanList(form.serviceAreasText),
    specialties: splitAndCleanList(form.specialtiesText),
    languages: splitAndCleanList(form.languagesText),
    awards: splitAndCleanList(form.awardsText),
    testimonials: parseTestimonialsText(form.testimonialsText),
    transactions: parseTransactionsText(form.transactionsText),
    neighborhoodKnowledge: profile?.neighborhoodKnowledge ?? {},
    socialLinks: sanitizeSocialLinks(form.socialUrls),
    visibilitySettings: {
      showPhone: form.showPhone,
      showEmail: form.showEmail,
      showTransactions: form.showTransactions,
      showAwards: form.showAwards,
      showTestimonials: form.showTestimonials,
      showAddress: form.showAddress,
    },
    yearsExperience: Number(form.yearsExperience) || 0,
    templateId: form.templateId || "classic",
    colorScheme: form.colorScheme || "gold",
    chatSettings: {
      enabled: form.chatEnabled,
      widgetLabel: form.chatWidgetLabel,
      greeting: form.chatGreeting,
      systemPrompt: form.chatSystemPrompt,
      style: form.chatStyle,
      suggestedPrompts: [form.chatSuggestedPrompt1, form.chatSuggestedPrompt2, form.chatSuggestedPrompt3].filter(Boolean),
    },
    status: profile?.status ?? "active",
    tier: profile?.tier ?? "free",
    stripeCustomerId: profile?.stripeCustomerId ?? null,
    stripeSubscriptionId: profile?.stripeSubscriptionId ?? null,
    subscriptionStatus: profile?.subscriptionStatus ?? null,
    currentPeriodEnd: profile?.currentPeriodEnd ?? null,
    lastPublishedAt: profile?.lastPublishedAt ?? null,
    createdAt: profile?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-card/50 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                {t("agentSiteDashboard.eyebrow")}
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight">
                {t("agentSiteDashboard.heroTitle")}
              </h1>
            </div>
            {/* Compact stat badges */}
            <div className="hidden lg:flex items-center gap-3 ml-4">
              {[
                { icon: Globe, value: query.data?.analytics.profileViews ?? 0, label: "Views" },
                { icon: MessageCircle, value: query.data?.analytics.chatMessages ?? 0, label: "Chats" },
                { icon: Users, value: query.data?.analytics.inquiries ?? 0, label: "Leads" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground">{value}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {query.data?.publicUrl && (
              <Button asChild size="sm" variant="outline">
                <Link href={query.data.publicUrl} target="_blank">
                  {t("agentSiteDashboard.openPublicPage")}
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button
              disabled={saveMutation.isPending || query.isLoading}
              size="sm"
              onClick={() => void handleSave()}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t("agentSiteDashboard.saving")}
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {t("agentSiteDashboard.savePublish")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Split-screen layout ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor panel */}
        <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 overflow-y-auto border-r border-border bg-background">
          <div className="px-5 py-6 space-y-6">
            {/* Completeness bar */}
            <CompletenessBar form={form} profile={profile} />

            {/* Public URL */}
            <div className="rounded-lg bg-muted/50 px-3.5 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t("agentSiteDashboard.publicRoute")}
              </div>
              <div className="mt-0.5 truncate font-mono text-xs font-medium">
                {query.data?.publicUrl ?? `/agents/${form.slug || "your-name"}`}
              </div>
            </div>
            {/* Tab bar */}
            <div className="mb-6 flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                    activeTab === id
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  type="button"
                  onClick={() => setActiveTab(id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab: Identity */}
            {activeTab === "identity" && (
              <div className="space-y-8">
                {/* Photo */}
                <section className="space-y-4">
                  <SectionHeader icon={ImageIcon} title="头像 & 个人资料图" description="将显示在公开主页的头部" />
                {/* Photo & hero image — dual URL/upload mode */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex-1 space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">头像</label>
                    <ImageUploadField
                      field="photo"
                      placeholder="https://... 或点击上传"
                      previewClass="aspect-square max-h-36"
                      value={form.photoUrl}
                      onChange={(url) => set("photoUrl", url)}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">封面图（可选）</label>
                    <ImageUploadField
                      field="hero"
                      placeholder="hero image URL"
                      previewClass="aspect-video"
                      value={form.heroImageUrl}
                      onChange={(url) => set("heroImageUrl", url)}
                    />
                  </div>
                </div>
                </section>

                {/* Basic info */}
                <section className="space-y-4">
                  <SectionHeader icon={User} title="基本信息" description="公开可见的身份信息" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldGroup label="公开链接 Slug" hint={`公开地址: /agents/${form.slug || "your-name"}`}>
                      <Input
                        className="text-sm font-mono"
                        placeholder={buildAgentSlug(form.name) || "your-name"}
                        value={form.slug}
                        onChange={(e) => {
                          const raw = e.target.value;
                          // Allow empty — placeholder shows fallback
                          set("slug", raw ? buildAgentSlug(raw) : "");
                        }}
                      />
                    </FieldGroup>
                    <FieldGroup label="从业年数">
                      <Input
                        className="text-sm"
                        min={0}
                        placeholder="10"
                        type="number"
                        value={form.yearsExperience}
                        onChange={(e) => set("yearsExperience", e.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="姓名">
                      <Input
                        className="text-sm"
                        placeholder="Li Wei"
                        value={form.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            name,
                            // Only auto-derive slug when user hasn't customized it
                            slug: prev.slug === "" || prev.slug === buildAgentSlug(prev.name)
                              ? buildAgentSlug(name)
                              : prev.slug,
                          }));
                        }}
                      />
                    </FieldGroup>
                    <FieldGroup label="邮箱">
                      <Input
                        className="text-sm"
                        placeholder="agent@example.com"
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="电话" hint="输入数字自动格式化为美国号码">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-8 text-sm"
                          placeholder="(212) 555-0142"
                          value={form.phone}
                          onChange={(e) => set("phone", formatUSPhone(e.target.value))}
                          maxLength={14}
                        />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="职称">
                      <Input
                        className="text-sm"
                        placeholder="Licensed Real Estate Agent"
                        value={form.title}
                        onChange={(e) => set("title", e.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="经纪公司">
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-8 text-sm"
                          placeholder="Coldwell Banker Realty"
                          value={form.brokerage}
                          onChange={(e) => set("brokerage", e.target.value)}
                        />
                      </div>
                    </FieldGroup>
                    <FieldGroup label="执照州份">
                      <Input
                        className="text-sm"
                        placeholder="CA"
                        value={form.licenseState}
                        onChange={(e) => set("licenseState", e.target.value)}
                      />
                    </FieldGroup>
                  </div>
                  <FieldGroup label="办公室地址">
                    <AddressAutocomplete
                      inputClassName="text-sm"
                      placeholder="350 S Grand Ave, Los Angeles, CA 90071"
                      value={form.officeAddress}
                      onChange={(v) => set("officeAddress", v)}
                      onSelect={(v) => set("officeAddress", v)}
                    />
                  </FieldGroup>
                  <FieldGroup label="预约链接" hint="Calendly / Cal.com URL，访客点击「预约策略通话」时跳转">
                    <Input
                      className="text-sm"
                      placeholder="https://calendly.com/username"
                      value={form.bookingUrl}
                      onChange={(e) => set("bookingUrl", e.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="个人简介" hint="显示在主页 Hero 区，建议 2-4 句话">
                    <Textarea
                      className="text-sm"
                      placeholder="专注为华语客户提供跨境房产顾问服务，深耕大洛杉矶地区十余年…"
                      rows={4}
                      value={form.bio}
                      onChange={(e) => set("bio", e.target.value)}
                    />
                  </FieldGroup>
                </section>
              </div>
            )}

            {/* Tab: Design */}
            {activeTab === "design" && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <SectionHeader icon={Sparkles} title="页面模板" description="选择一个视觉风格，所有模板都支持全部内容区块" />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {agentSiteTemplateOptions.map((option) => (
                      <TemplateCard
                        key={option.id}
                        option={option}
                        selected={form.templateId === option.id}
                        onSelect={() => set("templateId", option.id)}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    实时预览→{" "}
                    {query.data?.publicUrl ? (
                      <Link
                        className="text-primary underline-offset-2 hover:underline"
                        href={query.data.publicUrl}
                        target="_blank"
                      >
                        打开公开主页
                      </Link>
                    ) : (
                      <span>保存后即可访问</span>
                    )}
                  </p>
                </section>

                <section className="space-y-4">
                  <SectionHeader icon={Globe2} title="专业区域 & 专长" description="标签显示在主页 Hero 区" />
                  <FieldGroup label="服务区域" hint="按 Enter 或点击 + 添加，支持多个">
                    <TagInput
                      placeholder="Irvine, San Jose, Flushing…"
                      value={form.serviceAreasText}
                      onChange={(v) => set("serviceAreasText", v)}
                    />
                  </FieldGroup>
                  <FieldGroup label="专长领域">
                    <TagInput
                      placeholder="买家代理, 投资房, 豪宅…"
                      value={form.specialtiesText}
                      onChange={(v) => set("specialtiesText", v)}
                    />
                  </FieldGroup>
                  <FieldGroup label="服务语言">
                    <TagInput
                      placeholder="普通话, English, 粤语…"
                      value={form.languagesText}
                      onChange={(v) => set("languagesText", v)}
                    />
                  </FieldGroup>
                </section>
              </div>
            )}

            {/* Tab: Content */}
            {activeTab === "content" && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <SectionHeader icon={Award} title="奖项荣誉" description="每行一个奖项" />
                  <Textarea
                    className="text-sm font-mono"
                    placeholder={"Top Producer 2024\nCertified Luxury Homes Specialist\nPresident's Club Award"}
                    rows={4}
                    value={form.awardsText}
                    onChange={(e) => set("awardsText", e.target.value)}
                  />
                </section>

                <section className="space-y-4">
                  <SectionHeader
                    icon={Star}
                    title="客户评价"
                    description="格式：Name | Rating | Text（每行一条）"
                  />
                  <Textarea
                    className="text-sm font-mono"
                    placeholder={"张先生 | 5 | 全程专业负责，找到了理想学区房\nMs. Chen | 5 | Excellent bilingual service, closed in 3 weeks"}
                    rows={6}
                    value={form.testimonialsText}
                    onChange={(e) => set("testimonialsText", e.target.value)}
                  />
                </section>

                <section className="space-y-4">
                  <SectionHeader
                    icon={ChevronRight}
                    title="成交案例"
                    description="用下方快速添加，或直接编辑文本（格式：Address | City | Type | Price）"
                  />
                  {/* Quick-add row with address autocomplete */}
                  <div className="grid grid-cols-[1fr_120px_100px_120px_auto] gap-2 items-end">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">地址</label>
                      <AddressAutocomplete
                        inputClassName="text-sm h-9"
                        placeholder="12 Oak Lane, Irvine, CA"
                        value={txAddr}
                        onChange={setTxAddr}
                        onSelect={(formatted) => {
                          const parts = formatted.split(",").map((s) => s.trim());
                          setTxAddr(parts[0] ?? formatted);
                          if (parts.length >= 4) setTxCity(parts[1] ?? "");
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">城市</label>
                      <Input className="text-sm h-9" placeholder="Irvine, CA" value={txCity} onChange={(e) => setTxCity(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">类型</label>
                      <Input className="text-sm h-9" placeholder="Sold" value={txType} onChange={(e) => setTxType(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">价格</label>
                      <Input className="text-sm h-9" placeholder="$1,250,000" value={txPrice} onChange={(e) => setTxPrice(e.target.value)} />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        if (!txAddr.trim()) return;
                        const line = [txAddr.trim(), txCity, txPrice, txType || "Seller"].join(" | ");
                        set("transactionsText", form.transactionsText ? `${form.transactionsText}\n${line}` : line);
                        setTxAddr("");
                        setTxCity("");
                        setTxType("");
                        setTxPrice("");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Bulk textarea fallback */}
                  <Textarea
                    className="text-sm font-mono"
                    placeholder={"12 Oak Lane | Irvine, CA | Sold | $1,250,000\n88 Maple St, Unit 5B | Flushing, NY | Leased | $3,200/mo"}
                    rows={6}
                    value={form.transactionsText}
                    onChange={(e) => set("transactionsText", e.target.value)}
                  />
                </section>
              </div>
            )}

            {/* Tab: Social & Visibility */}
            {activeTab === "social" && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <SectionHeader
                    icon={Globe}
                    title="社交媒体链接"
                    description="填入哪个平台就显示哪个，留空的平台不会出现在主页"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {SOCIAL_PLATFORMS.map(({ key, label, placeholder, Icon }) => (
                      <FieldGroup key={key} label={label}>
                        <div className="relative">
                          <Icon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-8 text-sm"
                            placeholder={placeholder}
                            value={form.socialUrls[key] ?? ""}
                            onChange={(e) =>
                              set("socialUrls", {
                                ...form.socialUrls,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </div>
                      </FieldGroup>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <SectionHeader icon={Globe2} title="内容可见性" description="控制哪些信息出现在公开主页" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ["showPhone", t("agentSiteDashboard.showPhone")],
                      ["showEmail", t("agentSiteDashboard.showEmail")],
                      ["showAddress", t("agentSiteDashboard.showAddress")],
                      ["showTransactions", t("agentSiteDashboard.showTransactions")],
                      ["showAwards", t("agentSiteDashboard.showAwards")],
                      ["showTestimonials", t("agentSiteDashboard.showTestimonials")],
                    ] as Array<[string, string]>).map(([field, label]) => (
                      <label
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
                        key={field}
                      >
                        <input
                          checked={form[field as keyof FormState] as boolean}
                          className="accent-primary"
                          type="checkbox"
                          onChange={(e) =>
                            set(field as keyof FormState, e.target.checked as FormState[keyof FormState])
                          }
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === "bot" && (
              <div className="space-y-8">
                {/* Enable toggle */}
                <section className="space-y-4">
                  <SectionHeader
                    icon={Bot}
                    title="AI 助手浮窗"
                    description="公开主页右下角的对话机器人配置"
                  />
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/30">
                    <input
                      checked={form.chatEnabled}
                      className="accent-primary h-4 w-4"
                      type="checkbox"
                      onChange={(e) => set("chatEnabled", e.target.checked)}
                    />
                    <div>
                      <div className="text-sm font-semibold">启用 AI 助手</div>
                      <div className="text-xs text-muted-foreground">关闭后主页不显示对话按钒</div>
                    </div>
                  </label>

                  <FieldGroup label="按钒文字" hint="空则自动显示「Ask [name]」">
                    <Input
                      className="text-sm"
                      placeholder={`Ask ${form.name.split(" ")[0] || "me"}…`}
                      value={form.chatWidgetLabel}
                      onChange={(e) => set("chatWidgetLabel", e.target.value)}
                    />
                  </FieldGroup>
                </section>

                {/* Persona */}
                <section className="space-y-4">
                  <SectionHeader
                    icon={Sparkles}
                    title="AI 个性设定"
                    description="定义助手的沟通风格和背景语料"
                  />

                  {/* Style selector */}
                  <FieldGroup label="语气风格">
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["professional", "🏢 专业正式"],
                        ["friendly", "✨ 轻松挪要"],
                        ["bilingual", "🇨🇳 中英混搜"],
                      ] as const).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                            form.chatStyle === val
                              ? "border-primary bg-primary/8 text-primary"
                              : "border-border bg-muted/30 text-foreground hover:bg-muted"
                          }`}
                          onClick={() => set("chatStyle", val)}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>

                  <FieldGroup
                    label="开场白 / 欢迎语"
                    hint="显示在对话窗口空白处的第一句话。空则使用默认模板。"
                  >
                    <Textarea
                      className="text-sm"
                      placeholder="例：你好！我是 [Agent 名]的 AI 助手，有什么问题都可以问我。"
                      rows={3}
                      value={form.chatGreeting}
                      onChange={(e) => set("chatGreeting", e.target.value)}
                    />
                  </FieldGroup>

                  <FieldGroup
                    label="系统提示词 / 背景语料"
                    hint="不会对访客显示。助手将在回复时過滤或引用这里的内容。可写冄市知识、别名、客户类型、品牌语调等。"
                  >
                    <Textarea
                      className="font-mono text-xs"
                      placeholder={`例：\n- 专长华人跨境客户\n- 服务区域：费里蒙 / 尔湾 / 底特律\n- 风格：专业、简洁、不过度承诺\n- 如果用户问价格，引导预约卖房咨询`}
                      rows={8}
                      value={form.chatSystemPrompt}
                      onChange={(e) => set("chatSystemPrompt", e.target.value)}
                    />
                  </FieldGroup>
                </section>

                {/* Suggested prompts */}
                <section className="space-y-4">
                  <SectionHeader
                    icon={MessageCircle}
                    title="建议问题"
                    description="对话窗口空白时显示的快捷问题按钒（最多 3 个）。空则使用系统默认。"
                  />
                  <div className="space-y-2">
                    {(["chatSuggestedPrompt1", "chatSuggestedPrompt2", "chatSuggestedPrompt3"] as const).map((field, i) => (
                      <Input
                        key={field}
                        className="text-sm"
                        placeholder={`问题 ${i + 1}（选填）`}
                        value={form[field]}
                        onChange={(e) => set(field, e.target.value)}
                      />
                    ))}
                  </div>
                </section>
              </div>
            )}

          </div>
        </div>

        {/* Right: Live template preview */}
        <div className="hidden lg:flex flex-1 flex-col overflow-hidden bg-muted/30">
          <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card/50">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-muted-foreground">实时预览</span>
              <Badge variant="secondary" className="text-[10px]">{form.templateId || "classic"}</Badge>
            </div>
            <Badge variant={query.data?.isPersisted ? "default" : "secondary"} className="text-[10px]">
              {query.data?.isPersisted ? t("agentSiteDashboard.liveProfile") : t("agentSiteDashboard.draftProfile")}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="origin-top-left" style={{ transform: "scale(0.55)", width: "181.8%", transformOrigin: "top left" }}>
              <TemplateRenderer profile={previewProfile} preview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
