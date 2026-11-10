import { useState } from "react";
import type { FormEvent } from "react";

import type { ConnectInput } from "../api/types";
import type { UiError } from "../hooks/useDevice";
import { useI18n } from "../i18n/I18nProvider";
import { ErrorBanner } from "./ErrorBanner";
import { Icon } from "./Icon";

interface ConnectionPanelProps {
  onConnect: (input: ConnectInput) => Promise<boolean>;
  connecting: boolean;
  error: UiError | null;
}

export function ConnectionPanel({ onConnect, connecting, error }: ConnectionPanelProps) {
  const { t } = useI18n();
  const [address, setAddress] = useState("http://192.168.8.1");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onConnect({ address: address.trim(), username: username.trim(), password });
  };

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="connection-title">
      <div className="flex items-start gap-3">
        <span className="rounded-control bg-brand-soft p-2 text-brand-strong">
          <Icon name="plug" size={20} />
        </span>
        <div>
          <h2 className="text-lg" id="connection-title">
            {t("connection.title")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">{t("connection.description")}</p>
        </div>
      </div>

      <form autoComplete="off" className="mt-5 space-y-4" onSubmit={submit}>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cpe-address">
              {t("connection.address")}
            </label>
            <input
              autoComplete="url"
              className="field"
              id="cpe-address"
              inputMode="url"
              onChange={(event) => setAddress(event.target.value)}
              placeholder={t("connection.addressPlaceholder")}
              required
              spellCheck={false}
              type="text"
              value={address}
            />
          </div>
          <div>
            <label className="label" htmlFor="cpe-username">
              {t("connection.username")}
            </label>
            <input
              autoComplete="username"
              className="field"
              id="cpe-username"
              onChange={(event) => setUsername(event.target.value)}
              required
              spellCheck={false}
              type="text"
              value={username}
            />
          </div>
          <div>
            <label className="label" htmlFor="cpe-password">
              {t("connection.password")}
            </label>
            <input
              autoComplete="off"
              className="field"
              id="cpe-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>
        </div>

        <p className="text-xs leading-5 text-muted">{t("connection.passwordHint")}</p>

        {error ? <ErrorBanner error={error} title={t("connection.errorTitle")} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary min-w-32" disabled={connecting} type="submit">
            {connecting ? <Icon className="animate-spin" name="refresh" size={16} /> : <Icon name="plug" size={16} />}
            {connecting ? t("connection.connecting") : t("connection.connect")}
          </button>
          <p className="text-xs leading-5 text-muted">{t("connection.secureNote")}</p>
        </div>
      </form>
    </section>
  );
}
