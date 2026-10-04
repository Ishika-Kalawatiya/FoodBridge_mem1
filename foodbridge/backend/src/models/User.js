import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["donor", "volunteer", "ngo"], default: "volunteer", required: true },
  org: { type: String, trim: true, maxlength: 80, default: null },
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
