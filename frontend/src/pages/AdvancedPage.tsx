import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import type { AdvancedSettings, DhcpSettings, FirewallSettings } from "../api/types";
import { DisconnectedPanel } from "../components/DisconnectedPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { OperationDialog } from "../components/OperationDialog";
import { PageHeader } from "../components/PageHeader";
import { useDevice } from "../hooks/useDevice";
import { useOperation } from "../hooks/useOperation";
import { useResource } from "../hooks/useResource";
import { useI18n } from "../i18n/I18nProvider";

export function AdvancedPage() {
  const { t } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const connected = snapshot?.connected ?? false;
  const loadAdvanced = useCallback(() => api.advanced(), []);
  const advanced = useResource<AdvancedSettings>(loadAdvanced, connected);
  const operation = useOperation(() => void advanced.reload());
  const [dhcp, setDhcp] = useState<DhcpSettings | null>(null);
  const [firewall, setFirewall] = useState<FirewallSettings | null>(null);
  const [dmzEnabled, setDmzEnabled] = useState(false);
  const [dmzIp, setDmzIp] = useState("");

  useEffect(() => {
    if (advanced.data) {
      setDhcp(advanced.data.dhcp);
      setFirewall(advanced.data.firewall);
      setDmzEnabled(advanced.data.dmz_enabled ?? false);
      setDmzIp(advanced.data.dmz_ip ?? "");
    }
  }, [advanced.data]);

  const submitDhcp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dhcp) return;
    void operation.start("advanced.dhcp", { ...dhcp });
  };
  const submitFirewall = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firewall) return;
    void operation.start("advanced.firewall", { ...firewall });
  };
  const submitDmz = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void operation.start("advanced.dmz", { enabled: dmzEnabled, ip_address: dmzIp });
  };

  if (deviceLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle={t("advanced.subtitle")} title={t("advanced.title")} />
      {!connected ? (
        <DisconnectedPanel />
      ) : (
        <>
          <Notice variant="info" icon="info">{t("advanced.notice")}</Notice>
          {advanced.error ? <ErrorBanner error={advanced.error} /> : null}
          {advanced.loading && !advanced.data ? (
            <LoadingState />
          ) : advanced.data ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="card p-5" aria-labelledby="advanced-dhcp">
                <h2 className="flex items-center gap-2 text-base" id="advanced-dhcp"><Icon name="network" size={18} />{t("advanced.dhcpTitle")}</h2>
                {dhcp ? (
                  <form className="mt-3 space-y-3" onSubmit={submitDhcp}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id="dhcp-ip" label={t("advanced.ipAddress")} value={dhcp.ip_address ?? ""} onChange={(value) => setDhcp({ ...dhcp, ip_address: value })} />
                      <Field id="dhcp-mask" label={t("advanced.netmask")} value={dhcp.netmask ?? ""} onChange={(value) => setDhcp({ ...dhcp, netmask: value })} />
                      <Field id="dhcp-start" label={t("advanced.startIp")} value={dhcp.start_ip ?? ""} onChange={(value) => setDhcp({ ...dhcp, start_ip: value })} />
                      <Field id="dhcp-end" label={t("advanced.endIp")} value={dhcp.end_ip ?? ""} onChange={(value) => setDhcp({ ...dhcp, end_ip: value })} />
                      <Field id="dhcp-primary" label={t("advanced.primaryDns")} value={dhcp.primary_dns ?? ""} onChange={(value) => setDhcp({ ...dhcp, primary_dns: value })} />
                      <Field id="dhcp-secondary" label={t("advanced.secondaryDns")} value={dhcp.secondary_dns ?? ""} onChange={(value) => setDhcp({ ...dhcp, secondary_dns: value })} />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <Check id="dhcp-enabled" label={t("advanced.dhcpEnabled")} checked={dhcp.enabled ?? false} onChange={(checked) => setDhcp({ ...dhcp, enabled: checked })} />
                      <Check id="dns-enabled" label={t("advanced.dnsEnabled")} checked={dhcp.dns_enabled ?? false} onChange={(checked) => setDhcp({ ...dhcp, dns_enabled: checked })} />
                    </div>
                    <Notice variant="warning" icon="alert">{t("advanced.dhcpWarning")}</Notice>
                    <button className="btn btn-danger" disabled={operation.planning} type="submit"><Icon name="check" size={16} />{t("common.review")}</button>
                  </form>
                ) : null}
              </section>

              <section className="card p-5" aria-labelledby="advanced-services">
                <h2 className="flex items-center gap-2 text-base" id="advanced-services"><Icon name="advanced" size={18} />{t("advanced.servicesTitle")}</h2>
                <div className="mt-3 space-y-4">
                  <div className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2.5">
                    <div><p className="text-sm font-medium text-ink">{t("advanced.upnp")}</p><p className="text-xs text-muted">{advanced.data.upnp_enabled ? t("common.on") : t("common.off")}</p></div>
                    <button className="btn px-3 py-1.5 text-xs" disabled={operation.planning} onClick={() => void operation.start("advanced.upnp", { enabled: !advanced.data?.upnp_enabled })} type="button">{advanced.data.upnp_enabled ? t("common.disable") : t("common.enable")}</button>
                  </div>
                  <form className="space-y-3 rounded-control border border-line p-3" onSubmit={submitDmz}>
                    <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-ink">{t("advanced.dmz")}</p><Check id="dmz-enabled" label={t("advanced.enabled")} checked={dmzEnabled} onChange={setDmzEnabled} /></div>
                    <Field id="dmz-ip" label={t("advanced.dmzIp")} value={dmzIp} onChange={setDmzIp} />
                    <button className="btn" disabled={operation.planning} type="submit">{t("common.review")}</button>
                  </form>
                  {firewall ? (
                    <form className="space-y-3 rounded-control border border-line p-3" onSubmit={submitFirewall}>
                      <p className="text-sm font-medium text-ink">{t("advanced.firewall")}</p>
                      <Check id="fw-enabled" label={t("advanced.firewallEnabled")} checked={firewall.enabled ?? false} onChange={(value) => setFirewall({ ...firewall, enabled: value })} />
                      <Check id="fw-ping" label={t("advanced.wanPingFilter")} checked={firewall.wan_ping_filter ?? false} onChange={(value) => setFirewall({ ...firewall, wan_ping_filter: value })} />
                      <Check id="fw-ip" label={t("advanced.ipFilter")} checked={firewall.ip_filter ?? false} onChange={(value) => setFirewall({ ...firewall, ip_filter: value })} />
                      <Check id="fw-url" label={t("advanced.urlFilter")} checked={firewall.url_filter ?? false} onChange={(value) => setFirewall({ ...firewall, url_filter: value })} />
                      <Check id="fw-mac" label={t("advanced.macFilter")} checked={firewall.mac_filter ?? false} onChange={(value) => setFirewall({ ...firewall, mac_filter: value })} />
                      <button className="btn" disabled={operation.planning} type="submit">{t("common.review")}</button>
                    </form>
                  ) : null}
                </div>
              </section>

              <section className="card p-5 xl:col-span-2" aria-labelledby="advanced-readonly">
                <h2 className="flex items-center gap-2 text-base" id="advanced-readonly"><Icon name="lock" size={18} />{t("advanced.readOnlyTitle")}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{t("advanced.readOnlyBody")}</p>
              </section>
            </div>
          ) : null}
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void advanced.reload()} />
    </div>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="label" htmlFor={id}>{label}</label><input className="field" id={id} onChange={(event) => onChange(event.target.value)} value={value} /></div>;
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm text-ink" htmlFor={id}><input checked={checked} className="h-4 w-4 accent-[rgb(var(--c-brand))]" id={id} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>;
}
