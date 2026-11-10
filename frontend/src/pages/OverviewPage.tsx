import { Link } from "react-router-dom";

import type { ConnectionSnapshot, NetworkStatus, RadioMetrics, SignalSnapshot, TrafficSnapshot } from "../api/types";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { InfoRow } from "../components/InfoRow";
import { LiveNotice } from "../components/LiveNotice";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { RefreshLiveButton } from "../components/RefreshLiveButton";
import { SectionError } from "../components/SectionError";
import { SignalQualityBadge } from "../components/SignalQualityBadge";
import { errorInfoToUi, useDevice } from "../hooks/useDevice";
import { useLiveDashboard } from "../hooks/useLiveDashboard";
import { useI18n } from "../i18n/I18nProvider";
import {
  displayValue,
  formatBitrate,
  formatBytes,
  formatDateTime,
  formatDuration,
  formatNetworkType,
  formatSignalNumber,
} from "../lib/format";

function lanHost(address: string | null): string | null {
  if (!address) {
    return null;
  }
  try {
    return new URL(address).hostname;
  } catch {
    return null;
  }
}

function SignalSummary({ radio, metrics }: { radio: "lte" | "nr"; metrics: RadioMetrics }) {
  const { t, language } = useI18n();
  return (
    <div className="rounded-control border border-line bg-elevated/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: radio === "lte" ? "rgb(var(--c-lte))" : "rgb(var(--c-nr))" }}
          />
          {t(radio === "lte" ? "signal.lte" : "signal.nr")}
        </span>
        <SignalQualityBadge quality={metrics.quality} />
      </div>
      <p className="tabular mt-1 text-xl font-semibold text-ink">
        {formatSignalNumber(metrics.rsrp_dbm, language)}
        <span className="ml-1 text-xs font-normal text-muted">{t("unit.dbm")}</span>
      </p>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted">
        <span>
          {t("signal.sinr")} {formatSignalNumber(metrics.sinr_db, language)} {t("unit.db")}
        </span>
        <span>
          {t("signal.rsrq")} {formatSignalNumber(metrics.rsrq_db, language)} {t("unit.db")}
        </span>
        <span>
          {t("signal.band")} {metrics.band ?? t("common.dash")}
        </span>
        <span>
          {t("signal.pci")} {metrics.pci ?? t("common.dash")}
        </span>
        <span className="col-span-2 truncate">
          {t("signal.cellId")} {metrics.cell_id ?? t("common.dash")}
        </span>
      </div>
    </div>
  );
}

function SpeedCard({
  traffic,
  section,
}: {
  traffic: TrafficSnapshot | null;
  section: Parameters<typeof SectionError>[0]["section"];
}) {
  const { t, language } = useI18n();
  return (
    <section className="card p-5" aria-labelledby="overview-speed">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base" id="overview-speed">
          <Icon name="traffic" size={18} />
          {t("overview.speedTitle")}
        </h2>
        <Link className="text-xs font-medium text-brand hover:underline" to="/traffic">
          {t("overview.details")}
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MetricCard
          accent="download"
          label={t("traffic.download")}
          value={formatBitrate(traffic?.download_bps ?? null, language)}
        />
        <MetricCard
          accent="upload"
          label={t("traffic.upload")}
          value={formatBitrate(traffic?.upload_bps ?? null, language)}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {t("overview.sessionTraffic", {
          download: formatBytes(traffic?.session_download_bytes ?? null, language),
          upload: formatBytes(traffic?.session_upload_bytes ?? null, language),
          duration: formatDuration(traffic?.current_connect_seconds ?? null, language),
        })}
      </p>
      <div className="mt-2">
        <SectionError section={section} />
      </div>
    </section>
  );
}

function NetworkCard({
  status,
  section,
  snapshot,
}: {
  status: NetworkStatus | null;
  section: Parameters<typeof SectionError>[0]["section"];
  snapshot: ConnectionSnapshot;
}) {
  const { t, language } = useI18n();
  return (
    <section className="card p-5" aria-labelledby="overview-network">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base" id="overview-network">
          <Icon name="network" size={18} />
          {t("overview.networkTitle")}
        </h2>
        <span className="chip border-success/30 bg-success/10 text-success">
          <Icon name="check" size={13} />
          {t("top.connected")}
        </span>
      </div>
      <dl className="mt-2">
        <InfoRow label={t("device.operator")} value={displayValue(status?.operator, language)} />
        <InfoRow
          label={t("device.networkType")}
          value={formatNetworkType(status?.network_type ?? snapshot.device?.network_type, language)}
        />
        <InfoRow
          label={t("device.roaming")}
          value={
            status?.roaming === null || status?.roaming === undefined
              ? t("common.dash")
              : status.roaming
                ? t("common.yes")
                : t("common.no")
          }
        />
        <InfoRow label={t("device.wanIp")} mono value={status?.wan_ip_masked ?? t("common.dash")} />
        <InfoRow label={t("device.lanAddress")} mono value={lanHost(snapshot.address) ?? t("common.dash")} />
        <InfoRow label={t("device.uptime")} value={formatDuration(status?.uptime_seconds ?? null, language)} />
        <InfoRow
          label={t("device.lastSeen")}
          value={formatDateTime(snapshot.last_seen_at, language, t("common.dash"))}
        />
      </dl>
      <div className="mt-2">
        <SectionError section={section} />
      </div>
    </section>
  );
}

