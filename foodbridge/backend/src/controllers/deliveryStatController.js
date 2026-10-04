import mongoose from "mongoose";
import { DeliveryStat } from "../models/DeliveryStat.js";
import { Listing } from "../models/Listing.js";
import { User } from "../models/User.js";

function serializeStat(stat) {
  return {
    volunteerId: String(stat.volunteerId?._id ?? stat.volunteerId),
    volunteerName: stat.volunteerId?.name ?? null,
    deliveriesCompleted: stat.deliveriesCompleted,
    mealsRescued: stat.mealsRescued,
    distanceTraveled: stat.distanceTraveled,
    badgesEarned: stat.badgesEarned,
    createdAt: stat.createdAt,
    updatedAt: stat.updatedAt,
  };
}

function serverError(res, error, message) {
  console.error(error);
  return res.status(500).json({ error: message });
}

export async function listDeliveryStats(_req, res) {
  try {
    const stats = await DeliveryStat.find()
      .populate("volunteerId", "name")
      .sort({ deliveriesCompleted: -1, distanceTraveled: 1 })
      .limit(100)
      .lean();
    return res.json(stats.map(serializeStat));
  } catch (error) {
    return serverError(res, error, "Could not load delivery stats");
  }
}

export async function getDeliveryStat(req, res) {
  const volunteerId = req.params.volunteerId === "me" ? req.user?.id : req.params.volunteerId;
  if (!volunteerId || !mongoose.isValidObjectId(volunteerId)) {
    return res.status(400).json({ error: "A valid volunteerId is required" });
  }
  try {
    const stat = await DeliveryStat.findOne({ volunteerId }).populate("volunteerId", "name").lean();
    if (!stat) return res.status(404).json({ error: "Delivery stats not found" });
    return res.json(serializeStat(stat));
  } catch (error) {
    return serverError(res, error, "Could not load delivery stats");
  }
}

export async function getMyDeliveryStat(req, res) {
  if (!mongoose.isValidObjectId(req.user?.id)) return res.status(400).json({ error: "Invalid volunteer account" });
  try {
    const stat = await DeliveryStat.findOne({ volunteerId: req.user.id }).populate("volunteerId", "name").lean();
    const completed = await Listing.aggregate([
      { $match: { volunteerId: new mongoose.Types.ObjectId(req.user.id), status: { $in: ["collected", "distributed"] } } },
      { $group: { _id: null, deliveriesCompleted: { $sum: 1 }, mealsRescued: { $sum: "$meals" } } },
    ]);
    const user = await User.findById(req.user.id).select("name").lean();
    return res.json({
      volunteerId: req.user.id,
      volunteerName: user?.name ?? null,
      deliveriesCompleted: completed[0]?.deliveriesCompleted ?? stat?.deliveriesCompleted ?? 0,
      mealsRescued: completed[0]?.mealsRescued ?? stat?.mealsRescued ?? 0,
      distanceTraveled: stat?.distanceTraveled ?? 0,
      badgesEarned: stat?.badgesEarned ?? [],
      createdAt: stat?.createdAt ?? null,
      updatedAt: stat?.updatedAt ?? null,
    });
  } catch (error) {
    return serverError(res, error, "Could not load delivery stats");
  }
}

export async function getVolunteerStats(req, res) {
  if (!mongoose.isValidObjectId(req.user?.id)) return res.status(400).json({ error: "Invalid volunteer account" });
  try {
    const completed = await Listing.aggregate([
      { $match: { volunteerId: new mongoose.Types.ObjectId(req.user.id), status: { $in: ["collected", "distributed"] } } },
      { $group: { _id: null, deliveries: { $sum: 1 }, meals: { $sum: "$meals" } } },
    ]);
    const stat = await DeliveryStat.findOne({ volunteerId: req.user.id }).lean();
    return res.json({
      deliveries: completed[0]?.deliveries ?? stat?.deliveriesCompleted ?? 0,
      meals: completed[0]?.meals ?? stat?.mealsRescued ?? 0,
      distanceTraveled: stat?.distanceTraveled ?? 0,
      badgesEarned: stat?.badgesEarned ?? [],
    });
  } catch (error) {
    return serverError(res, error, "Could not load volunteer stats");
  }
}
