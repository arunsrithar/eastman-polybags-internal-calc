/**
 * seedQuoteCounters — initialises QuoteCounter documents from existing quotes
 * and optionally backfills quoteId on existing quote documents.
 *
 * Usage:  node --import ./config/env.js scripts/seedQuoteCounters.js
 */

import "../config/env.js";
import { connectDB } from "../config/db.js";
import Quote from "../models/Quote.js";
import QuoteCounter from "../models/QuoteCounter.js";

const CALC_KEY_PREFIX = {
  gravure: "GR",
  "flexo-rate-calc": "FR",
  "job-cost": "GJC",
  "flexo-job-cost": "FJC",
};

const CALC_KEYS = Object.keys(CALC_KEY_PREFIX);

async function run() {
  await connectDB();

  for (const calcKey of CALC_KEYS) {
    const prefix = CALC_KEY_PREFIX[calcKey];

    const docs = await Quote.find({ calcKey })
      .sort({ savedAt: 1 })
      .select("_id quoteId")
      .lean();

    let seq = 0;
    for (const doc of docs) {
      seq += 1;
      if (!doc.quoteId) {
        const newId = `${prefix}-${String(seq).padStart(4, "0")}`;
        await Quote.updateOne({ _id: doc._id }, { $set: { quoteId: newId } });
      }
    }

    await QuoteCounter.findOneAndUpdate(
      { _id: calcKey },
      { $set: { seq } },
      { upsert: true },
    );

    console.log(`${calcKey}: seeded counter to ${seq}, backfilled ${docs.filter((d) => !d.quoteId).length} quotes`);
  }

  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
