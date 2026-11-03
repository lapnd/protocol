import type {
  AppPayloadSpec,
  DhcpPayloadSpec,
  DissectedField,
  DissectedFrame,
  DissectedLayer,
  DnsPayloadSpec,
  DnsRecordType,
  DnsResourceRecord,
  Lesson,
  NodeId,
  PacketEvent,
  PacketRow,
  RtpPayloadSpec,
  SshPayloadSpec,
  TcpWireSpec,
  TlsRecordSpec,
  WireSpec,
} from "../types/protocol";

export function getLinkLatency(lesson: Lesson, from: NodeId, to: NodeId): number {
  const delay = lesson.latency?.[`${from}-${to}`] ?? lesson.latency?.[`${to}-${from}`];
  if (delay === undefined) {
    throw new Error(`${lesson.id}: no delay between ${from} and ${to}`);
  }
  return delay;
}

export const collectLessonPackets = (lesson: Lesson): PacketEvent[] =>
  lesson.steps
    .flatMap((step) => step.events)
    .flatMap((ev) =>
      ev.type === "packet" ? [ev] : ev.type === "stream" ? ev.packets : [],
    );

export class LayerBuilder {
  id: string;
  name: string;
  bytes: Array<number | null> = [];
  fields: DissectedField[] = [];
  summary?: string;
  full?: number;
  cut?: boolean;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  get length(): number {
    return this.bytes.length;
  }

  u8(value: number): this {
    this.bytes.push(value & 0xff);
    return this;
  }

  u16(value: number): this {
    this.bytes.push((value >>> 8) & 0xff, value & 0xff);
    return this;
  }

