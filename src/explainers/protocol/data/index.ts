// @ts-nocheck
import type { Lesson, ProtocolId, ProtocolMeta } from "../types/protocol";

const CLIENT_IP = "192.168.1.10";

const ROUTER_IP = "192.168.1.1";

const ROUTER_WAN_IP = "198.51.100.7";

const ETH_HEADER_SIZE = 14;

const IPV4_HEADER_SIZE = 20;

const TCP_HEADER_SIZE = 20;

const TLS_RECORD_OVERHEAD = 22;

const TCP_MSS = 1460;

const formatSeconds = (e) => `${e.toFixed(3)}s`;

const ethernetFrameBytes = (e) =>
  Math.max(60, ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE + e);

const tlsEthernetFrameBytes = (e) =>
  ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE + TLS_RECORD_OVERHEAD + e;

const crlfByteLength = (...e) => e.reduce((t, s) => t + s.length + 2, 0);

const formatByteSize = (e) => (e >= 1024 ? `${(e / 1024).toFixed(1)} KB` : `${e} B`);

const countMssSegments = (e) => Math.ceil(e / TCP_MSS);

const formatSegmentOrByteSize = (e, t = 1) => (t > 1 ? formatByteSize(e) : `${e} B`);

const packetEvent = (e, t, s, a, n, o, r = {}) => ({
  type: "packet",
  from: e,
  to: t,
  color: s,
  label: a,
  payload: n,
  row: o,
  ...r,
});

function createEndpointPair(e, t, s, a) {
  return { a: e, b: s, ports: (n) => (n === e ? { sport: t, dport: a } : { sport: a, dport: t }) };
}

const tcpWire = (e, t, s, a, n = {}) => ({ tcp: { ...e.ports(t), flags: s, data: a, ...n } });

const TCP_TS_OPTION_SIZE = 12;

function buildTcpHandshake({
  from: e = "client",
  to: t = "web",
  src: s = CLIENT_IP,
  dst: a,
  sport: n,
  dport: o,
  t: r,
  quick: i = !0,
  linux: l = !1,
}) {
  const c = (w, k, g, T, v, I) => ({
      time: formatSeconds(w),
      src: k,
      dst: g,
      proto: "TCP",
      info: T,
      len: `${v} B`,
      wire: I,
    }),
    h = (w) => (i ? [] : w),
    d = createEndpointPair(s, n, a, o),
    y = l ? TCP_TS_OPTION_SIZE : 0;
  return [
    packetEvent(
      e,
      t,
      "green",
      "SYN",
      h(["seq=0"]),
      c(r[0], s, a, `${n} → ${o} [SYN] Seq=0`, l ? 74 : 66, tcpWire(d, s, "S")),
      { quick: i },
    ),
    packetEvent(
      t,
      e,
      "green",
      "SYN-ACK",
      h(["seq=0 ack=1"]),
      c(r[1], a, s, `${o} → ${n} [SYN, ACK] Seq=0 Ack=1`, l ? 74 : 66, tcpWire(d, a, "SA")),
      { quick: i },
    ),
    packetEvent(
      e,
      t,
      "green",
      "ACK",
      h(["seq=1 ack=1"]),
      c(r[2], s, a, `${n} → ${o} [ACK] Seq=1 Ack=1`, ethernetFrameBytes(y), tcpWire(d, s, "A")),
      { quick: i },
    ),
  ];
}

const SERVER_HELLO_TLS_LEN = 2862;

const buildClientHelloTls = (e) => ({
  tls: [
    {
      type: "handshake",
      legacy: !0,
      length: 512,
      hello: {
        type: 1,
        name: "Client Hello",
        note: "What this client supports. Its exact contents vary from client to client; this is an example.",
        fields: [
          ["Server name (SNI)", e],
          ["Versions offered", "TLS 1.3, TLS 1.2"],
          ["Key share", "X25519"],
          ["Padding", "up to 512 bytes"],
        ],
      },
    },
  ],
});

const buildServerHelloTls = (e = "X25519", t = 122) => ({
  tls: [
    {
      type: "handshake",
      length: t,
      hello: {
        type: 2,
        name: "Server Hello",
        note: "The server’s choices and its key share.",
        fields: [
          ["Version", "TLS 1.3"],
          ["Cipher suite", "TLS_AES_128_GCM_SHA256"],
          ["Key share", e],
        ],
      },
    },
    { type: "ccs", length: 1 },
    {
      type: "appdata",
      length: 2724,
      inner: {
        what: "Encrypted Extensions, Certificate (the chain), Certificate Verify (the signature), Finished",
      },
    },
  ],
});

const CLIENT_FINISHED_TLS = {
  tls: [
    { type: "ccs", length: 1 },
    {
      type: "appdata",
      length: 53,
      inner: { what: "Finished: a check value over the whole handshake" },
    },
  ],
};

const buildTlsAppDataText = (e, t) => ({
  tls: [{ type: "appdata", length: crlfByteLength(...e) + 17, inner: { what: t, text: e } }],
});

const buildTlsAppDataOpaque = (e, t) => ({
  tls: [{ type: "appdata", length: e + 17, inner: { what: t } }],
});

function buildTlsHandshake({
  from: e = "client",
  to: t = "web",
  src: s = CLIENT_IP,
  dst: a,
  sni: n,
  sport: o,
  dport: r,
  t: i,
  linux: l = !1,
}) {
  const c = (w, k, g, T, v, I) => ({
      time: formatSeconds(w),
      src: k,
      dst: g,
      proto: "TLSv1.3",
      info: T,
      len: v,
      wire: I,
    }),
    h = createEndpointPair(s, o, a, r),
    d = l ? TCP_TS_OPTION_SIZE : 0,
    y = SERVER_HELLO_TLS_LEN + 2 * (ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE + d);
  return [
    packetEvent(
      e,
      t,
      "teal",
      "CLIENT HELLO",
      [],
      c(
        i[0],
        s,
        a,
        `Client Hello (SNI=${n})`,
        `${517 + ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE + d} B`,
        tcpWire(h, s, "PA", buildClientHelloTls(n)),
      ),
      { quick: !0 },
    ),
    packetEvent(
      t,
      e,
      "teal",
      "SERVER HELLO",
      [],
      c(
        i[1],
        a,
        s,
        "Server Hello + encrypted handshake, 2 segments",
        formatByteSize(y),
        tcpWire(h, a, "PA", buildServerHelloTls()),
      ),
      { quick: !0 },
    ),
    packetEvent(
      e,
      t,
      "teal",
      "FINISHED",
      [],
      c(
        i[2],
        s,
        a,
        "Change Cipher Spec, Finished (encrypted)",
        `${64 + ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE + d} B`,
        tcpWire(h, s, "PA", CLIENT_FINISHED_TLS),
      ),
      { quick: !0 },
    ),
  ];
}

const HTTP_DNS_IP = "8.8.8.8";

const HTTP_WEB_IP = "203.0.113.10";

const HTTP_REQUEST_LINES = [
  "GET / HTTP/1.1",
  "Host: www.example.com",
  "Connection: keep-alive",
  "Upgrade-Insecure-Requests: 1",
  "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Encoding: gzip, deflate",
  "Accept-Language: en-US,en;q=0.9",
  "",
];

const HTTP_REQUEST_LEN = crlfByteLength(...HTTP_REQUEST_LINES);

const HTTP_HTML_BODY_LEN = 12500;

const HTTP_RESPONSE_HEADERS = [
  "HTTP/1.1 200 OK",
  "Date: Sat, 31 Oct 2026 09:41:00 GMT",
  "Content-Type: text/html; charset=utf-8",
  `Content-Length: ${HTTP_HTML_BODY_LEN}`,
  "Connection: keep-alive",
  "",
];

const HTTP_RESPONSE_TOTAL_LEN = crlfByteLength(...HTTP_RESPONSE_HEADERS) + HTTP_HTML_BODY_LEN;

const HTTP_TCP_ENDPOINTS = createEndpointPair(CLIENT_IP, 52344, HTTP_WEB_IP, 80);

const HTTP_DNS_QUERY = { id: 15642, rd: !0, q: ["www.example.com", "A"] };

const buildHttpDnsUdpWire = (e, t) => ({
  udp:
    e === CLIENT_IP
      ? { sport: 59321, dport: 53, data: { dns: t } }
      : { sport: 53, dport: 59321, data: { dns: t } },
});

const HTTP_RESPONSE_SEGMENTS = countMssSegments(HTTP_RESPONSE_TOTAL_LEN);

const HTTP_RESPONSE_WIRE_BYTES =
  HTTP_RESPONSE_TOTAL_LEN +
  HTTP_RESPONSE_SEGMENTS * (ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE);

const HTTP_CLOSE_TIME = 0.094;

export const httpLesson: Lesson = {
  id: "http",
  name: "HTTP",
  title: "Web Communication",
  layer: 7,
  nodes: ["client", "router", "dns", "internet", "web"],
  latency: { "client-dns": 0.012, "client-web": 0.017 },
  legend: [
    ["blue", "DNS"],
    ["green", "TCP"],
    ["amber", "Request"],
    ["violet", "Response"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "Hypertext Transfer Protocol",
    description:
      "HTTP is the protocol of the web: a client asks for a resource, such as an HTML page, and the server answers with a status code, headers and usually a body. Every exchange is one request and one response, written as readable text in HTTP/1.1.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Default Port", "80 (HTTPS: 443)"],
      ["Transport", "TCP"],
      ["Data Format", "Text (headers + optional body)"],
      ["Common Methods", "GET, POST, PUT, DELETE, HEAD"],
      ["Defined In", "RFC 9110, RFC 9112"],
    ],
  },
  outro: {
    title: "Page delivered",
    desc: "One request, one response",
    text: "In under a tenth of a second the laptop looked up an address, opened a TCP connection and exchanged one HTTP request and response, all of it readable by anyone on the path. Press REPLAY to watch it again.",
    facts: [
      ["Round trips", "3 (DNS, TCP, HTTP)"],
      ["Total time", `${HTTP_CLOSE_TIME.toFixed(3)} s`],
      ["Page size", formatByteSize(HTTP_HTML_BODY_LEN)],
      ["Response", `Sent as ${HTTP_RESPONSE_SEGMENTS} TCP segments`],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Client Request",
      desc: "Browser prepares the request",
      detail:
        "You open http://www.example.com. The browser will send a GET request, but packets travel to IP addresses, not names, so first it needs the server’s address. (Browsers now try https:// first; this is the plain version.)",
      facts: [
        ["URL", "http://www.example.com/"],
        ["Method", "GET"],
        ["Next hop", "Router 192.168.1.1"],
      ],
      events: [
        { type: "type-url", text: "www.example.com" },
        { type: "show", nodes: ["router"], frame: "local" },
      ],
    },
    {
      title: "DNS Resolution",
      desc: "Finds the server’s IP address",
      detail:
        "The laptop asks the DNS server it was given by DHCP, 8.8.8.8, for the address of www.example.com. The query goes over UDP port 53 and the answer is an A record with the IPv4 address. (On a network with IPv6 it would also ask for an AAAA record.)",
      facts: [
        ["Resolver", "8.8.8.8 (had it cached)"],
        ["Transport", "UDP, port 53"],
        ["Answer", "A 203.0.113.10"],
      ],
      events: [
        { type: "show", nodes: ["internet", "dns"], frame: "lookup" },
        packetEvent("client", "dns", "blue", "DNS QUERY", ["A? www.example.com"], {
          time: formatSeconds(0),
          src: CLIENT_IP,
          dst: HTTP_DNS_IP,
          proto: "DNS",
          info: "Standard query A www.example.com",
          len: "75 B",
          wire: buildHttpDnsUdpWire(CLIENT_IP, HTTP_DNS_QUERY),
        }),
        packetEvent("dns", "client", "blue", "DNS REPLY", ["A 203.0.113.10"], {
          time: formatSeconds(0.012),
          src: HTTP_DNS_IP,
          dst: CLIENT_IP,
          proto: "DNS",
          info: "Standard query response A 203.0.113.10",
          len: "91 B",
          wire: buildHttpDnsUdpWire(HTTP_DNS_IP, {
            ...HTTP_DNS_QUERY,
            response: !0,
            ra: !0,
            an: [["www.example.com", "A", 1745, "203.0.113.10"]],
            exampleTtl: !0,
          }),
        }),
      ],
    },
    {
      title: "TCP Connection",
      desc: "Establishes a reliable link",
      detail:
        "HTTP runs on top of TCP. Before any page data moves, the laptop and the server open a connection to port 80 with a three-way handshake: SYN, SYN-ACK, ACK.",
      facts: [
        ["Server port", "80"],
        ["Client port", "52344 (ephemeral)"],
        ["Handshake", "SYN → SYN-ACK → ACK"],
      ],
      events: [
        { type: "show", nodes: ["web"], frame: "full" },
        ...buildTcpHandshake({
          dst: HTTP_WEB_IP,
          sport: 52344,
          dport: 80,
          t: [0.024, 0.041, 0.058],
          quick: !1,
        }),
      ],
    },
    {
      title: "HTTP Exchange",
      desc: "Request and response messages",
      detail: `The browser sends a GET request with a Host header. The server answers 200 OK with the HTML in the body: ${formatByteSize(HTTP_HTML_BODY_LEN)}, too big for one packet, so TCP splits it into ${HTTP_RESPONSE_SEGMENTS} segments of up to ${TCP_MSS} bytes (drawn here as one).`,
      facts: [
        ["Status", "200 OK"],
        ["Body", `text/html, ${formatByteSize(HTTP_HTML_BODY_LEN)}`],
        ["Sent as", `${HTTP_RESPONSE_SEGMENTS} TCP segments`],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "GET /",
          ["GET / HTTP/1.1", "Host: www.example.com"],
          {
            time: formatSeconds(0.058),
            src: CLIENT_IP,
            dst: HTTP_WEB_IP,
            proto: "HTTP",
            info: "GET / HTTP/1.1",
            len: `${ethernetFrameBytes(HTTP_REQUEST_LEN)} B`,
            wire: tcpWire(HTTP_TCP_ENDPOINTS, CLIENT_IP, "PA", { text: HTTP_REQUEST_LINES }),
          },
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "200 OK",
          [
            "HTTP/1.1 200 OK",
            `${formatByteSize(HTTP_HTML_BODY_LEN)} in ${HTTP_RESPONSE_SEGMENTS} segments`,
          ],
          {
            time: formatSeconds(0.076),
            src: HTTP_WEB_IP,
            dst: CLIENT_IP,
            proto: "HTTP",
            info: `HTTP/1.1 200 OK (text/html), ${HTTP_RESPONSE_SEGMENTS} segments`,
            len: formatSegmentOrByteSize(HTTP_RESPONSE_WIRE_BYTES, HTTP_RESPONSE_SEGMENTS),
            wire: tcpWire(HTTP_TCP_ENDPOINTS, HTTP_WEB_IP, "PA", {
              http: {
                lines: HTTP_RESPONSE_HEADERS,
                body: HTTP_HTML_BODY_LEN,
                what: "the HTML page",
              },
            }),
          },
        ),
      ],
    },
    {
      title: "Page Rendering",
      desc: "Browser displays the content",
      detail:
        "The browser parses the HTML and paints the page. Linked CSS, images and scripts would each start more requests just like this one, reusing the open connection where they can.",
      facts: [
        ["Document", `text/html, ${formatByteSize(HTTP_HTML_BODY_LEN)}`],
        ["Connection", "Kept open for reuse"],
        ["Total time", `${HTTP_CLOSE_TIME.toFixed(3)} s`],
      ],
      events: [{ type: "camera", frame: "client" }, { type: "render" }],
    },
  ],
};

const HTTPS_DNS_IP = "8.8.8.8";

const HTTPS_WEB_IP = "203.0.113.10";

const LOCKED_OPT = { locked: !0 };

const HTTPS_REQUEST_LINES = [
  "GET / HTTP/1.1",
  "Host: www.example.com",
  "Connection: keep-alive",
  'sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
  "sec-ch-ua-mobile: ?0",
  'sec-ch-ua-platform: "Windows"',
  "Upgrade-Insecure-Requests: 1",
  "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Sec-Fetch-Site: none",
  "Sec-Fetch-Mode: navigate",
  "Sec-Fetch-User: ?1",
  "Sec-Fetch-Dest: document",
  "Accept-Encoding: gzip, deflate, br, zstd",
  "Accept-Language: en-US,en;q=0.9",
  "",
];

const HTTPS_REQUEST_TLS_LEN = crlfByteLength(...HTTPS_REQUEST_LINES) + TLS_RECORD_OVERHEAD;

const HTTPS_HTML_BODY_LEN = 12500;

const HTTPS_RESPONSE_HEADERS = [
  "HTTP/1.1 200 OK",
  "Date: Sat, 31 Oct 2026 09:41:00 GMT",
  "Content-Type: text/html; charset=utf-8",
  `Content-Length: ${HTTPS_HTML_BODY_LEN}`,
  "Connection: keep-alive",
  "Strict-Transport-Security: max-age=31536000",
  "",
];

const HTTPS_RESPONSE_TLS_LEN =
  crlfByteLength(...HTTPS_RESPONSE_HEADERS) + HTTPS_HTML_BODY_LEN + TLS_RECORD_OVERHEAD;

const HTTPS_RESPONSE_SEGMENTS = countMssSegments(HTTPS_RESPONSE_TLS_LEN);

const HTTPS_RESPONSE_WIRE_BYTES =
  HTTPS_RESPONSE_TLS_LEN +
  HTTPS_RESPONSE_SEGMENTS * (ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE);

const HTTPS_TICKETS_TLS_LEN = 2 * (217 + TLS_RECORD_OVERHEAD);

const HTTPS_CLOSE_TIME = 0.13;

const HTTPS_CLIENT_HELLO_TLS = {
  tls: [
    {
      type: "handshake",
      legacy: !0,
      length: 1845,
      hello: {
        type: 1,
        name: "Client Hello",
        note: "Everything the browser supports. Browsers vary a few details from one connection to the next.",
        fields: [
          ["Server name (SNI)", "www.example.com"],
          ["Versions offered", "TLS 1.3, TLS 1.2"],
          ["Key shares", "X25519MLKEM768 (1,216 bytes), X25519"],
          ["App protocols (ALPN)", "h2, http/1.1"],
        ],
      },
    },
  ],
};

const HTTPS_SERVER_HELLO_TLS = {
  tls: [
    {
      type: "handshake",
      length: 1210,
      hello: {
        type: 2,
        name: "Server Hello",
        note: "The server’s choices and its half of the hybrid key exchange.",
        fields: [
          ["Version", "TLS 1.3"],
          ["Cipher suite", "TLS_AES_128_GCM_SHA256"],
          ["Key share", "X25519MLKEM768 (1,120 bytes)"],
        ],
      },
    },
    { type: "ccs", length: 1 },
    {
      type: "appdata",
      length: 2724,
      inner: {
        what: "Encrypted Extensions (ALPN: http/1.1), Certificate (the chain), Certificate Verify (the signature), Finished",
      },
    },
  ],
};

const HTTPS_SESSION_TICKET_RECORD = {
  type: "appdata",
  length: HTTPS_TICKETS_TLS_LEN / 2 - 5,
  inner: { what: "New Session Ticket: lets a later visit resume" },
};

const HTTPS_TCP_ENDPOINTS = createEndpointPair(CLIENT_IP, 52411, HTTPS_WEB_IP, 443);

const HTTPS_DNS_QUERY = { id: 31810, rd: !0, q: ["www.example.com", "A"] };

const buildHttpsDnsUdpWire = (e, t) => ({
  udp:
    e === CLIENT_IP
      ? { sport: 61744, dport: 53, data: { dns: t } }
      : { sport: 53, dport: 61744, data: { dns: t } },
});

const SHARED_HTTPS_METRICS = {
  REQUEST: HTTPS_REQUEST_TLS_LEN,
  RESPONSE: HTTPS_RESPONSE_TLS_LEN,
  SEGMENTS: HTTPS_RESPONSE_SEGMENTS,
  RESPONSE_FRAMES: HTTPS_RESPONSE_WIRE_BYTES,
  TICKETS: HTTPS_TICKETS_TLS_LEN,
  REQUEST_LINES: HTTPS_REQUEST_LINES,
  RESPONSE_LINES: HTTPS_RESPONSE_HEADERS,
  BODY: HTTPS_HTML_BODY_LEN,
  TICKET: HTTPS_SESSION_TICKET_RECORD,
};

