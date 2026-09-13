import { fmt, amountInWords } from "../../../utils/format";
import { formatPrintDate } from "../../print/printTokens";
import PrintInvoice from "../../print/PrintInvoice";
import { CompanyIcon } from "../../ui/Icons";
import { getPouchTypeLabel } from "../../../constants/pouchTypes";

const FLAT_KEYS = new Set(["packingCharges", "transportCharge"]);

/* ─── Charge subtitle builders ───────────────────────────────────────────── */

function companyTag(name) {
  if (!name) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <CompanyIcon className="w-3 h-3" />
      <span>{name}</span>
    </span>
  );
}

function printingSubtitle(p) {
  if (!p) return undefined;
  const parts = [];
  if (p.normalColors && p.normalColorCompany)
    parts.push(`${p.normalColors} Normal Colors — ${p.normalColorCompany}`);
  else if (p.normalColorCompany)
    parts.push(`Normal Colors — ${p.normalColorCompany}`);
  if (p.metallicEnabled && p.metallicColorCompany)
    parts.push(`Metallic — ${p.metallicColorCompany}`);
  if (p.mattFinishCompany)
    parts.push(`Matt Finish — ${p.mattFinishCompany}`);
  return parts.length > 0 ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <CompanyIcon className="w-3 h-3" />
      <span>{parts.join("  •  ")}</span>
    </span>
  ) : undefined;
}

function laminationSubtitle(l) {
  if (!l) return undefined;
  const text = [l.laminationType, l.laminationCompany].filter(Boolean).join(" — ");
  return text ? companyTag(text) : undefined;
}

function slittingSubtitle(s) {
  return s?.slittingCompany ? companyTag(s.slittingCompany) : undefined;
}

function pouchSubtitle(p) {
  if (!p) return undefined;
  const typeLabel = p.pouchType ? getPouchTypeLabel(p.pouchType) : "";
  const text = [p.pouchCompany, p.pouchSize ? `Size: ${p.pouchSize}` : "", typeLabel]
    .filter(Boolean)
    .join(" — ");
  return text ? companyTag(text) : undefined;
}

const SUBTITLE_BUILDERS = {
  printingCharges:    (form) => printingSubtitle(form?.items?.printingCharges),
  laminationCharges:  (form) => laminationSubtitle(form?.items?.laminationCharges),
  slittingCharges:    (form) => slittingSubtitle(form?.items?.slittingCharges),
  pouchMakingCharges: (form) => pouchSubtitle(form?.items?.pouchMakingCharges),
};

export default function JobCostPrintLayout({ result, form }) {
  if (!result) return null;

  const {
    enabledItems,
    wastagePercent,
    wastageAmount,
    totalAmount,
    dispatchWeight,
    finishedWeight,
    taxPercent,
    taxAmountPerKg,
    costOfJobExclTax,
  } = result;

  const roundedTotalAmount = Math.round(totalAmount || 0);
  const roundedTotalDisplay = roundedTotalAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const jobCostPerKg =
    dispatchWeight > 0 ? Math.round(roundedTotalAmount / dispatchWeight) : null;
  const jobCostPerKgDisplay =
    jobCostPerKg != null
      ? jobCostPerKg.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : null;

  const roundedTaxAmountPerKg = Math.round(taxAmountPerKg || 0);
  const roundedCostOfJobExclTax = Math.round(costOfJobExclTax || 0);

  /* ── Numbered line items (exclude flat-charge keys) ── */
  const items = enabledItems
    .filter((item) => !FLAT_KEYS.has(item.key))
    .map((item) => ({
      key: item.key,
      label: item.label,
      subtitle: SUBTITLE_BUILDERS[item.key]?.(form),
      qty: item.hasQty && item.qty > 0 ? item.qty : null,
      price: item.hasQty ? item.price : null,
      amount: item.amount,
    }));

  /* ── Flat charges (packing, transport) ── */
  const flatItems = enabledItems.filter((item) => FLAT_KEYS.has(item.key));

  /* ── Adjustment rows: wastage first, then flat charges ── */
  const adjustments = [
    wastagePercent > 0
      ? { label: `Wastage @ ${wastagePercent}%`, amount: wastageAmount }
      : null,
    ...flatItems.map((r) => ({ label: r.label, amount: r.amount, bold: true })),
  ].filter(Boolean);

  /* ── Meta rows for the parties panel ── */
  const metaRows = [
    {
      label: "Invoice No.",
      value: form.billingNo,
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
      label: "Total Bundles",
      value: form.noOfBundles,
      label2: "Final Size",
      value2: form.finalSize,
    },
    {
      label: "Film",
      value: form.film,
      label2: "Micron",
      value2: form.micron ? `${form.micron}μ` : "",
    },
    {
      label: "No. of Colours",
      value: form.noOfColours,
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
      documentTitle="Gravure Job Cost Sheet"
      documentNo={form.billingNo}
      documentDate={formatPrintDate(form.billingDate)}
      noteLabel="Dispatch Date"
      noteValue={formatPrintDate(form.dispatchDate)}
      customer={form.quoteName?.trim()}
      partyPrimaryLabel="Customer"
      partyPrimaryValue={form.quoteName?.trim()}
      partySecondaryLabel="Job Work Place"
      partySecondaryValue={form.jobWorkCompany?.trim()}
      metaRows={metaRows}
      items={items}
      adjustments={adjustments}
      totalAmount={roundedTotalAmount}
      totalAmountDisplay={roundedTotalDisplay}
      amountWords={amountInWords(roundedTotalAmount)}
      showAmountWords={false}
      totalRowProminent={false}
      pricePerKg={jobCostPerKg}
      pricePerKgLabel="Job Cost"
      pricePerKgDisplay={jobCostPerKgDisplay}
      pricePerKgProminent
      pricePerKgUnitSuffix=""
      pricePerKgLabelIndent={46}
      pricePerKgWords={
        jobCostPerKg != null ? amountInWords(jobCostPerKg) : undefined
      }
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