  u24(value: number): this {
    this.bytes.push((value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
    return this;
  }

  u32(value: number): this {
    this.bytes.push(
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    );
    return this;
  }

  raw(arr: Iterable<number | null>): this {
    for (const b of arr) {
      this.bytes.push(b);
    }
    return this;
  }

  ascii(text: string): this {
    for (const b of new TextEncoder().encode(text)) {
      this.bytes.push(b);
    }
    return this;
  }

  unknown(count: number): this {
    for (let i = 0; i < count; i++) {
      this.bytes.push(null);
    }
    return this;
  }

  field(
    name: string,
    value: string | number,
    writeFn: () => void = () => {},
    extra: Partial<DissectedField> = {},
  ): this {
    const start = this.length;
    writeFn();
    this.fields.push({
      name,
      value: String(value),
      from: start,
      to: this.length,
      ...extra,
    });
    return this;
  }
}

const ipv4ToBytes = (ip: string): number[] => ip.split(".").map(Number);

const macToBytes = (mac: string): number[] =>
  mac.split(":").map((part) => parseInt(part, 16));

function ipv6ToBytes(ip: string): number[] {
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail !== undefined && tail ? tail.split(":") : [];
  return [
    ...headParts,
    ...Array(8 - headParts.length - tailParts.length).fill("0"),
    ...tailParts,
  ].flatMap((word) => [parseInt(word, 16) >> 8, parseInt(word, 16) & 0xff]);
}

const formatHex = (value: number, width = 4): string =>
  `0x${value.toString(16).padStart(width, "0")}`;

function internetChecksum(bytes: Array<number | null>): number | null {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    const hi = bytes[i];
    const lo = i + 1 < bytes.length ? bytes[i + 1] : 0;
    if (hi === null || lo === null) return null;
    sum += (hi << 8) | lo;
  }
  while (sum > 0xffff) {
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return ~sum & 0xffff;
}

function mergeLayers(layers: LayerBuilder[]): {
  bytes: Array<number | null>;
  fields: DissectedField[];
  layers: DissectedLayer[];
} {
  const bytes: Array<number | null> = [];
  const fields: DissectedField[] = [];
  const layerMeta: DissectedLayer[] = [];

  for (const layer of layers) {
    const offset = bytes.length;
    layerMeta.push({
      id: layer.id,
      name: layer.name,
      from: offset,
      to: offset + layer.length,
      summary: layer.summary,
    });
    for (const f of layer.fields) {
      fields.push({
        ...f,
        layer: layer.id,
        from: f.from + offset,
        to: f.to + offset,
      });
    }
    bytes.push(...layer.bytes);
  }
  return { bytes, fields, layers: layerMeta };
}

const LAPTOP_IP = "192.168.1.10";
const ROUTER_LAN_IP = "192.168.1.1";
const ROUTER_WAN_IP = "198.51.100.7";
const ISP_ROUTER_IP = "198.51.100.1";
const PUBLIC_DNS_IP = "8.8.8.8";

const MAC_ADDRESSES = {
  laptop: "00:00:5e:00:53:10",
  lan: "00:00:5e:00:53:01",
  wan: "00:00:5e:00:53:02",
  isp: "00:00:5e:00:53:fe",
  all: "ff:ff:ff:ff:ff:ff",
};

const isHomeNetworkIp = (ip: string): boolean =>
  ip.startsWith("192.168.1.") || ip === "0.0.0.0" || ip === "255.255.255.255";

const isLaptopIp = (ip: string): boolean => ip === LAPTOP_IP || ip === "0.0.0.0";

const initialTtlForHost = (ip: string): number =>
  isLaptopIp(ip) || ip === PUBLIC_DNS_IP ? 128 : ip === ISP_ROUTER_IP ? 255 : 64;

const hopsFromHost = (ip: string): number =>
  ip === ROUTER_LAN_IP ? 0 : ip === ISP_ROUTER_IP ? 1 : ip === PUBLIC_DNS_IP ? 10 : 12;

const DEFAULT_MSS = 1460;

function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (const ch of str) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

const CRLF = "\r\n";
const escapeJsonString = (str: string): string => JSON.stringify(str).slice(1, -1);

function buildTextLinesLayer(id: string, name: string, lines: string[]): LayerBuilder {
  const layer = new LayerBuilder(id, name);
  lines.forEach((line, idx) =>
    layer.field(idx ? "" : "Text", `${escapeJsonString(line)}␍␊`, () => layer.ascii(line + CRLF), {
      mono: true,
    }),
  );
  return layer;
}

function buildAppPayloadWithSlice(row: PacketRow, spec: AppPayloadSpec): LayerBuilder {
  const fullLayer = buildAppPayloadLayer(row, spec);
  if (!spec.take) return fullLayer;
  const [from, to] = spec.take;
  const sliced = new LayerBuilder(
    fullLayer.id,
    `${fullLayer.name} · bytes ${from + 1}–${to} of ${fullLayer.length.toLocaleString("en-US")}`,
  );
  sliced.bytes = fullLayer.bytes.slice(from, to);
  sliced.fields = fullLayer.fields
    .filter((f) => (f.from === f.to ? f.from >= from && f.from <= to : f.to > from && f.from < to))
    .map((f) => ({
      ...f,
      from: Math.max(0, f.from - from),
      to: Math.min(to, f.to) - from,
    }));
  return sliced;
}

const cleanProtoDisplayName = (row: PacketRow): string =>
  row.proto.replace(" (TLS)", "").replace("-DATA", " data");

const TLS_RECORD_TYPES: Record<TlsRecordSpec["type"], [number, string]> = {
  handshake: [22, "Handshake"],
  ccs: [20, "Change Cipher Spec"],
  appdata: [23, "Application Data"],
  alert: [21, "Alert"],
};

function buildAppPayloadLayer(row: PacketRow, spec: AppPayloadSpec): LayerBuilder {
  if (spec.ascii !== undefined) {
    const asciiText = spec.ascii;
    const layer = new LayerBuilder("app", spec.name ?? cleanProtoDisplayName(row));
    layer.field(
      "Data",
      `"${asciiText}" (${asciiText.length} bytes)`,
      () => layer.ascii(asciiText),
      {
        mono: true,
        note: spec.note,
      },
    );
    return layer;
  }
  if (spec.text) {
    return buildTextLinesLayer("app", spec.name ?? cleanProtoDisplayName(row), spec.text);
  }
  if (spec.http) {
    const httpSpec = spec.http;
    const layer = buildTextLinesLayer("app", "HTTP", httpSpec.lines);
    if (httpSpec.body) {
      const bodyLen = httpSpec.body;
      layer.field(
        "Body",
        `${bodyLen.toLocaleString("en-US")} bytes: ${httpSpec.what}`,
        () => layer.unknown(bodyLen),
        { hidden: true, note: "The page itself; its contents are not part of the lesson." },
      );
    }
    return layer;
  }
  if (spec.opaque !== undefined) {
    const opaqueLen = spec.opaque;
    const layer = new LayerBuilder("app", spec.name ?? cleanProtoDisplayName(row));
    layer.field(
      "Data",
      `${opaqueLen.toLocaleString("en-US")} bytes: ${spec.what}`,
      () => layer.unknown(opaqueLen),
      { hidden: true, note: spec.note },
    );
    return layer;
  }
  if (spec.tls) return buildTlsLayer(spec.tls);
  if (spec.ssh) return buildSshLayer(spec.ssh);
  if (spec.dns) return buildDnsLayer(spec.dns);
  if (spec.dhcp) return buildDhcpLayer(spec.dhcp);
  if (spec.rtp) return buildRtpLayer(spec.rtp);
  throw new Error(`unknown payload for ${row.info}`);
}

function buildTlsLayer(records: TlsRecordSpec[]): LayerBuilder {
  const layer = new LayerBuilder(
    "tls",
    `TLS 1.3 · ${records.length} record${records.length > 1 ? "s" : ""}`,
  );
  for (const rec of records) {
    const [code, typeName] = TLS_RECORD_TYPES[rec.type];
    const len = rec.length;
    layer.field(
      "Record",
      `${typeName}, ${len.toLocaleString("en-US")} byte${len === 1 ? "" : "s"}`,
      () => {},
      { heading: true },
    );
    layer.field("Content type", `${code} (${typeName})`, () => layer.u8(code), {
      depth: 1,
      note: rec.inner
        ? "Every encrypted record says Application Data on the outside; the real type is inside."
        : undefined,
    });
    layer.field(
      "Version",
      rec.legacy ? "0x0301 (TLS 1.0)" : "0x0303 (TLS 1.2)",
      () => layer.u16(rec.legacy ? 0x0301 : 0x0303),
      {
        depth: 1,
        note: rec.legacy
          ? "A Client Hello’s record says TLS 1.0 so old middleboxes let it through; the real versions are offered inside."
          : "TLS 1.3 records say 1.2 on the outside, for compatibility.",
      },
    );
    layer.field("Length", len.toLocaleString("en-US"), () => layer.u16(len), { depth: 1 });

    if (rec.type === "ccs") {
      layer.field("Change cipher spec", "1", () => layer.u8(1), {
        depth: 1,
        note: "Has no job in TLS 1.3; sent so middleboxes see a familiar handshake.",
      });
    } else if (rec.hello) {
      const hello = rec.hello;
      layer.field("Handshake type", `${hello.type} (${hello.name})`, () => layer.u8(hello.type), {
        depth: 1,
      });
      layer.field("Length", (len - 4).toLocaleString("en-US"), () => layer.u24(len - 4), {
        depth: 1,
      });
      layer.field(
        "Contents",
        `${(len - 4).toLocaleString("en-US")} bytes`,
        () => layer.unknown(len - 4),
        {
          depth: 1,
          hidden: true,
          note: hello.note,
        },
      );
      for (const [fName, fVal] of hello.fields) {
        layer.field(fName, fVal, () => {}, { depth: 2 });
      }
    } else {
      layer.field(
        "Encrypted data",
        `${len.toLocaleString("en-US")} bytes`,
        () => layer.unknown(len),
        {
          depth: 1,
          hidden: true,
          note: "Ciphertext, ending in a 16-byte tag that shows any change. Only the two ends can read it.",
        },
      );
      if (rec.inner) {
        layer.field("Inside", rec.inner.what, () => {}, { depth: 2, inside: true });
        for (const line of rec.inner.text ?? []) {
          layer.field("", `${escapeJsonString(line)}␍␊`, () => {}, {
            depth: 3,
            inside: true,
            mono: true,
          });
        }
      }
    }
  }
  return layer;
}

function buildSshLayer(ssh: SshPayloadSpec): LayerBuilder {
  const layer = new LayerBuilder("ssh", "SSH");
  if (ssh.sealed) {
    const sealedLen = ssh.sealed;
    layer.name = "SSH · encrypted packet";
    layer.field("Encrypted packet", `${sealedLen} bytes`, () => layer.unknown(sealedLen), {
      hidden: true,
      note: "With chacha20-poly1305 even the length is encrypted; a 16-byte tag at the end shows any change.",
    });
    layer.field("Inside", ssh.inside!, () => {}, { depth: 1, inside: true });
    return layer;
  }

  const body = new LayerBuilder("x", "");
  const writeSshStringField = (label: string, val: string, depth = 1) =>
    body.field(
      label,
      val.length > 60 ? `${val.slice(0, 57)}…` : val,
      () => body.u32(val.length).ascii(val),
      { depth, mono: true },
    );

  if (ssh.msg === "kexinit") {
    body.field("Message", "20 (KEXINIT)", () => body.u8(20));
    body.field("Cookie", "16 random bytes", () => body.unknown(16), { depth: 1, hidden: true });
    const kexLists: Array<[string, string[]]> = [
      ["Key exchange", ssh.kex!],
      ["Host keys", ssh.hostkeys!],
      ["Ciphers, out", ssh.ciphers!],
      ["Ciphers, in", ssh.ciphers!],
      ["MACs, out", ssh.macs!],
      ["MACs, in", ssh.macs!],
      ["Compression, out", ssh.compression!],
      ["Compression, in", ssh.compression!],
      ["Languages, out", []],
      ["Languages, in", []],
    ];
    for (const [label, list] of kexLists) {
      writeSshStringField(label, list.join(","));
    }
    body.field("First packet follows", "0", () => body.u8(0), { depth: 1 });
    body.field("Reserved", "0", () => body.u32(0), { depth: 1 });
  } else if (ssh.msg === "ecdh_init") {
    const qLen = ssh.q!;
    body.field("Message", "30 (KEX_ECDH_INIT)", () => body.u8(30));
    body.field(
      "Public keys",
      `${qLen} bytes (sntrup761 1,158 + X25519 32)`,
      () => body.u32(qLen).unknown(qLen),
      { depth: 1, hidden: true },
    );
  } else if (ssh.msg === "ecdh_reply") {
    const ksLen = ssh.ks!;
    const qLen = ssh.q!;
    const sigLen = ssh.sig!;
    body.field("Message", "31 (KEX_ECDH_REPLY)", () => body.u8(31));
    body.field(
      "Host key",
      `${ksLen} bytes: ssh-ed25519 public key`,
      () => body.u32(ksLen).unknown(ksLen),
      { depth: 1, hidden: true },
    );
    body.field(
      "Server’s half",
      `${qLen} bytes (sntrup761 ciphertext 1,039 + X25519 32)`,
      () => body.u32(qLen).unknown(qLen),
      { depth: 1, hidden: true },
    );
    body.field(
      "Signature",
      `${sigLen} bytes: ssh-ed25519 signature over the exchange`,
      () => body.u32(sigLen).unknown(sigLen),
      { depth: 1, hidden: true },
    );
  } else if (ssh.msg === "newkeys") {
    body.field("Message", "21 (NEWKEYS)", () => body.u8(21), {
      note: "From the next packet on, this side encrypts.",
    });
  }

  let padLen = 8 - ((5 + body.length) % 8);
  if (padLen < 4) padLen += 8;

  layer.field(
    "Packet length",
    1 + body.length + padLen,
    () => layer.u32(1 + body.length + padLen),
    { note: "Bytes after this field." },
  );
  layer.field("Padding length", padLen, () => layer.u8(padLen), {
    note: "Random padding brings the packet to a multiple of 8 bytes.",
  });

  const bodyOffset = layer.length;
  layer.raw(body.bytes);
  for (const f of body.fields) {
    layer.fields.push({ ...f, from: f.from + bodyOffset, to: f.to + bodyOffset });
  }
  layer.field("Padding", `${padLen} random bytes`, () => layer.unknown(padLen), { hidden: true });
  return layer;
}

const DNS_TYPE_CODES: Record<DnsRecordType, number> = {
  A: 1,
  NS: 2,
  MX: 15,
  AAAA: 28,
  OPT: 41,
};

function buildDnsLayer(dns: DnsPayloadSpec): LayerBuilder {
  const layer = new LayerBuilder("dns", "DNS");
  const nameOffsets = new Map<string, number>();

  const writeCompressedName = (domain: string) => {
    const labels = domain.split(".");
    for (let i = 0; i < labels.length; i++) {
      const suffix = labels.slice(i).join(".");
      if (nameOffsets.has(suffix)) {
        return layer.u16(0xc000 | nameOffsets.get(suffix)!);
      }
      if (layer.length < 16383) {
        nameOffsets.set(suffix, layer.length);
      }
      layer.u8(labels[i].length).ascii(labels[i]);
    }
    layer.u8(0);
  };

  const flags =
    (dns.response ? 0x8000 : 0) |
    (dns.aa ? 0x0400 : 0) |
    (dns.rd ? 0x0100 : 0) |
    (dns.ra ? 0x0080 : 0);

  const flagNames = [
    dns.response ? "response" : "query",
    dns.aa && "AA (authoritative)",
    dns.rd && "RD (recursion desired)",
    dns.ra && "RA (recursion available)",
  ].filter(Boolean) as string[];

  const asList = (arr?: DnsResourceRecord[]) => arr ?? [];
  const arCount = asList(dns.ar).length + (dns.edns ? 1 : 0);

  layer.field("Transaction ID", formatHex(dns.id), () => layer.u16(dns.id), {
    note: "Picked at random; the answer must carry the same one.",
    example: true,
  });
  layer.field("Flags", `${formatHex(flags)}: ${flagNames.join(", ")}`, () => layer.u16(flags));
  layer.field("Questions", 1, () => layer.u16(1));
  layer.field("Answers", asList(dns.an).length, () => layer.u16(asList(dns.an).length));
  layer.field("Authority records", asList(dns.ns).length, () => layer.u16(asList(dns.ns).length));
  layer.field("Additional records", arCount, () => layer.u16(arCount));

  const [qName, qType] = dns.q;
  layer.field("Question", `${qName}, type ${qType}, class IN`, () => {
    writeCompressedName(qName);
    layer.u16(DNS_TYPE_CODES[qType]).u16(1);
  });

  const writeRecord = (sectionName: string, [rrName, rrType, ttl, rdata]: DnsResourceRecord) => {
    const displayRdata =
      rrType === "MX" ? `${(rdata as [number, string])[0]} ${(rdata as [number, string])[1]}` : rdata;
    layer.field(
      sectionName,
      `${rrName} ${rrType} ${displayRdata} (TTL ${ttl.toLocaleString("en-US")} s)`,
      () => {
        writeCompressedName(rrName);
        layer.u16(DNS_TYPE_CODES[rrType]).u16(1).u32(ttl);
        const lenPos = layer.length;
        layer.u16(0);
        if (rrType === "A") {
          layer.raw(ipv4ToBytes(rdata as string));
        } else if (rrType === "AAAA") {
          layer.raw(ipv6ToBytes(rdata as string));
        } else if (rrType === "NS") {
          writeCompressedName(rdata as string);
        } else if (rrType === "MX") {
          const [pref, host] = rdata as [number, string];
          layer.u16(pref);
          writeCompressedName(host);
        }
        const rdLen = layer.length - lenPos - 2;
        layer.bytes[lenPos] = rdLen >> 8;
        layer.bytes[lenPos + 1] = rdLen & 0xff;
      },
      { example: dns.exampleTtl && sectionName === "Answer" },
    );
  };

  asList(dns.an).forEach((rr) => writeRecord("Answer", rr));
  asList(dns.ns).forEach((rr) => writeRecord("Authority", rr));
  asList(dns.ar).forEach((rr) => writeRecord("Additional", rr));

  if (dns.edns) {
    const ednsSize = dns.edns.size;
    layer.field(
      "EDNS",
      `UDP size ${ednsSize}, DNSSEC OK = 0`,
      () => layer.u8(0).u16(41).u16(ednsSize).u32(0).u16(0),
      {
        note: "Says how big a UDP answer can be. DNSSEC signatures are not asked for here, to keep the lesson short; a validating resolver like 8.8.8.8 does ask for them.",
      },
    );
  }
  return layer;
}

const DHCP_MESSAGE_NAMES = [
  "",
  "Discover",
  "Offer",
  "Request",
  "Decline",
  "ACK",
  "NAK",
  "Release",
  "Inform",
];

const DHCP_OPTIONS_META: Record<number, [string, string]> = {
  1: ["Subnet mask", "ip"],
  3: ["Router", "ip"],
  6: ["DNS server", "ip"],
  12: ["Host name", "text"],
  28: ["Broadcast address", "ip"],
  50: ["Requested address", "ip"],
  51: ["Lease time", "secs"],
  53: ["Message type", "type"],
  54: ["Server identifier", "ip"],
  55: ["Parameters wanted", "list"],
  58: ["Renewal time (T1)", "secs"],
  59: ["Rebinding time (T2)", "secs"],
  60: ["Vendor class", "text"],
  61: ["Client identifier", "mac"],
  81: ["Client FQDN", "fqdn"],
};

function buildDhcpLayer(dhcp: DhcpPayloadSpec): LayerBuilder {
  const msgTypeTuple = dhcp.options.find(([code]) => code === 53)!;
  const layer = new LayerBuilder("dhcp", `DHCP ${DHCP_MESSAGE_NAMES[msgTypeTuple[1]]}`);
  const writeIpField = (label: string, ip: string, note?: string) =>
    layer.field(label, ip, () => layer.raw(ipv4ToBytes(ip)), { note });

  layer.field(
    "Message",
    dhcp.op === 1 ? "1 (request, from a client)" : "2 (reply, from a server)",
    () => layer.u8(dhcp.op),
  );
  layer.field("Hardware", "Ethernet, 6-byte addresses", () => layer.u8(1).u8(6));
  layer.field("Hops", "0", () => layer.u8(0));
  layer.field("Transaction ID", formatHex(dhcp.xid, 8), () => layer.u32(dhcp.xid), {
    note: "Chosen by the client; every reply repeats it.",
  });
  layer.field("Seconds", "0", () => layer.u16(0));
  layer.field("Flags", "0x0000 (unicast replies are fine)", () => layer.u16(0), {
    note: "Broadcast flag off: the server may send straight to the client’s MAC address.",
  });
  writeIpField(
    "Client address",
    dhcp.ciaddr ?? "0.0.0.0",
    "Filled in only when the client already has an address (renewing).",
  );
  writeIpField("Your address", dhcp.yiaddr ?? "0.0.0.0", "The address the server is giving out.");
  writeIpField("Next server", dhcp.siaddr ?? "0.0.0.0");
  writeIpField("Relay agent", "0.0.0.0");
  layer.field(
    "Client MAC",
    MAC_ADDRESSES.laptop,
    () => layer.raw(macToBytes(MAC_ADDRESSES.laptop)).raw(Array(10).fill(0)),
    { example: true },
  );
  layer.field("Server name, boot file", "empty", () => layer.raw(Array(192).fill(0)));
  layer.field("Magic cookie", "99.130.83.99 (DHCP)", () => layer.raw([99, 130, 83, 99]), {
    note: "Marks the options that follow as DHCP.",
  });

  for (const [optCode, optVal] of dhcp.options) {
    const [optLabel, optKind] = DHCP_OPTIONS_META[optCode];
    const formattedVal =
      optKind === "type"
        ? `${optVal} (${DHCP_MESSAGE_NAMES[optVal]})`
        : optKind === "secs"
          ? `${optVal.toLocaleString("en-US")} s (${optVal / 3600} h)`
          : optKind === "list"
            ? optVal.join(", ")
            : optKind === "mac"
              ? `01 ${MAC_ADDRESSES.laptop}`
              : optVal;

    layer.field(
      `Option ${optCode}`,
      `${optLabel}: ${formattedVal}`,
      () => {
        layer.u8(optCode);
        if (optKind === "ip") {
          layer.u8(4).raw(ipv4ToBytes(optVal));
        } else if (optKind === "type") {
          layer.u8(1).u8(optVal);
        } else if (optKind === "secs") {
          layer.u8(4).u32(optVal);
        } else if (optKind === "text") {
          layer.u8(optVal.length).ascii(optVal);
        } else if (optKind === "list") {
          layer.u8(optVal.length).raw(optVal);
        } else if (optKind === "mac") {
          layer.u8(7).u8(1).raw(macToBytes(MAC_ADDRESSES.laptop));
        } else if (optKind === "fqdn") {
          layer
            .u8(3 + optVal.length)
            .u8(0)
            .u8(0)
            .u8(0)
            .ascii(optVal);
        }
      },
      { example: ["text", "list", "fqdn"].includes(optKind) },
    );
  }

  layer.field("End", "255", () => layer.u8(255));
  if (layer.length < 300) {
    const padLen = 300 - layer.length;
    layer.field("Padding", `${padLen} zero bytes, up to the 300-byte minimum`, () =>
      layer.raw(Array(padLen).fill(0)),
    );
  }
  return layer;
}

function buildRtpLayer(rtp: RtpPayloadSpec): LayerBuilder {
  const layer = new LayerBuilder("rtp", "RTP + audio");
  layer.field("Version etc.", "2, no padding, no extension, no CSRCs", () => layer.u8(128));
  layer.field(
    "Marker, payload type",
    `${rtp.marker ? 1 : 0}, ${rtp.pt} (Opus, agreed when the call was set up)`,
    () => layer.u8((rtp.marker ? 128 : 0) | rtp.pt),
    { example: true },
  );
  layer.field("Sequence number", rtp.seq, () => layer.u16(rtp.seq), {
    note: "Counts up by one per packet, so the app can spot a missing or late one.",
    example: true,
  });
  layer.field("Timestamp", rtp.ts, () => layer.u32(rtp.ts), {
    note: "Audio clock at 48,000 per second: +960 per 20 ms frame.",
    example: true,
  });
  layer.field("SSRC", formatHex(rtp.ssrc, 8), () => layer.u32(rtp.ssrc), {
    note: "Identifies this audio stream.",
    example: true,
  });
  layer.field("Audio", `${rtp.audio} bytes of Opus audio (20 ms)`, () => layer.unknown(rtp.audio), {
    hidden: true,
  });
  return layer;
}

const TCP_FLAG_DEFS: Array<[string, number, string]> = [
  ["F", 1, "FIN"],
  ["S", 2, "SYN"],
  ["R", 4, "RST"],
  ["P", 8, "PSH"],
  ["A", 16, "ACK"],
];

function decodeTcpFlagsString(flagsStr: string): { bits: number; names: string } {
  const active = TCP_FLAG_DEFS.filter(([ch]) => flagsStr.includes(ch));
  return {
    bits: active.reduce((acc, [, bit]) => acc | bit, 0),
    names: active.map(([, , name]) => name).join(", "),
  };
}

const buildPseudoHeader = (srcIp: string, dstIp: string, proto: number, length: number): number[] => [
  ...ipv4ToBytes(srcIp),
  ...ipv4ToBytes(dstIp),
  0,
  proto,
  length >> 8,
  length & 0xff,
];

interface TcpEndpointState {
  ip: string;
  isn: number;
  next: number;
  got: number;
  ooo: Array<[number, number]>;
  tsBase: number;
  peerTs: number;
  win: [number, number];
}

interface TcpConnectionState {
  key: string;
  ends: Record<string, TcpEndpointState>;
  ts: boolean;
}

interface PendingTcpDelivery {
  at: number;
  to: TcpEndpointState;
  seq: number;
  len: number;
  tsval: number;
}

export class LessonPacketDissector {
  lesson: Lesson;
  alias = new Map<string, string>();
  ids = new Map<string, number>();
  conns = new Map<string, TcpConnectionState>();
  pending: PendingTcpDelivery[] = [];
  remote = new Map<string, number>();
  built: Array<DissectedFrame | null> = [];

  constructor(lesson: Lesson) {
    this.lesson = lesson;
  }

  ipId(srcIp: string): number {
    if (!this.ids.has(srcIp)) {
      this.ids.set(srcIp, fnv1aHash(`id ${srcIp}`) & 0xffff);
    }
    const current = this.ids.get(srcIp)!;
    this.ids.set(srcIp, (current + 1) & 0xffff);
    return current;
  }

  endpointMac(ip: string, isNextHop = false): string {
    if (!this.remote.has(ip)) {
      this.remote.set(ip, this.remote.size);
    }
    const idx = this.remote.get(ip)!;
    return `00:00:5e:00:53:${(isNextHop ? 128 + idx : 64 + idx).toString(16)}`;
  }

  link(row: PacketRow): {
    at: string;
    src: string;
    dst: string;
    srcNote: string;
    dstNote: string;
  } {
    const { src, dst } = row;
    if (isHomeNetworkIp(src) || isHomeNetworkIp(dst)) {
      const fromHome = isHomeNetworkIp(src);
      const isBroadcast = dst === "255.255.255.255" || dst === "Broadcast";
      return {
        at: "Seen on the laptop’s home network",
        src: fromHome ? MAC_ADDRESSES.laptop : MAC_ADDRESSES.lan,
        dst: isBroadcast
          ? MAC_ADDRESSES.all
          : fromHome
            ? MAC_ADDRESSES.lan
            : MAC_ADDRESSES.laptop,
        srcNote: fromHome
          ? "The laptop’s network card."
          : "The router’s side facing the home network.",
        dstNote: isBroadcast
          ? "Broadcast: every device on the network receives it."
          : fromHome
            ? "The router: anything beyond the home network goes to it first."
            : "The laptop.",
      };
    }
    if (src === ROUTER_WAN_IP) {
      return {
        at: "Seen as it leaves the router’s internet side",
        src: MAC_ADDRESSES.wan,
        dst: MAC_ADDRESSES.isp,
        srcNote: "The router’s internet-facing port.",
        dstNote: "The internet provider’s router, the next hop.",
      };
    }
    return {
      at: `Seen as it leaves ${src}`,
      src: this.endpointMac(src),
      dst: this.endpointMac(src, true),
      srcNote: "The sender’s network card.",
      dstNote: "The sender’s next router; each hop puts the packet in a new frame.",
    };
  }

  ttl(row: PacketRow, wire: WireSpec): number {
    if (wire.ttl !== undefined) return wire.ttl;
    if (isHomeNetworkIp(row.dst) && !isHomeNetworkIp(row.src)) {
      return initialTtlForHost(row.src) - hopsFromHost(row.src);
    }
    return initialTtlForHost(row.src);
  }

  conn(
    row: PacketRow,
    tcp: TcpWireSpec,
  ): {
    c: TcpConnectionState;
    me: TcpEndpointState;
    peer: TcpEndpointState;
    meKey: string;
    peerKey: string;
  } {
    const resolveAlias = (ep: string) => this.alias.get(ep) ?? ep;
    const meKey = resolveAlias(`${row.src}:${tcp.sport}`);
    const peerKey = resolveAlias(`${row.dst}:${tcp.dport}`);
    const connKey = [meKey, peerKey].sort().join(" ");
    if (!this.conns.has(connKey)) {
      this.conns.set(connKey, { key: connKey, ends: {}, ts: false });
    }
    const conn = this.conns.get(connKey)!;
    for (const [epKey, ip] of [
      [meKey, meKey.split(":")[0]],
      [peerKey, peerKey.split(":")[0]],
    ]) {
      conn.ends[epKey] ??= {
        ip,
        isn: fnv1aHash(`isn ${connKey} ${epKey}`),
        next: 0,
        got: 0,
        ooo: [],
        tsBase: fnv1aHash(`ts ${epKey}`) % 4e9,
        peerTs: 0,
        win: isLaptopIp(ip) ? [1026, 8] : [501, 7],
      };
    }
    return {
      c: conn,
      me: conn.ends[meKey],
      peer: conn.ends[peerKey],
      meKey,
      peerKey,
    };
  }

  deliver(timeSec: number): void {
    this.pending = this.pending.filter((item) => {
      if (item.at > timeSec + 1e-9) return true;
      const dest = item.to;
      if (item.seq === dest.got) {
        dest.got += item.len;
        dest.ooo.sort((a, b) => a[0] - b[0]);
        while (dest.ooo.length && dest.ooo[0][0] <= dest.got) {
          dest.got = Math.max(dest.got, dest.ooo.shift()![1]);
        }
      } else if (item.seq > dest.got) {
        dest.ooo.push([item.seq, item.seq + item.len]);
      }
      if (item.tsval) {
        dest.peerTs = item.tsval;
      }
      return false;
    });
  }

  tcp(
    row: PacketRow,
    tcpSpec: TcpWireSpec,
    payloadLayer: LayerBuilder | null,
    timeSec: number,
    pktEvent: PacketEvent,
    explicitSegments?: number,
  ): {
    header: LayerBuilder;
    first: number;
    segments: number;
    mss: number;
    seq: number;
    ack: number;
    hlen: number;
  } {
    const { c: conn, me, peer } = this.conn(row, tcpSpec);
    const { bits, names } = decodeTcpFlagsString(tcpSpec.flags);
    const isSyn = (bits & 2) !== 0;
    const isFin = (bits & 1) !== 0;
    const isAck = (bits & 16) !== 0;
    const payloadLen = payloadLayer ? payloadLayer.length : 0;
    const fromLaptop = isLaptopIp(me.ip);

    if (isSyn && !isAck) {
      conn.ts = !fromLaptop;
    }

    type TcpOptionEntry =
      | ["NOP"]
      | ["MSS", number]
      | ["WS", number]
      | ["SACKP"]
      | ["TS", number, number]
      | ["SACK", Array<[number, number]>];

    const options: TcpOptionEntry[] = [];
    const msElapsed = Math.round(timeSec * 1000);
    const tsVal = (me.tsBase + msElapsed) >>> 0;

    if (isSyn && !isAck && fromLaptop) {
      options.push(["MSS", 1460], ["NOP"], ["WS", 8], ["NOP"], ["NOP"], ["SACKP"]);
    } else if (isSyn && !isAck) {
      options.push(["MSS", 1460], ["SACKP"], ["TS", tsVal, 0], ["NOP"], ["WS", 7]);
    } else if (isSyn) {
      options.push(
        ...(conn.ts
          ? ([["MSS", 1460], ["SACKP"], ["TS", tsVal, me.peerTs], ["NOP"], ["WS", 7]] as TcpOptionEntry[])
          : ([["MSS", 1460], ["NOP"], ["NOP"], ["SACKP"], ["NOP"], ["WS", 7]] as TcpOptionEntry[])),
      );
    } else if (conn.ts) {
      options.push(["NOP"], ["NOP"], ["TS", tsVal, me.peerTs]);
    }

    if (tcpSpec.sack) {
      const sackBlocks = peer && me.ooo.map(([s, e]) => [s, e] as [number, number]);
      options.push(["NOP"], ["NOP"], ["SACK", sackBlocks]);
    }

    const effectiveMss = conn.ts ? DEFAULT_MSS - 12 : DEFAULT_MSS;
    const firstSegPayloadLen = Math.min(payloadLen, effectiveMss);
    const relSeq = tcpSpec.seq ?? me.next;
    const relAck = isAck ? (tcpSpec.ack ?? me.got) : 0;

    if (tcpSpec.seq === undefined) {
      me.next += payloadLen + (isSyn ? 1 : 0) + (isFin ? 1 : 0);
    }
    if (!pktEvent.lost) {
      this.pending.push({
        at: timeSec + getLinkLatency(this.lesson, pktEvent.from, pktEvent.to),
        to: peer,
        seq: relSeq,
        len: payloadLen + (isSyn ? 1 : 0) + (isFin ? 1 : 0),
        tsval: conn.ts ? tsVal : 0,
      });
    }

    const header = new LayerBuilder("tcp", "");
    const optionsByteLen = options.reduce(
      (sum, opt) =>
        sum +
        ({
          NOP: 1,
          MSS: 4,
          WS: 3,
          SACKP: 2,
          TS: 10,
          SACK: 2 + 8 * (opt[0] === "SACK" ? opt[1].length : 0),
        }[opt[0]] ?? 0),
      0,
    );
    const headerLen = 20 + optionsByteLen;

    header.summary = `${tcpSpec.sport} → ${tcpSpec.dport}, ${names}`;
    header.name = `TCP · ${headerLen} bytes`;

    header.field("Source port", tcpSpec.sport, () => header.u16(tcpSpec.sport), {
      note: fromLaptop
        ? row.src === ROUTER_WAN_IP
          ? "The router’s NAT swapped in its own port for the laptop’s."
          : "Picked by the laptop’s system for this connection."
        : undefined,
    });
    header.field("Destination port", tcpSpec.dport, () => header.u16(tcpSpec.dport));
    header.field(
      "Sequence number",
      isSyn ? "0 (relative)" : `${relSeq} (relative)`,
      () => header.u32((me.isn + relSeq) >>> 0),
      {
        note: isSyn
          ? "This side’s starting number. Shown as 0; the real one is random."
          : "Position of this segment’s first byte, counted from this side’s SYN.",
      },
    );
    header.field("Real sequence number", (me.isn + relSeq) >>> 0, () => {}, {
      depth: 1,
      example: true,
    });
    header.field(
      "Acknowledgment",
      isAck ? `${relAck} (relative)` : "0 (not used yet)",
      () => header.u32(isAck ? (peer.isn + relAck) >>> 0 : 0),
      {
        note: isAck
          ? "The next byte this side expects: everything before it has arrived."
          : "A first SYN has nothing to acknowledge.",
      },
    );
    header.field("Header length", `${headerLen} bytes`, () => header.u8((headerLen / 4) << 4), {
      note: optionsByteLen ? `20 bytes, plus ${optionsByteLen} of options.` : undefined,
    });
    header.field("Flags", `${formatHex(bits, 3)} (${names})`, () => header.u8(bits));

    const winScaleShift = me.win[1];
    const winRaw = isSyn ? (isAck && conn.ts ? 65160 : 64240) : me.win[0];
    header.field(
      "Window",
      isSyn
        ? `${winRaw}`
        : `${winRaw} (× ${2 ** winScaleShift} = ${(winRaw * 2 ** winScaleShift).toLocaleString("en-US")} bytes)`,
      () => header.u16(winRaw),
      { note: "How much more data this side can take right now.", example: true },
    );

    const checksumPos = header.length;
    header.field("Checksum", "", () => header.u16(0), {
      note: "Covers the header, the data and the IP addresses, so damage is caught.",
    });
    header.field("Urgent pointer", "0", () => header.u16(0));

    if (options.length) {
      header.field("Options", `${optionsByteLen} bytes`, () => {}, { heading: true });
      for (const opt of options) {
        if (opt[0] === "NOP") {
          header.field("No-op", "1", () => header.u8(1), {
            depth: 1,
            note: "Spacing, so the next option lines up.",
          });
        } else if (opt[0] === "MSS") {
          const mssVal = opt[1];
          header.field(
            "Maximum segment size",
            `${mssVal} bytes`,
            () => header.u8(2).u8(4).u16(mssVal),
            {
              depth: 1,
              note: "The most data this side wants in one segment.",
            },
          );
        } else if (opt[0] === "WS") {
          const wsVal = opt[1];
          header.field("Window scale", `× ${2 ** wsVal}`, () => header.u8(3).u8(3).u8(wsVal), {
            depth: 1,
            note: "Window values are multiplied by this, so windows can be larger than 64 KB.",
          });
        } else if (opt[0] === "SACKP") {
          header.field("SACK permitted", "yes", () => header.u8(4).u8(2), {
            depth: 1,
            note: "This side understands selective acknowledgements.",
          });
        } else if (opt[0] === "TS") {
          const [, tsV, tsE] = opt;
          header.field(
            "Timestamps",
            `value ${tsV}, echo ${tsE}`,
            () => header.u8(8).u8(10).u32(tsV).u32(tsE),
            {
              depth: 1,
              note: "Used to measure round trips; both sides offered them.",
              example: true,
            },
          );
        } else if (opt[0] === "SACK") {
          const blocks = opt[1];
          header.field(
            "SACK",
            blocks.map(([s, e]) => `has ${s}–${e - 1}`).join(", "),
            () => {
              header.u8(5).u8(2 + 8 * blocks.length);
              for (const [s, e] of blocks) {
                header.u32((peer.isn + s) >>> 0).u32((peer.isn + e) >>> 0);
              }
            },
            {
              depth: 1,
              note: "Bytes that arrived after the gap, so only the gap needs resending.",
            },
          );
        }
      }
    }

    const firstPayloadBytes = payloadLayer ? payloadLayer.bytes.slice(0, firstSegPayloadLen) : [];
    const checksum = internetChecksum([
      ...buildPseudoHeader(row.src, row.dst, 6, headerLen + firstSegPayloadLen),
      ...header.bytes,
      ...firstPayloadBytes,
    ]);
    const checksumField = header.fields.find((f) => f.name === "Checksum")!;

    if (checksum === null) {
      header.bytes[checksumPos] = header.bytes[checksumPos + 1] = null;
      checksumField.value = "covers bytes not shown here";
      checksumField.hidden = true;
    } else {
      header.bytes[checksumPos] = checksum >> 8;
      header.bytes[checksumPos + 1] = checksum & 0xff;
      checksumField.value = formatHex(checksum);
    }

    return {
      header,
      first: firstSegPayloadLen,
      segments: Math.max(1, explicitSegments ?? Math.ceil(payloadLen / effectiveMss)),
      mss: effectiveMss,
      seq: relSeq,
      ack: relAck,
      hlen: headerLen,
    };
  }

  frame(
    pktEvent: PacketEvent,
    index: number,
    allPackets: PacketEvent[],
  ): DissectedFrame | null {
    const row = pktEvent.row;
    const wire = row.wire;
    if (!wire) return null;

    const timeSec = parseFloat(row.time);
    this.deliver(timeSec);
    if (wire.alias) {
      this.alias.set(wire.alias[0], wire.alias[1]);
    }

    const linkInfo = wire.arp
      ? {
          at: "Seen on the laptop’s home network",
          src: row.src,
          dst: row.dst === "Broadcast" ? MAC_ADDRESSES.all : row.dst,
          srcNote: "The sender’s network card.",
          dstNote:
            row.dst === "Broadcast"
              ? "Broadcast: every device on the network receives it."
              : "Straight back to the device that asked.",
        }
      : this.link(row);

    const layers: LayerBuilder[] = [];
    const eth = new LayerBuilder("eth", "Ethernet II · 14 bytes");
    eth.summary = `${linkInfo.src} → ${linkInfo.dst}`;
    eth.field("Destination", linkInfo.dst, () => eth.raw(macToBytes(linkInfo.dst)), {
      note: linkInfo.dstNote,
      example: linkInfo.dst !== MAC_ADDRESSES.all,
    });
    eth.field("Source", linkInfo.src, () => eth.raw(macToBytes(linkInfo.src)), {
      note: linkInfo.srcNote,
      example: true,
    });
    eth.field(
      "Type",
      wire.arp ? "0x0806 (ARP)" : "0x0800 (IPv4)",
      () => eth.u16(wire.arp ? 0x0806 : 0x0800),
      { note: "What the frame carries." },
    );
    layers.push(eth);

    let segments = 1;
    let tcpInfo: {
      header: LayerBuilder;
      first: number;
      segments: number;
      mss: number;
      seq: number;
      ack: number;
      hlen: number;
    } | null = null;
    let ipIdVal: number | undefined;

    if (wire.arp) {
      const arpSpec = wire.arp;
      const arp = new LayerBuilder(
        "arp",
        `ARP ${arpSpec.op === 1 ? "request" : "reply"} · 28 bytes`,
      );
      arp.field("Hardware type", "1 (Ethernet)", () => arp.u16(1));
      arp.field("Protocol type", "0x0800 (IPv4)", () => arp.u16(0x0800));
      arp.field("Address sizes", "6 (MAC), 4 (IPv4)", () => arp.u8(6).u8(4));
      arp.field(
        "Operation",
        arpSpec.op === 1 ? "1 (request: who has …?)" : "2 (reply: … is at …)",
        () => arp.u16(arpSpec.op),
      );
      arp.field("Sender MAC", arpSpec.sender[0], () => arp.raw(macToBytes(arpSpec.sender[0])), {
        example: true,
      });
      arp.field("Sender IP", arpSpec.sender[1], () => arp.raw(ipv4ToBytes(arpSpec.sender[1])));
      arp.field("Target MAC", arpSpec.target[0], () => arp.raw(macToBytes(arpSpec.target[0])), {
        note:
          arpSpec.op === 1 ? "All zeros: this is what the request wants to find out." : undefined,
        example: arpSpec.op === 2,
      });
      arp.field("Target IP", arpSpec.target[1], () => arp.raw(ipv4ToBytes(arpSpec.target[1])));
      layers.push(arp);
    } else {
      const ipProto = wire.tcp ? 6 : wire.udp ? 17 : 1;
      const upperLayers: LayerBuilder[] = [];

      if (wire.tcp) {
        const appLayer = wire.tcp.data ? buildAppPayloadWithSlice(row, wire.tcp.data) : null;
        tcpInfo = this.tcp(row, wire.tcp, appLayer, timeSec, pktEvent, wire.tcp.segments);
        segments = tcpInfo.segments;
        upperLayers.push(tcpInfo.header);
        if (appLayer) {
          appLayer.full = appLayer.length;
          if (tcpInfo.first < appLayer.length) {
            appLayer.bytes = appLayer.bytes.slice(0, tcpInfo.first);
            appLayer.cut = true;
          }
          upperLayers.push(appLayer);
        }
      } else if (wire.udp) {
        const udpSpec = wire.udp;
        const appLayer = buildAppPayloadWithSlice(row, udpSpec.data);
        const udp = new LayerBuilder("udp", "UDP · 8 bytes");
        const udpLen = 8 + appLayer.length;
        udp.summary = `${udpSpec.sport} → ${udpSpec.dport}`;
        udp.field("Source port", udpSpec.sport, () => udp.u16(udpSpec.sport));
        udp.field("Destination port", udpSpec.dport, () => udp.u16(udpSpec.dport));
        udp.field("Length", `${udpLen} bytes`, () => udp.u16(udpLen), {
          note: "UDP header and data. That is all of UDP: no numbering, no acknowledgements.",
        });
        const checksum = internetChecksum([
          ...buildPseudoHeader(row.src, row.dst, 17, udpLen),
          ...udp.bytes,
          0,
          0,
          ...appLayer.bytes,
        ]);
        udp.field(
          "Checksum",
          checksum === null ? "covers bytes not shown here" : formatHex(checksum || 0xffff),
          () => (checksum === null ? udp.unknown(2) : udp.u16(checksum || 0xffff)),
          {
            note: "Covers the header, the data and the IP addresses.",
            hidden: checksum === null,
          },
        );
        upperLayers.push(udp, appLayer);
      } else if (wire.icmp) {
        const icmpSpec = wire.icmp;
        const icmp = new LayerBuilder("icmp", "");
        const icmpDescriptions: Record<string, string> = {
          "8,0": "Echo request",
          "0,0": "Echo reply",
          "11,0": "Time exceeded (TTL reached 0)",
          "3,3": "Destination unreachable (port unreachable)",
        };
        const desc = icmpDescriptions[`${icmpSpec.type},${icmpSpec.code}`];
        icmp.field("Type", `${icmpSpec.type}`, () => icmp.u8(icmpSpec.type), { note: desc });
        icmp.field("Code", `${icmpSpec.code}`, () => icmp.u8(icmpSpec.code));
        const checksumPos = icmp.length;
        icmp.field("Checksum", "", () => icmp.u16(0), { note: "Covers the whole ICMP message." });

        if (icmpSpec.type === 8 || icmpSpec.type === 0) {
          const echoId = icmpSpec.id!;
          const echoSeq = icmpSpec.seq!;
          const echoData = icmpSpec.data!;
          icmp.field("Identifier", formatHex(echoId), () => icmp.u16(echoId), {
            note: "Matches replies to this ping program.",
          });
          icmp.field("Sequence number", echoSeq, () => icmp.u16(echoSeq), {
            note: "Windows counts up across every ping it sends.",
          });
          icmp.field(
            "Data",
            `"${echoData}" (${echoData.length} bytes)`,
            () => icmp.ascii(echoData),
            {
              note:
                icmpSpec.type === 8
                  ? "Windows ping’s filler: the alphabet, a to w, then again."
                  : "Sent back exactly as it came.",
              mono: true,
            },
          );
        } else {
          icmp.field("Unused", "0", () => icmp.u32(0));
          const quotedFrame = this.built[index + icmpSpec.quote!]!;
          const ethHeaderSize = 14;
          const origIpPacket = quotedFrame.bytes.slice(
            ethHeaderSize,
            ethHeaderSize + (quotedFrame.ipLength ?? quotedFrame.bytes.length - ethHeaderSize),
          );
          const quotedSlice = origIpPacket.slice(
            0,
            icmpSpec.quoteBytes === 8 ? 28 : origIpPacket.length,
          );
          quotedSlice[8] = icmpSpec.ttl!;
          quotedSlice[10] = quotedSlice[11] = 0;
          const origHdrChecksum = internetChecksum(quotedSlice.slice(0, 20))!;
          quotedSlice[10] = origHdrChecksum >> 8;
          quotedSlice[11] = origHdrChecksum & 0xff;
          icmp.field(
            "Original packet",
            icmpSpec.quoteBytes === 8
              ? "its IP header and first 8 bytes (28 bytes)"
              : `all ${quotedSlice.length} bytes of it`,
            () => icmp.raw(quotedSlice),
            {
              note: `The packet that caused this, as the reporting device received it (TTL ${icmpSpec.ttl}), so the sender can tell which packet it was.`,
            },
          );
          icmp.field(
            "Its source, destination",
            `${row.dst} → ${allPackets[index + icmpSpec.quote!].row.dst}`,
            () => {},
            { depth: 1 },
          );
        }

        const icmpChecksum = internetChecksum(icmp.bytes)!;
        icmp.bytes[checksumPos] = icmpChecksum >> 8;
        icmp.bytes[checksumPos + 1] = icmpChecksum & 0xff;
        icmp.fields.find((f) => f.name === "Checksum")!.value = formatHex(icmpChecksum);
        icmp.name = `ICMP · ${desc}`;
        upperLayers.push(icmp);
      }

      const ipTotalLen = 20 + upperLayers.reduce((sum, l) => sum + l.length, 0);
      const ip = new LayerBuilder("ip", "IPv4 · 20 bytes");
      const ttlVal = this.ttl(row, wire);
      const dfFlag = wire.tcp
        ? true
        : (wire.df ??
          (!isLaptopIp(row.src) &&
            !!wire.udp &&
            row.src !== PUBLIC_DNS_IP &&
            row.src !== ROUTER_LAN_IP));
      const identification =
        wire.natOf !== undefined ? this.built[index + wire.natOf]!.ipId! : this.ipId(row.src);

      const ttlNote = isLaptopIp(row.src)
        ? `Windows starts at 128.${ttlVal !== 128 ? ` Set to ${ttlVal} on purpose here.` : ""}`
        : isHomeNetworkIp(row.dst) && !isHomeNetworkIp(row.src)
          ? `Started at ${initialTtlForHost(row.src)}; ${hopsFromHost(row.src)} router${hopsFromHost(row.src) === 1 ? "" : "s"} on the way each took 1.`
          : `As sent: this system starts at ${initialTtlForHost(row.src)}.`;

      ip.summary = `${row.src} → ${row.dst}`;
      ip.field("Version, header length", "4, 20 bytes", () => ip.u8(0x45), {
        note: "IPv4, with no options.",
      });
      ip.field("DSCP, ECN", "0, 0", () => ip.u8(0), {
        note: "Priority and congestion marks; 0 means ordinary traffic.",
      });
      ip.field("Total length", `${ipTotalLen} bytes`, () => ip.u16(ipTotalLen), {
        note: "This header and everything inside it.",
      });
      ip.field("Identification", formatHex(identification), () => ip.u16(identification), {
        note: "Lets the receiver reassemble the pieces if the packet gets split.",
        example: true,
      });
      ip.field(
        "Flags",
        dfFlag ? "DF (don’t fragment)" : "none",
        () => ip.u16(dfFlag ? 0x4000 : 0),
        {
          note: dfFlag
            ? "Routers must not split it; if it’s too big they report back instead."
            : "Routers may split it if a link is too small.",
          example: !wire.tcp,
        },
      );
      ip.field("Time to live", ttlVal, () => ip.u8(ttlVal), {
        note: ttlNote,
        example: row.src === ISP_ROUTER_IP,
      });
      ip.field(
        "Protocol",
        ipProto === 6 ? "6 (TCP)" : ipProto === 17 ? "17 (UDP)" : "1 (ICMP)",
        () => ip.u8(ipProto),
      );
      const ipChecksumPos = ip.length;
      ip.field("Header checksum", "", () => ip.u16(0), {
        note: "Covers this header only; every router recomputes it after lowering the TTL.",
      });
      ip.field("Source", row.src, () => ip.raw(ipv4ToBytes(row.src)));
      ip.field("Destination", row.dst, () => ip.raw(ipv4ToBytes(row.dst)));

      const ipChecksum = internetChecksum(ip.bytes)!;
      ip.bytes[ipChecksumPos] = ipChecksum >> 8;
      ip.bytes[ipChecksumPos + 1] = ipChecksum & 0xff;
      ip.fields.find((f) => f.name === "Header checksum")!.value = formatHex(ipChecksum);

      layers.push(ip, ...upperLayers);
      ipIdVal = identification;
    }

    const merged = mergeLayers(layers);
    const ipLength = wire.arp ? undefined : merged.bytes.length - 14;

    if (merged.bytes.length < 60) {
      const padLen = 60 - merged.bytes.length;
      const padLayer = new LayerBuilder("pad", `Ethernet padding · ${padLen} bytes`);
      padLayer.field("Padding", `${padLen} zero bytes`, () => padLayer.raw(Array(padLen).fill(0)), {
        note: "Ethernet frames are at least 60 bytes (64 with the checksum the card adds), so short ones are padded.",
      });
      const mergedPad = mergeLayers([padLayer]);
      merged.layers.push({
        ...mergedPad.layers[0],
        from: merged.bytes.length,
        to: 60,
      });
      for (const f of mergedPad.fields) {
        merged.fields.push({
          ...f,
          from: f.from + merged.bytes.length,
          to: f.to + merged.bytes.length,
        });
      }
      merged.bytes.push(...mergedPad.bytes);
    }

    const builtFrame: DissectedFrame = {
      index,
      at: linkInfo.at,
      ...merged,
      ipLength,
      ipId: ipIdVal,
      segments,
      tcp:
        tcpInfo && {
          seq: tcpInfo.seq,
          ack: tcpInfo.ack,
          hlen: tcpInfo.hlen,
          mss: tcpInfo.mss,
        },
      messageLength: (() => {
        const fullLayer = layers.find((l) => l.full !== undefined);
        return fullLayer ? fullLayer.full! : null;
      })(),
    };

    this.built[index] = builtFrame;
    return builtFrame;
  }
}

const lessonFrameCache = new WeakMap<Lesson, Array<DissectedFrame | null>>();

export function dissectLessonFrames(lesson: Lesson): Array<DissectedFrame | null> {
  if (!lessonFrameCache.has(lesson)) {
    const dissector = new LessonPacketDissector(lesson);
    const packets = collectLessonPackets(lesson);
    lessonFrameCache.set(
      lesson,
      packets.map((pkt, idx) => dissector.frame(pkt, idx, packets)),
    );
  }
  return lessonFrameCache.get(lesson)!;
}
