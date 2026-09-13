import { randomBytes } from "crypto";
import mongoose from "mongoose";

function makeQuoteId() {
  return `q-${randomBytes(6).toString("hex")}`;
}

const quoteSchema = new mongoose.Schema(
  {
    _id: { type: String, default: makeQuoteId },
    calcKey: { type: String, required: true, trim: true, index: true },
    quoteId: { type: String, default: null, trim: true },
    quoteName: { type: String, required: true, trim: true, maxlength: 200 },
    normalizedName: { type: String, required: true },
    pouchSize: { type: String, default: null, trim: true },
    pricePerKg: { type: Number, required: true, min: 0 },
    savedBy: { type: String, default: "Admin", trim: true },
    form: { type: mongoose.Schema.Types.Mixed, required: true },
    savedAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    collection: "quotes",
    versionKey: false,
  },
);

quoteSchema.index({ calcKey: 1, quoteId: 1 }, { unique: true, sparse: true });
quoteSchema.index({ calcKey: 1, savedAt: -1 });

const Quote = mongoose.model("Quote", quoteSchema);

export default Quote;
