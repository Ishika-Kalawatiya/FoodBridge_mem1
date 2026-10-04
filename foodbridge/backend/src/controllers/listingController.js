import mongoose from "mongoose";
import { Listing } from "../models/Listing.js";
import { User } from "../models/User.js";
import { DeliveryStat } from "../models/DeliveryStat.js";

const STATUSES = ["available", "claimed", "collected", "distributed", "cancelled"];
const BADGE_MILESTONES = [
  [5, "first-five"],
  [10, "kindness-x10"],
  [25, "food-friend"],
  [50, "community-hero"],
];

export function urgencyOf(expiresAt, now = Date.now()) {
  const minutesLeft = Math.floor((new Date(expiresAt) - now) / 60000);
  const urgency = minutesLeft <= 0 ? "expired" : minutesLeft < 60 ? "red" : minutesLeft < 120 ? "yellow" : "green";
  return { minutesLeft, urgency };
}

function serializeListing(listing) {
  const item = listing.toObject ? listing.toObject() : listing;
  const donor = item.donorId && typeof item.donorId === "object" ? item.donorId : null;
  const volunteer = item.volunteerId && typeof item.volunteerId === "object" ? item.volunteerId : null;
  const ngo = item.ngoId && typeof item.ngoId === "object" ? item.ngoId : null;
  const expiresAt = item.expiresAt;
  return {
    id: String(item._id),
    title: item.title,
    description: item.description,
    notes: item.description,
    location: item.location,
    pickup_address: item.location,
    meals: item.meals,
    status: item.status,
    donor_id: donor?._id ? String(donor._id) : String(item.donorId),
    donor_name: donor?.name ?? null,
    donor_org: donor?.org ?? null,
    volunteer_id: volunteer?._id ? String(volunteer._id) : item.volunteerId ? String(item.volunteerId) : null,
    volunteer_name: volunteer?.name ?? null,
    ngo_org: ngo?.org ?? null,
    expires_at: expiresAt,
    claimed_at: item.claimedAt,
    collected_at: item.collectedAt,
    distributed_at: item.distributedAt,
    created_at: item.createdAt,
    ...urgencyOf(expiresAt),
  };
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function sendServerError(res, error, message) {
  console.error(error);
  return res.status(500).json({ error: message });
}

export async function listListings(_req, res) {
  try {
    const listings = await Listing.find({
      $or: [{ status: { $ne: "available" } }, { expiresAt: { $gt: new Date() } }],
    })
      .populate("donorId", "name org")
      .populate("volunteerId", "name")
      .populate("ngoId", "org")
      .sort({ expiresAt: 1 })
      .limit(200);
    return res.json(listings.map(serializeListing));
  } catch (error) {
    return sendServerError(res, error, "Could not load listings");
  }
}

export async function createListing(req, res) {
  const { title, description, location, pickupAddress, meals, notes, expiresInMinutes } = req.body ?? {};
  const cleanTitle = String(title ?? "").trim();
  const cleanLocation = String(location ?? pickupAddress ?? "").trim();
  const cleanDescription = String(description ?? notes ?? "").trim();
  const mealCount = Number(meals);
  const expiryMinutes = Number(expiresInMinutes);

  if (!cleanTitle || cleanTitle.length > 80 || !cleanLocation || cleanLocation.length > 160 ||
      cleanDescription.length > 2000 || !Number.isInteger(mealCount) || mealCount < 1 ||
      !Number.isInteger(expiryMinutes) || expiryMinutes < 15 || expiryMinutes > 1440) {
    return res.status(400).json({ error: "Valid title, location, meals, and expiresInMinutes (15-1440) are required" });
  }
  if (!validId(req.user.id)) return res.status(400).json({ error: "Invalid donor account" });

  try {
    const listing = await Listing.create({
      title: cleanTitle,
      description: cleanDescription,
      location: cleanLocation,
      meals: mealCount,
      donorId: req.user.id,
      expiresAt: new Date(Date.now() + expiryMinutes * 60_000),
    });
    return res.status(201).json({ id: String(listing._id) });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ error: "Invalid listing data" });
    }
    return sendServerError(res, error, "Could not create listing");
  }
}

export async function updateListing(req, res) {
  const { title, description, location, pickupAddress, meals, notes, expiresInMinutes } = req.body ?? {};
  const cleanTitle = String(title ?? "").trim();
  const cleanLocation = String(location ?? pickupAddress ?? "").trim();
  const cleanDescription = String(description ?? notes ?? "").trim();
  const mealCount = Number(meals);
  const expiryMinutes = Number(expiresInMinutes);

  if (!validId(req.params.id) || !validId(req.user.id) ||
      !cleanTitle || cleanTitle.length > 80 || !cleanLocation || cleanLocation.length > 160 ||
      cleanDescription.length > 2000 || !Number.isInteger(mealCount) || mealCount < 1 ||
      !Number.isInteger(expiryMinutes) || expiryMinutes < 15 || expiryMinutes > 1440) {
    return res.status(400).json({ error: "Valid listing id, title, location, meals, and expiry are required" });
  }

  try {
    const listing = await Listing.findOneAndUpdate(
      { _id: req.params.id, donorId: req.user.id, status: "available" },
      {
        $set: {
          title: cleanTitle,
          description: cleanDescription,
          location: cleanLocation,
          meals: mealCount,
          expiresAt: new Date(Date.now() + expiryMinutes * 60_000),
        },
      },
      { new: true, runValidators: true },
    );
    if (!listing) return res.status(404).json({ error: "Listing not found, not owned by you, or no longer available" });
    return res.json(serializeListing(listing));
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ error: "Invalid listing data" });
    }
    return sendServerError(res, error, "Could not update listing");
  }
}

