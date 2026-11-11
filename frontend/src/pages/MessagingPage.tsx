import { MessageSquare, Send } from "lucide-react";
import { useCallback, useState } from "react";
import type { FormEvent } from "react";

import { api } from "@/api/client";
import type { SmsPage, UssdState } from "@/api/types";
import { DataNotice, EmptyState, LoadingState } from "@/components/dashboard/data-state";
import { DisconnectedState } from "@/components/dashboard/disconnected-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ErrorBanner } from "@/components/error-banner";
import { OperationDialog } from "@/components/operation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDevice } from "@/hooks/useDevice";
import { useOperation } from "@/hooks/useOperation";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

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

  if (deviceLoading) return <LoadingState rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader description={t("messaging.subtitle")} title={t("messaging.title")} />
      {!connected ? (
        <DisconnectedState />
      ) : (
        <>
          <DataNotice>{t("messaging.notice")}</DataNotice>
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              actions={<Badge variant="outline">{t("messaging.smsCount", { count: sms.data?.messages.length ?? 0 })}</Badge>}
              title={<span className="flex items-center gap-2"><MessageSquare className="size-4 text-primary" />{t("messaging.smsTitle")}</span>}
            >
              {sms.error ? <div className="mb-3"><ErrorBanner error={sms.error} /></div> : null}
              {sms.loading && !sms.data ? (
                <LoadingState rows={2} />
              ) : sms.data?.messages.length ? (
                <ul className="max-h-[520px] divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {sms.data.messages.map((item) => (
                    <li className="p-3" key={item.index}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                          {item.phone ?? t("common.dash")}
                          {item.is_read === false ? <Badge variant="info">{t("messaging.unread")}</Badge> : null}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(item.received_at, language, t("common.dash"))}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{item.content}</p>
                      <div className="mt-2 flex gap-1">
                        {item.is_read === false ? (
                          <Button onClick={() => void operation.start("sms.mark_read", { index: item.index })} size="sm" variant="ghost">
                            {t("messaging.markRead")}
                          </Button>
                        ) : null}
                        <Button className="text-destructive hover:text-destructive" onClick={() => void operation.start("sms.delete", { index: item.index })} size="sm" variant="ghost">
                          {t("common.delete")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<MessageSquare className="size-6" />} title={t("messaging.smsEmpty")} />
              )}

              <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={sendSms}>
                <h3 className="text-xs font-semibold">{t("messaging.sendSmsTitle")}</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="sms-phone">{t("messaging.phone")}</Label>
                  <Input id="sms-phone" onChange={(event) => setPhone(event.target.value)} required value={phone} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sms-message">{t("messaging.message")}</Label>
                  <Textarea id="sms-message" maxLength={1600} onChange={(event) => setMessage(event.target.value)} required value={message} />
                </div>
                <Button disabled={operation.planning} size="sm" type="submit">
                  <Send className="size-3.5" />
                  {t("common.review")}
                </Button>
              </form>
            </SectionCard>

            <SectionCard title={<span className="flex items-center gap-2"><MessageSquare className="size-4 text-primary" />{t("messaging.ussdTitle")}</span>}>
              {ussd.error ? <div className="mb-3"><ErrorBanner error={ussd.error} /></div> : null}
              <dl className="rounded-md border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
                  <dt className="text-[11px] text-muted-foreground">{t("messaging.ussdStatus")}</dt>
                  <dd className="text-[11px] text-foreground">{ussd.data?.status ?? t("common.dash")}</dd>
                </div>
                <div className="px-3 py-2.5">
                  <dt className="text-[11px] text-muted-foreground">{t("messaging.ussdResponse")}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{ussd.data?.response ?? t("common.dash")}</dd>
                </div>
              </dl>
              <form className="mt-4 space-y-3" onSubmit={sendUssd}>
                <div className="space-y-1.5">
                  <Label htmlFor="ussd-code">{t("messaging.ussdCode")}</Label>
                  <Input className="font-mono" id="ussd-code" onChange={(event) => setUssdCode(event.target.value)} placeholder="*100#" required value={ussdCode} />
                </div>
                <DataNotice>{t("messaging.ussdWarning")}</DataNotice>
                <Button disabled={operation.planning} size="sm" type="submit">
                  <Send className="size-3.5" />
                  {t("common.review")}
                </Button>
              </form>
            </SectionCard>
          </div>
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void reload()} />
    </div>
  );
}
