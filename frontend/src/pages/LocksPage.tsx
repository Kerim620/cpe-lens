import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import type { MobileSettings } from "../api/types";
import { DisconnectedPanel } from "../components/DisconnectedPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { OperationDialog } from "../components/OperationDialog";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useDevice } from "../hooks/useDevice";
import { useOperation } from "../hooks/useOperation";
import { useResource } from "../hooks/useResource";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { Link } from "react-router-dom";

const modes: Array<{ value: string; key: TranslationKey }> = [
  { value: "00", key: "radio.mode.auto" },
  { value: "03", key: "radio.mode.lte" },
  { value: "02", key: "radio.mode.3g" },
  { value: "01", key: "radio.mode.2g" },
  { value: "0302", key: "radio.mode.lte3g" },
  { value: "0301", key: "radio.mode.lte2g" },
  { value: "0201", key: "radio.mode.3g2g" },
];

function CapabilityLine({ id }: { id: string }) {
  const { t } = useI18n();
  const { snapshot } = useDevice();
  const capability = snapshot?.capability_report?.capabilities.find((item) => item.id === id);
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2 text-sm">
      <span>{t(`capability.name.${id}` as TranslationKey)}</span>
      {capability ? <StatusBadge status={capability.status} /> : <span className="text-xs text-muted">{t("common.dash")}</span>}
    </div>
  );
}

export function LocksPage() {
  const { t } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const connected = snapshot?.connected ?? false;
  const loadMobile = useCallback(() => api.mobile(), []);
  const mobile = useResource<MobileSettings>(loadMobile, connected);
  const operation = useOperation(() => void mobile.reload());
  const [mode, setMode] = useState("00");
  const [bands, setBands] = useState("");

  useEffect(() => {
    if (mobile.data) {
      setMode(mobile.data.network_mode ?? "00");
      setBands(mobile.data.lte_bands.length ? mobile.data.lte_bands.join(",") : "");
    }
  }, [mobile.data]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = bands
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 100);
    void operation.start("radio.update", {
      network_mode: mode,
      lte_bands: parsed.length ? parsed : null,
    });
  };

  if (deviceLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle={t("locks.subtitle")} title={t("locks.title")} />
      {!connected ? (
        <DisconnectedPanel />
      ) : (
        <>
          <Notice variant="warning" icon="alert">{t("locks.warning")}</Notice>
          {mobile.error ? <ErrorBanner error={mobile.error} /> : null}
          {mobile.loading && !mobile.data ? (
            <LoadingState />
          ) : mobile.data ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="card p-5" aria-labelledby="radio-settings">
                <h2 className="flex items-center gap-2 text-base" id="radio-settings">
                  <Icon name="signal" size={18} />
                  {t("locks.radioTitle")}
                </h2>
                <div className="mt-3 space-y-2">
                  <CapabilityLine id="network_mode" />
                  <CapabilityLine id="band_lock" />
                </div>
                <form className="mt-4 space-y-4" onSubmit={submit}>
                  <div>
                    <label className="label" htmlFor="radio-mode">{t("locks.networkMode")}</label>
                    <select className="field" id="radio-mode" onChange={(event) => setMode(event.target.value)} value={mode}>
                      {modes.map((item) => <option key={item.value} value={item.value}>{t(item.key)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="radio-bands">{t("locks.lteBands")}</label>
                    <input className="field" id="radio-bands" onChange={(event) => setBands(event.target.value)} placeholder={t("locks.bandsPlaceholder")} value={bands} />
                    <p className="hint">{t("locks.bandsHint")}</p>
                  </div>
                  <Notice variant="warning" icon="alert">{t("locks.radioWarning")}</Notice>
                  <button className="btn btn-danger" disabled={operation.planning} type="submit">
                    <Icon name="check" size={16} />
                    {t("locks.reviewChange")}
                  </button>
                </form>
              </section>

              <section className="card p-5" aria-labelledby="lock-readonly">
                <h2 className="flex items-center gap-2 text-base" id="lock-readonly">
                  <Icon name="lock" size={18} />
                  {t("locks.readOnlyTitle")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">{t("locks.readOnlyBody")}</p>
                <div className="mt-3 space-y-2">
                  <CapabilityLine id="cell_lock" />
                </div>
                <Link className="btn mt-4" to="/signal">{t("locks.viewCells")}<Icon name="arrowRight" size={16} /></Link>
              </section>
            </div>
          ) : null}
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void mobile.reload()} />
    </div>
  );
}
