// server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

// --- Import controllers ---
import {
  attachUser, requireRole, limitLoginAttempts,
  registerVolunteer, loginVolunteer, currentVolunteer, logout,
} from "./controllers/userController.js";
import {
  listDeliveryStats, getDeliveryStat, getMyDeliveryStat, getVolunteerStats,
} from "./controllers/deliveryStatController.js";

import {
  listListings, createListing, updateListing, cancelListing,
  claimListing, collectListing, distributeListing,
  monthlyImpact, pipelineSummary,
} from "./controllers/listingController.js";

import { submitScore, getLeaderboard } from "./controllers/scoreController.js";
import { bulkInsertAudits, getAuditSummary, requireApiKey } from "./controllers/auditController.js";

// --- Express app setup ---
const app = express();
const origins = new Set([
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  ...(process.env.CORS_ORIGIN ?? "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "256kb" }));

// --- Health check ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use(attachUser);

// --- Auth routes ---
app.post("/api/auth/register", registerVolunteer);
app.post("/api/auth/login", limitLoginAttempts, loginVolunteer);
app.get("/api/auth/me", currentVolunteer);
app.post("/api/auth/logout", logout);
app.get("/api/volunteers/me/stats", requireRole("volunteer"), getVolunteerStats);
app.get("/api/delivery-stats", listDeliveryStats);
app.get("/api/delivery-stats/me", requireRole("volunteer"), getMyDeliveryStat);
app.get("/api/delivery-stats/:volunteerId", getDeliveryStat);

// --- Listings pipeline ---
app.get("/api/listings", listListings);
app.post("/api/listings", requireRole("donor"), createListing);
app.put("/api/listings/:id", requireRole("donor"), updateListing);
app.post("/api/listings/:id/cancel", requireRole("donor"), cancelListing);
app.post("/api/listings/:id/claim", requireRole("volunteer"), claimListing);
app.post("/api/listings/:id/collect", requireRole("volunteer"), collectListing);
app.post("/api/listings/:id/distribute", requireRole("ngo"), distributeListing);
app.get("/api/impact/monthly", monthlyImpact);
app.get("/api/impact/summary", pipelineSummary);

// --- Audits ---
app.post("/api/audits/bulk", requireApiKey, bulkInsertAudits);
app.get("/api/audits/summary", getAuditSummary);

// --- Side game ---
app.post("/api/scores", submitScore);
app.get("/api/scores/leaderboard", getLeaderboard);

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.name === "ValidationError" || error.name === "CastError" || error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid request data" });
  }
  console.error("API request failed:", error);
  return res.status(500).json({ error: "Internal server error" });
});

// --- Start server ---
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`🚀 FoodBridge API listening on :${port}`));

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
if (!mongoUri) {
  console.error("MongoDB connection is not configured. Set MONGODB_URI in the root .env file.");
} else {
  mongoose.connect(mongoUri)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((error) => console.error("❌ MongoDB connection error:", error.message));
}
