import { ArrowRight, LockKeyhole, RadioTower } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { api } from "@/api/client";
import type { MobileSettings, NetworkModeOption } from "@/api/types";
import { DataNotice, LoadingState } from "@/components/dashboard/data-state";
import { DisconnectedState } from "@/components/dashboard/disconnected-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ErrorBanner } from "@/components/error-banner";
import { OperationDialog } from "@/components/operation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDevice } from "@/hooks/useDevice";
import { useOperation } from "@/hooks/useOperation";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

const baseModes: Array<{ value: string; key: TranslationKey }> = [
  { value: "00", key: "radio.mode.auto" },
  { value: "03", key: "radio.mode.lte" },
  { value: "02", key: "radio.mode.3g" },
  { value: "01", key: "radio.mode.2g" },
  { value: "0302", key: "radio.mode.lte3g" },
  { value: "0301", key: "radio.mode.lte2g" },
  { value: "0201", key: "radio.mode.3g2g" },
];

function modeLabel(option: NetworkModeOption): string {
  return option.label?.trim() || option.code;
}

function CapabilityLine({ id }: { id: string }) {
  const { t } = useI18n();
  const { snapshot } = useDevice();
  const capability = snapshot?.capability_report?.capabilities.find((item) => item.id === id);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
      <span>{t(`capability.name.${id}` as TranslationKey)}</span>
      {capability ? <StatusBadge status={capability.status} /> : <span className="text-muted-foreground">{t("common.dash")}</span>}
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

  const modes = [
    ...baseModes,
    ...(mobile.data?.network_modes ?? [])
      .filter((option) => !baseModes.some((base) => base.value === option.code))
      .map((option) => ({
        value: option.code,
        label: modeLabel(option),
        is5g: option.is_5g,
      })),
  ];

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

  if (deviceLoading) return <LoadingState rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader description={t("locks.subtitle")} title={t("locks.title")} />
      {!connected ? (
        <DisconnectedState />
      ) : (
        <>
          <DataNotice>{t("locks.warning")}</DataNotice>
          {mobile.error ? <ErrorBanner error={mobile.error} /> : null}
          {mobile.loading && !mobile.data ? (
            <LoadingState rows={2} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title={<span className="flex items-center gap-2"><RadioTower className="size-4 text-primary" />{t("locks.radioTitle")}</span>}>
                <div className="mb-4 space-y-1.5">
                  <CapabilityLine id="network_mode" />
                  <CapabilityLine id="band_lock" />
                </div>
                <form className="space-y-4" onSubmit={submit}>
                  <div className="space-y-1.5">
                    <Label>{t("locks.networkMode")}</Label>
                    <Select onValueChange={setMode} value={mode}>
                      <SelectTrigger aria-label={t("locks.networkMode")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {modes.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {"key" in item ? t(item.key as TranslationKey) : item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="radio-bands">{t("locks.lteBands")}</Label>
                    <Input id="radio-bands" onChange={(event) => setBands(event.target.value)} placeholder={t("locks.bandsPlaceholder")} value={bands} />
                    <p className="text-[10px] leading-4 text-muted-foreground">{t("locks.bandsHint")}</p>
                  </div>
                  <DataNotice>{t("locks.radioWarning")}</DataNotice>
                  <Button disabled={operation.planning} type="submit">{t("locks.reviewChange")}</Button>
                </form>
              </SectionCard>

              <SectionCard title={<span className="flex items-center gap-2"><LockKeyhole className="size-4 text-primary" />{t("locks.readOnlyTitle")}</span>}>
                <p className="text-xs leading-5 text-muted-foreground">{t("locks.readOnlyBody")}</p>
                <div className="mt-3"><CapabilityLine id="cell_lock" /></div>
                <Button asChild className="mt-4" size="sm" variant="outline">
                  <Link to="/signal">{t("locks.viewCells")}<ArrowRight className="size-3.5" /></Link>
                </Button>
              </SectionCard>
            </div>
          )}
        </>
      )}
      <OperationDialog controller={operation} onClose={() => void mobile.reload()} />
    </div>
  );
}
