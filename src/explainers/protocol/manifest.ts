import type { CatalogEntry } from "../../kit/catalog";

/**
 * Protocol Explorer is a "custom system": it keeps its own engine (isometric
 * network, packet dissector, 14 locales) and only plugs into the template
 * through this catalog entry and the /protocol route.
 */
export const protocolCatalogEntry: CatalogEntry = {
  kind: "custom",
  href: "/protocol/",
  lessonCount: 14,
  stepCount: 0,
  meta: {
    id: "protocol",
    icon: "🌐",
    accent: "blue",
    status: "stable",
    category: { vi: "Mạng máy tính", en: "Networking" },
    tags: ["networking", "tcp", "http", "tls"],
    locales: ["en", "es", "pt", "fr", "de", "tr", "id", "ja", "zh", "zh-TW", "ko", "hi", "ar", "he"],
    title: "Protocol Explorer",
    tagline: { vi: "Internet hoạt động thế nào, từng gói tin", en: "How the internet works, packet by packet" },
    description: {
      vi: "Xem gói tin di chuyển qua mạng: HTTP, HTTPS, TCP, UDP, IP, DNS, DHCP, ICMP, SMTP, POP3, IMAP, FTP, SSH và TLS, giải mã từng byte.",
      en: "Watch packets cross the network: HTTP, HTTPS, TCP, UDP, IP, DNS, DHCP, ICMP, SMTP, POP3, IMAP, FTP, SSH and TLS, decoded byte by byte.",
    },
    author: "Dilum Sanjaya",
  },
};
