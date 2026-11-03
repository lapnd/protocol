export type ProtocolId =
  | "http"
  | "https"
  | "tcp"
  | "udp"
  | "ip"
  | "dns"
  | "dhcp"
  | "icmp"
  | "smtp"
  | "pop3"
  | "imap"
  | "ftp"
  | "ssh"
  | "tls";

export type ProtocolGroup = "core" | "application" | "security";

export type NodeId =
  | "client"
  | "router"
  | "dns"
  | "internet"
  | "web"
  | "root"
  | "tld"
  | "auth"
  | "mx";

export type CameraFrameId =
  | "client"
  | "local"
  | "lookup"
  | "root"
  | "tld"
  | "path"
  | "mailhost"
  | "servers"
  | "full";

export type PacketColor =
  | "navy"
  | "blue"
  | "green"
  | "amber"
  | "violet"
  | "teal"
  | "slate";

export type LayerColor = PacketColor | "grey";

export interface ProtocolMeta {
  id: ProtocolId;
  name: string;
  full: string;
  group: ProtocolGroup;
}

export interface TlsHelloSpec {
  type: number;
  name: string;
  note: string;
  fields: Array<[string, string]>;
}

export interface TlsRecordSpec {
  type: "handshake" | "ccs" | "appdata" | "alert";
  legacy?: boolean;
  length: number;
  hello?: TlsHelloSpec;
  inner?: {
    what: string;
    text?: string[];
  };
}

export interface SshPayloadSpec {
  sealed?: number;
  inside?: string;
  msg?: "kexinit" | "ecdh_init" | "ecdh_reply" | "newkeys";
  kex?: string[];
  hostkeys?: string[];
  ciphers?: string[];
  macs?: string[];
  compression?: string[];
  q?: number;
  ks?: number;
  sig?: number;
}

export type DnsRecordType = "A" | "NS" | "MX" | "AAAA" | "OPT";

export type DnsResourceRecord =
  | [string, "A" | "AAAA" | "NS", number, string]
  | [string, "MX", number, [number, string]];

export interface DnsPayloadSpec {
  id: number;
  response?: boolean;
  aa?: boolean;
  rd?: boolean;
  ra?: boolean;
  exampleTtl?: boolean;
  q: [string, DnsRecordType];
  an?: DnsResourceRecord[];
  ns?: DnsResourceRecord[];
  ar?: DnsResourceRecord[];
  edns?: {
    size: number;
  };
}

export type DhcpOptionTuple = [number, any];

export interface DhcpPayloadSpec {
  op: 1 | 2;
  xid: number;
  ciaddr?: string;
  yiaddr?: string;
  siaddr?: string;
  options: DhcpOptionTuple[];
}

export interface RtpPayloadSpec {
  marker?: boolean;
  pt: number;
  seq: number;
  ts: number;
  ssrc: number;
  audio: number;
}

export interface HttpPayloadSpec {
  lines: string[];
  body?: number;
  what?: string;
}

export interface AppPayloadSpec {
  name?: string;
  ascii?: string;
  note?: string;
  text?: string[];
  http?: HttpPayloadSpec;
  opaque?: number;
  what?: string;
  tls?: TlsRecordSpec[];
  ssh?: SshPayloadSpec;
  dns?: DnsPayloadSpec;
  dhcp?: DhcpPayloadSpec;
  rtp?: RtpPayloadSpec;
  take?: [number, number];
}

export interface TcpWireSpec {
  sport: number;
  dport: number;
  flags: string;
  data?: AppPayloadSpec;
  seq?: number;
  ack?: number;
  sack?: boolean;
  segments?: number;
}

export interface UdpWireSpec {
  sport: number;
  dport: number;
  data: AppPayloadSpec;
}

export interface IcmpWireSpec {
  type: number;
  code: number;
  id?: number;
  seq?: number;
  data?: string;
  quote?: number;
  quoteBytes?: number;
  ttl?: number;
}

export interface ArpWireSpec {
  op: 1 | 2;
  sender: [string, string];
  target: [string, string];
}

export interface WireSpec {
  tcp?: TcpWireSpec;
  udp?: UdpWireSpec;
  icmp?: IcmpWireSpec;
  arp?: ArpWireSpec;
  ttl?: number;
  df?: boolean;
  natOf?: number;
  alias?: [string, string];
}

export interface PacketRow {
  time: string;
  src: string;
  dst: string;
  proto: string;
  info: string;
  len: string;
  wire?: WireSpec;
}

