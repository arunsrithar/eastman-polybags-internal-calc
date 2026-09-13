import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, default: 0 },
  },
  {
    collection: "quoteCounters",
    versionKey: false,
  },
);

const QuoteCounter = mongoose.model("QuoteCounter", counterSchema);

export default QuoteCounter;
