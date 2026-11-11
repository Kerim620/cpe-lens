import { EyeOff, KeyRound, Wifi } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { api } from "@/api/client";
import type { WifiSettings } from "@/api/types";
import { DataNotice, LoadingState } from "@/components/dashboard/data-state";
import { DisconnectedState } from "@/components/dashboard/disconnected-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ErrorBanner } from "@/components/error-banner";
import { OperationDialog } from "@/components/operation-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevice } from "@/hooks/useDevice";
import { useOperation } from "@/hooks/useOperation";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n/I18nProvider";
import { displayValue } from "@/lib/format";

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

  if (deviceLoading) return <LoadingState rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader description={t("wifi.subtitle")} title={t("wifi.title")} />
      {!connected ? (
        <DisconnectedState />
      ) : (
        <>
          <DataNotice>{t("wifi.notice")}</DataNotice>
          <DataNotice>{t("wifi.notImplemented")}</DataNotice>
          {wifi.error ? <ErrorBanner error={wifi.error} /> : null}
          {wifi.loading && !wifi.data ? (
            <LoadingState rows={2} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <SectionCard title={<span className="flex items-center gap-2"><Wifi className="size-4 text-primary" />{t("wifi.current")}</span>}>
                <dl className="space-y-0">
                  {[
                    [t("wifi.ssid"), displayValue(wifi.data?.ssid, language)],
                    [t("wifi.hidden"), wifi.data?.hidden === null || wifi.data?.hidden === undefined ? t("common.dash") : wifi.data.hidden ? t("common.yes") : t("common.no")],
                    [t("wifi.security"), displayValue(wifi.data?.security_mode, language)],
                  ].map(([label, value]) => (
                    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0" key={label}>
                      <dt className="text-[11px] text-muted-foreground">{label}</dt>
                      <dd className="text-right font-mono text-[11px] text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-muted-foreground">
                  <KeyRound className="mt-0.5 size-3 shrink-0" />
                  {t("wifi.passwordHint")}
                </p>
              </SectionCard>

              <SectionCard title={t("wifi.updateTitle")}>
                <form className="space-y-4" onSubmit={submit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="wifi-ssid">{t("wifi.ssid")}</Label>
                    <Input id="wifi-ssid" maxLength={32} onChange={(event) => setSsid(event.target.value)} required value={ssid} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wifi-password">{t("wifi.newPassword")}</Label>
                    <Input
                      autoComplete="new-password"
                      id="wifi-password"
                      maxLength={63}
                      minLength={8}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={t("wifi.passwordPlaceholder")}
                      type="password"
                      value={password}
                    />
                    <p className="text-[10px] leading-4 text-muted-foreground">{t("wifi.passwordHint")}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-foreground" htmlFor="wifi-hidden">
                    <Checkbox checked={hidden} id="wifi-hidden" onCheckedChange={(checked) => setHidden(checked === true)} />
                    <EyeOff className="size-3.5 text-muted-foreground" />
                    {t("wifi.hideSsid")}
                  </label>
                  <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] leading-5">
                    <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-warning" />
                    {t("wifi.disconnectWarning")}
                  </div>
                  <Button disabled={operation.planning} type="submit">
                    {t("wifi.reviewChange")}
                  </Button>
                </form>
              </SectionCard>
            </div>
          )}
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void wifi.reload()} />
    </div>
  );
}