export const httpsLesson: Lesson = {
  id: "https",
  name: "HTTPS",
  title: "Secure Web",
  layer: 7,
  nodes: ["client", "router", "dns", "internet", "web"],
  latency: { "client-dns": 0.012, "client-web": 0.017 },
  legend: [
    ["blue", "DNS"],
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "HTTP request"],
    ["violet", "HTTP response"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "HTTP Secure",
    description:
      "HTTPS is HTTP sent through an encrypted TLS connection. TLS proves the server is who it claims to be with a certificate, agrees on fresh encryption keys, and then protects every request and response from being read or changed on the way.",
    facts: [
      ["Layer", "Application (HTTP over TLS)"],
      ["Default Port", "443"],
      ["Transport", "TCP"],
      ["Security", "TLS 1.3 (1.2 still common)"],
      ["Proves", "Server identity (certificate)"],
      ["Defined In", "RFC 9110, RFC 8446"],
    ],
  },
  outro: {
    title: "Secure page delivered",
    desc: "Encrypted, except the lookup",
    text: "The browser looked up the address in plain DNS, opened a TCP connection, checked the server’s certificate and agreed on keys in one round trip. Every HTTP byte after that travelled encrypted. Press REPLAY to watch it again.",
    facts: [
      ["Round trips", "4 (DNS, TCP, TLS, HTTP)"],
      ["Total time", `${HTTPS_CLOSE_TIME.toFixed(3)} s`],
      ["Cipher", "TLS_AES_128_GCM_SHA256"],
      ["Still visible", "IPs, server name, sizes"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Secure Request",
      desc: "Browser asks for https://",
      detail:
        "You type https://www.example.com. The “s” tells the browser to protect the connection with TLS, on port 443 by default. Before it can connect at all, it still has to find the server’s IP address.",
      facts: [
        ["URL", "https://www.example.com/"],
        ["Port", "443"],
        ["Next hop", "Router 192.168.1.1"],
      ],
      events: [
        { type: "type-url", text: "https://www.example.com", secure: !0 },
        { type: "show", nodes: ["router"], frame: "local" },
      ],
    },
    {
      title: "DNS Lookup",
      desc: "Same lookup as HTTP, not encrypted",
      detail:
        "The lookup is exactly the same as for plain HTTP: a query to 8.8.8.8 over UDP port 53. It is not encrypted, so anyone on the path can see which name you asked for, unless the browser uses DNS over HTTPS.",
      facts: [
        ["Resolver", "8.8.8.8 (had it cached)"],
        ["Encrypted", "No (plain DNS)"],
        ["Answer", "A 203.0.113.10"],
      ],
      events: [
        { type: "show", nodes: ["internet", "dns"], frame: "lookup" },
        packetEvent("client", "dns", "blue", "DNS QUERY", ["A? www.example.com"], {
          time: formatSeconds(0),
          src: CLIENT_IP,
          dst: HTTPS_DNS_IP,
          proto: "DNS",
          info: "Standard query A www.example.com",
          len: "75 B",
          wire: buildHttpsDnsUdpWire(CLIENT_IP, HTTPS_DNS_QUERY),
        }),
        packetEvent("dns", "client", "blue", "DNS REPLY", ["A 203.0.113.10"], {
          time: formatSeconds(0.012),
          src: HTTPS_DNS_IP,
          dst: CLIENT_IP,
          proto: "DNS",
          info: "Standard query response A 203.0.113.10",
          len: "91 B",
          wire: buildHttpsDnsUdpWire(HTTPS_DNS_IP, {
            ...HTTPS_DNS_QUERY,
            response: !0,
            ra: !0,
            an: [["www.example.com", "A", 1722, "203.0.113.10"]],
            exampleTtl: !0,
          }),
        }),
      ],
    },
    {
      title: "TCP Handshake",
      desc: "Opens a connection to port 443",
      detail:
        "TLS rides on TCP, so the same three-way handshake comes first, this time to port 443. Nothing is encrypted yet.",
      facts: [
        ["Server port", "443"],
        ["Client port", "52411 (ephemeral)"],
        ["Handshake", "SYN → SYN-ACK → ACK"],
      ],
      events: [
        { type: "show", nodes: ["web"], frame: "full" },
        ...buildTcpHandshake({
          dst: HTTPS_WEB_IP,
          sport: 52411,
          dport: 443,
          t: [0.024, 0.041, 0.058],
          quick: !1,
        }),
      ],
    },
    {
      title: "TLS Handshake",
      desc: "Agrees on keys, checks the certificate",
      detail:
        "The browser offers ciphers and key shares, including a post-quantum hybrid. The server picks it and sends its own share, then its certificate, already encrypted. The browser checks it against authorities it trusts.",
      facts: [
        ["Version", "TLS 1.3"],
        ["Key exchange", "X25519MLKEM768 (hybrid)"],
        ["Server name", "Sent in clear (SNI)"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "teal",
          "CLIENT HELLO",
          ["TLS 1.3, SNI www.example.com", "key shares: hybrid + x25519"],
          {
            time: formatSeconds(0.058),
            src: CLIENT_IP,
            dst: HTTPS_WEB_IP,
            proto: "TLSv1.3",
            info: "Client Hello (SNI=www.example.com), 2 segments",
            len: "1.9 KB",
            wire: tcpWire(HTTPS_TCP_ENDPOINTS, CLIENT_IP, "PA", HTTPS_CLIENT_HELLO_TLS),
          },
        ),
        packetEvent(
          "web",
          "client",
          "teal",
          "SERVER HELLO",
          ["cipher: AES_128_GCM_SHA256", "then encrypted: cert, Finished"],
          {
            time: formatSeconds(0.076),
            src: HTTPS_WEB_IP,
            dst: CLIENT_IP,
            proto: "TLSv1.3",
            info: "Server Hello + encrypted handshake, 3 segments",
            len: "4.0 KB",
            wire: tcpWire(HTTPS_TCP_ENDPOINTS, HTTPS_WEB_IP, "PA", HTTPS_SERVER_HELLO_TLS),
          },
        ),
        { type: "note", at: "client", text: "CERTIFICATE VALID", tone: "green" },
        packetEvent("client", "web", "teal", "FINISHED", ["handshake complete (encrypted)"], {
          time: formatSeconds(0.094),
          src: CLIENT_IP,
          dst: HTTPS_WEB_IP,
          proto: "TLSv1.3",
          info: "Change Cipher Spec, Finished (encrypted)",
          len: "118 B",
          wire: tcpWire(HTTPS_TCP_ENDPOINTS, CLIENT_IP, "PA", CLIENT_FINISHED_TLS),
        }),
      ],
    },
    {
      title: "Encrypted Exchange",
      desc: "HTTP inside TLS records",
      detail:
        "The GET and 200 OK are the same HTTP messages as before, sealed in TLS records that look like random “application data” on the wire. The server also hands over two session tickets, so a later visit can skip part of the handshake.",
      facts: [
        ["Inside", "GET / and 200 OK"],
        ["Tickets", "2, for faster reconnects"],
        ["Still visible", "IPs, server name, sizes"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "APP DATA",
          ["inside: GET / HTTP/1.1", "outside: encrypted bytes"],
          {
            time: formatSeconds(0.094),
            src: CLIENT_IP,
            dst: HTTPS_WEB_IP,
            proto: "TLSv1.3",
            info: "Application Data (HTTP request)",
            len: formatSegmentOrByteSize(
              HTTPS_REQUEST_TLS_LEN + ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE,
            ),
            wire: tcpWire(HTTPS_TCP_ENDPOINTS, CLIENT_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: HTTPS_REQUEST_TLS_LEN - 5,
                  inner: { what: "The HTTP request", text: HTTPS_REQUEST_LINES },
                },
              ],
            }),
          },
          LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "TICKETS",
          [],
          {
            time: formatSeconds(0.111),
            src: HTTPS_WEB_IP,
            dst: CLIENT_IP,
            proto: "TLSv1.3",
            info: "New Session Ticket ×2 (encrypted)",
            len: formatSegmentOrByteSize(
              HTTPS_TICKETS_TLS_LEN + ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE,
            ),
            wire: tcpWire(HTTPS_TCP_ENDPOINTS, HTTPS_WEB_IP, "PA", {
              tls: [HTTPS_SESSION_TICKET_RECORD, HTTPS_SESSION_TICKET_RECORD],
            }),
          },
          { ...LOCKED_OPT, quick: !0 },
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "APP DATA",
          [
            "inside: HTTP/1.1 200 OK",
            `outside: ${formatByteSize(HTTPS_RESPONSE_WIRE_BYTES)}, ${HTTPS_RESPONSE_SEGMENTS} segments`,
          ],
          {
            time: formatSeconds(0.112),
            src: HTTPS_WEB_IP,
            dst: CLIENT_IP,
            proto: "TLSv1.3",
            info: `Application Data (HTTP response), ${HTTPS_RESPONSE_SEGMENTS} segments`,
            len: formatSegmentOrByteSize(HTTPS_RESPONSE_WIRE_BYTES, HTTPS_RESPONSE_SEGMENTS),
            wire: tcpWire(HTTPS_TCP_ENDPOINTS, HTTPS_WEB_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: HTTPS_RESPONSE_TLS_LEN - 5,
                  inner: {
                    what: `The HTTP response, then the ${HTTPS_HTML_BODY_LEN.toLocaleString("en-US")}-byte page`,
                    text: HTTPS_RESPONSE_HEADERS,
                  },
                },
              ],
            }),
          },
          LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Page Rendering",
      desc: "Browser shows the padlock",
      detail:
        "The browser decrypts the response, paints the page and shows a padlock: the connection is private and the server proved its identity. The Strict-Transport-Security header tells it to use HTTPS for this site from now on.",
      facts: [
        ["Document", `text/html, ${formatByteSize(HTTPS_HTML_BODY_LEN)}`],
        ["Remembers", "HTTPS only (HSTS), 1 year"],
        ["Total time", `${HTTPS_CLOSE_TIME.toFixed(3)} s`],
      ],
      events: [{ type: "camera", frame: "client" }, { type: "render" }],
    },
  ],
};

const TCP_WEB_IP = "203.0.113.10";

const TCP_CLIENT_PORT = 49152;

const TCP_CURL_REQUEST_LINES = [
  "GET / HTTP/1.1",
  "Host: www.example.com",
  "User-Agent: curl/8.9.1",
  "Accept: */*",
  "",
];

const TCP_CURL_REQUEST_LEN = crlfByteLength(...TCP_CURL_REQUEST_LINES);

const TCP_TWO_SEGMENTS_LEN = 2 * TCP_MSS;

const TCP_ENDPOINTS = createEndpointPair(CLIENT_IP, TCP_CLIENT_PORT, TCP_WEB_IP, 80);

const createTcpRow = (e, t, s, a, n, o) => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: "TCP",
  info: a,
  len: `${n} B`,
  wire: o,
});

const createClientTcpRow = (e, t, s, a, n, o) =>
  createTcpRow(
    e,
    CLIENT_IP,
    TCP_WEB_IP,
    `${TCP_CLIENT_PORT} → 80 ${t}`,
    s,
    tcpWire(TCP_ENDPOINTS, CLIENT_IP, a, n, o),
  );

const createServerTcpRow = (e, t, s, a, n, o) =>
  createTcpRow(
    e,
    TCP_WEB_IP,
    CLIENT_IP,
    `80 → ${TCP_CLIENT_PORT} ${t}`,
    s,
    tcpWire(TCP_ENDPOINTS, TCP_WEB_IP, a, n, o),
  );

const buildHttpResponseSegmentPayload = (e) => ({
  opaque: TCP_MSS,
  what: `the HTTP response, bytes ${e}–${e + TCP_MSS - 1}`,
  name: "HTTP",
});

export const tcpLesson: Lesson = {
  id: "tcp",
  name: "TCP",
  title: "Reliable Delivery",
  layer: 4,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-web": 0.017 },
  legend: [
    ["green", "Handshake and ACKs"],
    ["amber", "Data from laptop"],
    ["violet", "Data from server"],
    ["slate", "Closing (FIN)"],
  ],
  overview: {
    full: "Transmission Control Protocol",
    description:
      "TCP turns the internet’s best-effort packet delivery into a reliable, ordered stream of bytes. It numbers every byte, acknowledges what arrives, resends what goes missing, and paces the sender so neither the other side nor the network is overwhelmed.",
    facts: [
      ["Layer", "Transport (Layer 4)"],
      ["Connection", "Three-way handshake"],
      ["Reliability", "Sequence numbers + ACKs"],
      ["Recovery", "Retransmission"],
      ["Header", "20–60 bytes"],
      ["Defined In", "RFC 9293"],
    ],
  },
  outro: {
    title: "Connection closed",
    desc: "Every byte accounted for",
    text: "TCP opened a connection, numbered and acknowledged every byte, spotted a gap and resent just the missing segment, then closed both directions cleanly. curl received every byte in order and never saw the loss. Press REPLAY to watch it again.",
    facts: [
      ["Segments", "14 (1 lost, 1 resent)"],
      [
        "Bytes delivered",
        `${TCP_CURL_REQUEST_LEN} up, ${TCP_TWO_SEGMENTS_LEN.toLocaleString("en-US")} down`,
      ],
      ["Loss found by", "Duplicate ACK + SACK"],
      ["Total time", "0.148 s"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Open Connection",
      desc: "Three-way handshake",
      detail:
        "curl already knows the server’s address. Before any data moves, both sides choose a starting sequence number and confirm it: SYN, SYN-ACK, ACK. The numbers here are relative; real ones start at a random value.",
      facts: [
        ["Server", "203.0.113.10, port 80"],
        ["Client port", `${TCP_CLIENT_PORT} (ephemeral)`],
        ["Flags", "SYN → SYN-ACK → ACK"],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "full" },
        ...buildTcpHandshake({
          dst: TCP_WEB_IP,
          sport: TCP_CLIENT_PORT,
          dport: 80,
          t: [0, 0.017, 0.034],
          quick: !1,
        }),
      ],
    },
    {
      title: "Send Data",
      desc: "Every byte is numbered",
      detail: `curl sends its ${TCP_CURL_REQUEST_LEN}-byte HTTP request: bytes 1 to ${TCP_CURL_REQUEST_LEN}. The server’s ACK number, ${TCP_CURL_REQUEST_LEN + 1}, is the next byte it expects, which means everything before it has arrived.`,
      facts: [
        ["Sent", `${TCP_CURL_REQUEST_LEN} bytes (seq 1–${TCP_CURL_REQUEST_LEN})`],
        ["ACK", `${TCP_CURL_REQUEST_LEN + 1} = next byte expected`],
        ["Flags", "PSH, ACK"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "DATA",
          [`seq=1  len=${TCP_CURL_REQUEST_LEN}`, "GET / HTTP/1.1 …"],
          createClientTcpRow(
            0.034,
            `[PSH, ACK] Seq=1 Ack=1 Len=${TCP_CURL_REQUEST_LEN}`,
            ethernetFrameBytes(TCP_CURL_REQUEST_LEN),
            "PA",
            { text: TCP_CURL_REQUEST_LINES, name: "HTTP" },
          ),
        ),
        packetEvent(
          "web",
          "client",
          "green",
          "ACK",
          [`ack=${TCP_CURL_REQUEST_LEN + 1}`],
          createServerTcpRow(
            0.051,
            `[ACK] Seq=1 Ack=${TCP_CURL_REQUEST_LEN + 1}`,
            ethernetFrameBytes(0),
            "A",
          ),
        ),
      ],
    },
    {
      title: "Two Segments Back",
      desc: "One of them is lost",
      detail: `The server answers with ${TCP_TWO_SEGMENTS_LEN.toLocaleString("en-US")} bytes: two full segments of ${TCP_MSS.toLocaleString("en-US")} bytes, the most that fits in one packet here, sent back to back. The first is dropped somewhere on the internet; the second gets through.`,
      facts: [
        ["Segment 1", `bytes 1–${TCP_MSS} (lost)`],
        ["Segment 2", `bytes ${TCP_MSS + 1}–${TCP_TWO_SEGMENTS_LEN}`],
        ["Segment size", `${TCP_MSS.toLocaleString("en-US")} bytes (MSS)`],
      ],
      events: [
        {
          type: "stream",
          from: "web",
          to: "client",
          color: "violet",
          label: "2 SEGMENTS",
          payload: [`seq=1 and seq=${TCP_MSS + 1}`, "the first is lost"],
          packets: [
            packetEvent(
              "web",
              "client",
              "violet",
              "DATA",
              [],
              createServerTcpRow(
                0.052,
                `[ACK] Seq=1 Ack=${TCP_CURL_REQUEST_LEN + 1} Len=${TCP_MSS}`,
                ethernetFrameBytes(TCP_MSS),
                "A",
                buildHttpResponseSegmentPayload(1),
              ),
              { lost: !0 },
            ),
            packetEvent(
              "web",
              "client",
              "violet",
              "DATA",
              [],
              createServerTcpRow(
                0.052,
                `[PSH, ACK] Seq=${TCP_MSS + 1} Ack=${TCP_CURL_REQUEST_LEN + 1} Len=${TCP_MSS}`,
                ethernetFrameBytes(TCP_MSS),
                "PA",
                buildHttpResponseSegmentPayload(TCP_MSS + 1),
              ),
            ),
          ],
        },
        { type: "note", at: "internet", text: "SEGMENT 1 LOST", tone: "amber" },
      ],
    },
    {
      title: "A Gap Is Noticed",
      desc: "Duplicate ACK with SACK",
      detail: `Bytes ${TCP_MSS + 1}–${TCP_TWO_SEGMENTS_LEN} arrive, but 1–${TCP_MSS} never did. An ACK can only count bytes received in order, so the laptop repeats ACK 1 at once and adds a SACK block saying it already holds ${TCP_MSS + 1}–${TCP_TWO_SEGMENTS_LEN}.`,
      facts: [
        ["ACK", "1 (still waiting for byte 1)"],
        ["SACK", `holds bytes ${TCP_MSS + 1}–${TCP_TWO_SEGMENTS_LEN}`],
        ["Sent", "At once, not delayed"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "green",
          "DUP ACK",
          ["ack=1", `sack: has ${TCP_MSS + 1}–${TCP_TWO_SEGMENTS_LEN}`],
          createClientTcpRow(
            0.069,
            `[ACK] Seq=${TCP_CURL_REQUEST_LEN + 1} Ack=1 SLE=${TCP_MSS + 1} SRE=${TCP_TWO_SEGMENTS_LEN + 1}`,
            66,
            "A",
            void 0,
            {
              sack: !0,
            },
          ),
        ),
      ],
    },
    {
      title: "Resend the Gap",
      desc: "Only the missing bytes",
      detail:
        "The SACK tells the server exactly what is missing, so it resends just segment 1, and the laptop acknowledges everything. Had no ACK come back at all, timers would have stepped in: a probe after about two round trips, then a retransmission timeout (at least 200 ms on Linux).",
      facts: [
        ["Resent", `bytes 1–${TCP_MSS} only`],
        ["Next ACK", `${TCP_TWO_SEGMENTS_LEN + 1} (everything)`],
        ["curl saw", "Every byte, in order"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "violet",
          "RESEND",
          ["seq=1  len=1460", "just the missing segment"],
          createServerTcpRow(
            0.095,
            `[TCP Retransmission] Seq=1 Ack=${TCP_CURL_REQUEST_LEN + 1} Len=${TCP_MSS}`,
            ethernetFrameBytes(TCP_MSS),
            "A",
            buildHttpResponseSegmentPayload(1),
            {
              seq: 1,
            },
          ),
        ),
        packetEvent(
          "client",
          "web",
          "green",
          "ACK",
          [`ack=${TCP_TWO_SEGMENTS_LEN + 1}`],
          createClientTcpRow(
            0.112,
            `[ACK] Seq=${TCP_CURL_REQUEST_LEN + 1} Ack=${TCP_TWO_SEGMENTS_LEN + 1}`,
            ethernetFrameBytes(0),
            "A",
          ),
        ),
      ],
    },
    {
      title: "Close Connection",
      desc: "Each side says goodbye",
      detail:
        "curl is done, so it closes. Each direction closes on its own: the laptop sends FIN and the server acknowledges it, then the server sends its own FIN and the laptop acknowledges that. The laptop keeps the connection’s details for a while (TIME-WAIT).",
      facts: [
        ["Closed by", "A FIN from each side"],
        ["Order", "FIN → ACK → FIN → ACK"],
        ["Then", "Laptop waits (TIME-WAIT)"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "slate",
          "FIN",
          [`seq=${TCP_CURL_REQUEST_LEN + 1}  ack=${TCP_TWO_SEGMENTS_LEN + 1}`],
          createClientTcpRow(
            0.113,
            `[FIN, ACK] Seq=${TCP_CURL_REQUEST_LEN + 1} Ack=${TCP_TWO_SEGMENTS_LEN + 1}`,
            ethernetFrameBytes(0),
            "FA",
          ),
        ),
        packetEvent(
          "web",
          "client",
          "green",
          "ACK",
          [`ack=${TCP_CURL_REQUEST_LEN + 2}`],
          createServerTcpRow(
            0.13,
            `[ACK] Seq=${TCP_TWO_SEGMENTS_LEN + 1} Ack=${TCP_CURL_REQUEST_LEN + 2}`,
            ethernetFrameBytes(0),
            "A",
          ),
        ),
        packetEvent(
          "web",
          "client",
          "slate",
          "FIN",
          [`seq=${TCP_TWO_SEGMENTS_LEN + 1}  ack=${TCP_CURL_REQUEST_LEN + 2}`],
          createServerTcpRow(
            0.131,
            `[FIN, ACK] Seq=${TCP_TWO_SEGMENTS_LEN + 1} Ack=${TCP_CURL_REQUEST_LEN + 2}`,
            ethernetFrameBytes(0),
            "FA",
          ),
        ),
        packetEvent(
          "client",
          "web",
          "green",
          "ACK",
          [`ack=${TCP_TWO_SEGMENTS_LEN + 2}`],
          createClientTcpRow(
            0.148,
            `[ACK] Seq=${TCP_CURL_REQUEST_LEN + 2} Ack=${TCP_TWO_SEGMENTS_LEN + 2}`,
            ethernetFrameBytes(0),
            "A",
          ),
        ),
      ],
    },
  ],
};

const UDP_CLIENT_IP = "192.168.1.10";

const UDP_PEER_IP = "203.0.113.20";

const createUdpPacketEvent = (e, t, s, a, n, o, r = {}) => ({
  type: "packet",
  from: e,
  to: t,
  color: s,
  label: a,
  payload: n,
  row: o,
  ...r,
});

const createRtpUdpWire = (e, t) => ({
  udp: {
    ...(t ? { sport: 5e4, dport: 5004 } : { sport: 5004, dport: 5e4 }),
    data: {
      rtp: {
        seq: (t ? 21737 : 4418) + e,
        ts: (t ? 2617440 : 913280) + 960 * (e - 1),
        ssrc: t ? 1590076113 : 460833806,
        pt: 111,
        marker: e === 1,
        audio: 80,
      },
    },
  },
});

const createVoiceOutPacket = (e, t, s) =>
  createUdpPacketEvent(
    "client",
    "web",
    "amber",
    `VOICE ${e}`,
    [],
    {
      time: t,
      src: UDP_CLIENT_IP,
      dst: UDP_PEER_IP,
      proto: "UDP",
      info: "50000 → 5004 Len=92",
      len: "134 B",
      wire: createRtpUdpWire(e, !0),
    },
    s,
  );

