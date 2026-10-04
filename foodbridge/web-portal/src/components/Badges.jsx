const MILESTONES = [
  { count: 5, title: "First five", icon: "✳", className: "badge-mint", note: "The good is growing" },
  { count: 10, title: "Kindness x10", icon: "♡", className: "badge-peach", note: "A little local legend" },
  { count: 25, title: "Food friend", icon: "✿", className: "badge-lilac", note: "Making waves of change" },
  { count: 50, title: "Community hero", icon: "✦", className: "badge-gold", note: "Fifty reasons to smile" },
];

export default function Badges({ deliveries }) {
  return <div className="badge-grid">{MILESTONES.map((badge) => {
    const earned = deliveries >= badge.count;
    return <article className={`badge-card ${badge.className}${earned ? " badge-earned" : " badge-locked"}`} key={badge.count} aria-label={`${badge.title}, ${earned ? "earned" : `${badge.count - deliveries} deliveries to go`}`}>
      <span className="badge-icon">{badge.icon}</span><div><span className="badge-count">{badge.count} DELIVERIES</span><h3>{badge.title}</h3><p>{earned ? badge.note : `${Math.max(0, badge.count - deliveries)} more to unlock`}</p></div>{earned && <span className="badge-check">✓</span>}
    </article>;
  })}</div>;
}
