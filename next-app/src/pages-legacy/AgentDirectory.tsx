// legacy page — incrementally migrated
import { useT } from "@/i18n";
import { localeTag, pickText } from "@/i18n/copy";
import { dashboardPageCopy } from "@/i18n/dashboard-pages";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Users,
  Building2,
  Phone,
  Mail,
  Loader2,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

type SortField =
  | "memberFullName"
  | "memberEmail"
  | "officeName"
  | "memberStatus"
  | "closedDealsListing"
  | "closedDealsBuying"
  | "totalClosedDeals";

type SortButtonProps = {
  field: SortField;
  sortBy: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
  children: React.ReactNode;
};

function SortButton({ field, sortBy, sortDir, onSort, children }: SortButtonProps) {
  return (
    <button onClick={() => onSort(field)} className="group flex items-center gap-1 transition-colors hover:text-foreground">
      {children}
      <ArrowUpDown
        className={`h-3 w-3 transition-colors ${
          sortBy === field ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"
        }`}
      />
      {sortBy === field && <span className="text-[10px] font-normal text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

export default function AgentDirectory() {
  const { locale } = useT();
  const copy = dashboardPageCopy.agentDirectory;
  const pick = (value: { zh: string; en: string }) => pickText(locale, value);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<SortField>("totalClosedDeals");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [shouldPollSyncStatus, setShouldPollSyncStatus] = useState(false);
  const [shouldPollStatsStatus, setShouldPollStatsStatus] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }, []);

  const { data, isLoading, error } = trpc.agentDirectory.list.useQuery(
    { search: debouncedSearch, page, pageSize, sortBy, sortDir },
    {
      placeholderData: (prev: any) => prev,
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  const exportCsvQuery = trpc.agentDirectory.exportCsv.useQuery({ search: debouncedSearch }, { enabled: false });

  const syncMutation = trpc.agentDirectory.syncAgents.useMutation({
    onSuccess: (result) => {
      if (result?.started) {
        setShouldPollSyncStatus(true);
      }
    },
  });
  const refreshStatsMutation = trpc.agentDirectory.refreshStats.useMutation({
    onSuccess: (result) => {
      if (result?.started) {
        setShouldPollStatsStatus(true);
      }
    },
  });
  const syncStatusQuery = trpc.agentDirectory.syncStatus.useQuery(undefined, {
    refetchInterval: shouldPollSyncStatus ? 3000 : false,
  });
  const statsStatusQuery = trpc.agentDirectory.statsStatus.useQuery(undefined, {
    refetchInterval: shouldPollStatsStatus ? 3000 : false,
    refetchOnWindowFocus: false,
  });
  const isSyncing = syncStatusQuery.data?.syncing ?? false;
  const statsState = statsStatusQuery.data ?? data?.stats;
  const utils = trpc.useUtils();

  useEffect(() => {
    if (syncMutation.data?.started && !isSyncing && syncStatusQuery.data?.lastResult) {
      utils.agentDirectory.list.invalidate();
    }
    if (shouldPollSyncStatus && syncStatusQuery.data && !isSyncing) {
      setShouldPollSyncStatus(false);
    }
  }, [isSyncing, shouldPollSyncStatus, syncMutation.data, syncStatusQuery.data, utils]);

  useEffect(() => {
    if (
      !statsStatusQuery.data?.refreshing &&
      statsStatusQuery.data?.lastUpdatedAt &&
      statsStatusQuery.data.lastUpdatedAt !== data?.stats?.lastUpdatedAt
    ) {
      utils.agentDirectory.list.invalidate();
    }
    if (statsState?.refreshing) {
      setShouldPollStatsStatus(true);
    } else if (shouldPollStatsStatus && statsStatusQuery.data) {
      setShouldPollStatsStatus(false);
    }
  }, [
    statsStatusQuery.data?.refreshing,
    statsStatusQuery.data?.lastUpdatedAt,
    data?.stats?.lastUpdatedAt,
    statsState?.refreshing,
    shouldPollStatsStatus,
    utils,
  ]);

  const handleExport = async () => {
    const result = await exportCsvQuery.refetch();
    if (result.data?.csv) {
      const blob = new Blob(["\uFEFF" + result.data.csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `agent-directory-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field.includes("closed") || field.includes("total") ? "desc" : "asc");
    }
    setPage(1);
  };

  const sortButtonProps = { sortBy, sortDir, onSort: handleSort };
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
  const statsLastUpdatedLabel = statsState?.lastUpdatedAt ? new Date(statsState.lastUpdatedAt).toLocaleString(localeTag(locale)) : null;
  const statsMessage = (() => {
    if (!statsState) return null;
    if (statsState.refreshing && statsState.ready) return pick(copy.statsMessages.refreshingReady);
    if (statsState.refreshing && !statsState.ready) return pick(copy.statsMessages.refreshingCold);
    if (!statsState.ready) return pick(copy.statsMessages.notReady);
    if (statsState.stale) return pick(copy.statsMessages.stale);
    return null;
  })();

  if (error?.data?.code === "FORBIDDEN") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-medium text-muted-foreground">{pick(copy.accessDeniedTitle)}</h2>
        <p className="text-sm text-muted-foreground/70">{pick(copy.accessDeniedDescription)}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-medium text-foreground">{pick(copy.loadFailedTitle)}</h2>
        <p className="max-w-md text-center text-sm text-muted-foreground/70">{pick(copy.loadFailedDescription)}</p>
        <Button onClick={() => utils.agentDirectory.list.invalidate()}>{pick(copy.reload)}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{pick(copy.title)}</h1>
            <p className="text-sm text-muted-foreground">
              {data ? pick(copy.totalAgents(data.total.toLocaleString())) : pick(copy.loadingTotal)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => syncMutation.mutate()} disabled={isSyncing || syncMutation.isPending} variant="outline" className="gap-2">
            {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isSyncing ? pick(copy.syncingAgents) : pick(copy.syncAgents)}
          </Button>
          <Button
            onClick={() => refreshStatsMutation.mutate()}
            disabled={!!statsState?.refreshing || refreshStatsMutation.isPending}
            variant="outline"
            className="gap-2"
          >
            {statsState?.refreshing || refreshStatsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            {statsState?.ready ? pick(copy.refreshStats) : pick(copy.buildStats)}
          </Button>
          <Button onClick={handleExport} disabled={exportCsvQuery.isFetching} variant="outline" className="gap-2">
            {exportCsvQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pick(copy.exportCsv)}
          </Button>
        </div>
      </div>

      {statsMessage && (
        <Card className="border-amber-200/70 bg-amber-50/70 shadow-sm">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-950">{pick(copy.statsStatusTitle)}</p>
              <p className="text-sm text-amber-900/80">{statsMessage}</p>
            </div>
            <div className="text-xs text-amber-900/70">
              {statsLastUpdatedLabel ? `${pick(copy.lastUpdatedPrefix)}${statsLastUpdatedLabel}` : pick(copy.noStatsSnapshot)}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={pick(copy.searchPlaceholder)} value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          {[25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} {pick(copy.pageSizeSuffix)}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.rows.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Users className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{debouncedSearch ? pick(copy.emptySearch) : pick(copy.emptySync)}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>
                    <SortButton {...sortButtonProps} field="memberFullName">
                      {pick(copy.columns.agent)}
                    </SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton {...sortButtonProps} field="memberEmail">
                      <Mail className="h-3.5 w-3.5" />
                      {pick(copy.columns.email)}
                    </SortButton>
                  </TableHead>
                  <TableHead>
                    <Phone className="mr-1 inline h-3.5 w-3.5" />
                    {pick(copy.columns.phone)}
                  </TableHead>
                  <TableHead>
                    <SortButton {...sortButtonProps} field="officeName">
                      <Building2 className="h-3.5 w-3.5" />
                      {pick(copy.columns.company)}
                    </SortButton>
                  </TableHead>
                  <TableHead>{pick(copy.columns.companyContact)}</TableHead>
                  <TableHead>
                    <SortButton {...sortButtonProps} field="memberStatus">
                      {pick(copy.columns.status)}
                    </SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton {...sortButtonProps} field="closedDealsListing">
                      {pick(copy.columns.listingDeals)}
                    </SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton {...sortButtonProps} field="closedDealsBuying">
                      {pick(copy.columns.buyingDeals)}
                    </SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton {...sortButtonProps} field="totalClosedDeals">
                      {pick(copy.columns.totalDeals)}
                    </SortButton>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((agent: any) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{agent.memberFullName || "—"}</span>
                        {agent.memberStateLicense && <span className="text-[11px] text-muted-foreground">{pick(copy.columns.license)}: {agent.memberStateLicense}</span>}
                        {agent.memberMlsId && <span className="text-[11px] text-muted-foreground">{pick(copy.columns.mlsId)}: {agent.memberMlsId}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground/80">{agent.memberEmail || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-sm text-foreground/80">
                        {agent.memberPreferredPhone && <span title={pick(copy.columns.preferred)}>📞 {agent.memberPreferredPhone}</span>}
                        {agent.memberMobilePhone && agent.memberMobilePhone !== agent.memberPreferredPhone && (
                          <span title={pick(copy.columns.mobile)}>📱 {agent.memberMobilePhone}</span>
                        )}
                        {agent.memberDirectPhone &&
                          agent.memberDirectPhone !== agent.memberPreferredPhone &&
                          agent.memberDirectPhone !== agent.memberMobilePhone && <span title={pick(copy.columns.direct)}>☎️ {agent.memberDirectPhone}</span>}
                        {!agent.memberPreferredPhone && !agent.memberMobilePhone && !agent.memberDirectPhone && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{agent.officeName || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-sm text-foreground/80">
                        {agent.officePhone && <span>📞 {agent.officePhone}</span>}
                        {agent.officeEmail && <span>✉️ {agent.officeEmail}</span>}
                        {!agent.officePhone && !agent.officeEmail && <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {agent.memberStatus ? (
                        <Badge variant={agent.memberStatus === "Active" ? "default" : "secondary"} className="text-[11px]">
                          {agent.memberStatus}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{agent.closedDealsListing || 0}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{agent.closedDealsBuying || 0}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-sm font-medium ${agent.totalClosedDeals > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {agent.totalClosedDeals || 0}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pick(copy.pagination.summary(page, totalPages, data?.total.toLocaleString() || "0"))}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = index + 1;
              } else if (page <= 3) {
                pageNum = index + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + index;
              } else {
                pageNum = page - 2 + index;
              }
              return (
                <Button key={pageNum} variant={pageNum === page ? "default" : "outline"} size="sm" className="w-9" onClick={() => setPage(pageNum)}>
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
