import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () => api("/api/scores/leaderboard?type=volunteers")
      .then((data) => {
        if (active) {
          setRows(data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="leaderboard-section" id="leaderboard">
      <div className="section-wrap leaderboard-inner">
        <div className="section-heading"><div><p className="eyebrow">GOODNESS LOOKS GOOD ON YOU</p><h2>Kindness in <em>action.</em></h2></div><span className="live-label"><span className="live-dot" /> LIVE COMMUNITY</span></div>
        <div className="leaderboard-layout">
          <div className="leaderboard-intro"><span className="leaderboard-flower">✳</span><h3>Every delivery<br />makes a difference.</h3><p>Celebrating the volunteers who help good food find its people.</p><span className="rank-note">Ranked by deliveries · ties broken by fastest completed run</span></div>
          <div className="leaderboard-card">
            {error ? <p className="leaderboard-state error-state">{error}</p> : rows.length === 0 ? <p className="leaderboard-state">Your first community deliveries will shine here.</p> : rows.map((row, index) => (
              <div className={`leader-row${index === 0 ? " leader-first" : ""}`} key={row.name}>
                <span className="leader-rank">{String(row.rank ?? index + 1).padStart(2, "0")}</span><span className={`leader-avatar leader-avatar-${index % 4}`}>{row.name.slice(0, 1).toUpperCase()}</span><span className="leader-name">{row.name}<small>{row.deliveries} {row.deliveries === 1 ? "delivery" : "deliveries"} rescued</small></span><span className="leader-score">{row.score}<small>points</small></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