const createVoiceInPacket = (e, t) =>
  createUdpPacketEvent("web", "client", "violet", `REMOTE ${e}`, [], {
    time: t,
    src: UDP_PEER_IP,
    dst: UDP_CLIENT_IP,
    proto: "UDP",
    info: "5004 → 50000 Len=92",
    len: "134 B",
    wire: createRtpUdpWire(e, !1),
  });

export const udpLesson: Lesson = {
  id: "udp",
  name: "UDP",
  title: "Fast Datagrams",
  layer: 4,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-web": 0.017 },
  labels: { web: ["Media Server", UDP_PEER_IP] },
  legend: [
    ["amber", "Your voice"],
    ["violet", "Their voice"],
  ],
  overview: {
    full: "User Datagram Protocol",
    description:
      "UDP sends data in independent packets called datagrams, with no connection, no acknowledgements and no resends. That keeps it fast and light: right for voice, video, games and DNS, where a late answer is worse than a missing one.",
    facts: [
      ["Layer", "Transport (Layer 4)"],
      ["Connection", "None"],
      ["Reliability", "None (no ACKs, no resends)"],
      ["Ordering", "Not guaranteed"],
      ["Header", "8 bytes"],
      ["Defined In", "RFC 768"],
    ],
  },
  outro: {
    title: "Call keeps flowing",
    desc: "Fast, simple, no guarantees",
    text: "Audio started with the very first packet, every datagram travelled on its own, and the one that was lost was simply gone: UDP never noticed. The app covered the gap and the call carried on. Press REPLAY to watch it again.",
    facts: [
      ["Datagrams", "11 (1 lost, never resent)"],
      ["Setup time", "0 ms (no handshake)"],
      ["Header", "8 bytes (TCP: 20+)"],
      ["Shown", "The first 0.2 s of a call"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Send Right Away",
      desc: "No handshake, data goes first",
      detail:
        "A call app already knows the media server’s address and port from signing in. It doesn’t open a connection: the very first datagram already carries 20 ms of your voice, behind an 8-byte UDP header.",
      facts: [
        ["Setup", "None"],
        ["Header", "8 bytes"],
        ["Ports", "50000 → 5004"],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "full" },
        createUdpPacketEvent(
          "client",
          "web",
          "amber",
          "VOICE 1",
          ["UDP 50000 → 5004", "92 B of audio, no setup"],
          {
            time: "0.000s",
            src: UDP_CLIENT_IP,
            dst: UDP_PEER_IP,
            proto: "UDP",
            info: "50000 → 5004 Len=92",
            len: "134 B",
            wire: createRtpUdpWire(1, !0),
          },
        ),
      ],
    },
    {
      title: "A Stream of Datagrams",
      desc: "One every 20 ms, each on its own",
      detail:
        "The app keeps sending a datagram every 20 ms. Each one stands alone, with its own header and no link to the others. UDP doesn’t number them, and nothing comes back to confirm they arrived.",
      facts: [
        ["Rate", "1 datagram / 20 ms"],
        ["Numbering", "None in UDP itself"],
        ["Confirmation", "None (no ACKs)"],
      ],
      events: [
        {
          type: "stream",
          from: "client",
          to: "web",
          color: "amber",
          label: "4 DATAGRAMS",
          payload: ["voice frames 2–5", "each with its own 8-byte header"],
          packets: [
            createVoiceOutPacket(2, "0.020s"),
            createVoiceOutPacket(3, "0.040s"),
            createVoiceOutPacket(4, "0.060s"),
            createVoiceOutPacket(5, "0.080s"),
          ],
        },
      ],
    },
    {
      title: "Lost on the Way",
      desc: "Nobody resends it",
      detail:
        "Frame 7 is dropped somewhere on the internet. The media server never asks for it, and UDP never tells the laptop: there are no acknowledgements to miss. The datagrams after it arrive as normal.",
      facts: [
        ["Lost", "Voice frame 7"],
        ["Resent", "Never (no ACKs)"],
        ["Missing", "20 ms of audio"],
      ],
      events: [
        {
          type: "stream",
          from: "client",
          to: "web",
          color: "amber",
          label: "3 DATAGRAMS",
          payload: ["voice frames 6–8", "frame 7 is lost"],
          packets: [
            createVoiceOutPacket(6, "0.100s"),
            createVoiceOutPacket(7, "0.120s", { lost: !0 }),
            createVoiceOutPacket(8, "0.140s"),
          ],
        },
        { type: "note", at: "web", text: "FRAME 7 LOST · NOT RESENT", tone: "amber" },
      ],
    },
    {
      title: "Replies Come Back",
      desc: "The other voice comes back",
      detail:
        "The other person’s voice arrives the same way, as separate datagrams sent to port 50000. They get back in because your router remembered the outgoing port when it translated your address (NAT).",
      facts: [
        ["Ports", "5004 → 50000"],
        ["Direction", "Independent of ours"],
        ["Through NAT", "Router remembers the port"],
      ],
      events: [
        {
          type: "stream",
          from: "web",
          to: "client",
          color: "violet",
          label: "3 DATAGRAMS",
          payload: ["the other person’s voice", "sent to port 50000"],
          packets: [
            createVoiceInPacket(1, "0.150s"),
            createVoiceInPacket(2, "0.170s"),
            createVoiceInPacket(3, "0.190s"),
          ],
        },
      ],
    },
    {
      title: "The App Decides",
      desc: "Reliability is up to the app",
      detail:
        "The call app numbers its own frames (RTP does this), so it sees that frame 7 is missing and smooths over the 20 ms gap instead of waiting. Waiting for a resend would make the whole call lag.",
      facts: [
        ["Ordering", "App’s job (e.g. RTP)"],
        ["Loss", "Hidden by the app"],
        ["Also on UDP", "DNS, games, QUIC"],
      ],
      events: [{ type: "note", at: "client", text: "APP COVERS THE 20 MS GAP", tone: "green" }],
    },
  ],
};

const IP_WEB_IP = "203.0.113.10";

const CLIENT_MAC = "00:00:5e:00:53:10";

const ROUTER_LAN_MAC = "00:00:5e:00:53:01";

const IP_LAN_ENDPOINTS = createEndpointPair(CLIENT_IP, 52344, IP_WEB_IP, 443);

const IP_WAN_ENDPOINTS = createEndpointPair(ROUTER_WAN_IP, 40112, IP_WEB_IP, 443);

export const ipLesson: Lesson = {
  id: "ip",
  name: "IP",
  title: "Addressing & Routing",
  layer: 3,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-router": 0.001, "router-web": 0.016 },
  legend: [
    ["slate", "ARP"],
    ["amber", "Outgoing packet"],
    ["violet", "Reply"],
  ],
  overview: {
    full: "Internet Protocol",
    description:
      "IP gives every device an address and moves packets from network to network. Each router looks only at the destination address to choose the next hop. IP is best effort: it doesn’t promise delivery or order. TCP adds those on top.",
    facts: [
      ["Layer", "Network (Layer 3)"],
      ["Address", "32 bits (IPv4), 128 (IPv6)"],
      ["Header", "20–60 bytes (IPv4)"],
      ["TTL", "Lowered by 1 at each router"],
      ["Delivery", "Best effort"],
      ["Defined In", "RFC 791, RFC 8200 (IPv6)"],
    ],
  },
  outro: {
    title: "There and back",
    desc: "Twelve routers each way",
    text: "The laptop sent the packet to its router, which swapped in its public address. Twelve routers in all passed it along by destination address alone, and the reply found its way back the same way. Press REPLAY to watch it again.",
    facts: [
      ["Routers", "12 each way (1 home + 11)"],
      ["TTL at server", "116 (sent with 128)"],
      ["Rewritten by NAT", "Source out, destination back"],
      ["Version", "IPv4 (IPv6 works alike)"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Local or Not?",
      desc: "Compare the address with the subnet",
      detail:
        "The laptop is 192.168.1.10 with a /24 mask, so its own network is 192.168.1.0 to 192.168.1.255. The server, 203.0.113.10, is outside that range, so the packet has to go to the default gateway: the home router.",
      facts: [
        ["Laptop", "192.168.1.10/24"],
        ["Local range", "192.168.1.0 – .255"],
        ["Gateway", "192.168.1.1"],
      ],
      events: [
        { type: "note", at: "client", text: "203.0.113.10 IS NOT LOCAL", tone: "amber" },
        { type: "show", nodes: ["router"], frame: "local" },
      ],
    },
    {
      title: "Find the Router",
      desc: "ARP turns an IP into a MAC",
      detail:
        "On the local network, frames are delivered by MAC address. If the router’s MAC isn’t in the laptop’s ARP cache, it broadcasts “who has 192.168.1.1?” and the router answers with its MAC address.",
      facts: [
        ["Asks", "Who has 192.168.1.1?"],
        ["Sent to", "Everyone (broadcast)"],
        ["Learns", "Router’s MAC address"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "slate",
          "ARP REQUEST",
          ["who has 192.168.1.1?", "tell 192.168.1.10"],
          {
            time: formatSeconds(0),
            src: CLIENT_MAC,
            dst: "Broadcast",
            proto: "ARP",
            info: "Who has 192.168.1.1? Tell 192.168.1.10",
            len: "60 B",
            wire: {
              arp: {
                op: 1,
                sender: [CLIENT_MAC, CLIENT_IP],
                target: ["00:00:00:00:00:00", ROUTER_IP],
              },
            },
          },
        ),
        packetEvent(
          "router",
          "client",
          "slate",
          "ARP REPLY",
          ["192.168.1.1 is at", ROUTER_LAN_MAC],
          {
            time: formatSeconds(0.001),
            src: ROUTER_LAN_MAC,
            dst: CLIENT_MAC,
            proto: "ARP",
            info: `192.168.1.1 is at ${ROUTER_LAN_MAC}`,
            len: "60 B",
            wire: {
              arp: { op: 2, sender: [ROUTER_LAN_MAC, ROUTER_IP], target: [CLIENT_MAC, CLIENT_IP] },
            },
          },
        ),
      ],
    },
    {
      title: "Send the Packet",
      desc: "Addresses, TTL and protocol",
      detail:
        "The IP header carries the source and destination addresses, a TTL and the protocol inside. Here it holds a TCP SYN to port 443. Windows starts the TTL at 128 (Linux and macOS use 64).",
      facts: [
        ["From → to", "192.168.1.10 → 203.0.113.10"],
        ["TTL", "128"],
        ["Protocol", "6 (TCP)"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "IP PACKET",
          ["192.168.1.10 → 203.0.113.10", "TTL 128 · protocol TCP"],
          {
            time: formatSeconds(0.002),
            src: CLIENT_IP,
            dst: IP_WEB_IP,
            proto: "TCP",
            info: "TTL 128 · 52344 → 443 [SYN]",
            len: "66 B",
            wire: tcpWire(IP_LAN_ENDPOINTS, CLIENT_IP, "S"),
          },
        ),
      ],
    },
    {
      title: "NAT, Then Hop by Hop",
      desc: "The router rewrites and forwards",
      detail:
        "The router swaps the private source for its public address 198.51.100.7 (and here port 52344 for 40112), notes the mapping, and lowers the TTL to 127. Then 11 routers on the internet each choose the next hop by destination and lower the TTL again.",
      facts: [
        ["New source", "198.51.100.7:40112"],
        ["Leaves home", "TTL 127"],
        ["At the server", "TTL 116 (11 more hops)"],
      ],
      events: [
        { type: "show", nodes: ["internet", "web"], frame: "full" },
        packetEvent(
          "router",
          "web",
          "amber",
          "IP PACKET",
          ["198.51.100.7 → 203.0.113.10", "TTL 127 · after NAT"],
          {
            time: formatSeconds(0.003),
            src: ROUTER_WAN_IP,
            dst: IP_WEB_IP,
            proto: "TCP",
            info: "TTL 127 · 40112 → 443 [SYN] (after NAT)",
            len: "66 B",
            wire: {
              ...tcpWire(IP_WAN_ENDPOINTS, ROUTER_WAN_IP, "S", void 0, { seq: 0 }),
              ttl: 127,
              natOf: -1,
              alias: [`${ROUTER_WAN_IP}:40112`, `${CLIENT_IP}:52344`],
            },
          },
        ),
        { type: "note", at: "web", text: "ARRIVED WITH TTL 116", tone: "green" },
      ],
    },
    {
      title: "The Reply Comes Back",
      desc: "NAT translates it for the laptop",
      detail:
        "The server answers the address it saw, 198.51.100.7:40112. The router looks that up in its NAT table, rewrites the destination back to 192.168.1.10:52344 and passes it on. The reply started at TTL 64 and arrives with 52.",
      facts: [
        ["Sent to", "198.51.100.7:40112"],
        ["Delivered to", "192.168.1.10:52344"],
        ["TTL", "64 → 52 (12 routers)"],
      ],
      events: [
        packetEvent(
          "web",
          "router",
          "violet",
          "REPLY",
          ["203.0.113.10 → 198.51.100.7", "TTL 64 · SYN-ACK"],
          {
            time: formatSeconds(0.019),
            src: IP_WEB_IP,
            dst: ROUTER_WAN_IP,
            proto: "TCP",
            info: "TTL 64 · 443 → 40112 [SYN, ACK]",
            len: "66 B",
            wire: tcpWire(IP_WAN_ENDPOINTS, IP_WEB_IP, "SA"),
          },
        ),
        { type: "note", at: "router", text: "NAT: 40112 → 192.168.1.10", tone: "navy" },
        packetEvent(
          "router",
          "client",
          "violet",
          "REPLY",
          ["203.0.113.10 → 192.168.1.10", "TTL 52 · after NAT"],
          {
            time: formatSeconds(0.035),
            src: IP_WEB_IP,
            dst: CLIENT_IP,
            proto: "TCP",
            info: "TTL 52 · 443 → 52344 [SYN, ACK] (after NAT)",
            len: "66 B",
            wire: { ...tcpWire(IP_LAN_ENDPOINTS, IP_WEB_IP, "SA", void 0, { seq: 0 }), natOf: -1 },
          },
        ),
      ],
    },
  ],
};

const DNS_CLIENT_IP = "192.168.1.10";

const DNS_RESOLVER_IP = "8.8.8.8";

const DNS_ROOT_IP = "198.41.0.4";

const DNS_TLD_IP = "192.5.6.30";

const DNS_AUTH_IP = "198.51.100.53";

const createDnsPacketEvent = (e, t, s, a, n, o) => ({
  type: "packet",
  from: e,
  to: t,
  color: s,
  label: a,
  payload: n,
  row: o,
});

const DNS_EXAMPLE_QUESTION = ["www.example.com", "A"];

const DNS_EDNS_OPT = { size: 1232 };

const COM_NS_SERVERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"].map(
  (e) => `${e}.gtld-servers.net`,
);

const COM_NS_IPV4 = [
  "192.5.6.30",
  "192.33.14.30",
  "192.26.92.30",
  "192.31.80.30",
  "192.12.94.30",
  "192.35.51.30",
  "192.42.93.30",
  "192.54.112.30",
  "192.43.172.30",
  "192.48.79.30",
  "192.52.178.30",
  "192.41.162.30",
  "192.55.83.30",
];

const COM_NS_IPV6 = [
  "2001:503:a83e::2:30",
  "2001:503:231d::2:30",
  "2001:503:83eb::30",
  "2001:500:856e::30",
  "2001:502:1ca1::30",
  "2001:503:d414::30",
  "2001:503:eea3::30",
  "2001:502:8cc::30",
  "2001:503:39c1::30",
  "2001:502:7094::30",
  "2001:503:d2d::30",
  "2001:500:d937::30",
  "2001:501:b1f9::30",
];

const createDnsQueryWire = (e, t) => ({ udp: { sport: e, dport: 53, data: { dns: t } } });

const createDnsReplyWire = (e, t) => ({ udp: { sport: 53, dport: e, data: { dns: t } } });

export const dnsLesson: Lesson = {
  id: "dns",
  name: "DNS",
  title: "Name Resolution",
  layer: 7,
  nodes: ["client", "router", "internet", "dns", "root", "tld", "auth"],
  latency: { "client-dns": 0.012, "dns-root": 0.005, "dns-tld": 0.01, "dns-auth": 0.02 },
  legend: [
    ["blue", "Query"],
    ["amber", "Referral"],
    ["green", "Answer"],
    [null, "DNSSEC not requested here"],
  ],
  overview: {
    full: "Domain Name System",
    description:
      "DNS turns names like www.example.com into the IP addresses computers use to reach each other. No single server knows every name: the system is a hierarchy of servers, and answers are cached along the way so most lookups never have to go far.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Port", "53, UDP (TCP if large)"],
      ["Turns", "Names into IP addresses"],
      ["Hierarchy", "Root → TLD → authoritative"],
      ["Caching", "For each record’s TTL"],
      ["Defined In", "RFC 1034, RFC 1035"],
    ],
  },
  outro: {
    title: "Name resolved",
    desc: "And remembered for an hour",
    text: "Starting from an empty cache, the resolver walked from the root to .com to example.com’s own server, then answered the laptop. Until the TTL runs out, the next lookup for this name is answered straight from a cache. Press REPLAY to watch it again.",
    facts: [
      ["Queries", "4 (laptop 1, resolver 3)"],
      ["Total time", "0.094 s"],
      ["Transport", "UDP, port 53"],
      ["Cached for", "3600 s (TTL)"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Ask the Resolver",
      desc: "The laptop hands the question off",
      detail:
        "The browser needs the IP address of www.example.com and neither it nor Windows has one cached. The laptop sends one question to the recursive resolver it was given, 8.8.8.8, and asks it to do the whole lookup (recursion desired).",
      facts: [
        ["Question", "www.example.com, type A"],
        ["Asked", "8.8.8.8 (recursive)"],
        ["Flags", "RD (recursion desired)"],
      ],
      events: [
        { type: "type-url", text: "www.example.com" },
        { type: "show", nodes: ["router", "internet", "dns"], frame: "lookup" },
        createDnsPacketEvent(
          "client",
          "dns",
          "blue",
          "DNS QUERY",
          ["A? www.example.com", "flags: RD"],
          {
            time: "0.000s",
            src: DNS_CLIENT_IP,
            dst: DNS_RESOLVER_IP,
            proto: "DNS",
            info: "Standard query A www.example.com",
            len: "75 B",
            wire: createDnsQueryWire(54871, { id: 39486, rd: !0, q: DNS_EXAMPLE_QUESTION }),
          },
        ),
      ],
    },
    {
      title: "Root Server",
      desc: "Points the way to .com",
      detail:
        "The resolver’s cache is empty (it has just started), so it begins at the top. A root server doesn’t know the address, but it knows which servers handle .com and replies with a referral. Many resolvers send it only “com”, not the full name.",
      facts: [
        ["Server", "a.root-servers.net"],
        ["Root servers", "13 names, 1,000+ anycast sites"],
        ["Reply", "Referral (13 .com servers)"],
      ],
      events: [
        { type: "note", at: "dns", text: "NOT IN CACHE", tone: "amber" },
        { type: "show", nodes: ["root"], frame: "root" },
        createDnsPacketEvent("dns", "root", "blue", "DNS QUERY", ["A? www.example.com"], {
          time: "0.012s",
          src: DNS_RESOLVER_IP,
          dst: DNS_ROOT_IP,
          proto: "DNS",
          info: "Standard query A www.example.com",
          len: "86 B",
          wire: createDnsQueryWire(38143, {
            id: 20935,
            q: DNS_EXAMPLE_QUESTION,
            edns: DNS_EDNS_OPT,
          }),
        }),
        createDnsPacketEvent(
          "root",
          "dns",
          "amber",
          "REFERRAL",
          ["no answer: ask .com", "com. NS a.gtld-servers.net …"],
          {
            time: "0.017s",
            src: DNS_ROOT_IP,
            dst: DNS_RESOLVER_IP,
            proto: "DNS",
            info: "Referral: com. NS ×13 (with glue)",
            len: "882 B",
            wire: createDnsReplyWire(38143, {
              id: 20935,
              response: !0,
              q: DNS_EXAMPLE_QUESTION,
              edns: DNS_EDNS_OPT,
              ns: COM_NS_SERVERS.map((e) => ["com", "NS", 172800, e]),
              ar: [
                ...COM_NS_SERVERS.map((e, t) => [e, "A", 172800, COM_NS_IPV4[t]]),
                ...COM_NS_SERVERS.map((e, t) => [e, "AAAA", 172800, COM_NS_IPV6[t]]),
              ],
            }),
          },
        ),
      ],
    },
    {
      title: ".com TLD Server",
      desc: "Points the way to example.com",
      detail:
        "The resolver asks one of the .com servers. They don’t store addresses for every site either, but they know which name servers each .com domain uses, so this reply is another referral, with those servers’ addresses (glue) attached.",
      facts: [
        ["Server", "a.gtld-servers.net"],
        ["Knows", "Name servers of .com domains"],
        ["Reply", "Referral + glue addresses"],
      ],
      events: [
        { type: "show", nodes: ["tld"], frame: "tld" },
        createDnsPacketEvent("dns", "tld", "blue", "DNS QUERY", ["A? www.example.com"], {
          time: "0.022s",
          src: DNS_RESOLVER_IP,
          dst: DNS_TLD_IP,
          proto: "DNS",
          info: "Standard query A www.example.com",
          len: "86 B",
          wire: createDnsQueryWire(41766, {
            id: 11152,
            q: DNS_EXAMPLE_QUESTION,
            edns: DNS_EDNS_OPT,
          }),
        }),
        createDnsPacketEvent(
          "tld",
          "dns",
          "amber",
          "REFERRAL",
          ["no answer: ask example.com", "example.com. NS ns1.example.com"],
          {
            time: "0.032s",
            src: DNS_TLD_IP,
            dst: DNS_RESOLVER_IP,
            proto: "DNS",
            info: "Referral: example.com. NS ×2 (with glue)",
            len: "154 B",
            wire: createDnsReplyWire(41766, {
              id: 11152,
              response: !0,
              q: DNS_EXAMPLE_QUESTION,
              edns: DNS_EDNS_OPT,
              ns: [
                ["example.com", "NS", 172800, "ns1.example.com"],
                ["example.com", "NS", 172800, "ns2.example.com"],
              ],
              ar: [
                ["ns1.example.com", "A", 172800, DNS_AUTH_IP],
                ["ns2.example.com", "A", 172800, "198.51.100.54"],
              ],
            }),
          },
        ),
      ],
    },
    {
      title: "Authoritative Server",
      desc: "Gives the actual answer",
      detail:
        "Finally the resolver asks example.com’s own name server, which holds the domain’s records. It answers with the A record and marks the reply authoritative. The domain owner sets how long it may be cached: here, 3600 seconds.",
      facts: [
        ["Server", "ns1.example.com"],
        ["Answer", "A 203.0.113.10"],
        ["Flags", "AA (authoritative), TTL 3600"],
      ],
      events: [
        { type: "show", nodes: ["auth"], frame: "full" },
        createDnsPacketEvent("dns", "auth", "blue", "DNS QUERY", ["A? www.example.com"], {
          time: "0.042s",
          src: DNS_RESOLVER_IP,
          dst: DNS_AUTH_IP,
          proto: "DNS",
          info: "Standard query A www.example.com",
          len: "86 B",
          wire: createDnsQueryWire(50911, {
            id: 58884,
            q: DNS_EXAMPLE_QUESTION,
            edns: DNS_EDNS_OPT,
          }),
        }),
        createDnsPacketEvent(
          "auth",
          "dns",
          "green",
          "ANSWER",
          ["www.example.com A 203.0.113.10", "TTL 3600 · flag AA"],
          {
            time: "0.062s",
            src: DNS_AUTH_IP,
            dst: DNS_RESOLVER_IP,
            proto: "DNS",
            info: "Response A 203.0.113.10 (authoritative)",
            len: "102 B",
            wire: createDnsReplyWire(50911, {
              id: 58884,
              response: !0,
              aa: !0,
              q: DNS_EXAMPLE_QUESTION,
              edns: DNS_EDNS_OPT,
              an: [["www.example.com", "A", 3600, "203.0.113.10"]],
            }),
          },
        ),
      ],
    },
    {
      title: "Answer & Cache",
      desc: "The laptop gets its address",
      detail:
        "The resolver sends the answer back to the laptop and keeps a copy. For the next hour it can answer this name straight away, which is why the lookup in the HTTP lesson took only 24 ms. The laptop caches it too.",
      facts: [
        ["Answer", "A 203.0.113.10"],
        ["Flags", "RD, RA (recursion available)"],
        ["Cached by", "Resolver and laptop"],
      ],
      events: [
        createDnsPacketEvent(
          "dns",
          "client",
          "green",
          "ANSWER",
          ["A 203.0.113.10 · TTL 3600", "flags: RD RA"],
          {
            time: "0.082s",
            src: DNS_RESOLVER_IP,
            dst: DNS_CLIENT_IP,
            proto: "DNS",
            info: "Standard query response A 203.0.113.10",
            len: "91 B",
            wire: createDnsReplyWire(54871, {
              id: 39486,
              response: !0,
              rd: !0,
              ra: !0,
              q: DNS_EXAMPLE_QUESTION,
              an: [["www.example.com", "A", 3600, "203.0.113.10"]],
            }),
          },
        ),
        { type: "note", at: "dns", text: "CACHED · TTL 3600 S", tone: "green" },
      ],
    },
  ],
};

