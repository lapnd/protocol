import type { Metadata } from "next";
import "../../explainers/protocol/styles/protocol.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Protocol Explorer · Learn how the internet works",
  description:
    "Watch the internet work, packet by packet. Interactive lessons on HTTP, HTTPS, TCP, UDP, IP, DNS, DHCP, ICMP, SMTP, POP3, IMAP, FTP, SSH and TLS, with every packet decoded byte by byte.",
  authors: [{ name: "Dilum Sanjaya" }],
  openGraph: {
    type: "website",
    siteName: "Protocol Explorer",
    title: "Protocol Explorer · Learn how the internet works",
    description:
      "Watch the internet work, packet by packet: interactive lessons from DNS and TCP to TLS, with every packet decoded byte by byte.",
    images: [
      {
        url: `${basePath}/og.png`,
        type: "image/png",
        width: 1200,
        height: 630,
        alt: "Protocol Explorer: a network diagram with a TLS Server Hello packet travelling from the internet to a laptop's router.",
      },
    ],
  },
  twitter: { card: "summary_large_image", creator: "@DilumSanjaya" },
};

export default function ProtocolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
