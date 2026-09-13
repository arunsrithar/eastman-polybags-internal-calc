import { fmt, amountInWords } from "../../../utils/format";
import { formatPrintDate } from "../../print/printTokens";
import PrintInvoice from "../../print/PrintInvoice";
import { CompanyIcon } from "../../ui/Icons";

const FLAT_KEYS = new Set(["packingCharges", "transportCharges"]);

// Roll size and print colours are stored bare ("6", "3") to match the price
// settings keys. Quotes saved before that change already carry their own suffix
// ('6"', "3 Colour"), so only decorate values that are still bare digits.
const displayRollSize = (v) => (/^\d+(\.\d+)?$/.test(v ?? "") ? `${v}"` : v);
const displayPrintColours = (v) => (/^\d+$/.test(v ?? "") ? `${v} Colour` : v);

const COMPANY_FIELD = {
  printing: "printingCompany",
  gusset: "gussetCompany",
  cutting: "cuttingCompany",
  opaque: "opackCompany",
  punching: "punchingCompany",
};

/**
 * FlexoJobCostPrintLayout — maps Flexo Job Cost result + form data
 * into the reusable PrintInvoice shell.
 *
 * Pattern mirrors JobCostPrintLayout exactly.
 */
export default function FlexoJobCostPrintLayout({ result, form }) {
  if (!result) return null;

  const {
    enabledItems,
    totalAmount,
    finishedWeight,
    dispatchWeight,
    taxPercent,
    taxAmountPerKg,
    costOfJobExclTax,
  } = result;

  const roundedTotalAmount = Math.round(totalAmount || 0);
  const roundedTotalDisplay = roundedTotalAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const costOfJob =
    dispatchWeight > 0 ? Math.round(roundedTotalAmount / dispatchWeight) : null;
  const roundedTaxAmountPerKg = Math.round(taxAmountPerKg || 0);
  const roundedCostOfJobExclTax = Math.round(costOfJobExclTax || 0);
  const costOfJobDisplay =
    costOfJob != null
      ? costOfJob.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : null;

  function companySubtitle(name) {
    if (!name) return undefined;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <CompanyIcon className="w-3 h-3" />
        <span>{name}</span>
      </span>
    );
  }

  /* ── Line items (exclude flat charges) ── */
  const items = enabledItems
    .filter((item) => !FLAT_KEYS.has(item.key))
    .map((item) => ({
      key: item.key,
      label: item.label,
      subtitle: companySubtitle(form[COMPANY_FIELD[item.key]]),
      qty: item.hasQty && item.qty > 0 ? item.qty : null,
      price: item.hasQty ? item.price : null,
      amount: item.amount,
    }));

  /* ── Flat charges → adjustment rows ── */
  const flatItems = enabledItems.filter((item) => FLAT_KEYS.has(item.key));
  const adjustments = flatItems.map((item) => ({
    label:
      finishedWeight > 0
        ? `${item.label} · ₹${fmt(item.price)} × ${fmt(finishedWeight)} kg`
        : item.label,
    amount: item.amount,
    bold: true,
  }));

  const totalQty = enabledItems
    .filter((i) => i.hasQty && i.qty)
    .reduce((s, i) => s + i.qty, 0);

  /* ── Meta rows for the parties panel ── */
  const metaRows = [
    {
      label: "Inv No.",
      value: form.invNo,
      label2: "Dated",
      value2: formatPrintDate(form.billingDate),
    },
    {
      label: "Job Card No.",
      value: form.jobCardNo,
      label2: "Job Card Date",
      value2: formatPrintDate(form.jobCardDate),
    },
    {
      label: "No. of Bundles",
      value: form.noOfBundles,
      label2: "Dispatch Date",
      value2: formatPrintDate(form.dispatchDate),
    },
    {
      label: "Material",
      value: form.materialType,
      label2: "Roll Size",
      value2: displayRollSize(form.rollSizeSpec),
    },
    {
      label: "Micron",
      value: form.micron ? `${form.micron}μ` : "",
      label2: "Print Colours",
      value2: displayPrintColours(form.printColors),
    },
    {
      label: "Cover Size",
      value: form.coverSize,
      label2: "Billing Rate",
      value2: form.billingRate ? `₹ ${fmt(form.billingRate)}` : "",
    },
    {
      label: "Dispatch Weight",
      value: dispatchWeight > 0 ? `${fmt(dispatchWeight)} Kgs` : "",
      label2: "Finished Weight",
      value2: finishedWeight > 0 ? `${fmt(finishedWeight)} Kgs` : "",
    },
  ];

  return (
    <PrintInvoice
      documentTitle="Flexo Job Cost Sheet"
      documentNo={form.invNo}
      documentDate={formatPrintDate(form.billingDate)}
      customer={form.quoteName?.trim()}
      partyPrimaryLabel="Customer"
      partyPrimaryValue={form.quoteName?.trim()}
      partySecondaryLabel="Job Work Place"
      partySecondaryValue={form.jobWorkPlace?.trim()}
      metaRows={metaRows}
      items={items}
      adjustments={adjustments}
      totalQty={totalQty}
      totalAmount={roundedTotalAmount}
      totalAmountDisplay={roundedTotalDisplay}
      amountWords={amountInWords(roundedTotalAmount)}
      showAmountWords={false}
      totalRowProminent={false}
      pricePerKg={costOfJob}
      pricePerKgLabel="Job Cost"
      pricePerKgDisplay={costOfJobDisplay}
      pricePerKgProminent
      pricePerKgUnitSuffix=""
      pricePerKgLabelIndent={46}
      pricePerKgWords={costOfJob != null ? amountInWords(costOfJob) : undefined}
      pricePerKgWordsProminent
      taxPercent={taxPercent}
      taxAmount={roundedTaxAmountPerKg}
      exclusiveAmount={roundedCostOfJobExclTax}
      exclusiveLabel="Exclusive of Tax (/Kg)"
      footerShowBoxes={false}
      footerShowCaption
    />
  );
}
