import { Cable, Search, Users, Wifi } from "lucide-react";
import { useMemo, useState } from "react";

import { LoadingState, SectionError } from "@/components/dashboard/data-state";
import { ClientsTable } from "@/components/dashboard/clients-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ErrorBanner } from "@/components/error-banner";
import { Input } from "@/components/ui/input";
import { useDevice } from "@/hooks/useDevice";
import { useLiveDashboard } from "@/hooks/useLiveDashboard";
import { useI18n } from "@/i18n/I18nProvider";

export function ClientsPage() {
  const { t } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const { dashboard, loading: liveLoading, error } = useLiveDashboard();
  const [query, setQuery] = useState("");
  const connected = snapshot?.connected ?? false;
  const clients = dashboard?.clients.data;
  const filtered = useMemo(() => {
    const rows = clients?.clients ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((client) =>
      [client.hostname, client.ip_address, client.mac].some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [clients, query]);

  if (deviceLoading || (liveLoading && !dashboard)) return <LoadingState rows={4} />;
  if (!connected) {
    return (
      <div className="space-y-5">
        <PageHeader description={t("clients.subtitle")} title={t("clients.title")} />
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t("live.disconnectedTitle")}</p>
      </div>
    );
  }

  const rows = clients?.clients ?? [];
  const wifiCount = rows.filter((client) => client.connection_type === "wifi").length;
  const ethernetCount = rows.filter((client) => client.connection_type === "ethernet").length;

  return (
    <div className="space-y-5">
      <PageHeader
        description={t("clients.subtitle")}
        title={t("clients.title")}
      />
      {error ? <ErrorBanner error={error} /> : null}

      <div className="grid grid-cols-3 gap-3">
        <MetricCard color="var(--chart-lte)" icon={<Users className="size-4" />} label={t("clients.total")} value={clients?.count ?? rows.length} />
        <MetricCard color="var(--chart-download)" icon={<Wifi className="size-4" />} label={t("clients.connection.wifi")} value={wifiCount} />
        <MetricCard color="var(--chart-upload)" icon={<Cable className="size-4" />} label={t("clients.connection.ethernet")} value={ethernetCount} />
      </div>

      <SectionCard
        actions={
          <div className="relative w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t("clients.search")}
              className="h-8 pl-8 text-xs"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("clients.search")}
              value={query}
            />
          </div>
        }
        title={t("clients.listTitle", { count: filtered.length })}
      >
        <ClientsTable clients={filtered} noResults={t("clients.noResults")} />
        {dashboard?.clients ? <div className="mt-3"><SectionError section={dashboard.clients} /></div> : null}
      </SectionCard>
    </div>
  );
}
