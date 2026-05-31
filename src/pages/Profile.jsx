export default function Profile({ player }) {
  return (
    <>
      <div className="section-header">
        <div className="section-title">👤 Profile</div>
      </div>
      <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>
          Coming soon
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Profile settings for <strong>{player?.name}</strong> will be available here.
        </div>
      </div>
    </>
  );
}
