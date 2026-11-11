import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { api } from "@/api/client";
import type { AppSettings, SettingsResponse } from "@/api/types";
import { LoadingState } from "@/components/dashboard/data-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ErrorBanner } from "@/components/error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toUiError } from "@/hooks/useDevice";
import type { UiError } from "@/hooks/useDevice";
import { useResource } from "@/hooks/useResource";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

const fields: Array<{
  key: keyof AppSettings;
  label: TranslationKey;
  hint: TranslationKey;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "sample_interval_seconds", label: "settings.sampleInterval", hint: "settings.sampleIntervalHint", min: 0, max: 3600, step: 1 },
  { key: "monitor_interval_seconds", label: "settings.monitorInterval", hint: "settings.monitorIntervalHint", min: 0, max: 3600, step: 1 },
  { key: "telemetry_section_timeout_seconds", label: "settings.sectionTimeout", hint: "settings.sectionTimeoutHint", min: 1, max: 120, step: 1 },
  { key: "history_raw_days", label: "settings.rawRetention", hint: "settings.rawRetentionHint", min: 7, max: 365, step: 1 },
  { key: "history_hourly_days", label: "settings.hourlyRetention", hint: "settings.hourlyRetentionHint", min: 30, max: 3650, step: 1 },
];

export function SettingsPage() {
  const { t } = useI18n();
  const loadSettings = useCallback(() => api.getSettings(), []);
  const resource = useResource<SettingsResponse>(loadSettings, true);
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (resource.data) {
      setForm(resource.data.settings);
    }
  }, [resource.data]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await api.updateSettings(form);
      setForm(response.settings);
      setSaved(true);
      await resource.reload();
    } catch (requestError) {
      setError(toUiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await api.resetSettings();
      setForm(response.settings);
      setSaved(true);
      await resource.reload();
    } catch (requestError) {
      setError(toUiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (resource.loading && !resource.data) return <LoadingState rows={3} />;

  return (
    <div className="space-y-5">
      <PageHeader description={t("settings.subtitle")} title={t("settings.title")} />
      {resource.error ? <ErrorBanner error={resource.error} /> : null}
      {error ? <ErrorBanner error={error} /> : null}

      <SectionCard
        actions={saved ? <Badge variant="success">{t("settings.saved")}</Badge> : null}
        title={t("settings.runtimeTitle")}
      >
        {form ? (
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div className="space-y-1.5" key={field.key}>
                  <Label htmlFor={`settings-${field.key}`}>{t(field.label)}</Label>
                  <Input
                    id={`settings-${field.key}`}
                    max={field.max}
                    min={field.min}
                    onChange={(event) => {
                      setSaved(false);
                      setForm({ ...form, [field.key]: Number(event.target.value) });
                    }}
                    required
                    step={field.step}
                    type="number"
                    value={form[field.key]}
                  />
                  <p className="text-[10px] leading-4 text-muted-foreground">{t(field.hint)}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button disabled={saving} type="submit">{saving ? t("settings.saving") : t("settings.save")}</Button>
              <Button disabled={saving} onClick={() => void reset()} type="button" variant="outline">
                {t("settings.resetDefaults")}
              </Button>
            </div>
          </form>
        ) : null}
      </SectionCard>

    </div>
  );
}