export async function cancelListing(req, res) {
  if (!validId(req.params.id) || !validId(req.user.id)) {
    return res.status(400).json({ error: "A valid listing id is required" });
  }
  try {
    const listing = await Listing.findOneAndUpdate(
      { _id: req.params.id, donorId: req.user.id, status: "available" },
      { $set: { status: "cancelled" } },
      { new: true, runValidators: true },
    );
    if (!listing) return res.status(404).json({ error: "Listing not found, not owned by you, or no longer available" });
    return res.json({ id: String(listing._id), status: listing.status });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ error: "A valid listing id is required" });
    return sendServerError(res, error, "Could not cancel listing");
  }
}

async function transition(req, res, { filter, update, conflictMessage, afterUpdate }) {
  if (!validId(req.params.id) || !validId(req.user.id)) {
    return res.status(400).json({ error: "A valid listing id is required" });
  }
  try {
    const listing = await Listing.findOneAndUpdate(
      { _id: req.params.id, ...filter },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!listing) {
      const exists = await Listing.exists({ _id: req.params.id });
      return exists
        ? res.status(400).json({ error: conflictMessage })
        : res.status(404).json({ error: "Listing not found" });
    }
    if (afterUpdate) await afterUpdate(listing);
    return res.json({ ok: true });
  } catch (error) {
    if (error.name === "CastError" || error.name === "ValidationError") {
      return res.status(400).json({ error: "Invalid listing update" });
    }
    return sendServerError(res, error, "Could not update listing");
  }
}

export async function claimListing(req, res) {
  return transition(req, res, {
    filter: { status: "available", expiresAt: { $gt: new Date() } },
    update: { status: "claimed", volunteerId: req.user.id, claimedAt: new Date() },
    conflictMessage: "Already claimed or expired",
  });
}

export async function collectListing(req, res) {
  return transition(req, res, {
    filter: { status: "claimed", volunteerId: req.user.id },
    update: { status: "collected", collectedAt: new Date() },
    conflictMessage: "Only the claiming volunteer can mark this collected",
    afterUpdate: async (listing) => {
      const stat = await DeliveryStat.findOneAndUpdate(
        { volunteerId: req.user.id },
        {
          $inc: { deliveriesCompleted: 1, mealsRescued: listing.meals },
          $setOnInsert: { distanceTraveled: 0, badgesEarned: [] },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
      );
      const badges = BADGE_MILESTONES.filter(([milestone]) => stat.deliveriesCompleted >= milestone).map(([, badge]) => badge);
      if (badges.length) {
        stat.badgesEarned = [...new Set([...stat.badgesEarned, ...badges])];
        await stat.save();
      }
    },
  });
}

export async function distributeListing(req, res) {
  return transition(req, res, {
    filter: { status: "collected" },
    update: { status: "distributed", ngoId: req.user.id, distributedAt: new Date() },
    conflictMessage: "Food must be collected before it can be received",
  });
}

export async function monthlyImpact(req, res) {
  const donorId = req.query.donorId;
  if (donorId && !validId(donorId)) return res.status(400).json({ error: "A valid donorId is required" });
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const match = { status: { $in: ["collected", "distributed"] }, collectedAt: { $gte: startOfMonth } };
    if (donorId) match.donorId = new mongoose.Types.ObjectId(donorId);
    const [impact] = await Listing.aggregate([
      { $match: match },
      { $group: { _id: null, meals: { $sum: "$meals" }, listings: { $sum: 1 }, donorIds: { $addToSet: "$donorId" } } },
      { $project: { _id: 0, meals: 1, listings: 1, donorIds: 1 } },
    ]);
    let org = null;
    if (donorId) org = (await User.findById(donorId).select("org").lean())?.org ?? null;
    else if (impact?.donorIds?.length === 1) org = (await User.findById(impact.donorIds[0]).select("org").lean())?.org ?? null;
    return res.json({ meals: impact?.meals ?? 0, listings: impact?.listings ?? 0, org });
  } catch (error) {
    return sendServerError(res, error, "Could not load impact");
  }
}

export async function pipelineSummary(_req, res) {
  try {
    const now = new Date();
    const [summary] = await Listing.aggregate([
      {
        $group: {
          _id: null,
          available: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "available"] }, { $gt: ["$expiresAt", now] }] }, 1, 0] } },
          claimed: { $sum: { $cond: [{ $eq: ["$status", "claimed"] }, 1, 0] } },
          collected: { $sum: { $cond: [{ $eq: ["$status", "collected"] }, 1, 0] } },
          distributed: { $sum: { $cond: [{ $eq: ["$status", "distributed"] }, 1, 0] } },
          meals_diverted: { $sum: { $cond: [{ $in: ["$status", ["collected", "distributed"]] }, "$meals", 0] } },
        },
      },
      { $project: { _id: 0, available: 1, claimed: 1, collected: 1, distributed: 1, meals_diverted: 1 } },
    ]);
    return res.json(summary ?? { available: 0, claimed: 0, collected: 0, distributed: 0, meals_diverted: 0 });
  } catch (error) {
    return sendServerError(res, error, "Could not load summary");
  }
}
