import { LockKeyhole, Network, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { api } from "@/api/client";
import type { AdvancedSettings, DhcpSettings, FirewallSettings } from "@/api/types";
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

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} onChange={(event) => onChange(event.target.value)} value={value} />
    </div>
  );
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs" htmlFor={id}>
      <Checkbox checked={checked} id={id} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}

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
    if (dhcp) void operation.start("advanced.dhcp", { ...dhcp });
  };
  const submitFirewall = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (firewall) void operation.start("advanced.firewall", { ...firewall });
  };
  const submitDmz = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void operation.start("advanced.dmz", { enabled: dmzEnabled, ip_address: dmzIp });
  };

  if (deviceLoading) return <LoadingState rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader description={t("advanced.subtitle")} title={t("advanced.title")} />
      {!connected ? (
        <DisconnectedState />
      ) : (
        <>
          <DataNotice>{t("advanced.notice")}</DataNotice>
          {advanced.error ? <ErrorBanner error={advanced.error} /> : null}
          {advanced.loading && !advanced.data ? (
            <LoadingState rows={2} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title={<span className="flex items-center gap-2"><Network className="size-4 text-primary" />{t("advanced.dhcpTitle")}</span>}>
                {dhcp ? (
                  <form className="space-y-4" onSubmit={submitDhcp}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id="dhcp-ip" label={t("advanced.ipAddress")} value={dhcp.ip_address ?? ""} onChange={(value) => setDhcp({ ...dhcp, ip_address: value })} />
                      <Field id="dhcp-mask" label={t("advanced.netmask")} value={dhcp.netmask ?? ""} onChange={(value) => setDhcp({ ...dhcp, netmask: value })} />
                      <Field id="dhcp-start" label={t("advanced.startIp")} value={dhcp.start_ip ?? ""} onChange={(value) => setDhcp({ ...dhcp, start_ip: value })} />
                      <Field id="dhcp-end" label={t("advanced.endIp")} value={dhcp.end_ip ?? ""} onChange={(value) => setDhcp({ ...dhcp, end_ip: value })} />
                      <Field id="dhcp-primary" label={t("advanced.primaryDns")} value={dhcp.primary_dns ?? ""} onChange={(value) => setDhcp({ ...dhcp, primary_dns: value })} />
                      <Field id="dhcp-secondary" label={t("advanced.secondaryDns")} value={dhcp.secondary_dns ?? ""} onChange={(value) => setDhcp({ ...dhcp, secondary_dns: value })} />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Check checked={dhcp.enabled ?? false} id="dhcp-enabled" label={t("advanced.dhcpEnabled")} onChange={(value) => setDhcp({ ...dhcp, enabled: value })} />
                      <Check checked={dhcp.dns_enabled ?? false} id="dns-enabled" label={t("advanced.dnsEnabled")} onChange={(value) => setDhcp({ ...dhcp, dns_enabled: value })} />
                    </div>
                    <DataNotice>{t("advanced.dhcpWarning")}</DataNotice>
                    <Button disabled={operation.planning} size="sm" type="submit">{t("common.review")}</Button>
                  </form>
                ) : null}
              </SectionCard>

              <SectionCard title={<span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-primary" />{t("advanced.servicesTitle")}</span>}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium">{t("advanced.upnp")}</p>
                      <p className="text-[10px] text-muted-foreground">{advanced.data?.upnp_enabled ? t("common.on") : t("common.off")}</p>
                    </div>
                    <Button disabled={operation.planning} onClick={() => void operation.start("advanced.upnp", { enabled: !advanced.data?.upnp_enabled })} size="sm" variant="outline">
                      {advanced.data?.upnp_enabled ? t("common.disable") : t("common.enable")}
                    </Button>
                  </div>

                  <form className="space-y-3 rounded-md border border-border p-3" onSubmit={submitDmz}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">{t("advanced.dmz")}</p>
                      <Check checked={dmzEnabled} id="dmz-enabled" label={t("advanced.enabled")} onChange={setDmzEnabled} />
                    </div>
                    <Field id="dmz-ip" label={t("advanced.dmzIp")} value={dmzIp} onChange={setDmzIp} />
                    <Button disabled={operation.planning} size="sm" type="submit" variant="outline">{t("common.review")}</Button>
                  </form>

                  {firewall ? (
                    <form className="space-y-3 rounded-md border border-border p-3" onSubmit={submitFirewall}>
                      <p className="text-xs font-medium">{t("advanced.firewall")}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Check checked={firewall.enabled ?? false} id="fw-enabled" label={t("advanced.firewallEnabled")} onChange={(value) => setFirewall({ ...firewall, enabled: value })} />
                        <Check checked={firewall.wan_ping_filter ?? false} id="fw-ping" label={t("advanced.wanPingFilter")} onChange={(value) => setFirewall({ ...firewall, wan_ping_filter: value })} />
                        <Check checked={firewall.ip_filter ?? false} id="fw-ip" label={t("advanced.ipFilter")} onChange={(value) => setFirewall({ ...firewall, ip_filter: value })} />
                        <Check checked={firewall.url_filter ?? false} id="fw-url" label={t("advanced.urlFilter")} onChange={(value) => setFirewall({ ...firewall, url_filter: value })} />
                        <Check checked={firewall.mac_filter ?? false} id="fw-mac" label={t("advanced.macFilter")} onChange={(value) => setFirewall({ ...firewall, mac_filter: value })} />
                      </div>
                      <Button disabled={operation.planning} size="sm" type="submit" variant="outline">{t("common.review")}</Button>
                    </form>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard className="xl:col-span-2" title={<span className="flex items-center gap-2"><LockKeyhole className="size-4 text-muted-foreground" />{t("advanced.readOnlyTitle")}</span>}>
                <p className="text-xs leading-5 text-muted-foreground">{t("advanced.readOnlyBody")}</p>
              </SectionCard>
            </div>
          )}
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void advanced.reload()} />
    </div>
  );
}
