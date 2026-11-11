import { AlertTriangle, CheckCircle2, CircleAlert, LoaderCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import type { OperationController } from "@/hooks/useOperation";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { isTranslationKey } from "@/i18n/translations";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function fieldLabel(key: string): string {
  const translationKey = `field.${key}`;
  return isTranslationKey(translationKey) ? translationKey : key.replaceAll("_", " ");
}

function ValueTable({ values, emptyLabel }: { values: Record<string, unknown>; emptyLabel: string }) {
  const { t } = useI18n();
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <dl className="divide-y divide-border rounded-md border border-border">
      {entries.map(([key, value]) => (
        <div className="flex items-start justify-between gap-3 px-3 py-2" key={key}>
          <dt className="text-[11px] text-muted-foreground">
            {isTranslationKey(fieldLabel(key)) ? t(fieldLabel(key) as TranslationKey) : fieldLabel(key)}
          </dt>
          <dd className="max-w-[60%] break-words text-right font-mono text-[11px] text-foreground">
            {formatValue(value, t)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(value: unknown, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
  if (value === null || value === undefined || value === "") return t("common.dash");
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (Array.isArray(value)) {
    if (value.length === 0) return t("common.dash");
    return value.every((item) => typeof item === "string" || typeof item === "number")
      ? value.join(", ")
      : t("operation.itemCount", { count: value.length });
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const riskStyles = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-warning/30 bg-warning/10 text-warning",
  high: "border-destructive/30 bg-destructive/10 text-destructive",
} as const;

export function OperationDialog({ controller, onClose }: { controller: OperationController; onClose: () => void }) {
  const { t } = useI18n();
  const [understood, setUnderstood] = useState(false);
  const open = Boolean(controller.planning || controller.plan || controller.result || controller.error);

  useEffect(() => {
    setUnderstood(false);
  }, [controller.plan?.token]);

  const close = () => {
    if (controller.applying) return;
    controller.reset();
    onClose();
  };

  const result = controller.result;
  const plan = controller.plan;
  const risk = plan?.risk ?? "low";

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close();
      }}
      open={open}
    >
      <DialogContent className="max-w-2xl" closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{plan ? t(plan.title_key as TranslationKey) : result ? t("operation.resultTitle") : t("operation.confirmTitle")}</DialogTitle>
          <DialogDescription>
            {plan
              ? t("operation.confirmDescription")
              : result
                ? t("operation.resultDescription")
                : t("operation.planning")}
          </DialogDescription>
        </DialogHeader>

        {controller.error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">{t(controller.error.messageKey)}</p>
              {controller.error.detail ? <p className="text-muted-foreground">{controller.error.detail}</p> : null}
            </div>
          </div>
        ) : null}

        {controller.planning && !plan ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {t("operation.planning")}
          </div>
        ) : null}

        {plan ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border", riskStyles[risk])}>
                <AlertTriangle className="size-3" />
                {t(`risk.${risk}` as TranslationKey)}
              </Badge>
              {plan.capability_ids.map((id) => (
                <Badge key={id} variant="outline">
                  {t(`capability.name.${id}` as TranslationKey)}
                </Badge>
              ))}
            </div>

            {plan.warnings.map((warning) => (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs leading-5" key={warning}>
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span>{isTranslationKey(warning) ? t(warning as TranslationKey) : warning}</span>
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{t("operation.current")}</p>
                <ValueTable emptyLabel={t("common.dash")} values={plan.current} />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{t("operation.proposed")}</p>
                <ValueTable emptyLabel={t("common.dash")} values={plan.proposed} />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2.5">
              <Checkbox
                checked={understood}
                id="operation-acknowledge"
                onCheckedChange={(checked) => setUnderstood(checked === true)}
              />
              <Label className="leading-5" htmlFor="operation-acknowledge">
                {t("operation.acknowledge")}
              </Label>
            </div>

            <DialogFooter>
              <Button disabled={controller.applying} onClick={close} variant="outline">
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!understood || controller.applying}
                onClick={() => void controller.confirm()}
                variant={risk === "high" ? "destructive" : "default"}
              >
                {controller.applying ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {controller.applying ? t("operation.applying") : t("operation.confirm")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-4">
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
                result.status === "success" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
              )}
            >
              {result.status === "success" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <div>
                <p className="font-medium text-foreground">
                  {isTranslationKey(result.message_key) ? t(result.message_key) : t("operation.resultTitle")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("operation.verificationLabel")}: {t(`verification.${result.verification}` as TranslationKey)}
                </p>
                {result.error?.detail ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{result.error.detail}</p> : null}
              </div>
            </div>
            {Object.keys(result.output).length > 0 ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{t("operation.output")}</p>
                <ValueTable emptyLabel={t("common.dash")} values={result.output} />
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={close}>{t("common.close")}</Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
