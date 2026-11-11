import { KeyRound, PlugZap, Router, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { ConnectInput } from "@/api/types";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { UiError } from "@/hooks/useDevice";
import { useI18n } from "@/i18n/I18nProvider";
import { clearRememberedCredentials, loadRememberedCredentials, saveRememberedCredentials } from "@/lib/credentials";

export function ConnectionPanel({
  onConnect,
  connecting,
  error,
}: {
  onConnect: (input: ConnectInput) => Promise<boolean>;
  connecting: boolean;
  error: UiError | null;
}) {
  const { t } = useI18n();
  const [address, setAddress] = useState("http://192.168.8.1");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const saved = loadRememberedCredentials();
    if (saved) {
      setAddress(saved.address);
      setUsername(saved.username);
      setPassword(saved.password);
      setRemember(true);
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = { address: address.trim(), username: username.trim(), password };
    const connected = await onConnect(values);
    if (!connected) return;
    if (remember) {
      saveRememberedCredentials(values);
    } else {
      clearRememberedCredentials();
    }
  };

  return (
    <Card className="mx-auto w-full max-w-2xl p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <PlugZap className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{t("connection.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("connection.description")}</p>
        </div>
      </div>

      <form autoComplete="off" className="mt-6 space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="cpe-address">{t("connection.address")}</Label>
          <div className="relative">
            <Router className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoComplete="url"
              className="pl-9"
              id="cpe-address"
              inputMode="url"
              onChange={(event) => setAddress(event.target.value)}
              placeholder={t("connection.addressPlaceholder")}
              required
              spellCheck={false}
              value={address}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cpe-username">{t("connection.username")}</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoComplete="username"
                className="pl-9"
                id="cpe-username"
                onChange={(event) => setUsername(event.target.value)}
                required
                spellCheck={false}
                value={username}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpe-password">{t("connection.password")}</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoComplete="off"
                className="pl-9 pr-16"
                id="cpe-password"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? t("common.hide") : t("common.show")}
              </button>
            </div>
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          {t("connection.passwordHint")}
        </p>

        <div className="space-y-1.5 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <label className="flex items-start gap-2 text-[11px] leading-5" htmlFor="cpe-remember">
            <Checkbox
              checked={remember}
              id="cpe-remember"
              onCheckedChange={(checked) => {
                const next = checked === true;
                setRemember(next);
                if (!next) clearRememberedCredentials();
              }}
            />
            <span>{t("connection.remember")}</span>
          </label>
          <p className="pl-6 text-[10px] leading-4 text-muted-foreground">{t("connection.rememberWarning")}</p>
        </div>

        {error ? <ErrorBanner error={error} title={t("connection.errorTitle")} /> : null}

        <Button className="w-full sm:w-auto" disabled={connecting} type="submit">
          <PlugZap className="size-4" />
          {connecting ? t("connection.connecting") : t("connection.connect")}
        </Button>
      </form>

      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
        {t("connection.secureNote")}
      </p>
    </Card>
  );
}
