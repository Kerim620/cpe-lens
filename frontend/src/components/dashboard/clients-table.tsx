import type { ClientConnectionType, ClientInfo } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { formatDuration } from "@/lib/format";

const connectionKey: Record<ClientConnectionType, TranslationKey> = {
  wifi: "clients.connection.wifi",
  ethernet: "clients.connection.ethernet",
  unknown: "clients.connection.unknown",
};

export function ClientsTable({ clients, noResults }: { clients: ClientInfo[]; noResults: string }) {
  const { t, language } = useI18n();
  return (
    <Table className="min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead>{t("clients.name")}</TableHead>
          <TableHead>{t("clients.ip")}</TableHead>
          <TableHead>{t("clients.mac")}</TableHead>
          <TableHead>{t("clients.connection")}</TableHead>
          <TableHead className="text-right">{t("clients.onlineFor")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.length === 0 ? (
          <TableRow>
            <TableCell className="py-8 text-center text-xs text-muted-foreground" colSpan={5}>
              {noResults}
            </TableCell>
          </TableRow>
        ) : (
          clients.map((client, index) => (
            <TableRow key={`${client.mac ?? client.ip_address ?? "client"}-${index}`}>
              <TableCell className="text-xs font-medium text-foreground">{client.hostname ?? t("clients.unknownName")}</TableCell>
              <TableCell className="font-mono text-[11px]">{client.ip_address ?? t("common.dash")}</TableCell>
              <TableCell className="font-mono text-[11px] text-muted-foreground">{client.mac ?? t("common.dash")}</TableCell>
              <TableCell>
                <Badge variant="secondary">{t(connectionKey[client.connection_type])}</Badge>
              </TableCell>
              <TableCell className="tabular text-right text-xs text-muted-foreground">
                {formatDuration(client.online_seconds, language)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
