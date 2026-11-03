import ProtocolExplorerApp from "../../explainers/protocol/components/ProtocolExplorerApp";

export default function ProtocolPage() {
  return (
    <>
      <ProtocolExplorerApp />
      <noscript>
        <p style={{ margin: "40px", font: "16px/1.5 ui-monospace, monospace", color: "#00238a" }}>
          Protocol Explorer animates packets as they travel the network, so it needs JavaScript.
          Please turn it on to start the lessons.
        </p>
      </noscript>
    </>
  );
}
