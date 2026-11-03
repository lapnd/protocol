# Protocol Explorer (custom system)

> This folder is one *system* inside the Explainer Lab template. It keeps its own engine and is mounted at `/protocol/` by `src/app/protocol/`. See the root `README.md` and `docs/ARCHITECTURE.md`.

An interactive, byte-by-byte network protocol simulator and packet dissector rebuilt in **Next.js (App Router)** and **readable, strongly typed TypeScript**, reverse-engineered with 100% feature parity from [protocol-explorer-alpha.vercel.app](https://protocol-explorer-alpha.vercel.app/).

## Tech Stack Analysis of Original Application

- **Bundler & Build Tool**: Vite 6 ES module build (`assets/index-4NePqLyW.js`, `assets/index-CA4da9_o.css`) with dynamic code-splitting for 13 locale chunks and a shared typography helper (`assets/shared-CAKwAg2C.js`).
- **Rendering Architecture**: Custom zero-dependency reactive DOM & SVG engine using:
  - **3D Isometric Network Topology SVG**: Custom isometric projection and path router (`728×460` coordinate space) with animated packet dots, TCP segment trains, lock badges, laptop screen preview (browser / terminal / mail / call), and spring-damped viewBox camera framing.
  - **Sequence Diagram Engine**: Custom SVG lifeline layout engine with automatic label collision avoidance, RTT brace markers, lost-packet cross markers, and Web Animations API stroke-dashoffset drawing.
  - **Wireshark-Style Binary Packet Dissector**: Deterministic real-byte frame generator and multi-layer dissector (`Ethernet II` → `ARP` / `IPv4` → `ICMP` / `UDP` / `TCP` → `DNS` / `DHCP` / `RTP` / `TLS 1.3` / `SSH-2` / `HTTP` / `SMTP` / `POP3` / `IMAP` / `FTP`) with synchronized expandable field tree, byte range bar, hex dump, and ASCII gutter.
  - **Animation & Timing**: Web Animations API (`Element.animate`) coupled with a global speed-scalable `playbackClock` (`0.5×`, `1×`, `1.5×`, `2×`) and `ViewTransition` API support.
  - **Typography & Styling**: Custom self-hosted `Iosevka` variable-weight (`400`–`800` + `800 italic`) WOFF2 monospace font family, custom CSS variables with light/dark theme support, and responsive zoom scaling (`wide`, `medium`, `tablet`, `narrow`, `phone`).
  - **Internationalization (i18n)**: 14 languages (`en`, `es`, `pt`, `fr`, `de`, `tr`, `id`, `ja`, `zh`, `zh-TW`, `ko`, `hi`, `ar`, `he`) with full RTL layout support, Unicode BiDi isolation (`\u2066...\u2069`) for Latin technical runs in Arabic/Hebrew, and locale-specific number/punctuation formatting.

## Project Structure

```text
src/explainers/protocol/
├── manifest.ts                  # Catalog entry (hub card + menu)
├── styles/protocol.css          # Full stylesheet & design tokens (fonts shared from src/kit/styles/fonts)
├── components/
│   ├── ProtocolExplorerApp.tsx  # Main client shell, responsive layout, keyboard shortcuts, state wiring
│   ├── isometric-topology.ts    # 3D isometric network node & topology SVG renderer
│   ├── network-canvas.ts        # Interactive network SVG controller, camera transitions & packet animations
│   ├── sequence-diagram.ts      # Sequence diagram layout engine, label solver & timeline animations
│   ├── packet-inspector.ts      # Wireshark-style binary frame inspector (layers, tree, hex, ASCII)
│   ├── simulation-engine.ts     # Step/event state machine & playback controller
│   ├── topbar.ts                # Header bar, OSI badge, progress meter, language menu & theme toggle
│   ├── sidebar.ts               # Protocol catalog, step list & mobile drawer controller
│   ├── overview-panel.ts        # Protocol overview, step explanation & packet summary card
│   └── packet-table.ts          # Live packet capture table & transport controls
├── data/
│   └── index.ts                 # All 14 protocol lessons (HTTP, HTTPS, TCP, UDP, IP, DNS, DHCP, ICMP, SMTP, POP3, IMAP, FTP, SSH, TLS)
├── i18n/
│   ├── index.ts                 # Translation lookup, DOM retranslation & BiDi helpers
│   ├── shared.ts                # Number grouping, French punctuation & RTL Latin-run isolation
│   └── locales/                 # 13 lazy-loaded locale dictionaries (ar, de, es, fr, he, hi, id, ja, ko, pt, tr, zh, zh-TW)
├── lib/
│   ├── motion.ts                # Web Animations API helpers, spring scroll & playback clock
│   ├── packet-dissector.ts      # Wire-format byte synthesizer & protocol dissector
│   └── progress.ts              # LocalStorage lesson progress persistence
└── types/
    └── protocol.ts              # Strict TypeScript definitions for lessons, wire specs & dissected frames
```

## Development

```bash
npm install
npm run dev
```

## Static Export Build

```bash
npm run typecheck
npm run build
```
