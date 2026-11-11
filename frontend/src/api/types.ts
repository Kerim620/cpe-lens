export type CapabilityStatus =
  | "available"
  | "experimental"
  | "unavailable"
  | "no_permission"
  | "unsupported"
  | "probe_failed";

export type CapabilityReason =
  | "ok"
  | "write_not_verified"
  | "no_safe_probe"
  | "no_support"
  | "login_required"
  | "no_permission"
  | "timeout"
  | "connection_error"
  | "device_busy"
  | "bad_response"
  | "condition_not_met"
  | "unknown";

export type CapabilityCategory =
  | "device"
  | "network"
  | "signal"
  | "traffic"
  | "clients"
  | "wifi"
  | "mobile"
  | "messaging"
  | "advanced"
  | "system";

export type CapabilityAccess = "read" | "write";

export interface CapabilityResult {
  id: string;
  category: CapabilityCategory;
  access: CapabilityAccess;
  status: CapabilityStatus;
  reason: CapabilityReason;
  checked_at: string;
  duration_ms: number | null;
  detail: string | null;
}

export interface CapabilityReport {
  probed_at: string;
  adapter: string;
  source: string;
  device_model: string | null;
  firmware_version: string | null;
  notice_key: string | null;
  capabilities: CapabilityResult[];
}

export interface DeviceInfo {
  model: string | null;
  hardware_version: string | null;
  firmware_version: string | null;
  web_ui_version: string | null;
  device_name: string | null;
  imei: string | null;
  operator: string | null;
  network_type: string | null;
  connection_status: string | null;
}

export interface ErrorInfo {
  code: string;
  message_key: string;
  detail: string | null;
  retryable: boolean;
}

export interface ConnectionSnapshot {
  connected: boolean;
  address: string | null;
  username: string | null;
  connected_at: string | null;
  last_seen_at: string | null;
  reconnect_count: number;
  last_error: ErrorInfo | null;
  device: DeviceInfo | null;
  capability_report: CapabilityReport | null;
}

export interface ConnectInput {
  address: string;
  username: string;
  password: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  sample_interval_seconds: number;
}

export interface AppSettings {
  sample_interval_seconds: number;
  monitor_interval_seconds: number;
  telemetry_section_timeout_seconds: number;
  history_raw_days: number;
  history_hourly_days: number;
}

export interface SettingsResponse {
  settings: AppSettings;
}

export const CAPABILITY_STATUSES: CapabilityStatus[] = [
  "available",
  "experimental",
  "unavailable",
  "no_permission",
  "unsupported",
  "probe_failed",
];

export const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  "device",
  "network",
  "signal",
  "traffic",
  "clients",
  "wifi",
  "mobile",
  "messaging",
  "advanced",
  "system",
];

export type SignalQuality = "excellent" | "good" | "fair" | "poor";
export type CellRadio = "lte" | "nr";
export type ClientConnectionType = "wifi" | "ethernet" | "unknown";

export interface RadioMetrics {
  rsrp_dbm: number | null;
  rsrq_db: number | null;
  rssi_dbm: number | null;
  sinr_db: number | null;
  band: string | null;
  pci: number | null;
  cell_id: string | null;
  arfcn: number | null;
  dl_bandwidth_mhz: number | null;
  ul_bandwidth_mhz: number | null;
  cqi: number | null;
  mcs: number | null;
  tx_power_dbm: number | null;
  rank: number | null;
  quality: SignalQuality | null;
}

export interface SignalSnapshot {
  lte: RadioMetrics | null;
  nr: RadioMetrics | null;
}

export interface CellEntry {
  radio: CellRadio;
  band: string | null;
  pci: number | null;
  cell_id: string | null;
  arfcn: number | null;
  dl_bandwidth_mhz: number | null;
  ul_bandwidth_mhz: number | null;
  source: string;
}

export interface CellSnapshot {
  cells: CellEntry[];
}

export interface ClientInfo {
  hostname: string | null;
  ip_address: string | null;
  mac: string | null;
  connection_type: ClientConnectionType;
  online_seconds: number | null;
}

export interface ClientSnapshot {
  clients: ClientInfo[];
  count: number;
}

export interface NetworkStatus {
  operator: string | null;
  network_type: string | null;
  roaming: boolean | null;
  signal_bars: number | null;
  wan_ip: string | null;
  connect_time_seconds: number | null;
  uptime_seconds: number | null;
}

export interface TrafficSnapshot {
  download_bps: number | null;
  upload_bps: number | null;
  session_download_bytes: number | null;
  session_upload_bytes: number | null;
  today_download_bytes: number | null;
  today_upload_bytes: number | null;
  month_download_bytes: number | null;
  month_upload_bytes: number | null;
  total_download_bytes: number | null;
  total_upload_bytes: number | null;
  current_connect_seconds: number | null;
  total_connect_seconds: number | null;
}