const DHCP_INITIAL_XID_STR = "0x3903f326";

const DHCP_RENEW_XID_STR = "0x7a1c22e5";

const createDhcpRow = (e, t, s, a, n, o) => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: "DHCP",
  info: a,
  len: `${n} B`,
  wire: o,
});

const DHCP_HOSTNAME = "alice-laptop";

const DHCP_PARAM_REQUEST_LIST = [1, 3, 6, 15, 31, 33, 43, 44, 46, 47, 119, 121, 249, 252];

const createDhcpClientWire = (e) => ({
  udp: { sport: 68, dport: 67, data: { dhcp: { op: 1, ...e } } },
});

const createDhcpServerWire = (e) => ({
  udp: { sport: 67, dport: 68, data: { dhcp: { op: 2, ...e } } },
});

const DHCP_LEASE_OPTIONS = [
  [54, ROUTER_IP],
  [51, 86400],
  [58, 43200],
  [59, 75600],
  [1, "255.255.255.0"],
  [28, "192.168.1.255"],
  [3, ROUTER_IP],
  [6, "8.8.8.8"],
];

export const dhcpLesson: Lesson = {
  id: "dhcp",
  name: "DHCP",
  title: "Getting an Address",
  layer: 7,
  nodes: ["client", "router"],
  latency: { "client-router": 0.001 },
  labels: { router: ["Router", "192.168.1.1 · DHCP server"] },
  legend: [
    ["amber", "From the laptop"],
    ["violet", "From the DHCP server"],
  ],
  overview: {
    full: "Dynamic Host Configuration Protocol",
    description:
      "DHCP hands a device everything it needs to use a network: an IP address, the subnet mask, the router to send traffic through and the DNS servers to ask. Addresses are leased for a set time and renewed while the device stays on the network.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "UDP 67 (server), 68 (client)"],
      ["Hands out", "IP, mask, gateway, DNS"],
      ["Exchange", "Discover, Offer, Request, Ack"],
      ["Lease", "Renewed at half its time"],
      ["Defined In", "RFC 2131, RFC 2132"],
    ],
  },
  outro: {
    title: "On the network",
    desc: "Leased, and kept up to date",
    text: "Four messages took the laptop from no address to a working configuration, and halfway through the 24-hour lease it renewed it with a direct request to the router. Press REPLAY to watch it again.",
    facts: [
      ["Messages", "4 to join, 2 per renewal"],
      ["Address", "192.168.1.10/24"],
      ["Lease", "24 h, renewed at 12 h"],
      ["Ports", "UDP 68 → 67"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "No Address Yet",
      desc: "The laptop joins the network",
      detail:
        "The laptop has just connected. It has a MAC address built in, but no IP address, no gateway and no DNS server, so it can’t talk to anything beyond its own network yet. It asks for them with DHCP.",
      facts: [
        ["IP address", "None (uses 0.0.0.0)"],
        ["MAC address", "00:00:5e:00:53:10"],
        ["Needs", "IP, mask, gateway, DNS"],
      ],
      events: [
        { type: "note", at: "client", text: "NO IP ADDRESS YET", tone: "amber" },
        { type: "show", nodes: ["router"], frame: "local" },
      ],
    },
    {
      title: "Discover",
      desc: "Shout to the whole network",
      detail:
        "Without an address of its own, the laptop sends from 0.0.0.0 to the broadcast address 255.255.255.255, so every device on the local network receives it. Only DHCP servers answer.",
      facts: [
        ["From", "0.0.0.0, UDP port 68"],
        ["To", "255.255.255.255, port 67"],
        ["Carries", "MAC, transaction ID"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "DISCOVER",
          ["0.0.0.0 → 255.255.255.255", "any DHCP server out there?"],
          createDhcpRow(
            0,
            "0.0.0.0",
            "255.255.255.255",
            `DHCP Discover - Transaction ID ${DHCP_INITIAL_XID_STR}`,
            342,
            createDhcpClientWire({
              xid: +DHCP_INITIAL_XID_STR,
              options: [
                [53, 1],
                [61, "mac"],
                [12, DHCP_HOSTNAME],
                [60, "MSFT 5.0"],
                [55, DHCP_PARAM_REQUEST_LIST],
              ],
            }),
          ),
        ),
      ],
    },
    {
      title: "Offer",
      desc: "The router proposes an address",
      detail:
        "The router’s DHCP server picks a free address and offers it with the rest of the settings. The laptop can’t use an IP address yet, so the offer goes straight to its MAC address (some clients ask for a broadcast instead).",
      facts: [
        ["Offered", "192.168.1.10/24"],
        ["Gateway, DNS", "192.168.1.1, 8.8.8.8"],
        ["Lease", "86,400 s (24 h)"],
      ],
      events: [
        packetEvent(
          "router",
          "client",
          "violet",
          "OFFER",
          ["offer: 192.168.1.10/24", "gateway, DNS, lease 24 h"],
          createDhcpRow(
            0.004,
            ROUTER_IP,
            CLIENT_IP,
            `DHCP Offer - Transaction ID ${DHCP_INITIAL_XID_STR}`,
            342,
            createDhcpServerWire({
              xid: +DHCP_INITIAL_XID_STR,
              yiaddr: CLIENT_IP,
              options: [[53, 2], ...DHCP_LEASE_OPTIONS],
            }),
          ),
        ),
      ],
    },
    {
      title: "Request",
      desc: "Accept, out loud",
      detail:
        "The laptop asks for the offered address, naming the server it chose. It still broadcasts, so any other DHCP server that made an offer learns it wasn’t picked and can release its address.",
      facts: [
        ["Requests", "192.168.1.10"],
        ["Chosen server", "192.168.1.1"],
        ["Sent to", "255.255.255.255"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "REQUEST",
          ["I’ll take 192.168.1.10", "from server 192.168.1.1"],
          createDhcpRow(
            0.006,
            "0.0.0.0",
            "255.255.255.255",
            `DHCP Request - Transaction ID ${DHCP_INITIAL_XID_STR}`,
            364,
            createDhcpClientWire({
              xid: +DHCP_INITIAL_XID_STR,
              options: [
                [53, 3],
                [61, "mac"],
                [50, CLIENT_IP],
                [54, ROUTER_IP],
                [12, DHCP_HOSTNAME],
                [81, DHCP_HOSTNAME],
                [60, "MSFT 5.0"],
                [55, DHCP_PARAM_REQUEST_LIST],
              ],
            }),
          ),
        ),
      ],
    },
    {
      title: "Acknowledge",
      desc: "The address is the laptop’s",
      detail:
        "The server confirms, and the laptop configures its address, mask, gateway and DNS server. Many systems first check with ARP that no other device is already using the address.",
      facts: [
        ["Address", "192.168.1.10/24"],
        ["Gateway", "192.168.1.1"],
        ["DNS server", "8.8.8.8"],
      ],
      events: [
        packetEvent(
          "router",
          "client",
          "violet",
          "ACK",
          ["192.168.1.10 is yours", "for 24 hours"],
          createDhcpRow(
            0.009,
            ROUTER_IP,
            CLIENT_IP,
            `DHCP ACK - Transaction ID ${DHCP_INITIAL_XID_STR}`,
            342,
            createDhcpServerWire({
              xid: +DHCP_INITIAL_XID_STR,
              yiaddr: CLIENT_IP,
              options: [[53, 5], ...DHCP_LEASE_OPTIONS],
            }),
          ),
        ),
        { type: "note", at: "client", text: "192.168.1.10/24 · 24 H LEASE", tone: "green" },
      ],
    },
    {
      title: "Renew",
      desc: "Halfway through the lease",
      detail:
        "Twelve hours later, half the lease has passed. The laptop now has an address, so it asks the router directly to extend the lease, and the router resets it to 24 hours. If the router didn’t answer, it would broadcast at 87.5%.",
      facts: [
        ["When", "50% of lease (T1 = 12 h)"],
        ["Sent to", "The router (unicast)"],
        ["If unanswered", "Broadcast at 87.5% (T2)"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "REQUEST",
          ["renew 192.168.1.10", "sent straight to 192.168.1.1"],
          createDhcpRow(
            43200,
            CLIENT_IP,
            ROUTER_IP,
            `DHCP Request - Transaction ID ${DHCP_RENEW_XID_STR}`,
            352,
            createDhcpClientWire({
              xid: +DHCP_RENEW_XID_STR,
              ciaddr: CLIENT_IP,
              options: [
                [53, 3],
                [61, "mac"],
                [12, DHCP_HOSTNAME],
                [81, DHCP_HOSTNAME],
                [60, "MSFT 5.0"],
                [55, DHCP_PARAM_REQUEST_LIST],
              ],
            }),
          ),
        ),
        packetEvent(
          "router",
          "client",
          "violet",
          "ACK",
          ["lease renewed", "another 24 hours"],
          createDhcpRow(
            43200.003,
            ROUTER_IP,
            CLIENT_IP,
            `DHCP ACK - Transaction ID ${DHCP_RENEW_XID_STR}`,
            342,
            createDhcpServerWire({
              xid: +DHCP_RENEW_XID_STR,
              ciaddr: CLIENT_IP,
              yiaddr: CLIENT_IP,
              options: [[53, 5], ...DHCP_LEASE_OPTIONS],
            }),
          ),
        ),
      ],
    },
  ],
};

const ICMP_WEB_IP = "203.0.113.10";

const ICMP_ISP_ROUTER_IP = "198.51.100.1";

const createIcmpRow = (e, t, s, a, n, o) => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: "ICMP",
  info: a,
  len: n,
  wire: o,
});

const PING_PAYLOAD_ASCII = "abcdefghijklmnopqrstuvwabcdefghi";

const createEchoIcmpWire = (e, t, s) => ({
  icmp: { type: e, code: 0, id: 1, seq: t, data: PING_PAYLOAD_ASCII },
  ...(s ? { ttl: s } : {}),
});

const createErrorIcmpWire = (e, t, s, a = "all") => ({
  icmp: { type: e, code: t, quote: -1, ttl: s, quoteBytes: a },
});

export const icmpLesson: Lesson = {
  id: "icmp",
  name: "ICMP",
  title: "Network Diagnostics",
  layer: 3,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-router": 0.001, "client-internet": 0.005, "client-web": 0.017 },
  legend: [
    ["amber", "Ping / probe"],
    ["green", "Echo reply"],
    ["slate", "Error report"],
  ],
  overview: {
    full: "Internet Control Message Protocol",
    description:
      "ICMP is how the network reports back: a router says a packet’s time ran out, a server says nothing is listening on a port. Tools like ping and traceroute are built from these messages. It travels inside IP but carries no application data.",
    facts: [
      ["Layer", "Network (Layer 3)"],
      ["Carried in", "IP (protocol 1)"],
      ["Messages", "A type and a code"],
      ["Tools", "ping, tracert / traceroute"],
      ["Often", "Filtered by firewalls"],
      ["Defined In", "RFC 792 (IPv6: RFC 4443)"],
    ],
  },
  outro: {
    title: "The network answered",
    desc: "Replies, expiries and errors",
    text: "An echo request measured the round trip, packets with a small TTL made each router on the path identify itself, and a closed port was reported straight back. Press REPLAY to watch it again.",
    facts: [
      ["Round trip", "34 ms"],
      ["Path", "12 routers, server at hop 13"],
      ["Types used", "8, 0, 11 and 3"],
      ["Reply TTL", "52 (64 − 12 routers)"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Ping",
      desc: "Echo request",
      detail:
        "“ping -n 1 203.0.113.10” sends one ICMP echo request (plain ping sends four, a second apart): type 8, code 0, with an identifier, a sequence number and 32 bytes of filler. The server’s system answers by itself, no application needed.",
      facts: [
        ["Type, code", "8, 0 (echo request)"],
        ["Data", "32 bytes (Windows)"],
        ["TTL", "128"],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "full" },
        packetEvent(
          "client",
          "web",
          "amber",
          "ECHO REQUEST",
          ["type 8 · seq 1", "32 bytes of data"],
          createIcmpRow(
            0,
            CLIENT_IP,
            ICMP_WEB_IP,
            "Echo (ping) request id=0x0001, seq=1, ttl=128",
            "74 B",
            createEchoIcmpWire(8, 1),
          ),
        ),
      ],
    },
    {
      title: "Echo Reply",
      desc: "Round-trip time",
      detail:
        "The server sends back an echo reply, type 0, with the same identifier, sequence number and data. Ping prints the time it took and the TTL the reply arrived with: “bytes=32 time=34ms TTL=52”.",
      facts: [
        ["Type, code", "0, 0 (echo reply)"],
        ["Round trip", "34 ms"],
        ["TTL on arrival", "52 (64 − 12 routers)"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "green",
          "ECHO REPLY",
          ["type 0 · seq 1", "same 32 bytes back"],
          createIcmpRow(
            0.017,
            ICMP_WEB_IP,
            CLIENT_IP,
            "Echo (ping) reply id=0x0001, seq=1, ttl=52",
            "74 B",
            createEchoIcmpWire(0, 1),
          ),
        ),
        { type: "note", at: "client", text: "TIME=34MS TTL=52", tone: "green" },
      ],
    },
    {
      title: "TTL 1",
      desc: "The first router answers",
      detail:
        "“ping -n 1 -i 1” sends the same request with a TTL of 1. The home router lowers it to 0, so it must drop the packet, and it sends back a Time Exceeded message from its own address: “Reply from 192.168.1.1: TTL expired in transit.”",
      facts: [
        ["Sent with", "TTL 1"],
        ["Dropped by", "Router 192.168.1.1"],
        ["Type, code", "11, 0 (time exceeded)"],
      ],
      events: [
        packetEvent(
          "client",
          "router",
          "amber",
          "TTL 1",
          ["echo request", "expires at the first router"],
          createIcmpRow(
            1,
            CLIENT_IP,
            ICMP_WEB_IP,
            "Echo (ping) request id=0x0001, seq=2, ttl=1",
            "74 B",
            createEchoIcmpWire(8, 2, 1),
          ),
        ),
        packetEvent(
          "router",
          "client",
          "slate",
          "TIME EXCEEDED",
          ["type 11 · from 192.168.1.1", "quotes the dropped header"],
          createIcmpRow(
            1.001,
            ROUTER_IP,
            CLIENT_IP,
            "Time-to-live exceeded (in transit)",
            "102 B",
            createErrorIcmpWire(11, 0, 1),
          ),
        ),
      ],
    },
    {
      title: "TTL 2",
      desc: "The next router answers",
      detail:
        "With “-i 2”, the home router lowers the TTL to 1 and forwards it. The first router at the internet provider lowers it to 0 and reports back from 198.51.100.1. The home router translates the report back to the laptop like any reply.",
      facts: [
        ["Sent with", "TTL 2"],
        ["Dropped by", "ISP router 198.51.100.1"],
        ["Type, code", "11, 0 (time exceeded)"],
      ],
      events: [
        packetEvent(
          "client",
          "internet",
          "amber",
          "TTL 2",
          ["echo request", "expires at the second router"],
          createIcmpRow(
            2,
            CLIENT_IP,
            ICMP_WEB_IP,
            "Echo (ping) request id=0x0001, seq=3, ttl=2",
            "74 B",
            createEchoIcmpWire(8, 3, 2),
          ),
        ),
        { type: "note", at: "internet", text: "HOP 2 · 198.51.100.1", tone: "navy" },
        packetEvent(
          "internet",
          "client",
          "slate",
          "TIME EXCEEDED",
          ["type 11 · from 198.51.100.1", "quotes the dropped header"],
          createIcmpRow(
            2.005,
            ICMP_ISP_ROUTER_IP,
            CLIENT_IP,
            "Time-to-live exceeded (in transit)",
            "70 B",
            createErrorIcmpWire(11, 0, 1, 8),
          ),
        ),
      ],
    },
    {
      title: "That’s Traceroute",
      desc: "TTL 1, 2, 3 … until it arrives",
      detail:
        "tracert automates this: it raises the TTL by one each time, sends three probes per hop and lists who reports back. Hops 3 to 12 work the same way, and with TTL 13 the request finally reaches the server, which replies normally.",
      facts: [
        ["Hops", "12 routers, then the server"],
        ["Per hop", "3 probes"],
        ["On Linux", "traceroute sends UDP"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "TTL 13",
          ["echo request", "enough hops to arrive"],
          createIcmpRow(
            3,
            CLIENT_IP,
            ICMP_WEB_IP,
            "Echo (ping) request id=0x0001, seq=4, ttl=13",
            "74 B",
            createEchoIcmpWire(8, 4, 13),
          ),
        ),
        packetEvent(
          "web",
          "client",
          "green",
          "ECHO REPLY",
          ["the server itself answers", "end of the route"],
          createIcmpRow(
            3.017,
            ICMP_WEB_IP,
            CLIENT_IP,
            "Echo (ping) reply id=0x0001, seq=4, ttl=52",
            "74 B",
            createEchoIcmpWire(0, 4),
          ),
        ),
      ],
    },
    {
      title: "Unreachable",
      desc: "Nothing listening on that port",
      detail:
        "An app sends a UDP datagram to port 9999, where nothing is listening. The server can’t deliver it, so it replies with Destination Unreachable, code 3 (port unreachable), quoting the start of the datagram. Many firewalls drop such packets silently instead.",
      facts: [
        ["Type, code", "3, 3 (port unreachable)"],
        ["Other codes", "0 net, 1 host, 4 too big"],
        ["Firewalls", "Often silent instead"],
      ],
      events: [
        packetEvent("client", "web", "amber", "UDP", ["to port 9999", "nothing listening there"], {
          time: formatSeconds(4),
          src: CLIENT_IP,
          dst: ICMP_WEB_IP,
          proto: "UDP",
          info: "52500 → 9999 Len=18",
          len: "60 B",
          wire: {
            udp: {
              sport: 52500,
              dport: 9999,
              data: {
                ascii: "hello, anyone here",
                name: "App data",
                note: "What the app sent; nothing on the server is listening for it.",
              },
            },
          },
        }),
        packetEvent(
          "web",
          "client",
          "slate",
          "UNREACHABLE",
          ["type 3 · code 3", "port unreachable"],
          createIcmpRow(
            4.017,
            ICMP_WEB_IP,
            CLIENT_IP,
            "Destination unreachable (Port unreachable)",
            "88 B",
            createErrorIcmpWire(3, 3, 116),
          ),
        ),
      ],
    },
  ],
};

