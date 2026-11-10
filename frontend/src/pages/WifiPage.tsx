import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import type { WifiSettings } from "../api/types";
import { DisconnectedPanel } from "../components/DisconnectedPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { InfoRow } from "../components/InfoRow";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { OperationDialog } from "../components/OperationDialog";
import { PageHeader } from "../components/PageHeader";
import { useDevice } from "../hooks/useDevice";
import { useOperation } from "../hooks/useOperation";
import { useResource } from "../hooks/useResource";
import { useI18n } from "../i18n/I18nProvider";
import { displayValue } from "../lib/format";

export function WifiPage() {
  const { t, language } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const connected = snapshot?.connected ?? false;
  const loadWifi = useCallback(() => api.wifi(), []);
  const wifi = useResource<WifiSettings>(loadWifi, connected);
  const operation = useOperation(() => void wifi.reload());

  const [ssid, setSsid] = useState("");
  const [hidden, setHidden] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (wifi.data) {
      setSsid(wifi.data.ssid ?? "");
      setHidden(wifi.data.hidden ?? false);
    }
  }, [wifi.data]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void operation.start("wifi.update", {
      ssid: ssid.trim(),
      hidden,
      password: password.trim() ? password : null,
    });
  };

  if (deviceLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle={t("wifi.subtitle")} title={t("wifi.title")} />
      {!connected ? (
        <DisconnectedPanel />
      ) : (
        <>
          <LiveWifiNotice />
          {wifi.error ? <ErrorBanner error={wifi.error} /> : null}
          {wifi.loading && !wifi.data ? (
            <LoadingState />
          ) : wifi.data ? (
            <>
              <Notice variant="info" icon="info">{t("wifi.notImplemented")}</Notice>
              <div className="grid gap-4 lg:grid-cols-2">
              <section className="card p-5" aria-labelledby="wifi-current">
                <h2 className="flex items-center gap-2 text-base" id="wifi-current">
                  <Icon name="wifi" size={18} />
                  {t("wifi.current")}
                </h2>
                <dl className="mt-2">
                  <InfoRow label={t("wifi.ssid")} value={displayValue(wifi.data.ssid, language)} />
                  <InfoRow label={t("wifi.hidden")} value={wifi.data.hidden ? t("common.yes") : t("common.no")} />
                  <InfoRow label={t("wifi.security")} value={displayValue(wifi.data.security_mode, language)} />
                </dl>
              </section>

              <section className="card p-5" aria-labelledby="wifi-update">
                <h2 className="flex items-center gap-2 text-base" id="wifi-update">
                  <Icon name="wifi" size={18} />
                  {t("wifi.updateTitle")}
                </h2>
                <form className="mt-3 space-y-4" onSubmit={submit}>
                  <div>
                    <label className="label" htmlFor="wifi-ssid">{t("wifi.ssid")}</label>
                    <input className="field" id="wifi-ssid" maxLength={32} onChange={(event) => setSsid(event.target.value)} required value={ssid} />
                  </div>
                  <div>
                    <label className="label" htmlFor="wifi-password">{t("wifi.newPassword")}</label>
                    <input
                      autoComplete="new-password"
                      className="field"
                      id="wifi-password"
                      minLength={8}
                      maxLength={63}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={t("wifi.passwordPlaceholder")}
                      type="password"
                      value={password}
                    />
                    <p className="hint">{t("wifi.passwordHint")}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input checked={hidden} className="h-4 w-4 accent-[rgb(var(--c-brand))]" onChange={(event) => setHidden(event.target.checked)} type="checkbox" />
                    {t("wifi.hideSsid")}
                  </label>
                  <Notice variant="warning" icon="alert">{t("wifi.disconnectWarning")}</Notice>
                  <button className="btn btn-danger" disabled={operation.planning} type="submit">
                    <Icon name="check" size={16} />
                    {t("wifi.reviewChange")}
                  </button>
                </form>
              </section>
              </div>
            </>
          ) : null}
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void wifi.reload()} />
    </div>
  );
}

function LiveWifiNotice() {
  const { t } = useI18n();
  return <Notice variant="info" icon="info">{t("wifi.notice")}</Notice>;
}