export interface LiveSection<T> {
  data: T | null;
  error: ErrorInfo | null;
  updated_at: string | null;
  stale: boolean;
}

export interface LiveDashboard {
  generated_at: string;
  connected: boolean;
  sampled_at: string | null;
  status: LiveSection<NetworkStatus>;
  signal: LiveSection<SignalSnapshot>;
  cells: LiveSection<CellSnapshot>;
  traffic: LiveSection<TrafficSnapshot>;
  clients: LiveSection<ClientSnapshot>;
}

export type HistoryRange = "15m" | "1h" | "6h" | "24h" | "7d";

export interface HistoryPoint {
  timestamp: string;
  lte_rsrp: number | null;
  lte_rsrq: number | null;
  lte_sinr: number | null;
  lte_rssi: number | null;
  nr_rsrp: number | null;
  nr_rsrq: number | null;
  nr_sinr: number | null;
  download_bps: number | null;
  upload_bps: number | null;
  download_bytes: number | null;
  upload_bytes: number | null;
}

export interface HistorySummary {
  current: Record<string, number | null>;
  average: Record<string, number | null>;
  minimum: Record<string, number | null>;
  maximum: Record<string, number | null>;
}

export interface HistoryResponse {
  range: HistoryRange;
  from_at: string;
  to_at: string;
  bucket_seconds: number;
  points: HistoryPoint[];
  summary: HistorySummary;
}

export interface WifiSettings {
  ssid: string | null;
  hidden: boolean | null;
  security_mode: string | null;
}

export interface ApnProfile {
  index: number;
  name: string | null;
  apn: string | null;
  username: string | null;
  auth_mode: number | null;
  ip_type: number | null;
  is_default: boolean;
  read_only: boolean;
}

export interface SmsMessage {
  index: number;
  phone: string | null;
  content: string;
  received_at: string | null;
  is_read: boolean | null;
}

export interface SmsPage {
  messages: SmsMessage[];
  page: number;
  read_count: number;
  has_more: boolean;
}

export interface NetworkModeOption {
  code: string;
  label: string | null;
  is_5g: boolean;
}

export interface MobileSettings {
  data_enabled: boolean | null;
  roaming_enabled: boolean | null;
  network_mode: string | null;
  lte_band_mask: string | null;
  lte_bands: number[];
  network_modes: NetworkModeOption[];
}

export interface DhcpSettings {
  enabled: boolean | null;
  ip_address: string | null;
  netmask: string | null;
  start_ip: string | null;
  end_ip: string | null;
  lease_seconds: number | null;
  dns_enabled: boolean | null;
  primary_dns: string | null;
  secondary_dns: string | null;
}

export interface FirewallSettings {
  enabled: boolean | null;
  ip_filter: boolean | null;
  wan_ping_filter: boolean | null;
  url_filter: boolean | null;
  mac_filter: boolean | null;
}

export interface AdvancedSettings {
  dhcp: DhcpSettings;
  upnp_enabled: boolean | null;
  dmz_enabled: boolean | null;
  dmz_ip: string | null;
  firewall: FirewallSettings;
}

export interface UssdState {
  status: string | null;
  response: string | null;
}

export type RiskLevel = "low" | "medium" | "high";
export type VerificationStatus = "not_attempted" | "verified" | "partial" | "unverifiable" | "failed";
export type OperationStatus = "success" | "failed" | "rejected" | "unsupported";

export interface OperationPlan {
  token: string;
  action: string;
  title_key: string;
  risk: RiskLevel;
  capability_ids: string[];
  current: Record<string, unknown>;
  proposed: Record<string, unknown>;
  warnings: string[];
  expires_at: string;
}

export interface OperationResult {
  operation_id: number | null;
  action: string;
  status: OperationStatus;
  verification: VerificationStatus;
  current: Record<string, unknown>;
  proposed: Record<string, unknown>;
  output: Record<string, unknown>;
  message_key: string;
  error: ErrorInfo | null;
}

export interface OperationLogEntry {
  id: number;
  created_at: string;
  action: string;
  title_key: string;
  risk: RiskLevel;
  status: OperationStatus;
  verification: VerificationStatus;
  capability_ids: string[];
  current: Record<string, unknown>;
  proposed: Record<string, unknown>;
  message_key: string;
  device_model: string | null;
}

export interface DiagnosticReport {
  generated_at: string;
  app_version: string;
  device: Record<string, unknown>;
  capabilities: Array<Record<string, unknown>>;
  live_errors: Record<string, ErrorInfo | null>;
  operations: OperationLogEntry[];
  settings: Record<string, unknown>;
}
