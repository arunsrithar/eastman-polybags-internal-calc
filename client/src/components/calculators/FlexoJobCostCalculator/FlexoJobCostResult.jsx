import { fmt } from "../../../utils/format";
import { FlexoIcon } from "../../ui/Icons";
import InvoiceHeader from "../../invoice/InvoiceHeader";
import InvoiceFooter from "../../invoice/InvoiceFooter";
import InvoiceEmpty from "../../invoice/InvoiceEmpty";
import TableHeader from "../../invoice/TableHeader";
import ItemRow from "../../invoice/ItemRow";
import SectionLabel from "../../invoice/SectionLabel";
import SectionSubtotal from "../../invoice/SectionSubtotal";
import { SECTION_COLORS } from "../../../constants/invoiceColors";
import { visibleFlexoCompanyName } from "../FlexoRateCalculator/companyDisplay";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const PROCESSING_KEYS = new Set([
  "rollSize",
  "printing",
  "gusset",
  "cutting",
  "opaque",
  "punching",
]);

const COMPANY_FIELD = {
  printing: "printingCompany",
  gusset: "gussetCompany",
  cutting: "cuttingCompany",
  opaque: "opackCompany",
  punching: "punchingCompany",
};

function sumSection(items) {
  return items.reduce((s, i) => s + i.amount, 0);
}

function processingLabel(item, form) {
  const companyName = visibleFlexoCompanyName(form[COMPANY_FIELD[item.key]]);
  if (!companyName) return item.label;
  return (
    <>
      {item.label}
      <span className="text-label-3 italic"> · {companyName}</span>
    </>
  );
}

function formatFlatLabel(item, finishedWeight) {
  return finishedWeight > 0 ? (
    <>
      {item.label}
      <span className="text-label-3 italic">
        {` · ₹${fmt(item.price)} × ${fmt(finishedWeight)} kg`}
      </span>
    </>
  ) : (
    item.label
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function FlexoJobCostResult({ result, form, status, date }) {
  if (!result) {
    return (
      <InvoiceEmpty
        message="No breakdown yet"
        hint="Enter item quantities and dispatch weight to see the cost breakdown."
      />
    );
  }

  const {
    enabledItems,
    totalAmount,
    finishedWeight,
    dispatchWeight,
    taxPercent,
    taxAmountPerKg,
    costOfJobExclTax,
  } = result;

  const roundedTotal = Math.round(totalAmount);
  const breakdownCostOfJob =
    dispatchWeight > 0 ? roundedTotal / dispatchWeight : null;

  const materials = enabledItems.filter((i) => i.key === "material");
  const processing = enabledItems.filter((i) => PROCESSING_KEYS.has(i.key));
  const other = enabledItems.filter(
    (i) => i.key !== "material" && !PROCESSING_KEYS.has(i.key),
  );

  const materialTotal = sumSection(materials);
  const processingTotal = sumSection(processing);
  const otherTotal = sumSection(other);

  const meta = [
    form.jobCardNo ? { label: "Job Card", value: form.jobCardNo } : null,
    form.jobWorkPlace
      ? { label: "Work Place", value: form.jobWorkPlace }
      : null,
    form.materialType
      ? { label: "Material", value: form.materialType }
      : null,
    form.rollSizeSpec
      ? { label: "Roll Size", value: form.rollSizeSpec }
      : null,
    form.coverSize ? { label: "Cover Size", value: form.coverSize } : null,
    form.micron ? { label: "Micron", value: `${form.micron}μ` } : null,
    form.printColors ? { label: "Colours", value: form.printColors } : null,
  ].filter(Boolean);

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="h-0.5 bg-tint shrink-0" />

      <InvoiceHeader
        icon={<FlexoIcon className="size-4.5 text-tint" />}
        title="Eastman Colour Printers"
        subtitle="Flexo Job Cost Estimate"
        customer={form.quoteName?.trim()}
        status={status}
        date={date}
        meta={meta}
      />

      <TableHeader />

      {/* ── Materials ────────────────────────────────────────────────── */}
      {materials.length > 0 ? (
        <>
          <SectionLabel color={SECTION_COLORS.blue} label="Materials" />
          {materials.map((item) => (
            <ItemRow
              key={item.key}
              label={item.label}
              rate={item.price}
              qty={item.qty}
              amount={item.amount}
            />
          ))}
          <SectionSubtotal label="Materials subtotal" amount={materialTotal} />
        </>
      ) : null}

      {/* ── Processing ───────────────────────────────────────────────── */}
      {processing.length > 0 ? (
        <>
          <SectionLabel color={SECTION_COLORS.green} label="Processing" />
          {processing.map((item) => (
            <ItemRow
              key={item.key}
              label={processingLabel(item, form)}
              rate={item.price}
              qty={item.qty}
              amount={item.amount}
            />
          ))}
          <SectionSubtotal
            label="Processing subtotal"
            amount={processingTotal}
          />
        </>
      ) : null}

      {/* ── Other (packing + transport) ──────────────────────────────── */}
      {other.length > 0 ? (
        <>
          <SectionLabel color={SECTION_COLORS.orange} label="Other" />
          {other.map((item) => (
            <ItemRow
              key={item.key}
              label={formatFlatLabel(item, finishedWeight)}
              amount={item.amount}
            />
          ))}
          <SectionSubtotal label="Other subtotal" amount={otherTotal} />
        </>
      ) : null}

      <InvoiceFooter
        total={totalAmount}
        highlight={breakdownCostOfJob}
        highlightLabel="Cost of Job"
        highlightUnit="/kg"
        annotation={
          dispatchWeight > 0
            ? `₹${fmt(roundedTotal)} total ÷ ${fmt(dispatchWeight)} kg dispatch${finishedWeight > 0 ? ` · ${fmt(finishedWeight)} kg finished` : ""}`
            : "Enter dispatch weight to see cost per kg"
        }
        taxPercent={taxPercent}
        taxAmount={taxAmountPerKg}
        exclusiveAmount={costOfJobExclTax}
        exclusiveLabel="Exclusive of Tax (/kg)"
      />
    </div>
  );
}
