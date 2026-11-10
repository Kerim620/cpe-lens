import { CapabilityList } from "../components/CapabilityList";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { InfoRow } from "../components/InfoRow";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { errorInfoToUi, useDevice } from "../hooks/useDevice";
import { useI18n } from "../i18n/I18nProvider";
import { formatDateTime, formatNetworkType } from "../lib/format";

export function DevicePage() {
  const { t, language } = useI18n();
  const {
    snapshot,
    loading,
    refreshing,
    connecting,
    probing,
    error,
    connect,
    disconnect,
    probe,
    refreshDevice,
  } = useDevice();

  if (loading) {
    return <LoadingState />;
  }

  if (!snapshot?.connected) {
    return (
      <div className="space-y-6">
        <PageHeader subtitle={t("device.subtitle")} title={t("device.title")} />
        {snapshot?.last_error && !error ? (
          <ErrorBanner error={errorInfoToUi(snapshot.last_error)} title={t("overview.offlineTitle")} />
        ) : null}
        <ConnectionPanel connecting={connecting} error={error} onConnect={connect} />
      </div>
    );
  }

  const device = snapshot.device;
  const report = snapshot.capability_report;
  const capabilities = report?.capabilities ?? [];
  const hasExperimental = capabilities.some((capability) => capability.status === "experimental");

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <button
              className="btn"
              disabled={refreshing || probing}
              onClick={() => void refreshDevice()}
              type="button"
            >
              <Icon className={refreshing ? "animate-spin" : ""} name="refresh" size={16} />
              {t("device.refreshInfo")}
            </button>
            <button className="btn btn-primary" disabled={probing || refreshing} onClick={() => void probe()} type="button">
              <Icon className={probing ? "animate-spin" : ""} name={probing ? "refresh" : "flask"} size={16} />
              {probing ? t("device.reprobing") : t("device.reprobe")}
            </button>
            <button
              className="btn btn-danger"
              disabled={probing || refreshing}
              onClick={() => void disconnect()}
              type="button"
            >
              <Icon name="plug" size={16} />
              {t("device.disconnect")}
            </button>
          </>
        }
        subtitle={t("device.subtitle")}
        title={t("device.title")}
      />

      {snapshot.last_error ? (
        <ErrorBanner error={errorInfoToUi(snapshot.last_error)} title={t("device.probeError")} />
      ) : null}
      {!device ? (
        <Notice variant="warning" icon="alert">
          {t("device.infoUnavailable")}
        </Notice>
      ) : null}
      {hasExperimental ? (
        <Notice icon="alert" variant="warning">
          {t("device.experimentalNotice")}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="device-identity">
          <h2 className="flex items-center gap-2 text-base" id="device-identity">
            <Icon name="device" size={18} />
            {t("device.identity")}
          </h2>
          <dl className="mt-2">
            <InfoRow label={t("device.model")} value={device?.model ?? t("common.dash")} />
            <InfoRow label={t("device.deviceName")} value={device?.device_name ?? t("common.dash")} />
            <InfoRow label={t("device.hardware")} value={device?.hardware_version ?? t("common.dash")} />
            <InfoRow label={t("device.firmware")} value={device?.firmware_version ?? t("common.dash")} />
            <InfoRow label={t("device.webui")} value={device?.web_ui_version ?? t("common.dash")} />
            <InfoRow label={t("device.operator")} value={device?.operator ?? t("common.dash")} />
            <InfoRow
              label={t("device.networkType")}
              value={formatNetworkType(device?.network_type, language)}
            />
            <InfoRow label={t("device.imei")} mono value={device?.imei_masked ?? t("common.dash")} />
          </dl>
        </section>

        <section className="card p-5" aria-labelledby="device-session">
          <h2 className="flex items-center gap-2 text-base" id="device-session">
            <Icon name="shield" size={18} />
            {t("device.session")}
          </h2>
          <dl className="mt-2">
            <InfoRow label={t("device.address")} mono value={snapshot.address ?? t("common.dash")} />
            <InfoRow label={t("device.username")} value={snapshot.username ?? t("common.dash")} />
            <InfoRow
              label={t("device.connectedSince")}
              value={formatDateTime(snapshot.connected_at, language, t("common.dash"))}
            />
            <InfoRow
              label={t("device.lastSeen")}
              value={formatDateTime(snapshot.last_seen_at, language, t("common.dash"))}
            />
            <InfoRow label={t("device.reconnects")} value={snapshot.reconnect_count} />
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted">{t("connection.passwordHint")}</p>
        </section>
      </div>

      <section className="card p-5" aria-labelledby="device-capabilities">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base" id="device-capabilities">
              <Icon name="flask" size={18} />
              {t("device.capabilities")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {report
                ? t("device.capabilityCount", { count: capabilities.length })
                : t("device.empty")}
              {report ? (
                <span className="ml-2 text-xs">
                  {formatDateTime(report.probed_at, language, t("common.dash"))}
                </span>
              ) : null}
            </p>
          </div>
          <button
            className="btn"
            disabled={probing}
            onClick={() => void probe()}
            type="button"
          >
            <Icon className={probing ? "animate-spin" : ""} name={probing ? "refresh" : "flask"} size={16} />
            {probing ? t("device.reprobing") : t("device.reprobe")}
          </button>
        </div>
        <div className="mt-4">
          {capabilities.length > 0 ? (
            <CapabilityList capabilities={capabilities} />
          ) : (
            <p className="rounded-control border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              {t("device.empty")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