const SMTP_SUBMISSION_IP = "203.0.113.25";

const SMTP_DNS_IP = "8.8.8.8";

const SMTP_MX_IP = "198.51.100.25";

const SMTP_CLIENT_ENDPOINTS = createEndpointPair(CLIENT_IP, 52900, SMTP_SUBMISSION_IP, 465);

const SMTP_RELAY_ENDPOINTS = createEndpointPair(SMTP_SUBMISSION_IP, 41522, SMTP_MX_IP, 25);

function createSmtpPacketEvent(e, t, s, a, n, o = !0) {
  const r = t === SMTP_MX_IP || s === SMTP_MX_IP,
    i = r ? SMTP_RELAY_ENDPOINTS : SMTP_CLIENT_ENDPOINTS,
    l = n.message ? n.message + CRLF_DOT_LEN : crlfByteLength(...n),
    c = n.message ? `${n.what}, then a line holding only “.”` : "SMTP",
    h = o
      ? n.message
        ? buildTlsAppDataOpaque(l, c)
        : buildTlsAppDataText(n, c)
      : { text: n, name: "SMTP" };
  return {
    time: formatSeconds(e),
    src: t,
    dst: s,
    proto: o ? "SMTP (TLS)" : "SMTP",
    info: a,
    len: `${(o ? tlsEthernetFrameBytes(l) : ethernetFrameBytes(l)) + (r ? TCP_TS_OPTION_SIZE : 0)} B`,
    wire: tcpWire(i, t, "PA", h),
  };
}

const SMTP_DNS_EDNS = { sport: 44210, edns: { size: 1232 } };

const createSmtpDnsRow = (e, t, s, a, n, o) => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: "DNS",
  info: a,
  len: `${n} B`,
  wire: {
    udp:
      t === SMTP_SUBMISSION_IP
        ? {
            sport: SMTP_DNS_EDNS.sport,
            dport: 53,
            data: { dns: { rd: !0, edns: SMTP_DNS_EDNS.edns, ...o } },
          }
        : {
            sport: 53,
            dport: SMTP_DNS_EDNS.sport,
            data: {
              dns: { response: !0, rd: !0, ra: !0, edns: SMTP_DNS_EDNS.edns, exampleTtl: !0, ...o },
            },
          },
  },
});

const SMTP_LOCKED_OPT = { locked: !0 };

const SMTP_SUBMISSION_MSG_LEN = 316;

const SMTP_RELAY_MSG_LEN = 1316;

const CRLF_DOT_LEN = crlfByteLength(".");

const SMTP_BANNER_LINES = ["220 smtp.example.com ESMTP Postfix"];

const SMTP_EHLO_CLIENT_LINES = ["EHLO alice-laptop"];

const SMTP_EHLO_REPLY_LINES = [
  "250-smtp.example.com",
  "250-PIPELINING",
  "250-SIZE 52428800",
  "250-AUTH PLAIN LOGIN",
  "250-ENHANCEDSTATUSCODES",
  "250-8BITMIME",
  "250 SMTPUTF8",
];

const SMTP_AUTH_PLAIN_LINES = ["AUTH PLAIN AGFsaWNlAHNlY3JldA=="];

const SMTP_AUTH_OK_LINES = ["235 2.7.0 Authentication successful"];

const SMTP_ENVELOPE_LINES = ["MAIL FROM:<alice@example.com>", "RCPT TO:<bob@example.org>", "DATA"];

const SMTP_ENVELOPE_REPLY_LINES = [
  "250 2.1.0 Ok",
  "250 2.1.5 Ok",
  "354 End data with <CR><LF>.<CR><LF>",
];

const SMTP_QUEUED_SUBMISSION_LINES = ["250 2.0.0 Ok: queued as 4A1F2C3D9E"];

const SMTP_MX_BANNER_LINES = ["220 mx.example.org ESMTP Postfix"];

const SMTP_EHLO_RELAY_LINES = ["EHLO smtp.example.com"];

const SMTP_MX_EHLO_REPLY_LINES = [
  "250-mx.example.org",
  "250-PIPELINING",
  "250-SIZE 52428800",
  "250-STARTTLS",
  "250-ENHANCEDSTATUSCODES",
  "250-8BITMIME",
  "250 SMTPUTF8",
];

const SMTP_STARTTLS_LINES = ["STARTTLS"];

const SMTP_STARTTLS_READY_LINES = ["220 2.0.0 Ready to start TLS"];

const SMTP_MX_POST_TLS_EHLO_LINES = SMTP_MX_EHLO_REPLY_LINES.filter((e) => e !== "250-STARTTLS");

const SMTP_MX_ENVELOPE_LINES = [
  `MAIL FROM:<alice@example.com> SIZE=${SMTP_RELAY_MSG_LEN}`,
  "RCPT TO:<bob@example.org>",
  "DATA",
];

const SMTP_QUEUED_MX_LINES = ["250 2.0.0 Ok: queued as 7B3E9F01A2"];

