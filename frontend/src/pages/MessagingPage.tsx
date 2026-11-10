import { useCallback, useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import type { SmsPage, UssdState } from "../api/types";
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
import { formatDateTime } from "../lib/format";

export function MessagingPage() {
  const { t, language } = useI18n();
  const { snapshot, loading: deviceLoading } = useDevice();
  const connected = snapshot?.connected ?? false;
  const loadSms = useCallback(() => api.sms(1, 20), []);
  const loadUssd = useCallback(() => api.ussd(), []);
  const sms = useResource<SmsPage>(loadSms, connected, 20_000);
  const ussd = useResource<UssdState>(loadUssd, connected, 20_000);
  const reload = useCallback(async () => {
    await Promise.all([sms.reload(), ussd.reload()]);
  }, [sms, ussd]);
  const operation = useOperation(() => void reload());
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [ussdCode, setUssdCode] = useState("");

  const sendSms = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void operation.start("sms.send", { phone, message });
  };
  const sendUssd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void operation.start("ussd.send", { code: ussdCode });
  };

  if (deviceLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle={t("messaging.subtitle")} title={t("messaging.title")} />
      {!connected ? (
        <DisconnectedPanel />
      ) : (
        <>
          <Notice variant="info" icon="info">{t("messaging.notice")}</Notice>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="card p-5" aria-labelledby="sms-list">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base" id="sms-list"><Icon name="message" size={18} />{t("messaging.smsTitle")}</h2>
                <span className="chip border-line bg-elevated text-muted">{t("messaging.smsCount", { count: sms.data?.messages.length ?? 0 })}</span>
              </div>
              {sms.error ? <div className="mt-3"><ErrorBanner error={sms.error} /></div> : null}
              {sms.loading && !sms.data ? (
                <p className="mt-4 text-sm text-muted">{t("common.loading")}</p>
              ) : sms.data?.messages.length ? (
                <ul className="mt-3 space-y-2">
                  {sms.data.messages.map((item) => (
                    <li className="rounded-control border border-line bg-elevated/40 p-3" key={item.index}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                        <span className="font-mono">{item.phone_masked ?? t("common.dash")}</span>
                        <span>{formatDateTime(item.received_at, language, t("common.dash"))}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{item.content}</p>
                      <div className="mt-2 flex gap-2">
                        <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => void operation.start("sms.mark_read", { index: item.index })} type="button">{t("messaging.markRead")}</button>
                        <button className="btn btn-ghost px-2 py-1 text-xs text-danger" onClick={() => void operation.start("sms.delete", { index: item.index })} type="button">{t("common.delete")}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">{t("messaging.smsEmpty")}</p>
              )}

              <form className="mt-5 space-y-3 border-t border-line pt-4" onSubmit={sendSms}>
                <h3 className="text-sm font-semibold text-ink">{t("messaging.sendSmsTitle")}</h3>
                <div><label className="label" htmlFor="sms-phone">{t("messaging.phone")}</label><input className="field" id="sms-phone" onChange={(event) => setPhone(event.target.value)} required value={phone} /></div>
                <div><label className="label" htmlFor="sms-message">{t("messaging.message")}</label><textarea className="field min-h-24" id="sms-message" maxLength={1600} onChange={(event) => setMessage(event.target.value)} required value={message} /></div>
                <button className="btn btn-primary" disabled={operation.planning} type="submit"><Icon name="message" size={16} />{t("common.review")}</button>
              </form>
            </section>

            <section className="card p-5" aria-labelledby="ussd-panel">
              <h2 className="flex items-center gap-2 text-base" id="ussd-panel"><Icon name="message" size={18} />{t("messaging.ussdTitle")}</h2>
              {ussd.error ? <div className="mt-3"><ErrorBanner error={ussd.error} /></div> : null}
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-b border-line py-2"><dt className="text-muted">{t("messaging.ussdStatus")}</dt><dd>{ussd.data?.status ?? t("common.dash")}</dd></div>
                <div className="border-b border-line py-2"><dt className="text-muted">{t("messaging.ussdResponse")}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{ussd.data?.response ?? t("common.dash")}</dd></div>
              </dl>
              <form className="mt-4 space-y-3" onSubmit={sendUssd}>
                <div><label className="label" htmlFor="ussd-code">{t("messaging.ussdCode")}</label><input className="field font-mono" id="ussd-code" onChange={(event) => setUssdCode(event.target.value)} placeholder="*100#" required value={ussdCode} /></div>
                <Notice variant="warning" icon="alert">{t("messaging.ussdWarning")}</Notice>
                <button className="btn btn-primary" disabled={operation.planning} type="submit"><Icon name="message" size={16} />{t("common.review")}</button>
              </form>
            </section>
          </div>
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void reload()} />
    </div>
  );
}
