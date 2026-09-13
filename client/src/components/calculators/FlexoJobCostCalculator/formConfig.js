import { LINE_ITEMS, DROPDOWN_SEEDS } from "../../../constants/flexoJobCost";
import { DEFAULT_FLEXO_COMPANY_NAME } from "../FlexoRateCalculator/companyDisplay";

/* ─── Re-exports ──────────────────────────────────────────────────────────── */
export { LINE_ITEMS, DROPDOWN_SEEDS };

/* ─── Derived item groups ─────────────────────────────────────────────────── */
export const PROCESSING_ITEMS = LINE_ITEMS.filter(
  (i) => i.hasQty && i.key !== "material",
);
export const FLAT_ITEMS = LINE_ITEMS.filter((i) => !i.hasQty);

/* ─── Flat charge localStorage persistence ───────────────────────────────── */
const FLAT_CHARGE_PRICE_KEYS = {
  packingCharges: "flexo-job-cost-packing-charge-price",
  transportCharges: "flexo-job-cost-transport-charge-price",
};

function getStoredFlatChargePrice(itemKey, fallback) {
  try {
    const storageKey = FLAT_CHARGE_PRICE_KEYS[itemKey];
    if (!storageKey) return fallback;
    const val = window.localStorage.getItem(storageKey);
    return val != null ? val : fallback;
  } catch {
    return fallback;
  }
}

export function storeFlatChargePrice(itemKey, value) {
  try {
    const storageKey = FLAT_CHARGE_PRICE_KEYS[itemKey];
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, String(value ?? ""));
  } catch {
    // Ignore storage failures
  }
}

/* ─── Form state factory ─────────────────────────────────────────────────── */
export function makeInitialForm(settings = null) {
  const materialPrice =
    settings?.materials?.PP?.priceHistory?.[0]?.price ?? 200;

  const items = {};
  for (const def of LINE_ITEMS) {
    if (def.key === "material") {
      items[def.key] = {
        enabled: true,
        qty: "",
        price: String(materialPrice),
      };
    } else if (!def.hasQty) {
      items[def.key] = {
        enabled: true,
        price: getStoredFlatChargePrice(def.key, String(def.defaultPrice)),
      };
    } else {
      // Processing charges — price synced by useEffect in form on mount
      items[def.key] = {
        enabled: true,
        qty: "",
        price: String(def.defaultPrice),
      };
    }
  }

  return {
    quoteName: "",
    invNo: "",
    jobCardNo: "",
    jobCardDate: "",
    dispatchDate: "",
    billingRate: "",
    billingDate: "",
    noOfBundles: "",
    jobWorkPlace: "",
    materialType: "PP",
    rollSizeSpec: "",
    micron: "",
    printColors: "",
    coverSize: "",
    printingCompany: DEFAULT_FLEXO_COMPANY_NAME,
    gussetCompany: DEFAULT_FLEXO_COMPANY_NAME,
    cuttingCompany: DEFAULT_FLEXO_COMPANY_NAME,
    punchingCompany: DEFAULT_FLEXO_COMPANY_NAME,
    opackCompany: DEFAULT_FLEXO_COMPANY_NAME,
    items,
    tax: "18",
    finishedWeight: "",
    dispatchWeight: "",
  };
}
