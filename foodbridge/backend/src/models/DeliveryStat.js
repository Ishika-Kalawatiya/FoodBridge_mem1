import mongoose from "mongoose";

const deliveryStatSchema = new mongoose.Schema({
  volunteerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  deliveriesCompleted: { type: Number, default: 0, min: 0 },
  mealsRescued: { type: Number, default: 0, min: 0 },
  distanceTraveled: { type: Number, default: 0, min: 0 },
  badgesEarned: { type: [String], default: [] },
}, { timestamps: true });

deliveryStatSchema.index({ deliveriesCompleted: -1, distanceTraveled: 1 });

export const DeliveryStat = mongoose.models.DeliveryStat
  || mongoose.model("DeliveryStat", deliveryStatSchema);
