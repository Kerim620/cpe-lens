export type IconName =
  | "overview"
  | "device"
  | "signal"
  | "traffic"
  | "clients"
  | "wifi"
  | "mobile"
  | "message"
  | "lock"
  | "advanced"
  | "diagnostics"
  | "settings"
  | "sun"
  | "moon"
  | "monitor"
  | "refresh"
  | "check"
  | "flask"
  | "clock"
  | "forbidden"
  | "xcircle"
  | "minus"
  | "alert"
  | "plug"
  | "shield"
  | "arrowRight"
  | "menu"
  | "close"
  | "network"
  | "info"
  | "search";

const paths: Record<IconName, string> = {
  overview: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  device: "M4 5h16v11H4zM9 20h6M12 16v4",
  signal: "M4 20V10M9 20V6M14 20V13M19 20V3",
  traffic: "M4 19V9M10 19V5M16 19v-7M22 19H2",
  clients: "M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M17 11a3 3 0 100-6M16 14a5 5 0 016 4.5",
  wifi: "M2 8a15 15 0 0120 0M5.5 11.5a10 10 0 0113 0M9 15a5 5 0 016 0M12 19h.01",
  mobile: "M7 2h10v20H7zM11 18h2",
  message: "M4 4h16v12H8l-4 4z",
  lock: "M6 10V7a6 6 0 0112 0v3M5 10h14v11H5z",
  advanced: "M4 6h16M4 12h16M4 18h16M9 3v6M15 9v6M7 15v6",
  diagnostics: "M3 12h4l2 6 4-12 2 6h6",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 00-1.9-.2 1.7 1.7 0 00-1 1.6V22h-4v-.3a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.2l-.2.1-2-3.4.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2v-4h.6a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 001.9.2 1.7 1.7 0 001-1.6V2h4v.3a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.2l.2-.1 2 3.4-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.6v4h-.6a1.7 1.7 0 00-1.5 1z",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  refresh: "M20 12a8 8 0 11-2.3-5.7M20 4v5h-5",
  check: "M20 6L9 17l-5-5",
  flask: "M9 3h6M10 3v6L5 18a2 2 0 002 2h10a2 2 0 002-2l-5-9V3M7.5 14h9",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  forbidden: "M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8",
  xcircle: "M12 21a9 9 0 100-18 9 9 0 000 18zM15 9l-6 6M9 9l6 6",
  minus: "M5 12h14",
  alert: "M12 3L2 21h20zM12 9v5M12 18h.01",
  plug: "M9 2v6M15 2v6M6 8h12v4a6 6 0 01-12 0zM12 18v4",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  network: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9z",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7h.01",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
    >
      <path d={paths[name]} />
    </svg>
  );
}
