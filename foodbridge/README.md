# FoodBridge: Surplus Food to Nearby People

**SDG 2 (Zero Hunger) and SDG 12 (Responsible Consumption).**
Restaurants, college canteens, hostels and events often have edible surplus
while people nearby need food. FoodBridge connects them before it spoils.

## The flow

```
Donor posts "30 meals available"  ->  Volunteer: Accept pickup
   ->  Volunteer: Mark collected  ->  NGO/community: Confirm food received
Dashboard:  Available -> Claimed -> Collected -> Distributed
```

**Expiry countdown** on every live listing:
🟢 2+ hours remaining, 🟡 1 to 2 hours, 🔴 under 1 hour (urgent pickup).
Unclaimed food disappears from the board once it expires.

**Impact line:** "This month, your campus diverted 420 meals from waste."

## Roles

| Role | Where | What they do |
|------|-------|--------------|
| Donor (restaurant, college, hostel, event) | `web-portal/` | Post surplus with a safe-until time |
| Volunteer | `web-portal/` | Accept pickup, mark collected |
| NGO / community | `web-portal/` | Confirm food received (marks Distributed) |
| Backend / data | `backend/` | REST API, MongoDB-backed accounts/listings/delivery stats, PostgreSQL game and audit data |
| Community audit | `community-audit/` | Volunteers upload CSV proof of deliveries |
| Side game | `game-client/` | Rescue Run mini-game; points are NOT real meals |

## Quick start

```bash
cp .env.example .env
npm run install:all
npm run db:init
npm run dev:backend   # :4000
npm run dev:portal    # :5174  (main app)
npm run dev:game      # :5173  (optional side game)
```

Open the portal and create a volunteer account with an email address and
password (minimum 10 characters). Donors can continue posting food through
the existing listing API.

To enable the satellite route map, set `VITE_GOOGLE_MAPS_API_KEY` in the root
`.env` file and enable Maps JavaScript API, Directions API, and the Geometry
library in your Google Cloud project. Without a key, the rest of the portal
continues to work and the map explains how to configure itself.

## API

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | public | Register a volunteer account |
| POST | `/api/auth/login` | public | Sign in and set an HttpOnly session cookie |
| GET | `/api/auth/me` | volunteer | Read the signed-in volunteer profile |
| POST | `/api/auth/logout` | any | Revoke the current session |
| GET | `/api/volunteers/me/stats` | volunteer | Read completed deliveries and meals |
| GET | `/api/delivery-stats` | public | List volunteer delivery totals |
| GET | `/api/delivery-stats/me` | volunteer | Read the signed-in volunteer’s delivery stats and badges |
| GET | `/api/delivery-stats/:volunteerId` | public | Read a volunteer’s delivery stats |
| GET | `/api/scores/leaderboard?type=volunteers` | public | Rank volunteers by completed deliveries and fastest run |
| GET | `/api/listings` | any | Board data with `minutesLeft` and `urgency` |
| POST | `/api/listings` | donor | Post surplus |
| POST | `/api/listings/:id/claim` | volunteer | Accept pickup |
| POST | `/api/listings/:id/collect` | claiming volunteer | Mark collected |
| POST | `/api/listings/:id/distribute` | ngo | Confirm received |
| GET | `/api/impact/monthly?donorId=` | any | Meals diverted this month |
| GET | `/api/impact/summary` | any | Counts per stage |

Volunteer accounts, sessions, listings, and delivery stats are stored in
MongoDB using Mongoose. Sessions use opaque random tokens stored as hashes and
delivered in `HttpOnly`, `SameSite=Strict` cookies. Production deployments
must use HTTPS so cookies receive the `Secure` flag. Game-score and audit
storage remain PostgreSQL-backed; the game scoreboard uses the unqualified
`/api/scores/leaderboard` endpoint.

## Known gaps (next steps)

- Phone verification and account recovery are not yet implemented.
- No distance matching yet: add lat/lng on listings and "within 5 km" filtering.
- No push/SMS alerts for urgent (red) listings.
- Add food-safety fields (cooked time, allergens) and a donor rating system.
- Tests for status transitions and urgency thresholds.
