import { useCallback, useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import type { ApnProfile, MobileSettings } from "../api/types";
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
import type { TranslationKey } from "../i18n/translations";

const authModes: Array<{ value: number; key: TranslationKey }> = [
  { value: 0, key: "apn.auth.auto" },
  { value: 1, key: "apn.auth.pap" },
  { value: 2, key: "apn.auth.chap" },
];
const ipTypes: Array<{ value: number; key: TranslationKey }> = [
  { value: 0, key: "apn.ipType.ipv4" },
  { value: 1, key: "apn.ipType.ipv6" },
  { value: 2, key: "apn.ipType.dual" },
];

interface ApnFormState {
  index: number | null;
  name: string;
  apn: string;
  username: string;
  password: string;
  auth_mode: number;
  ip_type: number;
  is_default: boolean;
}

const emptyApn: ApnFormState = {
  index: null,
  name: "",
  apn: "",
  username: "",
  password: "",
  auth_mode: 0,
  ip_type: 2,
  is_default: false,
};

export function MobilePage() {
  const { t } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const connected = snapshot?.connected ?? false;
  const loadMobile = useCallback(() => api.mobile(), []);
  const loadApn = useCallback(() => api.apn(), []);
  const mobile = useResource<MobileSettings>(loadMobile, connected, 15_000);
  const apn = useResource<ApnProfile[]>(loadApn, connected, 20_000);
  const reload = useCallback(async () => {
    await Promise.all([mobile.reload(), apn.reload()]);
  }, [mobile, apn]);
  const operation = useOperation(() => void reload());
  const [form, setForm] = useState<ApnFormState>(emptyApn);


  const submitApn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.index === null) {
      void operation.start("apn.create", {
        name: form.name,
        apn: form.apn,
        username: form.username || null,
        password: form.password || null,
        auth_mode: form.auth_mode,
        ip_type: form.ip_type,
        is_default: form.is_default,
      });
    } else {
      void operation.start("apn.update", {
        index: form.index,
        name: form.name,
        apn: form.apn,
        username: form.username || null,
        password: form.password || null,
        auth_mode: form.auth_mode,
        ip_type: form.ip_type,
        is_default: form.is_default,
      });
    }
  };

  if (deviceLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle={t("mobile.subtitle")} title={t("mobile.title")} />
      {!connected ? (
        <DisconnectedPanel />
      ) : (
        <>
          <Notice variant="info" icon="info">{t("mobile.notice")}</Notice>
          {mobile.error ? <ErrorBanner error={mobile.error} /> : null}
          {mobile.loading && !mobile.data ? (
            <LoadingState />
          ) : mobile.data ? (
            <section className="card p-5" aria-labelledby="mobile-connections">
              <h2 className="flex items-center gap-2 text-base" id="mobile-connections">
                <Icon name="mobile" size={18} />
                {t("mobile.connectionTitle")}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ToggleRow
                  enabled={mobile.data.data_enabled}
                  label={t("mobile.data")}
                  loading={operation.planning || operation.applying}
                  onToggle={() => void operation.start("mobile.data", { enabled: !mobile.data?.data_enabled })}
                />
                <ToggleRow
                  enabled={mobile.data.roaming_enabled}
                  label={t("mobile.roaming")}
                  loading={operation.planning || operation.applying}
                  onToggle={() => void operation.start("mobile.roaming", { enabled: !mobile.data?.roaming_enabled })}
                />
              </div>
              <div className="mt-4">
                <button
                  className="btn btn-danger"
                  disabled={operation.planning || operation.applying}
                  onClick={() => void operation.start("mobile.reconnect", {})}
                  type="button"
                >
                  <Icon name="refresh" size={16} />
                  {t("mobile.reconnect")}
                </button>
                <p className="hint">{t("mobile.reconnectHint")}</p>
              </div>
            </section>
          ) : null}

          <section className="card p-5" aria-labelledby="mobile-apn">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base" id="mobile-apn">
                <Icon name="network" size={18} />
                {t("apn.title")}
              </h2>
              <button
                className="btn"
                onClick={() => setForm(emptyApn)}
                type="button"
              >
                <Icon name="advanced" size={16} />
                {t("apn.new")}
              </button>
            </div>
            {apn.error ? <div className="mt-3"><ErrorBanner error={apn.error} /></div> : null}
            {apn.loading && !apn.data ? (
              <p className="mt-4 text-sm text-muted">{t("common.loading")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-control border border-line">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2.5 font-medium" scope="col">{t("apn.name")}</th>
                      <th className="px-3 py-2.5 font-medium" scope="col">{t("apn.apn")}</th>
                      <th className="px-3 py-2.5 font-medium" scope="col">{t("apn.username")}</th>
                      <th className="px-3 py-2.5 font-medium" scope="col">{t("apn.auth")}</th>
                      <th className="px-3 py-2.5 font-medium" scope="col">{t("apn.ipType")}</th>
                      <th className="px-3 py-2.5 font-medium" scope="col">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(apn.data ?? []).map((profile) => (
                      <tr className="border-t border-line" key={profile.index}>
                        <td className="px-3 py-3 font-medium text-ink">
                          {profile.name ?? t("common.dash")}
                          {profile.is_default ? <span className="chip ml-2 border-success/30 bg-success/10 text-success">{t("apn.default")}</span> : null}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">{profile.apn ?? t("common.dash")}</td>
                        <td className="px-3 py-3 text-xs">{profile.username ?? t("common.dash")}</td>
                        <td className="px-3 py-3 text-xs">{t(authModes.find((mode) => mode.value === profile.auth_mode)?.key ?? "common.unknown")}</td>
                        <td className="px-3 py-3 text-xs">{t(ipTypes.find((type) => type.value === profile.ip_type)?.key ?? "common.unknown")}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setForm({
                              index: profile.index,
                              name: profile.name ?? "",
                              apn: profile.apn ?? "",
                              username: profile.username ?? "",
                              password: "",
                              auth_mode: profile.auth_mode ?? 0,
                              ip_type: profile.ip_type ?? 2,
                              is_default: profile.is_default,
                            })} type="button">{t("common.edit")}</button>
                            {!profile.is_default ? (
                              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => void operation.start("apn.default", { index: profile.index })} type="button">{t("apn.setDefault")}</button>
                            ) : null}
                            <button className="btn btn-ghost px-2 py-1 text-xs text-danger" onClick={() => void operation.start("apn.delete", { index: profile.index })} type="button">{t("common.delete")}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form className="mt-5 rounded-control border border-line p-4" onSubmit={submitApn}>
              <h3 className="text-sm font-semibold text-ink">{form.index === null ? t("apn.createTitle") : t("apn.editTitle")}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="apn-name">{t("apn.name")}</label><input className="field" id="apn-name" onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></div>
                <div><label className="label" htmlFor="apn-value">{t("apn.apn")}</label><input className="field" id="apn-value" onChange={(event) => setForm({ ...form, apn: event.target.value })} required value={form.apn} /></div>
                <div><label className="label" htmlFor="apn-username">{t("apn.username")}</label><input className="field" id="apn-username" onChange={(event) => setForm({ ...form, username: event.target.value })} value={form.username} /></div>
                <div><label className="label" htmlFor="apn-password">{t("apn.password")}</label><input autoComplete="new-password" className="field" id="apn-password" onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={form.index === null ? "" : t("apn.passwordUnchanged")} type="password" value={form.password} /></div>
                <div><label className="label" htmlFor="apn-auth">{t("apn.auth")}</label><select className="field" id="apn-auth" onChange={(event) => setForm({ ...form, auth_mode: Number(event.target.value) })} value={form.auth_mode}>{authModes.map((mode) => <option key={mode.value} value={mode.value}>{t(mode.key)}</option>)}</select></div>
                <div><label className="label" htmlFor="apn-ip">{t("apn.ipType")}</label><select className="field" id="apn-ip" onChange={(event) => setForm({ ...form, ip_type: Number(event.target.value) })} value={form.ip_type}>{ipTypes.map((type) => <option key={type.value} value={type.value}>{t(type.key)}</option>)}</select></div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-ink"><input checked={form.is_default} className="h-4 w-4 accent-[rgb(var(--c-brand))]" onChange={(event) => setForm({ ...form, is_default: event.target.checked })} type="checkbox" />{t("apn.setDefault")}</label>
              <button className="btn btn-primary mt-3" disabled={operation.planning} type="submit"><Icon name="check" size={16} />{t("common.review")}</button>
            </form>
          </section>
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void reload()} />
    </div>
  );
}

function ToggleRow({ enabled, label, loading, onToggle }: { enabled: boolean | null; label: string; loading: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-elevated/40 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{enabled === null ? t("common.dash") : enabled ? t("common.on") : t("common.off")}</p>
      </div>
      <button className={`btn px-3 py-1.5 text-xs ${enabled ? "btn-danger" : "btn-primary"}`} disabled={loading} onClick={onToggle} type="button">
        {enabled ? t("common.disable") : t("common.enable")}
      </button>
    </div>
  );
}
