// legacy page — incrementally migrated
import { useT } from "@/i18n";
import { getDashboardPageCopy } from "@/i18n/dashboard-pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  CirclePlus,
  Edit3,
  Loader2,
  MapPin,
  Pause,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

type SubscriptionChannel = "email" | "sms" | "wechat" | "in_app" | "web_push";
type SubscriptionFrequency = "instant" | "daily_digest" | "weekly_digest";

function formatPrice(value: string | null | undefined) {
  if (!value) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `$${(number / 1_000).toFixed(0)}K`;
  return `$${number.toLocaleString()}`;
}

export default function Subscriptions() {
  const { locale } = useT();
  const copy = getDashboardPageCopy(locale).subscriptions;
  const propertyTypeOptions = copy.propertyTypes;
  const channelOptions = copy.channels;
  const frequencyOptions = copy.frequencies;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [cities, setCities] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const [maxBeds, setMaxBeds] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [channel, setChannel] = useState<SubscriptionChannel>("email");
  const [frequency, setFrequency] = useState<SubscriptionFrequency>("instant");

  const utils = trpc.useUtils();
  const subsQuery = trpc.subscription.list.useQuery();
  const createMutation = trpc.subscription.create.useMutation({
    onSuccess: () => {
      toast.success(copy.toasts.created);
      resetForm();
      utils.subscription.list.invalidate();
    },
    onError: (err) => toast.error(copy.toasts.createFailed, { description: err.message }),
  });
  const updateMutation = trpc.subscription.update.useMutation({
    onSuccess: () => {
      toast.success(copy.toasts.updated);
      setEditingId(null);
      resetForm();
      utils.subscription.list.invalidate();
    },
    onError: (err) => toast.error(copy.toasts.updateFailed, { description: err.message }),
  });
  const deleteMutation = trpc.subscription.delete.useMutation({
    onSuccess: () => {
      toast.success(copy.toasts.deleted);
      utils.subscription.list.invalidate();
    },
    onError: (err) => toast.error(copy.toasts.deleteFailed, { description: err.message }),
  });

  const resetForm = useCallback(() => {
    setName("");
    setCities("");
    setMinPrice("");
    setMaxPrice("");
    setMinBeds("");
    setMaxBeds("");
    setSelectedTypes([]);
    setKeywords("");
    setChannel("email");
    setFrequency("instant");
    setShowCreateForm(false);
    setEditingId(null);
  }, []);

  const handleSubmit = () => {
    const cityList = cities.split(",").map((city) => city.trim()).filter(Boolean);
    const data = {
      name: name.trim() || undefined,
      cities: cityList.length > 0 ? cityList : undefined,
      minPrice: minPrice.trim() || undefined,
      maxPrice: maxPrice.trim() || undefined,
      minBeds: minBeds ? Number(minBeds) : undefined,
      maxBeds: maxBeds ? Number(maxBeds) : undefined,
      propertyTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      keywords: keywords.trim() || undefined,
      channel,
      frequency,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const startEdit = (sub: NonNullable<typeof subsQuery.data>[number]) => {
    setEditingId(sub.id);
    setShowCreateForm(true);
    setName(sub.name ?? "");
    setCities((sub.cities as string[] | null)?.join(", ") ?? "");
    setMinPrice(sub.minPrice ?? "");
    setMaxPrice(sub.maxPrice ?? "");
    setMinBeds(sub.minBeds?.toString() ?? "");
    setMaxBeds(sub.maxBeds?.toString() ?? "");
    setSelectedTypes((sub.propertyTypes as string[] | null) ?? []);
    setKeywords(sub.keywords ?? "");
    setChannel(sub.channel as SubscriptionChannel);
    setFrequency(sub.frequency as SubscriptionFrequency);
  };

  const togglePause = (sub: NonNullable<typeof subsQuery.data>[number]) => {
    const newStatus = sub.status === "active" ? "paused" : "active";
    updateMutation.mutate({ id: sub.id, status: newStatus as "active" | "paused" | "expired" });
  };

  const channelLabel = (value: string) => {
    const option = channelOptions.find((item) => item.value === value);
    return option ? option.label : value;
  };

  const frequencyLabel = (value: string) => {
    const option = frequencyOptions.find((item) => item.value === value);
    return option ? option.label : value;
  };

  const propertyTypeLabel = (value: string) => {
    const option = propertyTypeOptions.find((item) => item.value === value);
    return option ? option.label : value;
  };

  const statusLabel = (status: "active" | "paused" | "expired") => copy.status[status];
  const subscriptions = subsQuery.data ?? [];

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Bell className="h-4 w-4" />
          {copy.heroBadge}
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">{copy.heroTitle}</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">{copy.heroDescription}</p>
      </div>

      {showCreateForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? <Edit3 className="h-4 w-4" /> : <CirclePlus className="h-4 w-4" />}
              {editingId ? copy.editTitle : copy.createTitle}
            </CardTitle>
            <CardDescription>{copy.formDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{copy.fields.name}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={copy.fields.namePlaceholder}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  <MapPin className="mr-1 inline h-3.5 w-3.5" />
                  {copy.fields.cities}
                </Label>
                <Input
                  value={cities}
                  onChange={(e) => setCities(e.target.value)}
                  placeholder={copy.fields.citiesPlaceholder}
                />
                <p className="text-[11px] text-muted-foreground">{copy.fields.citiesHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{copy.fields.keywords}</Label>
                <Textarea
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  rows={2}
                  placeholder={copy.fields.keywordsPlaceholder}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{copy.fields.minPrice}</Label>
                <Input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="500000" />
              </div>
              <div className="space-y-1.5">
                <Label>{copy.fields.maxPrice}</Label>
                <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="1500000" />
              </div>
              <div className="space-y-1.5">
                <Label>{copy.fields.minBeds}</Label>
                <Input type="number" value={minBeds} onChange={(e) => setMinBeds(e.target.value)} placeholder="3" />
              </div>
              <div className="space-y-1.5">
                <Label>{copy.fields.maxBeds}</Label>
                <Input type="number" value={maxBeds} onChange={(e) => setMaxBeds(e.target.value)} placeholder="5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{copy.fields.propertyTypes}</Label>
              <div className="flex flex-wrap gap-2">
                {propertyTypeOptions.map((type) => {
                  const active = selectedTypes.includes(type.value);
                  return (
                    <Button
                      key={type.value}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => {
                        setSelectedTypes((prev) => (active ? prev.filter((item) => item !== type.value) : [...prev, type.value]));
                      }}
                    >
                      {type.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{copy.fields.channel}</Label>
                <div className="flex flex-wrap gap-2">
                  {channelOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={channel === option.value ? "default" : "outline"}
                      onClick={() => setChannel(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{copy.fields.frequency}</Label>
                <div className="flex flex-wrap gap-2">
                  {frequencyOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={frequency === option.value ? "default" : "outline"}
                      onClick={() => setFrequency(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? copy.actions.saveChanges : copy.actions.create}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                {copy.actions.cancel}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowCreateForm(true)} className="gap-2">
          <CirclePlus className="h-4 w-4" />
          {copy.actions.createNew}
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            {copy.listTitle}
            {subscriptions.length > 0 && <Badge variant="secondary">{subscriptions.length}</Badge>}
          </CardTitle>
          <CardDescription>{copy.listDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {subsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.loading}
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Bell className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">{copy.empty}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[520px]">
              <div className="space-y-3">
                {subscriptions.map((sub) => {
                  const citiesList = (sub.cities as string[] | null) ?? [];
                  const types = (sub.propertyTypes as string[] | null) ?? [];
                  const isActive = sub.status === "active";
                  const isPaused = sub.status === "paused";
                  const activeStatus = isActive ? "active" : isPaused ? "paused" : "expired";

                  return (
                    <div
                      key={sub.id}
                      className={`rounded-xl border p-4 transition ${
                        isActive
                          ? "border-primary/15 bg-primary/[0.02]"
                          : isPaused
                            ? "border-amber-500/15 bg-amber-500/[0.02]"
                            : "border-muted opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h3 className="truncate text-sm font-medium">{sub.name || `${copy.defaultName} #${sub.id}`}</h3>
                            <Badge variant={isActive ? "default" : isPaused ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                              {statusLabel(activeStatus)}
                            </Badge>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                            {citiesList.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5">
                                <MapPin className="h-3 w-3" />
                                {citiesList.join(", ")}
                              </span>
                            )}
                            {(sub.minPrice || sub.maxPrice) && (
                              <span className="rounded-md bg-muted px-1.5 py-0.5">
                                {formatPrice(sub.minPrice) || "$0"} – {formatPrice(sub.maxPrice) || copy.meta.unlimited}
                              </span>
                            )}
                            {(sub.minBeds != null || sub.maxBeds != null) && (
                              <span className="rounded-md bg-muted px-1.5 py-0.5">
                                {sub.minBeds ?? 0}–{sub.maxBeds ?? "∞"} {copy.meta.bedroomUnit}
                              </span>
                            )}
                            {types.map((type) => (
                              <span key={type} className="rounded-md bg-muted px-1.5 py-0.5">
                                {propertyTypeLabel(type)}
                              </span>
                            ))}
                          </div>

                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>
                              {copy.meta.channel}: {channelLabel(sub.channel)}
                            </span>
                            <span>
                              {copy.meta.frequency}: {frequencyLabel(sub.frequency)}
                            </span>
                            <span>{copy.meta.matchCount(sub.matchCount)}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {sub.status !== "expired" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => togglePause(sub)}
                              title={isActive ? copy.actions.pause : copy.actions.resume}
                            >
                              {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(sub)}
                            title={copy.actions.edit}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(copy.actions.confirmDelete)) deleteMutation.mutate({ id: sub.id });
                            }}
                            title={copy.actions.remove}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
