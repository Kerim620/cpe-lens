import { useCallback } from "react";

import { api } from "../api/client";
import type { DiagnosticReport, HealthResponse } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/Icon";
import { InfoRow } from "../components/InfoRow";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { useResource } from "../hooks/useResource";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";

export function SettingsPage() {
  const { t } = useI18n();
  const loadHealth = useCallback(() => api.health(), []);
  const loadReport = useCallback(() => api.diagnosticReport(), []);
  const health = useResource<HealthResponse>(loadHealth, true);
  const report = useResource<DiagnosticReport>(loadReport, true);

  if (health.loading && !health.data) {
    return <LoadingState />;
  }
  const settings = (report.data?.settings ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <PageHeader subtitle={t("settings.subtitle")} title={t("settings.title")} />
      {health.error ? <ErrorBanner error={health.error} /> : null}
      {report.error ? <ErrorBanner error={report.error} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="settings-about">
          <h2 className="flex items-center gap-2 text-base" id="settings-about"><Icon name="settings" size={18} />{t("settings.aboutTitle")}</h2>
          <dl className="mt-2">
            <InfoRow label={t("diagnostics.version")} value={health.data?.version ?? t("common.dash")} />
            <InfoRow label={t("settings.license")} value="MIT" />
            <InfoRow label={t("settings.backend")} value="FastAPI · huawei-lte-api" />
            <InfoRow label={t("settings.network")} value={t("app.localOnly")} />
          </dl>
          <div className="mt-3 space-y-2">
            <Notice variant="success" icon="shield">{t("settings.securityNote")}</Notice>
          </div>
        </section>

        <section className="card p-5" aria-labelledby="settings-data">
          <h2 className="flex items-center gap-2 text-base" id="settings-data"><Icon name="traffic" size={18} />{t("settings.dataTitle")}</h2>
          <dl className="mt-2">
            {Object.entries(settings).map(([key, value]) => (
              <InfoRow key={key} label={t(`diagnostics.setting.${key}` as TranslationKey)} value={String(value)} />
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted">{t("settings.dataNote")}</p>
        </section>

        <section className="card p-5 lg:col-span-2" aria-labelledby="settings-appearance">
          <h2 className="flex items-center gap-2 text-base" id="settings-appearance"><Icon name="sun" size={18} />{t("settings.appearanceTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("settings.appearanceBody")}</p>
        </section>
      </div>
    </div>
  );
}
