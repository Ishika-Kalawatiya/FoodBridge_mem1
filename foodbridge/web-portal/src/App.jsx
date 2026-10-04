import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Header from "./components/Header.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import MapView from "./components/MapView.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import Badges from "./components/Badges.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({ deliveries: 0, meals: 0 });
  const [notice, setNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function restoreSession() {
      try {
        const profile = await api("/api/auth/me", { signal: controller.signal });
        setUser(profile);
        setAuthError("");
      } catch (error) {
        if (error.name === "AbortError") return;
        setUser(null);
        if (error.status === 401) {
          setAuthError("");
        } else {
          setAuthError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    restoreSession();
    return () => controller.abort();
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [items, profileStats] = await Promise.all([
        api("/api/listings"),
        api("/api/volunteers/me/stats"),
      ]);
      setListings(items);
      setStats(profileStats);
    } catch (error) {
      setNotice(error.message);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return undefined;
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [refresh, user]);

  async function signOut() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setListings([]);
      setStats({ deliveries: 0, meals: 0 });
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function claim(listing) {
    try {
      await api(`/api/listings/${listing.id}/claim`, { method: "POST" });
      setNotice(`Pickup accepted: ${listing.title}`);
      await refresh();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function collect(listing) {
    try {
      await api(`/api/listings/${listing.id}/collect`, { method: "POST" });
      setNotice(`Delivery completed. Thank you for rescuing ${listing.meals} meals!`);
      await refresh();
    } catch (error) {
      setNotice(error.message);
    }
  }

  if (loading) return <div className="loading-screen">Preparing your FoodBridge…</div>;
  if (!user) return <LoginScreen onLogin={setUser} serviceError={authError} />;

  const available = listings.filter((item) => item.status === "available");
  const mine = listings.filter((item) => item.status === "claimed" && item.volunteer_id === user.id);

  return (
    <div className="app-shell">
      <Header user={user} onSignOut={signOut} />
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
      <main>
        <section className="hero section-wrap" id="home">
          <div className="hero-copy">
            <p className="eyebrow"><span className="live-dot" /> YOUR NEIGHBORHOOD, NOURISHED</p>
            <h1>Good food deserves<br />a <em>good journey.</em></h1>
            <p className="hero-lede">Every pickup brings a meal closer to someone who needs it. Let’s make today count, {user.name.split(" ")[0]}.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#rescue-run">Find a rescue run <span>↗</span></a>
              <a className="button button-quiet" href="#leaderboard">See your impact</a>
            </div>
            <div className="impact-strip">
              <div><strong>{stats.deliveries}</strong><span>deliveries rescued</span></div>
              <i />
              <div><strong>{stats.meals}</strong><span>meals moved forward</span></div>
              <i />
              <div><strong>{available.length}</strong><span>nearby opportunities</span></div>
            </div>
          </div>
          <div className="hero-art" role="img" aria-label="Fresh ingredients ready to be shared">
            <div className="hero-photo" />
            <div className="floating-note note-meals"><span>✳</span><b>Good food.<br />Good neighbors.</b></div>
            <div className="floating-note note-route"><span>↗</span><div><b>Every run matters</b><small>One pickup at a time</small></div></div>
            <div className="hero-stamp">FRESH<br />FOR ALL</div>
          </div>
        </section>

        <section className="section-wrap profile-row" aria-label="Volunteer profile and badges">
          <div className="section-heading"><div><p className="eyebrow">YOUR GOOD-WORK GLOW-UP</p><h2>Little milestones. <em>Big-hearted impact.</em></h2></div><span className="profile-name"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>{user.name}</span></div>
          <Badges deliveries={stats.deliveries} />
        </section>

        <section className="section-wrap rescue-section" id="rescue-run">
          <div className="section-heading"><div><p className="eyebrow">MAKE A DIFFERENCE TODAY</p><h2>Rescue runs <em>near you</em></h2></div><span className="section-count">{available.length} open pickups</span></div>
          {mine.length > 0 && <div className="pickup-group"><h3>Your active pickup</h3><div className="listing-grid">{mine.map((item) => <ListingCard key={item.id} listing={item} onAction={() => collect(item)} action="Mark as collected" active />)}</div></div>}
          {available.length > 0 ? <div className="listing-grid">{available.map((item) => <ListingCard key={item.id} listing={item} onAction={() => claim(item)} action="Accept this pickup" />)}</div> : <div className="empty-state"><span>✳</span><h3>You’re all caught up.</h3><p>We’ll keep an eye out for the next rescue run in your community.</p></div>}
        </section>

        <MapView />

        <Leaderboard />
      </main>
      <Footer />
    </div>
  );
}

function ListingCard({ listing, onAction, action, active }) {
  const expiry = listing.minutesLeft > 0 ? `${Math.floor(listing.minutesLeft / 60)}h ${listing.minutesLeft % 60}m left` : "Pickup window passed";
  return (
    <article className={`listing-card${active ? " listing-active" : ""}`}>
      <div className="listing-top"><span className="food-icon">✳</span><span className={`urgency urgency-${listing.urgency}`}>{expiry}</span></div>
      <p className="listing-meals">{listing.meals} meals to share</p>
      <h3>{listing.title}</h3>
      <p className="listing-address">⌖ {listing.pickup_address}</p>
      <p className="listing-donor">Shared by {listing.donor_org || listing.donor_name}</p>
      <button className={active ? "button button-primary" : "button button-outline"} disabled={listing.minutesLeft <= 0} onClick={onAction}>{action}<span>→</span></button>
    </article>
  );
}
