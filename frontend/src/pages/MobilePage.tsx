import { Plus, RotateCw } from "lucide-react";
import { useCallback, useState } from "react";
import type { FormEvent } from "react";

import { api } from "@/api/client";
import type { ApnProfile, MobileSettings } from "@/api/types";
import { DataNotice, EmptyState, LoadingState } from "@/components/dashboard/data-state";
import { DisconnectedState } from "@/components/dashboard/disconnected-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ErrorBanner } from "@/components/error-banner";
import { OperationDialog } from "@/components/operation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDevice } from "@/hooks/useDevice";
import { useOperation } from "@/hooks/useOperation";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

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

function ApnActions({
  profile,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  profile: ApnProfile;
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-2 flex flex-wrap justify-end gap-1">
      <Button onClick={onEdit} size="sm" variant="ghost">{t("common.edit")}</Button>
      {!profile.is_default ? <Button onClick={onSetDefault} size="sm" variant="ghost">{t("apn.setDefault")}</Button> : null}
      <Button className="text-destructive hover:text-destructive" onClick={onDelete} size="sm" variant="ghost">{t("common.delete")}</Button>
    </div>
  );
}

function ToggleRow({ label, enabled, loading, onToggle }: { label: string; enabled: boolean | null; loading: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{enabled === null ? t("common.dash") : enabled ? t("common.on") : t("common.off")}</p>
      </div>
      <Button disabled={loading} onClick={onToggle} size="sm" variant={enabled ? "outline" : "default"}>
        {enabled ? t("common.disable") : t("common.enable")}
      </Button>
    </div>
  );
}

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

  if (deviceLoading) return <LoadingState rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader description={t("mobile.subtitle")} title={t("mobile.title")} />
      {!connected ? (
        <DisconnectedState />
      ) : (
        <>
          <DataNotice>{t("mobile.notice")}</DataNotice>
          {mobile.error ? <ErrorBanner error={mobile.error} /> : null}
          {mobile.loading && !mobile.data ? (
            <LoadingState rows={2} />
          ) : (
            <SectionCard title={t("mobile.connectionTitle")}>
              <div className="grid gap-2 sm:grid-cols-2">
                <ToggleRow
                  enabled={mobile.data?.data_enabled ?? null}
                  label={t("mobile.data")}
                  loading={operation.planning || operation.applying}
                  onToggle={() => void operation.start("mobile.data", { enabled: !mobile.data?.data_enabled })}
                />
                <ToggleRow
                  enabled={mobile.data?.roaming_enabled ?? null}
                  label={t("mobile.roaming")}
                  loading={operation.planning || operation.applying}
                  onToggle={() => void operation.start("mobile.roaming", { enabled: !mobile.data?.roaming_enabled })}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  disabled={operation.planning || operation.applying}
                  onClick={() => void operation.start("mobile.reconnect", {})}
                  size="sm"
                  variant="outline"
                >
                  <RotateCw className="size-3.5" />
                  {t("mobile.reconnect")}
                </Button>
                <p className="text-[10px] text-muted-foreground">{t("mobile.reconnectHint")}</p>
              </div>
            </SectionCard>
          )}

          <SectionCard
            actions={<Button onClick={() => setForm(emptyApn)} size="sm" variant="outline"><Plus className="size-3.5" />{t("apn.new")}</Button>}
            title={t("apn.title")}
          >
            {apn.error ? <div className="mb-3"><ErrorBanner error={apn.error} /></div> : null}
            {apn.loading && !apn.data ? (
              <LoadingState rows={2} />
            ) : (
              (apn.data ?? []).length === 0 ? (
                <EmptyState title={t("apn.empty")} />
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table className="min-w-[640px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("apn.name")}</TableHead>
                          <TableHead>{t("apn.apn")}</TableHead>
                          <TableHead>{t("apn.auth")}</TableHead>
                          <TableHead>{t("apn.ipType")}</TableHead>
                          <TableHead className="text-right">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(apn.data ?? []).map((profile) => (
                          <TableRow key={profile.index}>
                            <TableCell>
                              <span className="flex items-center gap-1.5 text-xs font-medium">
                                {profile.name ?? t("common.dash")}
                                {profile.is_default ? <Badge variant="success">{t("apn.default")}</Badge> : null}
                              </span>
                              <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{profile.username ?? t("common.dash")}</span>
                            </TableCell>
                            <TableCell className="font-mono text-[11px]">{profile.apn ?? t("common.dash")}</TableCell>
                            <TableCell className="text-[11px]">{t(authModes.find((mode) => mode.value === profile.auth_mode)?.key ?? "common.unknown")}</TableCell>
                            <TableCell className="text-[11px]">{t(ipTypes.find((type) => type.value === profile.ip_type)?.key ?? "common.unknown")}</TableCell>
                            <TableCell>
                              <ApnActions
                                onDelete={() => void operation.start("apn.delete", { index: profile.index })}
                                onEdit={() => setForm({
                                  index: profile.index,
                                  name: profile.name ?? "",
                                  apn: profile.apn ?? "",
                                  username: profile.username ?? "",
                                  password: "",
                                  auth_mode: profile.auth_mode ?? 0,
                                  ip_type: profile.ip_type ?? 2,
                                  is_default: profile.is_default,
                                })}
                                onSetDefault={() => void operation.start("apn.default", { index: profile.index })}
                                profile={profile}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <ul className="space-y-2 md:hidden">
                    {(apn.data ?? []).map((profile) => (
                      <li className="rounded-md border border-border p-3" key={profile.index}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                              {profile.name ?? t("common.dash")}
                              {profile.is_default ? <Badge variant="success">{t("apn.default")}</Badge> : null}
                            </p>
                            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{profile.apn ?? t("common.dash")}</p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                          <span>{t("apn.auth")}: {t(authModes.find((mode) => mode.value === profile.auth_mode)?.key ?? "common.unknown")}</span>
                          <span>{t("apn.ipType")}: {t(ipTypes.find((type) => type.value === profile.ip_type)?.key ?? "common.unknown")}</span>
                        </div>
                        <ApnActions
                          onDelete={() => void operation.start("apn.delete", { index: profile.index })}
                          onEdit={() => setForm({
                            index: profile.index,
                            name: profile.name ?? "",
                            apn: profile.apn ?? "",
                            username: profile.username ?? "",
                            password: "",
                            auth_mode: profile.auth_mode ?? 0,
                            ip_type: profile.ip_type ?? 2,
                            is_default: profile.is_default,
                          })}
                          onSetDefault={() => void operation.start("apn.default", { index: profile.index })}
                          profile={profile}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )
            )}
          </SectionCard>

          <SectionCard title={form.index === null ? t("apn.createTitle") : t("apn.editTitle")}>
            <form className="space-y-3" onSubmit={submitApn}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="apn-name">{t("apn.name")}</Label><Input id="apn-name" onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></div>
                <div className="space-y-1.5"><Label htmlFor="apn-value">{t("apn.apn")}</Label><Input id="apn-value" onChange={(event) => setForm({ ...form, apn: event.target.value })} required value={form.apn} /></div>
                <div className="space-y-1.5"><Label htmlFor="apn-username">{t("apn.username")}</Label><Input id="apn-username" onChange={(event) => setForm({ ...form, username: event.target.value })} value={form.username} /></div>
                <div className="space-y-1.5">
                  <Label htmlFor="apn-password">{t("apn.password")}</Label>
                  <Input autoComplete="new-password" id="apn-password" onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={form.index === null ? undefined : t("apn.passwordUnchanged")} type="password" value={form.password} />
                  {form.index !== null ? <p className="text-[10px] leading-4 text-muted-foreground">{t("apn.passwordUnchanged")}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("apn.auth")}</Label>
                  <Select onValueChange={(value) => setForm({ ...form, auth_mode: Number(value) })} value={String(form.auth_mode)}>
                    <SelectTrigger aria-label={t("apn.auth")}><SelectValue /></SelectTrigger>
                    <SelectContent>{authModes.map((mode) => <SelectItem key={mode.value} value={String(mode.value)}>{t(mode.key)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("apn.ipType")}</Label>
                  <Select onValueChange={(value) => setForm({ ...form, ip_type: Number(value) })} value={String(form.ip_type)}>
                    <SelectTrigger aria-label={t("apn.ipType")}><SelectValue /></SelectTrigger>
                    <SelectContent>{ipTypes.map((type) => <SelectItem key={type.value} value={String(type.value)}>{t(type.key)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs" htmlFor="apn-default">
                <Checkbox checked={form.is_default} id="apn-default" onCheckedChange={(checked) => setForm({ ...form, is_default: checked === true })} />
                {t("apn.setDefault")}
              </label>
              <Button disabled={operation.planning} type="submit">{t("common.review")}</Button>
            </form>
          </SectionCard>
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void reload()} />
    </div>
  );
}
