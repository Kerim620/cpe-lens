import { useMemo, useState } from "react";

import { ClientsTable } from "../components/ClientsTable";
import { DisconnectedPanel } from "../components/DisconnectedPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { LiveNotice } from "../components/LiveNotice";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { RefreshLiveButton } from "../components/RefreshLiveButton";
import { SectionError } from "../components/SectionError";
import { useDevice } from "../hooks/useDevice";
import { useLiveDashboard } from "../hooks/useLiveDashboard";
import { useI18n } from "../i18n/I18nProvider";
import { formatDateTime } from "../lib/format";

export function ClientsPage() {
  const { t, language } = useI18n();
  const { snapshot: deviceSnapshot, loading: deviceLoading } = useDevice();
  const { dashboard, loading, refreshing, error, refresh } = useLiveDashboard();
  const [query, setQuery] = useState("");
  const clientsSection = dashboard?.clients;
  const clientSnapshot = clientsSection?.data;
  const connected =
    (dashboard?.connected ?? false) && (deviceSnapshot?.connected ?? dashboard?.connected ?? false);

  const filtered = useMemo(() => {
    const clients = clientSnapshot?.clients ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return clients;
    }
    return clients.filter((client) =>
      [client.hostname, client.ip_address, client.mac_masked]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [clientSnapshot, query]);

  if ((deviceLoading || loading) && !dashboard) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<RefreshLiveButton onClick={() => void refresh()} refreshing={refreshing} />}
        subtitle={t("clients.subtitle")}
        title={t("clients.title")}
      />

      {!dashboard ? (
        <div className="space-y-4">
          {error ? <ErrorBanner error={error} /> : null}
          <p className="text-sm text-muted">{t("live.waiting")}</p>
        </div>
      ) : !connected ? (
        <DisconnectedPanel />
      ) : (
        <>
          <LiveNotice />
          {error ? <ErrorBanner error={error} /> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{t("live.sampledAt", { time: formatDateTime(dashboard.sampled_at, language, t("common.dash")) })}</span>
            <span className="chip border-line bg-elevated text-muted">
              {t("clients.count", { count: clientSnapshot?.count ?? 0 })}
            </span>
          </div>

          {clientsSection ? <SectionError section={clientsSection} /> : null}

          <section className="card p-5" aria-labelledby="clients-list">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base" id="clients-list">
                <Icon name="clients" size={18} />
                {t("clients.title")}
              </h2>
              <div className="relative w-full sm:w-72">
                <label className="sr-only" htmlFor="client-search">
                  {t("clients.search")}
                </label>
                <Icon
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  name="search"
                  size={15}
                />
                <input
                  className="field pl-9"
                  id="client-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("clients.searchPlaceholder")}
                  type="search"
                  value={query}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <ClientsTable
                clients={filtered}
                noResults={query.trim() ? t("clients.noMatch") : t("clients.empty")}
              />
              <p className="flex items-start gap-2 text-xs leading-5 text-muted">
                <Icon className="mt-0.5 shrink-0" name="lock" size={14} />
                {t("clients.macMaskedNote")}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
