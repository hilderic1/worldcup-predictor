import { useState } from "react";
import { GLOBAL_DEADLINE } from "../constants";
import { isPast } from "../utils";
import { exportMyPicks, exportComparison } from "../utils/exportReport";

export default function Profile({ player }) {
  const [exporting, setExporting] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const allPicksUnlocked = isPast(GLOBAL_DEADLINE);

  return (
    <>
      <div className="section-header">
        <div className="section-title">👤 Profile</div>
      </div>

      <div className="card">
        <div className="card-label">📥 Export My Picks</div>
        <p style={{ fontSize: 13, color: "var(--text-dark)", marginBottom: 16, marginTop: 8 }}>
          Download all your predictions as an Excel file — group scores, group rankings,
          qualifier picks and KO match scores.
        </p>
        <button
          className="btn-save"
          onClick={async () => { setExporting(true); try { await exportMyPicks(player.name); } finally { setExporting(false); } }}
          disabled={exporting}
          style={{ width: "auto" }}
        >
          {exporting ? "Generating…" : "📥 Download My Picks (.xlsx)"}
        </button>
      </div>

      {allPicksUnlocked && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-label">📊 Download All Players' Picks</div>
          <p style={{ fontSize: 13, color: "var(--text-dark)", marginBottom: 16, marginTop: 8 }}>
            One sheet comparing every player side by side — group scores, group rankings,
            qualifier picks and KO scores for started rounds.
          </p>
          <button
            className="btn-save"
            onClick={async () => { setExportingAll(true); try { await exportComparison(player?.name); } finally { setExportingAll(false); } }}
            disabled={exportingAll}
            style={{ width: "auto" }}
          >
            {exportingAll ? "Generating…" : "📊 Download All Players' Picks (.xlsx)"}
          </button>
        </div>
      )}

      <div className="card" style={{ marginTop: 16, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>
          More profile settings coming soon
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Profile settings for <strong>{player?.name}</strong> will be available here.
        </div>
      </div>
    </>
  );
}