export interface PacketEvent {
  type: "packet";
  from: NodeId;
  to: NodeId;
  color: PacketColor;
  label: string;
  payload: string[];
  row: PacketRow;
  quick?: boolean;
  locked?: boolean;
  lost?: boolean;
  step?: number;
}

export interface StreamEvent {
  type: "stream";
  from: NodeId;
  to: NodeId;
  color: PacketColor;
  label: string;
  payload: string[];
  packets: PacketEvent[];
  spacing?: number;
  locked?: boolean;
  step?: number;
}

export interface TypeUrlEvent {
  type: "type-url";
  text: string;
  secure?: boolean;
  step?: number;
}

export interface ShowEvent {
  type: "show";
  nodes: NodeId[];
  frame: CameraFrameId;
  step?: number;
}

export interface FocusEvent {
  type: "focus";
  nodes: NodeId[];
  frame: CameraFrameId;
  step?: number;
}

export interface CameraEvent {
  type: "camera";
  frame: CameraFrameId;
  step?: number;
}

export interface RenderEvent {
  type: "render";
  step?: number;
}

export interface NoteEvent {
  type: "note";
  at: NodeId;
  text: string;
  tone?: PacketColor;
  step?: number;
}

export type LessonEvent =
  | PacketEvent
  | StreamEvent
  | TypeUrlEvent
  | ShowEvent
  | FocusEvent
  | CameraEvent
  | RenderEvent
  | NoteEvent;

export type FactTuple = [string, string];
export type FactPair = FactTuple;
export type StepExecutionEvent = LessonEvent & { step: number };

export interface LessonStep {
  title: string;
  desc: string;
  detail: string;
  facts?: FactTuple[];
  events: LessonEvent[];
}

export interface LessonOverview {
  full: string;
  description: string;
  facts: FactTuple[];
}

export interface LessonOutro {
  title: string;
  desc: string;
  text: string;
  facts: FactTuple[];
}

export interface Lesson {
  id: ProtocolId;
  name: string;
  title: string;
  layer: number;
  nodes: NodeId[];
  labels?: Partial<Record<NodeId, [string, string]>>;
  lifelines?: NodeId[];
  latency: Record<string, number>;
  legend: Array<[PacketColor | null, string]>;
  overview: LessonOverview;
  outro: LessonOutro;
  start: {
    nodes: NodeId[];
    frame: CameraFrameId;
  };
  steps: LessonStep[];
}

export type StepProgressState = "todo" | "active" | "done";
export type PacketTimelineState = "past" | "current" | "future";
export type NoteTimelineState = "past" | "future";

export interface SimulationState {
  playing: boolean;
  running: boolean;
  started: boolean;
  done: boolean;
  activeStep: number;
  event: LessonEvent | null;
  steps: StepProgressState[];
  packets: PacketTimelineState[];
  notes: NoteTimelineState[];
}

export interface DissectedField {
  name: string;
  value: string;
  from: number;
  to: number;
  layer?: string;
  depth?: number;
  heading?: boolean;
  hidden?: boolean;
  inside?: boolean;
  mono?: boolean;
  example?: boolean;
  note?: string;
}

export interface DissectedLayer {
  id: string;
  name: string;
  from: number;
  to: number;
  summary?: string;
}

export interface DissectedFrame {
  index: number;
  at: string;
  bytes: Array<number | null>;
  fields: DissectedField[];
  layers: DissectedLayer[];
  ipLength?: number;
  ipId?: number;
  segments: number;
  tcp?: {
    seq: number;
    ack: number;
    hlen: number;
    mss: number;
  } | null;
  messageLength: number | null;
}

export type LocaleCode =
  | "en"
  | "es"
  | "pt"
  | "fr"
  | "de"
  | "tr"
  | "id"
  | "ja"
  | "zh"
  | "zh-TW"
  | "ko"
  | "hi"
  | "ar"
  | "he";

export type PatternReplacer =
  | string
  | ((substring: string, ...args: string[]) => string);

export interface LocaleDictionary {
  strings: Record<string, string>;
  patterns?: Array<[RegExp, PatternReplacer]>;
  post?: (text: string) => string;
}

export interface LocaleInfo {
  code: LocaleCode;
  name: string;
  short: string;
  html: string;
  dir?: "ltr" | "rtl";
  load?: () => Promise<{ default: LocaleDictionary }>;
}
