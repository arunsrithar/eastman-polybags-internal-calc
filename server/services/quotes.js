import Quote from "../models/Quote.js";
import QuoteCounter from "../models/QuoteCounter.js";

const CALC_KEY_PREFIX = {
  gravure: "GR",
  "flexo-rate-calc": "FR",
  "job-cost": "GJC",
  "flexo-job-cost": "FJC",
};

function toResponse(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    quoteId: doc.quoteId ?? null,
    savedAt:
      doc.savedAt instanceof Date ? doc.savedAt.toISOString() : doc.savedAt,
    savedBy: doc.savedBy,
    quoteName: doc.quoteName,
    pouchSize: doc.pouchSize ?? null,
    pricePerKg: doc.pricePerKg,
    form: doc.form,
  };
}

function normalizeName(name) {
  return String(name).trim().toLowerCase();
}

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function generateQuoteId(calcKey) {
  const prefix = CALC_KEY_PREFIX[calcKey] || "Q";
  const counter = await QuoteCounter.findOneAndUpdate(
    { _id: calcKey },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `${prefix}-${String(counter.seq).padStart(4, "0")}`;
}

export async function getNextQuoteId(calcKey) {
  const prefix = CALC_KEY_PREFIX[calcKey] || "Q";
  const counter = await QuoteCounter.findOne({ _id: calcKey }).lean();
  const nextSeq = (counter?.seq ?? 0) + 1;
  return `${prefix}-${String(nextSeq).padStart(4, "0")}`;
}

export async function listQuotes(calcKey) {
  const docs = await Quote.find({ calcKey }).sort({ savedAt: -1 }).lean();
  return docs.map(toResponse);
}

export async function countQuotes(calcKey) {
  return Quote.countDocuments({ calcKey });
}

export async function createQuote(calcKey, payload) {
  const quoteName = String(payload.quoteName || "").trim();
  const normalized = normalizeName(quoteName);
  const quoteId = await generateQuoteId(calcKey);

  const doc = await Quote.create({
    calcKey,
    quoteId,
    quoteName,
    normalizedName: normalized,
    pouchSize: payload.pouchSize ?? null,
    pricePerKg: payload.pricePerKg,
    savedBy: payload.savedBy || "Admin",
    form: payload.form,
    savedAt: new Date(),
  });
  return toResponse(doc.toObject());
}

export async function deleteQuote(calcKey, id) {
  const result = await Quote.deleteOne({ _id: id, calcKey });
  return result.deletedCount > 0;
}

export async function getDistinctCustomers() {
  const names = await Quote.distinct("quoteName");
  return names.filter(Boolean).sort((a, b) => a.localeCompare(b));
}
