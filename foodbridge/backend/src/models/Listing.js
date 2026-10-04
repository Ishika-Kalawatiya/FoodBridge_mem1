import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, default: "" },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  status: {
    type: String,
    enum: ["available", "claimed", "collected", "distributed", "cancelled"],
    default: "available",
    index: true,
  },
  meals: { type: Number, required: true, min: 1 },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  ngoId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  expiresAt: { type: Date, required: true, index: true },
  claimedAt: { type: Date, default: null },
  collectedAt: { type: Date, default: null },
  distributedAt: { type: Date, default: null },
}, { timestamps: true });

listingSchema.index({ status: 1, expiresAt: 1 });

export const Listing = mongoose.models.Listing || mongoose.model("Listing", listingSchema);