export function OverviewPage() {
  const { t, language } = useI18n();
  const { snapshot, loading, connecting, error, connect } = useDevice();
  const { dashboard, loading: liveLoading, refreshing, error: liveError, refresh } = useLiveDashboard();

  if (loading) {
    return <LoadingState />;
  }

  const connected = snapshot?.connected ?? false;
  const report = snapshot?.capability_report ?? null;
  const capabilities = report?.capabilities ?? [];
  const counts = {
    available: capabilities.filter((capability) => capability.status === "available").length,
    experimental: capabilities.filter((capability) => capability.status === "experimental").length,
    issues: capabilities.filter((capability) =>
      ["unavailable", "no_permission", "unsupported", "probe_failed"].includes(capability.status),
    ).length,
  };
  const signal: SignalSnapshot | null = dashboard?.signal.data ?? null;
  const traffic = dashboard?.traffic.data ?? null;
  const status = dashboard?.status.data ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={connected ? <RefreshLiveButton onClick={() => void refresh()} refreshing={refreshing} /> : undefined}
        subtitle={t("overview.subtitle")}
        title={t("overview.title")}
      />

      {!connected ? (
        <>
          <Notice icon="plug" variant="info">
            <p className="font-medium">{t("overview.connectTitle")}</p>
            <p className="mt-0.5 text-muted">{t("overview.connectBody")}</p>
          </Notice>
          {snapshot?.last_error && !error ? (
            <ErrorBanner error={errorInfoToUi(snapshot.last_error)} title={t("overview.offlineTitle")} />
          ) : null}
          <ConnectionPanel connecting={connecting} error={error} onConnect={connect} />
          <div className="grid gap-3 md:grid-cols-2">
            <Notice variant="info" icon="info">
              {t("overview.phaseNote")}
            </Notice>
            <Notice variant="success" icon="shield">
              {t("overview.securityNote")}
            </Notice>
          </div>
        </>
      ) : (
        <>
          <LiveNotice />
          {liveError ? <ErrorBanner error={liveError} /> : null}
          {!snapshot?.device ? (
            <Notice variant="warning" icon="alert">
              {t("device.infoUnavailable")}
            </Notice>
          ) : null}
          {snapshot?.last_error ? (
            <ErrorBanner error={errorInfoToUi(snapshot.last_error)} title={t("device.probeError")} />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {t("live.sampledAt", {
                time: formatDateTime(dashboard?.sampled_at, language, t("common.dash")),
              })}
            </span>
            {liveLoading && !dashboard ? <span>{t("live.waiting")}</span> : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <SpeedCard section={dashboard?.traffic ?? { data: null, error: null, updated_at: null, stale: false }} traffic={traffic} />
            <section className="card p-5" aria-labelledby="overview-signal">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base" id="overview-signal">
                  <Icon name="signal" size={18} />
                  {t("overview.signalTitle")}
                </h2>
                <Link className="text-xs font-medium text-brand hover:underline" to="/signal">
                  {t("overview.details")}
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {signal?.lte ? <SignalSummary metrics={signal.lte} radio="lte" /> : null}
                {signal?.nr ? <SignalSummary metrics={signal.nr} radio="nr" /> : null}
                {!signal?.lte && !signal?.nr ? (
                  <p className="py-6 text-center text-sm text-muted">{t("signal.noData")}</p>
                ) : null}
              </div>
              <div className="mt-2">
                <SectionError section={dashboard?.signal ?? { data: null, error: null, updated_at: null, stale: false }} />
              </div>
            </section>
            {snapshot ? (
              <NetworkCard
                section={dashboard?.status ?? { data: null, error: null, updated_at: null, stale: false }}
                snapshot={snapshot}
                status={status}
              />
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5" aria-labelledby="overview-device">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base" id="overview-device">
                  <Icon name="device" size={18} />
                  {t("overview.deviceTitle")}
                </h2>
              </div>
              <dl className="mt-2">
                <InfoRow label={t("device.model")} value={displayValue(snapshot?.device?.model, language)} />
                <InfoRow label={t("device.firmware")} value={displayValue(snapshot?.device?.firmware_version, language)} />
                <InfoRow label={t("device.webui")} value={displayValue(snapshot?.device?.web_ui_version, language)} />
                <InfoRow label={t("device.imei")} mono value={displayValue(snapshot?.device?.imei_masked, language)} />
              </dl>
            </section>

            <section className="card p-5" aria-labelledby="overview-capabilities">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base" id="overview-capabilities">
                    <Icon name="shield" size={18} />
                    {t("overview.capabilitiesTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {t("overview.capabilitiesBody", {
                      available: counts.available,
                      experimental: counts.experimental,
                      issues: counts.issues,
                    })}
                  </p>
                </div>
                <Link className="btn" to="/device">
                  {t("overview.openDevice")}
                  <Icon name="arrowRight" size={16} />
                </Link>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["available", counts.available, "border-success/30 bg-success/10 text-success"],
                    ["experimental", counts.experimental, "border-warning/40 bg-warning/10 text-warning"],
                    ["issues", counts.issues, "border-danger/30 bg-danger/10 text-danger"],
                  ] as const
                ).map(([key, value, className]) => (
                  <div className={`rounded-control border px-3 py-2 ${className}`} key={key}>
                    <p className="text-[11px] font-medium">
                      {key === "issues"
                        ? t("device.filter.issues")
                        : t(key === "available" ? "capability.status.available" : "capability.status.experimental")}
                    </p>
                    <p className="tabular text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link className="btn" to="/signal">
              <Icon name="signal" size={16} />
              {t("nav.signal")}
            </Link>
            <Link className="btn" to="/traffic">
              <Icon name="traffic" size={16} />
              {t("nav.traffic")}
            </Link>
            <Link className="btn" to="/clients">
              <Icon name="clients" size={16} />
              {t("nav.clients")}
            </Link>
          </div>

          <p className="flex items-start gap-2 text-xs leading-5 text-muted">
            <Icon className="mt-0.5 shrink-0" name="shield" size={14} />
            {t("overview.securityNote")}
          </p>
        </>
      )}
    </div>
  );
}