export const smtpLesson: Lesson = {
  id: "smtp",
  name: "SMTP",
  title: "Sending Email",
  layer: 7,
  nodes: ["client", "router", "internet", "dns", "web", "mx"],
  latency: { "client-web": 0.015, "web-dns": 0.005, "web-mx": 0.02 },
  lifelines: ["client", "web", "dns", "mx"],
  labels: { web: ["smtp.example.com", SMTP_SUBMISSION_IP], mx: ["mx.example.org", SMTP_MX_IP] },
  legend: [
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "SMTP command"],
    ["violet", "SMTP reply"],
    ["blue", "DNS"],
  ],
  overview: {
    full: "Simple Mail Transfer Protocol",
    description:
      "SMTP moves email: from your mail app to your provider’s server, and from that server to the recipient’s. It is a conversation of short text commands, each answered with a three-digit reply code. Reading mail is a different job, done with IMAP or POP3.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "465/587 submit, 25 relay"],
      ["Transport", "TCP, usually with TLS"],
      ["Commands", "EHLO, MAIL, RCPT, DATA"],
      ["Replies", "2xx ok, 3xx go on, 4/5xx error"],
      ["Defined In", "RFC 5321, RFC 6409"],
    ],
  },
  outro: {
    title: "Mail delivered",
    desc: "Two hops, one message",
    text: "Alice’s app handed the message to her provider over an encrypted, logged-in connection. The provider found Bob’s mail server in DNS and relayed it there, upgrading that link to TLS. It now waits in Bob’s mailbox until he reads it with IMAP or POP3.",
    facts: [
      ["Hops", "Laptop → provider → Bob’s"],
      ["Submission", "Port 465, TLS, login"],
      ["Relay", "Port 25, STARTTLS"],
      ["Checks at Bob’s", "SPF, DKIM, DMARC"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Connect Securely",
      desc: "Port 465, TLS from the start",
      detail:
        "Alice presses Send. Her mail app connects to her provider’s submission server, smtp.example.com, on port 465. On this port TLS starts immediately, so the whole SMTP conversation, including her password, is encrypted.",
      facts: [
        ["Server", "smtp.example.com:465"],
        ["Security", "TLS from the start"],
        ["Then", "SMTP inside TLS"],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "path" },
        ...buildTcpHandshake({
          dst: SMTP_SUBMISSION_IP,
          sport: 52900,
          dport: 465,
          t: [0, 0.015, 0.03],
        }),
        ...buildTlsHandshake({
          dst: SMTP_SUBMISSION_IP,
          sni: "smtp.example.com",
          sport: 52900,
          dport: 465,
          t: [0.03, 0.045, 0.062],
        }),
      ],
    },
    {
      title: "Greeting & Login",
      desc: "EHLO, then AUTH",
      detail:
        "The server greets with code 220. The app says EHLO and the server lists what it supports, including AUTH. The app logs in with AUTH PLAIN (user name and password, base64-encoded) and gets 235: authenticated.",
      facts: [
        ["Greeting", "220 … ESMTP"],
        ["Capabilities", "AUTH, PIPELINING, SIZE …"],
        ["Login result", "235 2.7.0"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "violet",
          "220",
          ["220 smtp.example.com ESMTP"],
          createSmtpPacketEvent(
            0.077,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "220 smtp.example.com ESMTP Postfix",
            SMTP_BANNER_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "EHLO",
          ["EHLO alice-laptop"],
          createSmtpPacketEvent(
            0.092,
            CLIENT_IP,
            SMTP_SUBMISSION_IP,
            "EHLO alice-laptop",
            SMTP_EHLO_CLIENT_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "250",
          ["250-PIPELINING", "250-AUTH PLAIN LOGIN …"],
          createSmtpPacketEvent(
            0.107,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "250 capabilities (PIPELINING, SIZE, AUTH …)",
            SMTP_EHLO_REPLY_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "AUTH",
          ["AUTH PLAIN AGFsaWNlAHNl…", "user and password, base64"],
          createSmtpPacketEvent(
            0.122,
            CLIENT_IP,
            SMTP_SUBMISSION_IP,
            "AUTH PLAIN (credentials)",
            SMTP_AUTH_PLAIN_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "235",
          ["235 2.7.0 Authentication", "successful"],
          createSmtpPacketEvent(
            0.137,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "235 2.7.0 Authentication successful",
            SMTP_AUTH_OK_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Send the Message",
      desc: "Envelope, then content",
      detail:
        "MAIL FROM and RCPT TO are the envelope: sender and recipient. PIPELINING lets all three commands share one packet. After 354 comes the message, ended by a line holding just a dot.",
      facts: [
        ["Envelope", "alice@ → bob@example.org"],
        ["Content ends", "A line with only “.”"],
        ["Result", "250 Ok: queued"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "MAIL · RCPT · DATA",
          ["MAIL FROM:<alice@example.com>", "RCPT TO:<bob@example.org>", "DATA"],
          createSmtpPacketEvent(
            0.152,
            CLIENT_IP,
            SMTP_SUBMISSION_IP,
            "MAIL FROM, RCPT TO, DATA (pipelined)",
            SMTP_ENVELOPE_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "250 · 250 · 354",
          ["250 2.1.0 Ok · 250 2.1.5 Ok", "354 End data with", "<CR><LF>.<CR><LF>"],
          createSmtpPacketEvent(
            0.167,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "250 Ok, 250 Ok, 354 End data with <CR><LF>.<CR><LF>",
            SMTP_ENVELOPE_REPLY_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "MESSAGE",
          ["Subject: Lunch on Friday?", "… message …", "."],
          createSmtpPacketEvent(
            0.182,
            CLIENT_IP,
            SMTP_SUBMISSION_IP,
            `Message (${SMTP_SUBMISSION_MSG_LEN} bytes), then “.”`,
            {
              message: SMTP_SUBMISSION_MSG_LEN,
              what: `Alice’s message (${SMTP_SUBMISSION_MSG_LEN} bytes)`,
            },
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "250 QUEUED",
          ["250 2.0.0 Ok: queued", "as 4A1F2C3D9E"],
          createSmtpPacketEvent(
            0.2,
            SMTP_SUBMISSION_IP,
            CLIENT_IP,
            "250 2.0.0 Ok: queued as 4A1F2C3D9E",
            SMTP_QUEUED_SUBMISSION_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Find Bob’s Server",
      desc: "An MX lookup in DNS",
      detail:
        "Alice’s provider now has to deliver to example.org. It asks DNS for that domain’s MX record, which names the server that accepts its mail, then looks up that server’s address.",
      facts: [
        ["MX record", "10 mx.example.org"],
        ["Address", "A 198.51.100.25"],
        ["Asked by", "Alice’s provider"],
      ],
      events: [
        { type: "show", nodes: ["dns"], frame: "mailhost" },
        packetEvent(
          "web",
          "dns",
          "blue",
          "DNS QUERY",
          ["MX? example.org"],
          createSmtpDnsRow(
            0.205,
            SMTP_SUBMISSION_IP,
            SMTP_DNS_IP,
            "Standard query MX example.org",
            82,
            {
              id: 28165,
              q: ["example.org", "MX"],
            },
          ),
        ),
        packetEvent(
          "dns",
          "web",
          "blue",
          "DNS REPLY",
          ["example.org MX 10", "mx.example.org"],
          createSmtpDnsRow(
            0.21,
            SMTP_DNS_IP,
            SMTP_SUBMISSION_IP,
            "Standard query response MX 10 mx.example.org",
            101,
            {
              id: 28165,
              q: ["example.org", "MX"],
              an: [["example.org", "MX", 3600, [10, "mx.example.org"]]],
            },
          ),
        ),
        packetEvent(
          "web",
          "dns",
          "blue",
          "DNS QUERY",
          ["A? mx.example.org"],
          createSmtpDnsRow(
            0.215,
            SMTP_SUBMISSION_IP,
            SMTP_DNS_IP,
            "Standard query A mx.example.org",
            85,
            {
              id: 8146,
              q: ["mx.example.org", "A"],
            },
          ),
        ),
        packetEvent(
          "dns",
          "web",
          "blue",
          "DNS REPLY",
          ["mx.example.org", "A 198.51.100.25"],
          createSmtpDnsRow(
            0.22,
            SMTP_DNS_IP,
            SMTP_SUBMISSION_IP,
            "Standard query response A 198.51.100.25",
            101,
            {
              id: 8146,
              q: ["mx.example.org", "A"],
              an: [["mx.example.org", "A", 3600, "198.51.100.25"]],
            },
          ),
        ),
      ],
    },
    {
      title: "Server to Server",
      desc: "Port 25, upgraded with STARTTLS",
      detail:
        "The provider connects to mx.example.org on port 25. This conversation starts in plain text: the greeting and EHLO reply advertise STARTTLS, the provider asks for it, gets 220 and both sides switch to TLS.",
      facts: [
        ["Server", "mx.example.org:25"],
        ["Starts as", "Plain text"],
        ["Upgrade", "STARTTLS → 220 → TLS"],
      ],
      events: [
        { type: "show", nodes: ["mx"], frame: "full" },
        ...buildTcpHandshake({
          from: "web",
          to: "mx",
          src: SMTP_SUBMISSION_IP,
          dst: SMTP_MX_IP,
          sport: 41522,
          dport: 25,
          t: [0.225, 0.245, 0.265],
          linux: !0,
        }),
        packetEvent(
          "mx",
          "web",
          "violet",
          "220",
          ["220 mx.example.org ESMTP"],
          createSmtpPacketEvent(
            0.285,
            SMTP_MX_IP,
            SMTP_SUBMISSION_IP,
            "220 mx.example.org ESMTP Postfix",
            SMTP_MX_BANNER_LINES,
            !1,
          ),
        ),
        packetEvent(
          "web",
          "mx",
          "amber",
          "EHLO",
          ["EHLO smtp.example.com"],
          createSmtpPacketEvent(
            0.305,
            SMTP_SUBMISSION_IP,
            SMTP_MX_IP,
            "EHLO smtp.example.com",
            SMTP_EHLO_RELAY_LINES,
            !1,
          ),
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "250",
          ["250-PIPELINING", "250-STARTTLS …"],
          createSmtpPacketEvent(
            0.325,
            SMTP_MX_IP,
            SMTP_SUBMISSION_IP,
            "250 capabilities (PIPELINING, STARTTLS …)",
            SMTP_MX_EHLO_REPLY_LINES,
            !1,
          ),
        ),
        packetEvent(
          "web",
          "mx",
          "amber",
          "STARTTLS",
          ["STARTTLS"],
          createSmtpPacketEvent(
            0.345,
            SMTP_SUBMISSION_IP,
            SMTP_MX_IP,
            "STARTTLS",
            SMTP_STARTTLS_LINES,
            !1,
          ),
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "220",
          ["220 2.0.0 Ready to", "start TLS"],
          createSmtpPacketEvent(
            0.365,
            SMTP_MX_IP,
            SMTP_SUBMISSION_IP,
            "220 2.0.0 Ready to start TLS",
            SMTP_STARTTLS_READY_LINES,
            !1,
          ),
        ),
        ...buildTlsHandshake({
          from: "web",
          to: "mx",
          src: SMTP_SUBMISSION_IP,
          dst: SMTP_MX_IP,
          sni: "mx.example.org",
          sport: 41522,
          dport: 25,
          t: [0.385, 0.405, 0.427],
          linux: !0,
        }),
      ],
    },
    {
      title: "Deliver",
      desc: "The same transaction again",
      detail:
        "With TLS on, the provider repeats EHLO, then the envelope and the message, now with a DKIM signature and a Received header added. Bob’s server checks SPF, DKIM and DMARC and accepts it.",
      facts: [
        ["Login needed", "No (server to server)"],
        ["Message", "1,316 bytes (signed)"],
        ["Result", "250 Ok: queued"],
      ],
      events: [
        packetEvent(
          "web",
          "mx",
          "amber",
          "EHLO",
          ["EHLO smtp.example.com"],
          createSmtpPacketEvent(
            0.427,
            SMTP_SUBMISSION_IP,
            SMTP_MX_IP,
            "EHLO smtp.example.com",
            SMTP_EHLO_RELAY_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "250",
          ["250-PIPELINING", "250-SIZE …"],
          createSmtpPacketEvent(
            0.447,
            SMTP_MX_IP,
            SMTP_SUBMISSION_IP,
            "250 capabilities (PIPELINING, SIZE …)",
            SMTP_MX_POST_TLS_EHLO_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "mx",
          "amber",
          "MAIL · RCPT · DATA",
          ["MAIL FROM:<alice@example.com>", "RCPT TO:<bob@example.org>", "DATA"],
          createSmtpPacketEvent(
            0.467,
            SMTP_SUBMISSION_IP,
            SMTP_MX_IP,
            `MAIL FROM (SIZE=${SMTP_RELAY_MSG_LEN}), RCPT TO, DATA`,
            SMTP_MX_ENVELOPE_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "250 · 250 · 354",
          ["250 2.1.0 Ok · 250 2.1.5 Ok", "354 End data with", "<CR><LF>.<CR><LF>"],
          createSmtpPacketEvent(
            0.487,
            SMTP_MX_IP,
            SMTP_SUBMISSION_IP,
            "250 Ok, 250 Ok, 354 End data with <CR><LF>.<CR><LF>",
            SMTP_ENVELOPE_REPLY_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "mx",
          "amber",
          "MESSAGE",
          ["DKIM-Signature: …", "… message …", "."],
          createSmtpPacketEvent(
            0.507,
            SMTP_SUBMISSION_IP,
            SMTP_MX_IP,
            `Message (${SMTP_RELAY_MSG_LEN.toLocaleString("en-US")} bytes), then “.”`,
            {
              message: SMTP_RELAY_MSG_LEN,
              what: `The signed message (${SMTP_RELAY_MSG_LEN.toLocaleString("en-US")} bytes)`,
            },
          ),
          SMTP_LOCKED_OPT,
        ),
        packetEvent(
          "mx",
          "web",
          "violet",
          "250 QUEUED",
          ["250 2.0.0 Ok: queued", "as 7B3E9F01A2"],
          createSmtpPacketEvent(
            0.538,
            SMTP_MX_IP,
            SMTP_SUBMISSION_IP,
            "250 2.0.0 Ok: queued as 7B3E9F01A2",
            SMTP_QUEUED_MX_LINES,
          ),
          SMTP_LOCKED_OPT,
        ),
        { type: "note", at: "mx", text: "IN BOB’S MAILBOX", tone: "green" },
      ],
    },
  ],
};

const POP3_SERVER_IP = "198.51.100.110";

const POP3_ENDPOINTS = createEndpointPair(CLIENT_IP, 53010, POP3_SERVER_IP, 995);

const pop3Lines = (...e) => e;

const createPop3Row = (e, t, s, a, n) => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: "POP (TLS)",
  info: a,
  len: `${tlsEthernetFrameBytes(crlfByteLength(...n))} B`,
  wire: tcpWire(POP3_ENDPOINTS, t, "PA", buildTlsAppDataText(n, "POP3")),
});

const POP3_LOCKED_OPT = { locked: !0 };

const POP3_RETR_TLS_LEN =
  crlfByteLength("+OK 1904 octets") + 1904 + crlfByteLength(".") + TLS_RECORD_OVERHEAD;

const POP3_RETR_WIRE_BYTES =
  POP3_RETR_TLS_LEN +
  countMssSegments(POP3_RETR_TLS_LEN) * (ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE);

export const pop3Lesson: Lesson = {
  id: "pop3",
  name: "POP3",
  title: "Downloading Email",
  layer: 7,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-web": 0.015 },
  labels: { web: ["pop.example.org", POP3_SERVER_IP] },
  legend: [
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "POP3 command"],
    ["violet", "POP3 reply"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "Post Office Protocol, version 3",
    description:
      "POP3 lets a mail app download messages from a mailbox on a server. It was designed for one device that fetches mail and then removes it from the server. Commands are short words, and every reply starts with +OK or -ERR.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "995 (TLS), 110 (STLS)"],
      ["Transport", "TCP"],
      ["Model", "Download, then delete"],
      ["Replies", "+OK or -ERR"],
      ["Defined In", "RFC 1939"],
    ],
  },
  outro: {
    title: "Mail downloaded",
    desc: "And gone from the server",
    text: "Bob’s app logged in, saw two messages, downloaded the first and deleted it, which the server carried out at QUIT. That message now lives only on this laptop, which is why POP3 suits one device and IMAP suits several.",
    facts: [
      ["Messages", "2 waiting, 1 downloaded"],
      ["Deleted", "At QUIT (UPDATE state)"],
      ["Port", "995, TLS from the start"],
      ["Best for", "A single device"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Connect Securely",
      desc: "Port 995, TLS from the start",
      detail:
        "Bob’s mail app connects to pop.example.org on port 995, where TLS starts right away. Inside it, the server greets with +OK. (On port 110 the session starts in plain text and is upgraded with the STLS command.)",
      facts: [
        ["Server", "pop.example.org:995"],
        ["Security", "TLS from the start"],
        ["Greeting", "+OK Dovecot ready."],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "path" },
        ...buildTcpHandshake({
          dst: POP3_SERVER_IP,
          sport: 53010,
          dport: 995,
          t: [0, 0.015, 0.03],
        }),
        ...buildTlsHandshake({
          dst: POP3_SERVER_IP,
          sni: "pop.example.org",
          sport: 53010,
          dport: 995,
          t: [0.03, 0.045, 0.062],
        }),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK Dovecot ready."],
          createPop3Row(
            0.077,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK Dovecot ready.",
            pop3Lines("+OK Dovecot ready."),
          ),
          POP3_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Log In",
      desc: "USER, then PASS",
      detail:
        "The app sends the user name with USER and the password with PASS. Each command gets its own +OK. Because the session is inside TLS, the password isn’t readable on the way.",
      facts: [
        ["Commands", "USER bob, PASS ••••"],
        ["Replies", "+OK, +OK Logged in."],
        ["Protected by", "TLS"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "USER",
          ["USER bob"],
          createPop3Row(0.092, CLIENT_IP, POP3_SERVER_IP, "USER bob", pop3Lines("USER bob")),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK"],
          createPop3Row(0.107, POP3_SERVER_IP, CLIENT_IP, "+OK", pop3Lines("+OK")),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "PASS",
          ["PASS ••••••"],
          createPop3Row(
            0.122,
            CLIENT_IP,
            POP3_SERVER_IP,
            "PASS (password)",
            pop3Lines("PASS secret"),
          ),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK Logged in."],
          createPop3Row(
            0.137,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK Logged in.",
            pop3Lines("+OK Logged in."),
          ),
          POP3_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Check the Mailbox",
      desc: "STAT and LIST",
      detail:
        "STAT returns the number of messages and their total size: 2 messages, 5120 bytes. LIST gives each message’s number and size, ending with a line holding just a dot.",
      facts: [
        ["STAT", "+OK 2 5120"],
        ["Message 1", "1904 bytes"],
        ["Message 2", "3216 bytes"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "STAT",
          ["STAT"],
          createPop3Row(0.152, CLIENT_IP, POP3_SERVER_IP, "STAT", pop3Lines("STAT")),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK 2 5120"],
          createPop3Row(0.167, POP3_SERVER_IP, CLIENT_IP, "+OK 2 5120", pop3Lines("+OK 2 5120")),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "LIST",
          ["LIST"],
          createPop3Row(0.182, CLIENT_IP, POP3_SERVER_IP, "LIST", pop3Lines("LIST")),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK 2 messages:", "1 1904 · 2 3216 · ."],
          createPop3Row(
            0.197,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK 2 messages: 1 1904, 2 3216",
            pop3Lines("+OK 2 messages:", "1 1904", "2 3216", "."),
          ),
          POP3_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Download",
      desc: "RETR 1",
      detail:
        "RETR 1 asks for the first message. The server answers +OK with its size, then the message and a closing dot: 1904 bytes plus the reply line, two TCP segments.",
      facts: [
        ["Command", "RETR 1"],
        ["Reply", "+OK 1904 octets"],
        ["Sent as", "2 TCP segments"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "RETR 1",
          ["RETR 1"],
          createPop3Row(0.212, CLIENT_IP, POP3_SERVER_IP, "RETR 1", pop3Lines("RETR 1")),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "MESSAGE",
          ["+OK 1904 octets", "… message …", "."],
          {
            time: formatSeconds(0.227),
            src: POP3_SERVER_IP,
            dst: CLIENT_IP,
            proto: "POP (TLS)",
            info: `+OK 1904 octets, message, “.” (${countMssSegments(POP3_RETR_TLS_LEN)} segments)`,
            len: formatSegmentOrByteSize(POP3_RETR_WIRE_BYTES, countMssSegments(POP3_RETR_TLS_LEN)),
            wire: tcpWire(POP3_ENDPOINTS, POP3_SERVER_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: POP3_RETR_TLS_LEN - 5,
                  inner: {
                    what: "+OK 1904 octets, the 1,904-byte message, then a line holding only “.”",
                  },
                },
              ],
            }),
          },
          POP3_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Delete & Quit",
      desc: "Deleted only at QUIT",
      detail:
        "DELE 1 only marks the message. The server removes it when the app says QUIT: if the connection dropped before that, nothing would be deleted. Many apps offer “leave a copy on the server”, which skips DELE.",
      facts: [
        ["DELE 1", "Marks message 1"],
        ["Removed", "At QUIT"],
        ["Option", "Leave a copy on server"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "DELE 1",
          ["DELE 1"],
          createPop3Row(0.242, CLIENT_IP, POP3_SERVER_IP, "DELE 1", pop3Lines("DELE 1")),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK Marked to be deleted."],
          createPop3Row(
            0.257,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK Marked to be deleted.",
            pop3Lines("+OK Marked to be deleted."),
          ),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "QUIT",
          ["QUIT"],
          createPop3Row(0.272, CLIENT_IP, POP3_SERVER_IP, "QUIT", pop3Lines("QUIT")),
          POP3_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+OK",
          ["+OK Logging out,", "messages deleted."],
          createPop3Row(
            0.287,
            POP3_SERVER_IP,
            CLIENT_IP,
            "+OK Logging out, messages deleted.",
            pop3Lines("+OK Logging out, messages deleted."),
          ),
          POP3_LOCKED_OPT,
        ),
        { type: "note", at: "web", text: "MESSAGE 1 DELETED", tone: "amber" },
      ],
    },
  ],
};

const IMAP_SERVER_IP = "198.51.100.143";

const IMAP_ENDPOINTS = createEndpointPair(CLIENT_IP, 53140, IMAP_SERVER_IP, 993);

const imapLines = (...e) => e;

const createImapRow = (e, t, s, a, n) => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: "IMAP (TLS)",
  info: a,
  len: `${tlsEthernetFrameBytes(crlfByteLength(...n))} B`,
  wire: tcpWire(IMAP_ENDPOINTS, t, "PA", buildTlsAppDataText(n, "IMAP")),
});

const IMAP_LOCKED_OPT = { locked: !0 };

const IMAP_GREETING_LINES = imapLines(
  "* OK [CAPABILITY IMAP4rev1 IDLE LITERAL+ AUTH=PLAIN] Service ready",
);

const IMAP_LOGIN_LINES = imapLines("a1 LOGIN bob secret");

const IMAP_LOGIN_OK_LINES = imapLines("a1 OK LOGIN completed");

const IMAP_SELECT_LINES = imapLines("a2 SELECT INBOX");

const IMAP_SELECT_UNTAGGED_LINES = imapLines(
  "* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)",
  "* OK [PERMANENTFLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft \\*)] Flags permitted",
  "* 2 EXISTS",
  "* 0 RECENT",
  "* OK [UNSEEN 2] Message 2 is first unseen",
  "* OK [UIDVALIDITY 1700000000] UIDs valid",
  "* OK [UIDNEXT 3] Predicted next UID",
  "a2 OK [READ-WRITE] SELECT completed",
);

const IMAP_FETCH_LINES = imapLines("a3 FETCH 2 BODY[]");

const IMAP_FETCH_TLS_LEN =
  crlfByteLength("* 2 FETCH (FLAGS (\\Seen) BODY[] {3216}") +
  3216 +
  crlfByteLength(")", "a3 OK FETCH completed") +
  TLS_RECORD_OVERHEAD;

const IMAP_FETCH_WIRE_BYTES =
  IMAP_FETCH_TLS_LEN +
  countMssSegments(IMAP_FETCH_TLS_LEN) * (ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE);

export const imapLesson: Lesson = {
  id: "imap",
  name: "IMAP",
  title: "Mail That Stays in Sync",
  layer: 7,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-web": 0.015 },
  labels: { web: ["imap.example.org", IMAP_SERVER_IP] },
  legend: [
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "IMAP command"],
    ["violet", "IMAP response"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "Internet Message Access Protocol",
    description:
      "IMAP lets mail apps work with a mailbox that stays on the server. Folders, read and flagged marks and deletions are kept there, so a phone, a laptop and webmail all see the same mailbox. The server can also tell an app about new mail as it arrives.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "993 (TLS), 143 (STARTTLS)"],
      ["Transport", "TCP"],
      ["Model", "Mail stays on the server"],
      ["Syncs", "Folders and flags"],
      ["Defined In", "RFC 9051, RFC 3501"],
    ],
  },
  outro: {
    title: "Mailbox in sync",
    desc: "Read once, read everywhere",
    text: "Bob’s app opened his inbox, read a message, which marked it \\Seen on the server for all his devices, and then waited with IDLE until the server announced new mail. Nothing was deleted: the server still holds everything.",
    facts: [
      ["Messages", "2, then 3 (new mail)"],
      ["Read mark", "\\Seen, stored on server"],
      ["New mail", "Pushed during IDLE"],
      ["Port", "993, TLS from the start"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Connect Securely",
      desc: "Port 993, TLS from the start",
      detail:
        "Bob’s app connects to imap.example.org on port 993, where TLS starts right away. The server greets with an untagged “* OK” line that also lists its capabilities, such as IDLE.",
      facts: [
        ["Server", "imap.example.org:993"],
        ["Security", "TLS from the start"],
        ["Greeting", "* OK [CAPABILITY …]"],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "path" },
        ...buildTcpHandshake({
          dst: IMAP_SERVER_IP,
          sport: 53140,
          dport: 993,
          t: [0, 0.015, 0.03],
        }),
        ...buildTlsHandshake({
          dst: IMAP_SERVER_IP,
          sni: "imap.example.org",
          sport: 53140,
          dport: 993,
          t: [0.03, 0.045, 0.062],
        }),
        packetEvent(
          "web",
          "client",
          "violet",
          "* OK",
          ["* OK [CAPABILITY IMAP4rev1", "IDLE …] Service ready"],
          createImapRow(
            0.077,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "* OK [CAPABILITY …] Service ready",
            IMAP_GREETING_LINES,
          ),
          IMAP_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Log In",
      desc: "Commands carry tags",
      detail:
        "Every command starts with a tag the app chooses, like a1, and the server ends its answer with the same tag. That way several commands can be in flight and each reply is matched up. Lines starting with * are untagged data.",
      facts: [
        ["Command", "a1 LOGIN bob ••••"],
        ["Reply", "a1 OK LOGIN completed"],
        ["Tags", "Match replies to commands"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "a1 LOGIN",
          ["a1 LOGIN bob ••••••"],
          createImapRow(
            0.092,
            CLIENT_IP,
            IMAP_SERVER_IP,
            "a1 LOGIN (user and password)",
            IMAP_LOGIN_LINES,
          ),
          IMAP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "a1 OK",
          ["a1 OK LOGIN completed"],
          createImapRow(
            0.107,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "a1 OK LOGIN completed",
            IMAP_LOGIN_OK_LINES,
          ),
          IMAP_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Open the Inbox",
      desc: "SELECT a folder",
      detail:
        "SELECT INBOX opens the folder. The server reports the message count, the flags it supports and the first unread message, then confirms the folder is open read-write.",
      facts: [
        ["Messages", "* 2 EXISTS"],
        ["First unread", "Message 2"],
        ["Access", "[READ-WRITE]"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "a2 SELECT",
          ["a2 SELECT INBOX"],
          createImapRow(0.122, CLIENT_IP, IMAP_SERVER_IP, "a2 SELECT INBOX", IMAP_SELECT_LINES),
          IMAP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "a2 OK",
          ["* 2 EXISTS", "* OK [UNSEEN 2]", "a2 OK [READ-WRITE]"],
          createImapRow(
            0.137,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "* 2 EXISTS … a2 OK [READ-WRITE] SELECT completed",
            IMAP_SELECT_UNTAGGED_LINES,
          ),
          IMAP_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Read a Message",
      desc: "FETCH, and the \\Seen flag",
      detail:
        "FETCH 2 BODY[] downloads message 2 (three TCP segments). That sets its \\Seen flag on the server, so it shows as read on Bob’s phone too, and the message stays there.",
      facts: [
        ["Command", "a3 FETCH 2 BODY[]"],
        ["Flag set", "\\Seen (on the server)"],
        ["Sent as", "3 TCP segments"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "a3 FETCH",
          ["a3 FETCH 2 BODY[]"],
          createImapRow(0.152, CLIENT_IP, IMAP_SERVER_IP, "a3 FETCH 2 BODY[]", IMAP_FETCH_LINES),
          IMAP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "MESSAGE",
          ["* 2 FETCH (FLAGS (\\Seen)", "BODY[] {3216} …)", "a3 OK FETCH completed"],
          {
            time: formatSeconds(0.167),
            src: IMAP_SERVER_IP,
            dst: CLIENT_IP,
            proto: "IMAP (TLS)",
            info: `* 2 FETCH (FLAGS (\\Seen) BODY[] …), ${countMssSegments(IMAP_FETCH_TLS_LEN)} segments`,
            len: formatSegmentOrByteSize(
              IMAP_FETCH_WIRE_BYTES,
              countMssSegments(IMAP_FETCH_TLS_LEN),
            ),
            wire: tcpWire(IMAP_ENDPOINTS, IMAP_SERVER_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: IMAP_FETCH_TLS_LEN - 5,
                  inner: {
                    what: "* 2 FETCH (FLAGS (\\Seen) BODY[] {3216}, the 3,216-byte message, then a3 OK FETCH completed",
                  },
                },
              ],
            }),
          },
          IMAP_LOCKED_OPT,
        ),
        { type: "note", at: "web", text: "STILL ON SERVER · \\SEEN", tone: "green" },
      ],
    },
    {
      title: "Wait for New Mail",
      desc: "IDLE: the server pushes",
      detail:
        "IDLE tells the server “let me know when something changes”. About 42 seconds later Alice’s message arrives and the server pushes “* 3 EXISTS” straight away. The app ends IDLE with DONE and can fetch the new mail.",
      facts: [
        ["Command", "a4 IDLE"],
        ["Server says", "* 3 EXISTS (new mail)"],
        ["Ended by", "DONE"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "a4 IDLE",
          ["a4 IDLE"],
          createImapRow(0.182, CLIENT_IP, IMAP_SERVER_IP, "a4 IDLE", imapLines("a4 IDLE")),
          IMAP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "+ idling",
          ["+ idling"],
          createImapRow(0.197, IMAP_SERVER_IP, CLIENT_IP, "+ idling", imapLines("+ idling")),
          IMAP_LOCKED_OPT,
        ),
        { type: "note", at: "web", text: "NEW MAIL ARRIVED", tone: "navy" },
        packetEvent(
          "web",
          "client",
          "violet",
          "* 3 EXISTS",
          ["* 3 EXISTS", "* 1 RECENT"],
          createImapRow(
            42.515,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "* 3 EXISTS, * 1 RECENT",
            imapLines("* 3 EXISTS", "* 1 RECENT"),
          ),
          IMAP_LOCKED_OPT,
        ),
        packetEvent(
          "client",
          "web",
          "amber",
          "DONE",
          ["DONE"],
          createImapRow(42.53, CLIENT_IP, IMAP_SERVER_IP, "DONE", imapLines("DONE")),
          IMAP_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "a4 OK",
          ["a4 OK IDLE terminated"],
          createImapRow(
            42.545,
            IMAP_SERVER_IP,
            CLIENT_IP,
            "a4 OK IDLE terminated",
            imapLines("a4 OK IDLE terminated"),
          ),
          IMAP_LOCKED_OPT,
        ),
      ],
    },
  ],
};

const FTP_SERVER_IP = "203.0.113.21";

const FTP_FILE_TOTAL_BYTES = 4e3;

const FTP_PASV_PORT = 195 * 256 + 149;

const FTP_CTRL_ENDPOINTS = createEndpointPair(CLIENT_IP, 52800, FTP_SERVER_IP, 21);

const FTP_DATA_ENDPOINTS = createEndpointPair(CLIENT_IP, 52801, FTP_SERVER_IP, FTP_PASV_PORT);

const createFtpCtrlRow = (e, t, s, a, n) => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: "FTP",
  info: a,
  len: `${ethernetFrameBytes(crlfByteLength(n))} B`,
  wire: tcpWire(FTP_CTRL_ENDPOINTS, t, "PA", { text: [n], name: "FTP" }),
});

const createFtpCmdPacket = (e, t) =>
  packetEvent(
    "client",
    "web",
    "amber",
    t.split(" ")[0],
    [t],
    createFtpCtrlRow(e, CLIENT_IP, FTP_SERVER_IP, t, t),
  );

const createFtpReplyPacket = (e, t, s, a) =>
  packetEvent("web", "client", "violet", t, s, createFtpCtrlRow(e, FTP_SERVER_IP, CLIENT_IP, a, a));

const FTP_DATA_SEGMENT_SIZES: number[] = [];

for (let e = FTP_FILE_TOTAL_BYTES; e > 0; e -= TCP_MSS)
  FTP_DATA_SEGMENT_SIZES.push(Math.min(TCP_MSS, e));

const createFtpDataSegmentRow = (e, t) => {
  const s = 1 + t * TCP_MSS;
  return {
    time: formatSeconds(0.225),
    src: FTP_SERVER_IP,
    dst: CLIENT_IP,
    proto: "FTP-DATA",
    info: `FTP Data: ${e} bytes (Seq=${s})`,
    len: `${ethernetFrameBytes(e)} B`,
    wire: tcpWire(
      FTP_DATA_ENDPOINTS,
      FTP_SERVER_IP,
      t === FTP_DATA_SEGMENT_SIZES.length - 1 ? "PA" : "A",
      {
        opaque: e,
        what: `report.pdf, bytes ${s}–${s + e - 1}`,
        name: "FTP data",
        note: "The file itself, unencrypted: anyone on the path could read it.",
      },
    ),
  };
};

export const ftpLesson: Lesson = {
  id: "ftp",
  name: "FTP",
  title: "Transferring Files",
  layer: 7,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-web": 0.015 },
  labels: { web: ["ftp.example.com", FTP_SERVER_IP] },
  legend: [
    ["green", "TCP"],
    ["amber", "FTP command"],
    ["violet", "FTP reply"],
    ["blue", "File data"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "File Transfer Protocol",
    description:
      "FTP moves files between a client and a server. It is unusual in using two TCP connections: one for commands and replies, and a fresh one for each file or listing. It dates from the early 1970s and sends everything, passwords included, as plain text.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Ports", "21 control, data varies"],
      ["Connections", "Control + one per transfer"],
      ["Encryption", "None (plain text)"],
      ["Safer options", "SFTP, or FTPS (FTP + TLS)"],
      ["Defined In", "RFC 959"],
    ],
  },
  outro: {
    title: "File downloaded",
    desc: "Two connections, no encryption",
    text: "Commands went over the control connection, the file over its own data connection, and closing that connection marked the end of the file. Anyone on the path could have read the password and the file, which is why SFTP or FTPS is used today.",
    facts: [
      ["Connections", "2 (control + data)"],
      [
        "File",
        `${FTP_FILE_TOTAL_BYTES.toLocaleString("en-US")} bytes, ${FTP_DATA_SEGMENT_SIZES.length} segments`,
      ],
      ["Password", "Sent in plain text"],
      ["Use instead", "SFTP or FTPS"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Control Connection",
      desc: "Port 21, plain text",
      detail:
        "The FTP app opens a TCP connection to ftp.example.com on port 21. This control connection carries commands and replies for the whole session. The server greets with 220. Like SMTP, every reply starts with a three-digit code.",
      facts: [
        ["Server", "ftp.example.com:21"],
        ["Greeting", "220 (vsFTPd 3.0.5)"],
        ["Encrypted", "No"],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "path" },
        ...buildTcpHandshake({ dst: FTP_SERVER_IP, sport: 52800, dport: 21, t: [0, 0.015, 0.03] }),
        createFtpReplyPacket(0.045, "220", ["220 (vsFTPd 3.0.5)"], "220 (vsFTPd 3.0.5)"),
      ],
    },
    {
      title: "Log In",
      desc: "USER and PASS, readable by anyone",
      detail:
        "The app sends USER, the server asks for the password with 331, and PASS sends it. Nothing is encrypted, so the user name and password cross every network on the way as readable text.",
      facts: [
        ["Commands", "USER alice, PASS secret"],
        ["Result", "230 Login successful."],
        ["Visible to", "Anyone on the path"],
      ],
      events: [
        createFtpCmdPacket(0.06, "USER alice"),
        createFtpReplyPacket(
          0.075,
          "331",
          ["331 Please specify", "the password."],
          "331 Please specify the password.",
        ),
        createFtpCmdPacket(0.09, "PASS secret"),
        { type: "note", at: "router", text: "PASSWORD IN PLAIN TEXT", tone: "amber" },
        createFtpReplyPacket(0.105, "230", ["230 Login successful."], "230 Login successful."),
      ],
    },
    {
      title: "Passive Mode",
      desc: "The server names a data port",
      detail:
        "TYPE I asks for a byte-for-byte binary copy. PASV asks the server to open a port for the data connection. The reply encodes the address and port as six numbers: 195 × 256 + 149 = port 50069. The laptop connects out, which works through NAT.",
      facts: [
        ["Reply", "227 (203,0,113,21,195,149)"],
        ["Data port", "195 × 256 + 149 = 50069"],
        ["Active mode", "Server dials in: NAT blocks"],
      ],
      events: [
        createFtpCmdPacket(0.12, "TYPE I"),
        createFtpReplyPacket(
          0.135,
          "200",
          ["200 Switching to", "Binary mode."],
          "200 Switching to Binary mode.",
        ),
        createFtpCmdPacket(0.15, "PASV"),
        createFtpReplyPacket(
          0.165,
          "227",
          ["227 Entering Passive Mode", "(203,0,113,21,195,149)."],
          "227 Entering Passive Mode (203,0,113,21,195,149).",
        ),
      ],
    },
    {
      title: "Data Connection",
      desc: "A second TCP connection",
      detail:
        "The app opens a second TCP connection, to port 50069, and asks for the file on the control connection with RETR. The server answers 150 there and starts sending the file over the new connection.",
      facts: [
        ["Data to", `ftp.example.com:${FTP_PASV_PORT}`],
        ["Command", "RETR report.pdf"],
        ["Reply", "150 Opening BINARY …"],
      ],
      events: [
        ...buildTcpHandshake({
          dst: FTP_SERVER_IP,
          sport: 52801,
          dport: FTP_PASV_PORT,
          t: [0.18, 0.195, 0.21],
        }),
        createFtpCmdPacket(0.21, "RETR report.pdf"),
        packetEvent(
          "web",
          "client",
          "violet",
          "150",
          ["150 Opening BINARY mode", "data connection …"],
          createFtpCtrlRow(
            0.225,
            FTP_SERVER_IP,
            CLIENT_IP,
            "150 Opening BINARY mode data connection …",
            `150 Opening BINARY mode data connection for report.pdf (${FTP_FILE_TOTAL_BYTES} bytes).`,
          ),
        ),
      ],
    },
    {
      title: "The File Arrives",
      desc: "Closing the connection ends it",
      detail: `The ${FTP_FILE_TOTAL_BYTES.toLocaleString("en-US")} bytes arrive in ${FTP_DATA_SEGMENT_SIZES.length} TCP segments. FTP sends no length marker in the data itself: the server closes the data connection to mark the end of the file. Once the laptop has acknowledged everything, the server confirms with 226 on the control connection.`,
      facts: [
        ["File", `report.pdf, ${FTP_FILE_TOTAL_BYTES.toLocaleString("en-US")} bytes`],
        ["Segments", FTP_DATA_SEGMENT_SIZES.join(" + ")],
        ["End of file", "Data connection closed"],
      ],
      events: [
        {
          type: "stream",
          from: "web",
          to: "client",
          color: "blue",
          label: `${FTP_DATA_SEGMENT_SIZES.length} SEGMENTS`,
          payload: [
            "report.pdf",
            `${FTP_FILE_TOTAL_BYTES.toLocaleString("en-US")} bytes, readable by anyone`,
          ],
          packets: FTP_DATA_SEGMENT_SIZES.map((e, t) =>
            packetEvent("web", "client", "blue", "DATA", [], createFtpDataSegmentRow(e, t)),
          ),
        },
        packetEvent("web", "client", "green", "FIN", ["end of file:", "data connection closed"], {
          time: formatSeconds(0.225),
          src: FTP_SERVER_IP,
          dst: CLIENT_IP,
          proto: "TCP",
          info: `${FTP_PASV_PORT} → 52801 [FIN, ACK] Seq=${FTP_FILE_TOTAL_BYTES + 1} Ack=1`,
          len: `${ethernetFrameBytes(0)} B`,
          wire: tcpWire(FTP_DATA_ENDPOINTS, FTP_SERVER_IP, "FA"),
        }),
        createFtpReplyPacket(0.255, "226", ["226 Transfer complete."], "226 Transfer complete."),
      ],
    },
    {
      title: "Quit",
      desc: "Close the control connection",
      detail:
        "QUIT ends the session and the server says goodbye with 221. For anything sensitive, SFTP (a different protocol, run over SSH) or FTPS (FTP inside TLS) gives the same job encryption.",
      facts: [
        ["Command", "QUIT"],
        ["Reply", "221 Goodbye."],
        ["Encrypted cousins", "SFTP, FTPS"],
      ],
      events: [
        createFtpCmdPacket(0.27, "QUIT"),
        createFtpReplyPacket(0.285, "221", ["221 Goodbye."], "221 Goodbye."),
      ],
    },
  ],
};

const SSH_SERVER_IP = "203.0.113.22";

const SSH_LOCKED_OPT = { locked: !0 };

const calcSshPadding = (e) => {
  let t = 8 - (e % 8);
  return (t < 4 && (t += 8), t);
};

const calcPlainSshPacketLen = (e) => 5 + e + calcSshPadding(5 + e);

const calcSealedSshPacketLen = (e) => 5 + e + calcSshPadding(1 + e) + 16;

const sshStringWireLen = (e) => 4 + (typeof e == "number" ? e : e.length);

const sshListWireLen = (e) => sshStringWireLen(e.join(","));

const sshTotalWireBytes = (e) =>
  e + countMssSegments(e) * (ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE);

const SSH_KEX_ALGORITHMS = [
  "sntrup761x25519-sha512@openssh.com",
  "curve25519-sha256",
  "curve25519-sha256@libssh.org",
  "ecdh-sha2-nistp256",
  "ecdh-sha2-nistp384",
  "ecdh-sha2-nistp521",
  "diffie-hellman-group-exchange-sha256",
  "diffie-hellman-group16-sha512",
  "diffie-hellman-group18-sha512",
  "diffie-hellman-group14-sha256",
];

const SSH_CLIENT_HOSTKEY_ALGS = [
  "ssh-ed25519-cert-v01@openssh.com",
  "ecdsa-sha2-nistp256-cert-v01@openssh.com",
  "ecdsa-sha2-nistp384-cert-v01@openssh.com",
  "ecdsa-sha2-nistp521-cert-v01@openssh.com",
  "sk-ssh-ed25519-cert-v01@openssh.com",
  "sk-ecdsa-sha2-nistp256-cert-v01@openssh.com",
  "rsa-sha2-512-cert-v01@openssh.com",
  "rsa-sha2-256-cert-v01@openssh.com",
  "ssh-ed25519",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ssh-ed25519@openssh.com",
  "sk-ecdsa-sha2-nistp256@openssh.com",
  "rsa-sha2-512",
  "rsa-sha2-256",
];

const SSH_SERVER_HOSTKEY_ALGS = [
  "rsa-sha2-512",
  "rsa-sha2-256",
  "ecdsa-sha2-nistp256",
  "ssh-ed25519",
];

const SSH_CIPHERS = [
  "chacha20-poly1305@openssh.com",
  "aes128-ctr",
  "aes192-ctr",
  "aes256-ctr",
  "aes128-gcm@openssh.com",
  "aes256-gcm@openssh.com",
];

const SSH_MACS = [
  "umac-64-etm@openssh.com",
  "umac-128-etm@openssh.com",
  "hmac-sha2-256-etm@openssh.com",
  "hmac-sha2-512-etm@openssh.com",
  "hmac-sha1-etm@openssh.com",
  "umac-64@openssh.com",
  "umac-128@openssh.com",
  "hmac-sha2-256",
  "hmac-sha2-512",
  "hmac-sha1",
];

const SSH_COMPRESSION = ["none", "zlib@openssh.com"];

const calcKexInitPacketLen = (e, t) =>
  calcPlainSshPacketLen(
    17 +
      sshListWireLen(e) +
      sshListWireLen(t) +
      2 * sshListWireLen(SSH_CIPHERS) +
      2 * sshListWireLen(SSH_MACS) +
      2 * sshListWireLen(SSH_COMPRESSION) +
      2 * sshListWireLen([]) +
      1 +
      4,
  );

const SSH_CLIENT_KEXINIT_LEN = calcKexInitPacketLen(
  [...SSH_KEX_ALGORITHMS, "ext-info-c", "kex-strict-c-v00@openssh.com"],
  SSH_CLIENT_HOSTKEY_ALGS,
);

const SSH_SERVER_KEXINIT_LEN = calcKexInitPacketLen(
  [...SSH_KEX_ALGORITHMS, "ext-info-s", "kex-strict-s-v00@openssh.com"],
  SSH_SERVER_HOSTKEY_ALGS,
);

const SSH_ED25519_PUBKEY_LEN = sshStringWireLen("ssh-ed25519") + sshStringWireLen(32);

const SSH_ED25519_SIG_LEN = sshStringWireLen("ssh-ed25519") + sshStringWireLen(64);

const SSH_ECDH_INIT_LEN = calcPlainSshPacketLen(1 + sshStringWireLen(1190));

const SSH_ECDH_REPLY_LEN = calcPlainSshPacketLen(
  1 +
    sshStringWireLen(SSH_ED25519_PUBKEY_LEN) +
    sshStringWireLen(1071) +
    sshStringWireLen(SSH_ED25519_SIG_LEN),
);

const SSH_NEWKEYS_LEN = calcPlainSshPacketLen(1);

const SSH_USERAUTH_PREFIX_LEN = sshStringWireLen("alice") + sshStringWireLen("ssh-connection");

const SSH_SERVICE_REQ_LEN = calcSealedSshPacketLen(1 + sshStringWireLen("ssh-userauth"));

const SSH_AUTH_NONE_LEN = calcSealedSshPacketLen(
  1 + SSH_USERAUTH_PREFIX_LEN + sshStringWireLen("none"),
);

const SSH_AUTH_METHODS_LEN = calcSealedSshPacketLen(1 + sshStringWireLen("publickey,password") + 1);

const SSH_AUTH_PUBKEY_QUERY_LEN = calcSealedSshPacketLen(
  1 +
    SSH_USERAUTH_PREFIX_LEN +
    sshStringWireLen("publickey") +
    1 +
    sshStringWireLen("ssh-ed25519") +
    sshStringWireLen(SSH_ED25519_PUBKEY_LEN),
);

const SSH_AUTH_PK_OK_LEN = calcSealedSshPacketLen(
  1 + sshStringWireLen("ssh-ed25519") + sshStringWireLen(SSH_ED25519_PUBKEY_LEN),
);

const SSH_AUTH_PUBKEY_SIG_LEN = calcSealedSshPacketLen(
  1 +
    SSH_USERAUTH_PREFIX_LEN +
    sshStringWireLen("publickey-hostbound-v00@openssh.com") +
    1 +
    sshStringWireLen("ssh-ed25519") +
    sshStringWireLen(SSH_ED25519_PUBKEY_LEN) +
    sshStringWireLen(SSH_ED25519_PUBKEY_LEN) +
    sshStringWireLen(SSH_ED25519_SIG_LEN),
);

const SSH_ONE_BYTE_MSG_LEN = calcSealedSshPacketLen(1);

const SSH_CHANNEL_OPEN_LEN = calcSealedSshPacketLen(1 + sshStringWireLen("session") + 4 + 4 + 4);

const SSH_CHANNEL_OPEN_CONFIRM_LEN = calcSealedSshPacketLen(17);

const calcChannelDataPacketLen = (e) => calcSealedSshPacketLen(5 + sshStringWireLen(e));

const SSH_SINGLE_KEYSTROKE_LEN = calcChannelDataPacketLen(1);

const SSH_SHELL_PROMPT_RAW =
  "\x1B]0;alice@server: ~\x07\x1B[01;32malice@server\x1B[00m:\x1B[01;34m~\x1B[00m$ ";

const SSH_PWD_OUTPUT_RAW =
  `\r
\x1B[?2004l\r/home/alice\r
\x1B[?2004h` + SSH_SHELL_PROMPT_RAW;

const SSH_PWD_OUTPUT_LEN = calcChannelDataPacketLen(SSH_PWD_OUTPUT_RAW.length);

const SSH_ENDPOINTS = createEndpointPair(CLIENT_IP, 53210, SSH_SERVER_IP, 22);

const createSshRow = (e, t, s, a, n, o) => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: "SSH",
  info: a,
  len: formatSegmentOrByteSize(sshTotalWireBytes(n), countMssSegments(n)),
  wire: tcpWire(SSH_ENDPOINTS, t, "PA", o),
});

const createEncryptedSshRow = (e, t, s, a, n, o) =>
  createSshRow(e, t, s, `Encrypted (len=${n}): ${a}`, n, { ssh: { sealed: n, inside: o } });

const createClientSshPacket = (e, t, s, a, n, o, r) =>
  packetEvent(
    "client",
    "web",
    "amber",
    t,
    s,
    createEncryptedSshRow(e, CLIENT_IP, SSH_SERVER_IP, a, n, r),
    { ...SSH_LOCKED_OPT, ...o },
  );

const createServerSshPacket = (e, t, s, a, n, o, r) =>
  packetEvent(
    "web",
    "client",
    "violet",
    t,
    s,
    createEncryptedSshRow(e, SSH_SERVER_IP, CLIENT_IP, a, n, r),
    { ...SSH_LOCKED_OPT, ...o },
  );

const createSshBannerPayload = (e) => ({ text: [e], name: "SSH" });

const createSshKexInitPayload = (e, t) => ({
  ssh: {
    msg: "kexinit",
    kex: e,
    hostkeys: t,
    ciphers: SSH_CIPHERS,
    macs: SSH_MACS,
    compression: SSH_COMPRESSION,
  },
});

const SSH_CHANNEL_DATA_PREFIX = "SSH_MSG_CHANNEL_DATA (94), channel 0:";

const SSH_QUICK_OPT = { quick: !0 };

export const sshLesson: Lesson = {
  id: "ssh",
  name: "SSH",
  title: "Secure Remote Login",
  layer: 7,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-web": 0.015 },
  labels: { web: ["server.example.com", SSH_SERVER_IP] },
  legend: [
    ["green", "TCP"],
    ["slate", "Plain setup"],
    ["teal", "Key exchange"],
    ["amber", "From laptop"],
    ["violet", "From server"],
    [null, "Some packets not shown"],
  ],
  overview: {
    full: "Secure Shell",
    description:
      "SSH gives you an encrypted, authenticated connection to another computer, to run commands on it, copy files (SFTP, scp) or carry other connections. The server proves who it is with a host key; you prove who you are with a key pair or a password.",
    facts: [
      ["Layer", "Application (Layer 7)"],
      ["Port", "22"],
      ["Transport", "TCP"],
      ["Server proves", "Host key (known_hosts)"],
      ["You prove", "Key pair or password"],
      ["Defined In", "RFC 4251 – 4254"],
    ],
  },
  outro: {
    title: "Logged in securely",
    desc: "Encrypted from the key exchange on",
    text: "The two sides agreed on algorithms, built shared keys with a post-quantum hybrid exchange, and the server proved its identity with its host key. Alice proved hers by signing with a private key that never left the laptop, then typed a command, one packet per key.",
    facts: [
      ["Key exchange", "sntrup761 + X25519"],
      ["Cipher", "ChaCha20-Poly1305"],
      ["Login", "Ed25519 key, no password"],
      ["Port", "22"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Say Hello",
      desc: "Versions, in plain text",
      detail:
        "Alice runs “ssh alice@server.example.com”. After the TCP handshake on port 22, each side sends one line of plain text naming the SSH protocol version (2.0) and its software. Everything else in SSH is binary.",
      facts: [
        ["Laptop", "OpenSSH_for_Windows_9.5"],
        ["Server", "OpenSSH_9.6p1 Ubuntu"],
        ["Protocol", "SSH-2.0"],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "path" },
        ...buildTcpHandshake({ dst: SSH_SERVER_IP, sport: 53210, dport: 22, t: [0, 0.015, 0.03] }),
        packetEvent(
          "client",
          "web",
          "slate",
          "VERSION",
          ["SSH-2.0-", "OpenSSH_for_Windows_9.5"],
          createSshRow(
            0.03,
            CLIENT_IP,
            SSH_SERVER_IP,
            "Client: SSH-2.0-OpenSSH_for_Windows_9.5",
            crlfByteLength("SSH-2.0-OpenSSH_for_Windows_9.5"),
            createSshBannerPayload("SSH-2.0-OpenSSH_for_Windows_9.5"),
          ),
        ),
        packetEvent(
          "web",
          "client",
          "slate",
          "VERSION",
          ["SSH-2.0-OpenSSH_9.6p1", "Ubuntu-3ubuntu13.5"],
          createSshRow(
            0.045,
            SSH_SERVER_IP,
            CLIENT_IP,
            "Server: SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5",
            crlfByteLength("SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5"),
            createSshBannerPayload("SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5"),
          ),
        ),
      ],
    },
    {
      title: "Agree on Algorithms",
      desc: "KEXINIT lists, first match wins",
      detail:
        "Each side sends a KEXINIT listing every algorithm it supports, in order of preference, for key exchange, host keys, encryption, integrity and compression. In each category the first algorithm on the laptop’s list that the server also supports is chosen.",
      facts: [
        ["Key exchange", "sntrup761x25519-sha512"],
        ["Host key", "ssh-ed25519"],
        ["Cipher", "chacha20-poly1305"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "slate",
          "KEXINIT",
          ["server’s algorithm lists", "in order of preference"],
          createSshRow(
            0.045,
            SSH_SERVER_IP,
            CLIENT_IP,
            "Server: Key Exchange Init",
            SSH_SERVER_KEXINIT_LEN,
            createSshKexInitPayload(
              [...SSH_KEX_ALGORITHMS, "ext-info-s", "kex-strict-s-v00@openssh.com"],
              SSH_SERVER_HOSTKEY_ALGS,
            ),
          ),
        ),
        packetEvent(
          "client",
          "web",
          "slate",
          "KEXINIT",
          ["laptop’s algorithm lists", "in order of preference"],
          createSshRow(
            0.06,
            CLIENT_IP,
            SSH_SERVER_IP,
            `Client: Key Exchange Init, ${countMssSegments(SSH_CLIENT_KEXINIT_LEN)} segments`,
            SSH_CLIENT_KEXINIT_LEN,
            createSshKexInitPayload(
              [...SSH_KEX_ALGORITHMS, "ext-info-c", "kex-strict-c-v00@openssh.com"],
              SSH_CLIENT_HOSTKEY_ALGS,
            ),
          ),
        ),
      ],
    },
    {
      title: "Key Exchange",
      desc: "Shared keys, and a host key check",
      detail:
        "The laptop sends its half of a hybrid exchange: a Streamlined NTRU Prime key, chosen to resist future quantum computers, plus an X25519 key. The server answers with its half, its host key and a signature over the exchange. NEWKEYS switches encryption on.",
      facts: [
        ["Hybrid", "sntrup761 + X25519"],
        ["Host key", "Matches known_hosts"],
        ["First visit", "ssh asks you to confirm"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "teal",
          "KEX INIT",
          ["sntrup761 + X25519", "public keys"],
          createSshRow(
            0.06,
            CLIENT_IP,
            SSH_SERVER_IP,
            "Client: KEX_ECDH_INIT (sntrup761x25519 public keys)",
            SSH_ECDH_INIT_LEN,
            {
              ssh: { msg: "ecdh_init", q: 1190 },
            },
          ),
        ),
        packetEvent(
          "web",
          "client",
          "teal",
          "KEX REPLY",
          ["its half, its host key", "and a signature"],
          createSshRow(
            0.075,
            SSH_SERVER_IP,
            CLIENT_IP,
            "Server: KEX_ECDH_REPLY (host key, its half, signature)",
            SSH_ECDH_REPLY_LEN,
            {
              ssh: {
                msg: "ecdh_reply",
                ks: SSH_ED25519_PUBKEY_LEN,
                q: 1071,
                sig: SSH_ED25519_SIG_LEN,
              },
            },
          ),
        ),
        packetEvent(
          "web",
          "client",
          "teal",
          "NEWKEYS",
          [],
          createSshRow(0.075, SSH_SERVER_IP, CLIENT_IP, "Server: New Keys", SSH_NEWKEYS_LEN, {
            ssh: { msg: "newkeys" },
          }),
          SSH_QUICK_OPT,
        ),
        { type: "note", at: "client", text: "HOST KEY MATCHES KNOWN_HOSTS", tone: "green" },
        packetEvent(
          "client",
          "web",
          "teal",
          "NEWKEYS",
          [],
          createSshRow(0.09, CLIENT_IP, SSH_SERVER_IP, "Client: New Keys", SSH_NEWKEYS_LEN, {
            ssh: { msg: "newkeys" },
          }),
          SSH_QUICK_OPT,
        ),
      ],
    },
    {
      title: "Log In with a Key",
      desc: "Sign, don’t send a secret",
      detail:
        "The server lists the login methods it accepts. The laptop offers Alice’s public key, and the server says it would accept it. The laptop then signs this session with the private key, which never leaves the laptop. The server checks the signature against authorized_keys.",
      facts: [
        ["Methods", "publickey, password"],
        ["Key", "Ed25519, private stays here"],
        ["Checked with", "~/.ssh/authorized_keys"],
      ],
      events: [
        createClientSshPacket(
          0.09,
          "SERVICE REQUEST",
          [],
          "service request, ssh-userauth",
          SSH_SERVICE_REQ_LEN,
          SSH_QUICK_OPT,
          "SSH_MSG_SERVICE_REQUEST (5): “ssh-userauth”",
        ),
        createServerSshPacket(
          0.105,
          "SERVICE ACCEPT",
          [],
          "service accept",
          SSH_SERVICE_REQ_LEN,
          SSH_QUICK_OPT,
          "SSH_MSG_SERVICE_ACCEPT (6): “ssh-userauth”",
        ),
        createClientSshPacket(
          0.12,
          "AUTH: NONE",
          [],
          "login with method none",
          SSH_AUTH_NONE_LEN,
          SSH_QUICK_OPT,
          "SSH_MSG_USERAUTH_REQUEST (50): user “alice”, service “ssh-connection”, method “none”",
        ),
        createServerSshPacket(
          0.135,
          "AUTH FAILURE",
          [],
          "try publickey,password",
          SSH_AUTH_METHODS_LEN,
          SSH_QUICK_OPT,
          "SSH_MSG_USERAUTH_FAILURE (51): methods that can continue: “publickey,password”",
        ),
        createClientSshPacket(
          0.15,
          "OFFER KEY",
          ["alice’s public key", "would you accept it?"],
          "offer public key",
          SSH_AUTH_PUBKEY_QUERY_LEN,
          {},
          "SSH_MSG_USERAUTH_REQUEST (50): method “publickey”, no signature, the ssh-ed25519 public key",
        ),
        createServerSshPacket(
          0.165,
          "PK OK",
          ["yes, that key", "is in authorized_keys"],
          "public key OK",
          SSH_AUTH_PK_OK_LEN,
          {},
          "SSH_MSG_USERAUTH_PK_OK (60): the same ssh-ed25519 key",
        ),
        createClientSshPacket(
          0.18,
          "SIGNED",
          ["same key, plus a signature", "made with the private key"],
          "public key + signature",
          SSH_AUTH_PUBKEY_SIG_LEN,
          {},
          "SSH_MSG_USERAUTH_REQUEST (50): method “publickey-hostbound-v00@openssh.com”, the key, the server’s host key and a signature",
        ),
        createServerSshPacket(
          0.195,
          "SUCCESS",
          ["logged in"],
          "login success",
          SSH_ONE_BYTE_MSG_LEN,
          {},
          "SSH_MSG_USERAUTH_SUCCESS (52)",
        ),
      ],
    },
    {
      title: "Open a Session",
      desc: "Channels inside one connection",
      detail:
        "One SSH connection can carry many channels: a shell, file transfers, forwarded ports. The laptop opens a session channel, then asks for a terminal and a shell (not shown), and the server sends its welcome text and a prompt.",
      facts: [
        ["Channel", "session"],
        ["Then asks for", "A terminal and a shell"],
        ["Also possible", "SFTP, port forwarding"],
      ],
      events: [
        createClientSshPacket(
          0.21,
          "CHANNEL OPEN",
          ["open a channel:", "session"],
          "channel open: session",
          SSH_CHANNEL_OPEN_LEN,
          {},
          "SSH_MSG_CHANNEL_OPEN (90): “session”, channel 0, window 2 MB, packets up to 32 KB",
        ),
        createServerSshPacket(
          0.225,
          "CONFIRMED",
          ["channel open"],
          "channel open confirmed",
          SSH_CHANNEL_OPEN_CONFIRM_LEN,
          {},
          "SSH_MSG_CHANNEL_OPEN_CONFIRMATION (91): channel 0 is open",
        ),
      ],
    },
    {
      title: "Type a Command",
      desc: "Every key is a packet",
      detail:
        "Alice types pwd. Each key goes out at once in its own encrypted packet, and the server sends the character back to be shown (the echo). Since 9.5, OpenSSH sends keys on a 20 ms beat and adds decoy packets, so typing rhythm is harder to read from the timing.",
      facts: [
        ["Per key", `1 packet, ${sshTotalWireBytes(SSH_SINGLE_KEYSTROKE_LEN)} bytes`],
        ["Echo", "Sent back by the server"],
        ["Timing", "20 ms beat plus decoys"],
      ],
      events: [
        createClientSshPacket(
          2,
          "“p”",
          [],
          "keystroke",
          SSH_SINGLE_KEYSTROKE_LEN,
          SSH_QUICK_OPT,
          `${SSH_CHANNEL_DATA_PREFIX} 1 byte, “p”`,
        ),
        createServerSshPacket(
          2.015,
          "ECHO",
          [],
          "echo",
          SSH_SINGLE_KEYSTROKE_LEN,
          SSH_QUICK_OPT,
          `${SSH_CHANNEL_DATA_PREFIX} 1 byte, “p”, sent back to be shown`,
        ),
        createClientSshPacket(
          2.14,
          "“w”",
          [],
          "keystroke",
          SSH_SINGLE_KEYSTROKE_LEN,
          SSH_QUICK_OPT,
          `${SSH_CHANNEL_DATA_PREFIX} 1 byte, “w”`,
        ),
        createServerSshPacket(
          2.155,
          "ECHO",
          [],
          "echo",
          SSH_SINGLE_KEYSTROKE_LEN,
          SSH_QUICK_OPT,
          `${SSH_CHANNEL_DATA_PREFIX} 1 byte, “w”, sent back to be shown`,
        ),
        createClientSshPacket(
          2.26,
          "“d”",
          [],
          "keystroke",
          SSH_SINGLE_KEYSTROKE_LEN,
          SSH_QUICK_OPT,
          `${SSH_CHANNEL_DATA_PREFIX} 1 byte, “d”`,
        ),
        createServerSshPacket(
          2.275,
          "ECHO",
          [],
          "echo",
          SSH_SINGLE_KEYSTROKE_LEN,
          SSH_QUICK_OPT,
          `${SSH_CHANNEL_DATA_PREFIX} 1 byte, “d”, sent back to be shown`,
        ),
        createClientSshPacket(
          2.42,
          "ENTER",
          ["Enter key"],
          "keystroke (Enter)",
          SSH_SINGLE_KEYSTROKE_LEN,
          {},
          `${SSH_CHANNEL_DATA_PREFIX} 1 byte, a carriage return (Enter)`,
        ),
        createServerSshPacket(
          2.435,
          "OUTPUT",
          ["/home/alice", "alice@server:~$"],
          "output and a new prompt",
          SSH_PWD_OUTPUT_LEN,
          {},
          `${SSH_CHANNEL_DATA_PREFIX} ${SSH_PWD_OUTPUT_RAW.length} bytes: a new line, the shell’s terminal codes, “/home/alice”, and the coloured prompt`,
        ),
        { type: "note", at: "client", text: "EACH KEY IS ITS OWN PACKET", tone: "navy" },
      ],
    },
  ],
};

const TLS_WEB_IP = "203.0.113.10";

const TLS_LOCKED_OPT = { locked: !0 };

const TCP_IP_ETH_OVERHEAD = ETH_HEADER_SIZE + IPV4_HEADER_SIZE + TCP_HEADER_SIZE;

const TLS_SERVER_HELLO_RECORD_WIRE = 1215;

const TLS_SERVER_CCS_RECORD_WIRE = 6;

const TLS_SERVER_HANDSHAKE_ENC_WIRE = 2729;

const TLS_SERVER_FLIGHT_TOTAL =
  TLS_SERVER_HELLO_RECORD_WIRE + TLS_SERVER_CCS_RECORD_WIRE + TLS_SERVER_HANDSHAKE_ENC_WIRE;

const TLS_SERVER_FLIGHT_SEGMENTS: number[] = [];

for (let e = TLS_SERVER_FLIGHT_TOTAL; e > 0; e -= TCP_MSS)
  TLS_SERVER_FLIGHT_SEGMENTS.push(Math.min(TCP_MSS, e));

const TLS_ALERT_RECORD_WIRE = 2 + TLS_RECORD_OVERHEAD;

const createTlsRow = (e, t, s, a, n, o = "TLSv1.3") => ({
  time: formatSeconds(e),
  src: t,
  dst: s,
  proto: o,
  info: a,
  len: n,
});

const TLS_ENDPOINTS = createEndpointPair(CLIENT_IP, 52411, TLS_WEB_IP, 443);

const attachWireSpec = (e, t) => ({ ...e, wire: t });

const TLS_SEGMENT_OFFSETS = TLS_SERVER_FLIGHT_SEGMENTS.map((e, t) =>
  TLS_SERVER_FLIGHT_SEGMENTS.slice(0, t).reduce((s, a) => s + a, 0),
);

export const tlsLesson: Lesson = {
  id: "tls",
  name: "TLS/SSL",
  title: "Encryption Explained",
  layer: 6,
  nodes: ["client", "router", "internet", "web"],
  latency: { "client-web": 0.017 },
  labels: { web: ["www.example.com", TLS_WEB_IP] },
  legend: [
    ["green", "TCP"],
    ["teal", "TLS handshake"],
    ["amber", "From browser"],
    ["violet", "From server"],
    [null, "Data ACKs not shown"],
  ],
  overview: {
    full: "Transport Layer Security",
    description:
      "TLS puts a secure channel on top of TCP. It proves the server’s identity with a certificate, agrees on fresh keys, then encrypts and authenticates everything sent. HTTPS, secure email and many other protocols run inside it. SSL was the name of its predecessor.",
    facts: [
      ["Sits", "Between TCP and the app"],
      ["OSI layer", "Often placed at 6"],
      ["Current", "TLS 1.3 (RFC 8446)"],
      ["Retired", "SSL 2 and 3, TLS 1.0 and 1.1"],
      ["Proves", "Server identity (certificate)"],
      ["Port", "The app’s own (443, 993 …)"],
    ],
  },
  outro: {
    title: "Secure from start to finish",
    desc: "One round trip to set up",
    text: "One round trip agreed on a version, a cipher and a post-quantum hybrid key. The certificate chain proved who the server was, and every byte after the Server Hello was encrypted and authenticated, right up to the close_notify. Press REPLAY to watch it again.",
    facts: [
      ["Version", "TLS 1.3"],
      ["Cipher", "TLS_AES_128_GCM_SHA256"],
      ["Key exchange", "X25519MLKEM768"],
      ["Setup", "1 round trip"],
    ],
  },
  start: { nodes: ["client"], frame: "client" },
  steps: [
    {
      title: "Client Hello",
      desc: "Everything the browser supports",
      detail:
        "After the TCP handshake the browser lists what it can do: TLS versions, cipher suites, and key shares for the groups it expects, including the post-quantum hybrid X25519MLKEM768. It also names the site (SNI) and the protocols it speaks (ALPN).",
      facts: [
        ["Versions", "TLS 1.3, TLS 1.2"],
        ["Key shares", "X25519MLKEM768, X25519"],
        ["SNI, ALPN", "www.example.com; h2, http/1.1"],
      ],
      events: [
        { type: "show", nodes: ["router", "internet", "web"], frame: "path" },
        ...buildTcpHandshake({ dst: TLS_WEB_IP, sport: 52411, dport: 443, t: [0, 0.017, 0.034] }),
        packetEvent(
          "client",
          "web",
          "teal",
          "CLIENT HELLO",
          ["versions, ciphers, key shares", "SNI www.example.com"],
          attachWireSpec(
            createTlsRow(
              0.034,
              CLIENT_IP,
              TLS_WEB_IP,
              "Client Hello (SNI=www.example.com), 2 segments",
              "1.9 KB",
            ),
            tcpWire(TLS_ENDPOINTS, CLIENT_IP, "PA", HTTPS_CLIENT_HELLO_TLS),
          ),
        ),
      ],
    },
    {
      title: "Server Hello",
      desc: "Choices made, keys computed",
      detail:
        "The server picks TLS 1.3, the cipher suite and the hybrid group, and sends its own key share. From the two shares both sides compute the same secret without it ever crossing the network. Everything after this message is encrypted.",
      facts: [
        ["Cipher", "TLS_AES_128_GCM_SHA256"],
        ["Group", "X25519MLKEM768"],
        ["From here on", "Encrypted"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "teal",
          "SERVER HELLO",
          ["TLS 1.3, AES_128_GCM", "its key share"],
          attachWireSpec(
            createTlsRow(
              0.052,
              TLS_WEB_IP,
              CLIENT_IP,
              "Server Hello, Change Cipher Spec (+ encrypted)",
              `${TLS_SERVER_FLIGHT_SEGMENTS[0] + TCP_IP_ETH_OVERHEAD} B`,
            ),
            tcpWire(TLS_ENDPOINTS, TLS_WEB_IP, "A", {
              ...HTTPS_SERVER_HELLO_TLS,
              take: [0, TLS_SERVER_FLIGHT_SEGMENTS[0]],
            }),
          ),
        ),
        { type: "note", at: "client", text: "SHARED SECRET COMPUTED", tone: "teal" },
      ],
    },
    {
      title: "Certificate",
      desc: "Who the server is, proven",
      detail:
        "Now encrypted, the flight continues: the chosen protocol (http/1.1), the certificate chain, a signature made with the certificate’s private key, and Finished.",
      facts: [
        ["Chain", "Site → intermediate → root"],
        ["Signature", "Proves the private key"],
        ["Checked", "Name, dates, trusted root"],
      ],
      events: [
        {
          type: "stream",
          from: "web",
          to: "client",
          color: "teal",
          label: `${TLS_SERVER_FLIGHT_SEGMENTS.length - 1} SEGMENTS`,
          locked: !0,
          payload: ["encrypted: http/1.1, certificates,", "signature, Finished"],
          packets: TLS_SERVER_FLIGHT_SEGMENTS.slice(1).map((e, t) =>
            packetEvent(
              "web",
              "client",
              "teal",
              "ENCRYPTED",
              [],
              attachWireSpec(
                createTlsRow(
                  0.052,
                  TLS_WEB_IP,
                  CLIENT_IP,
                  t === TLS_SERVER_FLIGHT_SEGMENTS.length - 2
                    ? "Encrypted handshake (certificate, verify, Finished)"
                    : "Encrypted handshake (continued)",
                  `${e + TCP_IP_ETH_OVERHEAD} B`,
                ),
                tcpWire(
                  TLS_ENDPOINTS,
                  TLS_WEB_IP,
                  t === TLS_SERVER_FLIGHT_SEGMENTS.length - 2 ? "PA" : "A",
                  {
                    ...HTTPS_SERVER_HELLO_TLS,
                    take: [TLS_SEGMENT_OFFSETS[t + 1], TLS_SEGMENT_OFFSETS[t + 1] + e],
                  },
                ),
              ),
              TLS_LOCKED_OPT,
            ),
          ),
        },
        { type: "note", at: "client", text: "CHAIN LEADS TO A TRUSTED ROOT", tone: "green" },
      ],
    },
    {
      title: "Finished",
      desc: "One round trip, then data",
      detail:
        "The browser sends its own Finished: a check value over everything both sides said, keyed with the new secret, so any tampering with the hellos would show. TLS 1.3 needs one round trip before data flows; TLS 1.2 needed two.",
      facts: [
        ["Round trips", "1 (TLS 1.2: 2)"],
        ["Covers", "The whole handshake"],
        ["Change Cipher Spec", "For old middleboxes"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "teal",
          "FINISHED",
          ["check value over", "the whole handshake"],
          attachWireSpec(
            createTlsRow(
              0.07,
              CLIENT_IP,
              TLS_WEB_IP,
              "Change Cipher Spec, Finished (encrypted)",
              "118 B",
            ),
            tcpWire(TLS_ENDPOINTS, CLIENT_IP, "PA", CLIENT_FINISHED_TLS),
          ),
          TLS_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Encrypted Data",
      desc: "Records, tags and tickets",
      detail:
        "HTTP now travels in encrypted records, each with a 16-byte tag that exposes any change. The server also sends two session tickets: next time the browser can resume with one and skip the certificate.",
      facts: [
        ["Per record", `${TLS_RECORD_OVERHEAD} bytes of overhead`],
        ["Tickets", "2, for resuming later"],
        ["Visible", "IPs, SNI, sizes, timing"],
      ],
      events: [
        packetEvent(
          "client",
          "web",
          "amber",
          "APP DATA",
          ["inside: GET / HTTP/1.1"],
          attachWireSpec(
            createTlsRow(
              0.07,
              CLIENT_IP,
              TLS_WEB_IP,
              "Application Data (HTTP request)",
              formatSegmentOrByteSize(SHARED_HTTPS_METRICS.REQUEST + TCP_IP_ETH_OVERHEAD),
            ),
            tcpWire(TLS_ENDPOINTS, CLIENT_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: SHARED_HTTPS_METRICS.REQUEST - 5,
                  inner: { what: "The HTTP request", text: SHARED_HTTPS_METRICS.REQUEST_LINES },
                },
              ],
            }),
          ),
          TLS_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "TICKETS",
          ["2 session tickets", "for resuming later"],
          attachWireSpec(
            createTlsRow(
              0.087,
              TLS_WEB_IP,
              CLIENT_IP,
              "New Session Ticket ×2 (encrypted)",
              formatSegmentOrByteSize(SHARED_HTTPS_METRICS.TICKETS + TCP_IP_ETH_OVERHEAD),
            ),
            tcpWire(TLS_ENDPOINTS, TLS_WEB_IP, "PA", {
              tls: [SHARED_HTTPS_METRICS.TICKET, SHARED_HTTPS_METRICS.TICKET],
            }),
          ),
          TLS_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "violet",
          "APP DATA",
          ["inside: HTTP/1.1 200 OK", `${SHARED_HTTPS_METRICS.SEGMENTS} segments`],
          attachWireSpec(
            createTlsRow(
              0.088,
              TLS_WEB_IP,
              CLIENT_IP,
              `Application Data (HTTP response), ${SHARED_HTTPS_METRICS.SEGMENTS} segments`,
              formatSegmentOrByteSize(
                SHARED_HTTPS_METRICS.RESPONSE_FRAMES,
                SHARED_HTTPS_METRICS.SEGMENTS,
              ),
            ),
            tcpWire(TLS_ENDPOINTS, TLS_WEB_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: SHARED_HTTPS_METRICS.RESPONSE - 5,
                  inner: {
                    what: `The HTTP response, then the ${SHARED_HTTPS_METRICS.BODY.toLocaleString("en-US")}-byte page`,
                    text: SHARED_HTTPS_METRICS.RESPONSE_LINES,
                  },
                },
              ],
            }),
          ),
          TLS_LOCKED_OPT,
        ),
      ],
    },
    {
      title: "Closing",
      desc: "close_notify, then TCP",
      detail:
        "After 75 idle seconds the server closes the connection. It first sends a close_notify alert, encrypted like everything else, so the browser knows the data ended on purpose and wasn’t cut short by an attacker. Then TCP closes as usual.",
      facts: [
        ["Alert", "close_notify"],
        ["Why", "Shows nothing was cut off"],
        ["Then", "TCP FIN from both sides"],
      ],
      events: [
        packetEvent(
          "web",
          "client",
          "violet",
          "CLOSE_NOTIFY",
          ["alert: close_notify", "encrypted"],
          attachWireSpec(
            createTlsRow(
              75.088,
              TLS_WEB_IP,
              CLIENT_IP,
              "Application Data (inside: close_notify alert)",
              `${TLS_ALERT_RECORD_WIRE + TCP_IP_ETH_OVERHEAD} B`,
            ),
            tcpWire(TLS_ENDPOINTS, TLS_WEB_IP, "PA", {
              tls: [
                {
                  type: "appdata",
                  length: TLS_ALERT_RECORD_WIRE - 5,
                  inner: { what: "Alert: close_notify (the data ends here, on purpose)" },
                },
              ],
            }),
          ),
          TLS_LOCKED_OPT,
        ),
        packetEvent(
          "web",
          "client",
          "green",
          "FIN",
          [],
          attachWireSpec(
            createTlsRow(75.088, TLS_WEB_IP, CLIENT_IP, "443 → 52411 [FIN, ACK]", "60 B", "TCP"),
            tcpWire(TLS_ENDPOINTS, TLS_WEB_IP, "FA"),
          ),
          { quick: !0 },
        ),
        packetEvent(
          "client",
          "web",
          "green",
          "FIN",
          [],
          attachWireSpec(
            createTlsRow(75.105, CLIENT_IP, TLS_WEB_IP, "52411 → 443 [FIN, ACK]", "60 B", "TCP"),
            tcpWire(TLS_ENDPOINTS, CLIENT_IP, "FA"),
          ),
          { quick: !0 },
        ),
      ],
    },
  ],
};

export const PROTOCOL_LESSONS: Record<ProtocolId, Lesson> = {
  http: httpLesson,
  https: httpsLesson,
  tcp: tcpLesson,
  udp: udpLesson,
  ip: ipLesson,
  dns: dnsLesson,
  dhcp: dhcpLesson,
  icmp: icmpLesson,
  smtp: smtpLesson,
  pop3: pop3Lesson,
  imap: imapLesson,
  ftp: ftpLesson,
  ssh: sshLesson,
  tls: tlsLesson,
};

export const PROTOCOL_LIST: ProtocolMeta[] = [
  { id: "http", name: "HTTP", full: "Hypertext Transfer Protocol", group: "application" },
  { id: "https", name: "HTTPS", full: "HTTP Secure", group: "security" },
  { id: "tcp", name: "TCP", full: "Transmission Control Protocol", group: "core" },
  { id: "udp", name: "UDP", full: "User Datagram Protocol", group: "core" },
  { id: "ip", name: "IP", full: "Internet Protocol", group: "core" },
  { id: "dns", name: "DNS", full: "Domain Name System", group: "application" },
  { id: "dhcp", name: "DHCP", full: "Dynamic Host Configuration", group: "application" },
  { id: "icmp", name: "ICMP", full: "Internet Control Message", group: "core" },
  { id: "smtp", name: "SMTP", full: "Simple Mail Transfer Protocol", group: "application" },
  { id: "pop3", name: "POP3", full: "Post Office Protocol v3", group: "application" },
  { id: "imap", name: "IMAP", full: "Internet Message Access", group: "application" },
  { id: "ftp", name: "FTP", full: "File Transfer Protocol", group: "application" },
  { id: "ssh", name: "SSH", full: "Secure Shell", group: "security" },
  { id: "tls", name: "TLS/SSL", full: "Transport Layer Security", group: "security" },
];

export const ICONS: Record<string, string> = {
  menu: '<svg viewBox="0 0 18 14" width="18" height="14" aria-hidden="true"><path d="M1.5 2h15M1.5 7h15M1.5 12h15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close:
    '<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  dots: '<svg viewBox="0 0 20 6" width="20" height="6" aria-hidden="true"><circle cx="3" cy="3" r="2.1"/><circle cx="10" cy="3" r="2.1"/><circle cx="17" cy="3" r="2.1"/></svg>',
  chevron:
    '<svg viewBox="0 0 10 16" width="9" height="14" aria-hidden="true"><path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check:
    '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2.2 6.4l2.4 2.4 5.2-5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset:
    '<svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><path d="M15 9a6 6 0 1 1-1.9-4.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M14.6 1.6v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M7.5 2L3.5 6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  caret:
    '<svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  globe:
    '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><ellipse cx="10" cy="10" rx="3.6" ry="8"/><path d="M2.4 7.2h15.2M2.4 12.8h15.2"/></g></svg>',
  sun: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><path d="M10 1.6v2.2M10 16.2v2.2M1.6 10h2.2M16.2 10h2.2M4.1 4.1l1.5 1.5M14.4 14.4l1.5 1.5M4.1 15.9l1.5-1.5M14.4 5.6l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M16.5 12.6A7 7 0 0 1 7.4 3.5a7 7 0 1 0 9.1 9.1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

const ur = "protocol-explorer:progress:v1";
