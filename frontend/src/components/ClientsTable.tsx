import type { ClientConnectionType, ClientInfo } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { formatDuration } from "../lib/format";

const connectionKey: Record<ClientConnectionType, TranslationKey> = {
  wifi: "clients.connection.wifi",
  ethernet: "clients.connection.ethernet",
  unknown: "clients.connection.unknown",
};

export function ClientsTable({ clients, noResults }: { clients: ClientInfo[]; noResults: string }) {
  const { t, language } = useI18n();
  if (clients.length === 0) {
    return <p className="rounded-control border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{noResults}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-control border border-line">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">{t("clients.title")}</caption>
        <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("clients.name")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("clients.ip")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("clients.mac")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("clients.connection")}</th>
            <th className="px-3 py-2.5 font-medium" scope="col">{t("clients.onlineFor")}</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, index) => (
            <tr className="border-t border-line" key={`${client.mac_masked ?? client.ip_address ?? "client"}-${index}`}>
              <td className="px-3 py-3 font-medium text-ink">{client.hostname ?? t("clients.unknownName")}</td>
              <td className="tabular px-3 py-3 font-mono text-xs">{client.ip_address ?? t("common.dash")}</td>
              <td className="px-3 py-3 font-mono text-xs">{client.mac_masked ?? t("common.dash")}</td>
              <td className="px-3 py-3">
                <span className="chip border-line bg-elevated text-muted">{t(connectionKey[client.connection_type])}</span>
              </td>
              <td className="tabular px-3 py-3 text-xs text-muted">{formatDuration(client.online_seconds, language)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
