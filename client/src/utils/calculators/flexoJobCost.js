import { LINE_ITEMS } from "../../constants/flexoJobCost";

/**
 * calculateFlexoJobCost(form)
 *
 * Formula:
 *   Cost of Job (₹/kg) = Total Amount / Dispatch Weight
 *
 * Where:
 *   hasQty items:  amount = qty × price
 *   !hasQty items: amount = price × finishedWeight  (per-kg rate × finished kg)
 *
 * Returns null if no items are enabled or total is zero.
 */
export function calculateFlexoJobCost(form) {
  const finishedWeight = parseFloat(form.finishedWeight) || 0;

  const lineItems = LINE_ITEMS.map((def) => {
    const item = form.items?.[def.key] ?? {};
    const enabled = item.enabled ?? true;
    const price = parseFloat(item.price) || 0;

    let amount = 0;
    if (enabled && def.hasQty) {
      const qty = parseFloat(item.qty) || 0;
      amount = qty * price;
    }

    return {
      key: def.key,
      label: def.label,
      hasQty: def.hasQty,
      enabled,
      qty: def.hasQty ? parseFloat(item.qty) || 0 : null,
      price,
      amount,
    };
  });

  // Flat items (packing/transport): amount = price × finishedWeight
  for (const item of lineItems) {
    if (!item.hasQty && item.enabled) {
      item.amount = item.price * finishedWeight;
    }
  }

  const enabledItems = lineItems.filter((i) => i.enabled);
  const totalAmount = enabledItems.reduce((s, i) => s + i.amount, 0);
  const dispatchWeight = parseFloat(form.dispatchWeight) || 0;

  if (enabledItems.length === 0 || totalAmount === 0) {
    return null;
  }

  const costOfJob = dispatchWeight > 0 ? totalAmount / dispatchWeight : null;

  const taxPercent = parseFloat(form.tax) || 0;
  const taxDivisor = 1 + taxPercent / 100;
  const costOfJobExclTax = costOfJob != null ? costOfJob / taxDivisor : null;
  const taxAmountPerKg = costOfJob != null ? costOfJob - costOfJobExclTax : null;

  return {
    lineItems,
    enabledItems,
    totalAmount,
    finishedWeight,
    dispatchWeight,
    costOfJob,
    taxPercent,
    taxAmountPerKg,
    costOfJobExclTax,
    selectedCompanies: {
      printing: form.printingCompany || null,
      gusset: form.gussetCompany || null,
      cutting: form.cuttingCompany || null,
      opaque: form.opackCompany || null,
      punching: form.punchingCompany || null,
    },
  };
}
