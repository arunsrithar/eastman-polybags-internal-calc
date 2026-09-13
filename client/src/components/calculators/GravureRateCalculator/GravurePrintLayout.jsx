import { fmt, amountInWords } from "../../../utils/format";
import { MATERIAL_NAMES } from "../../../constants/gravureRates";
import PrintInvoice from "../../print/PrintInvoice";
import { CompanyIcon } from "../../ui/Icons";
import { isOwnGravureCompany } from "./companyDisplay";
import { useAuth } from "../../../context/AuthContext";
import { getPouchTypeLabel } from "../../../constants/pouchTypes";

/**
 * GravurePrintLayout — thin wrapper that maps Gravure result + form data
 * into the reusable PrintInvoice shell.
 *
 * For Flexo, follow the same pattern:
 *   1. Build `items`, `adjustments`, `metaRows`, `totalQty` from your result/form
 *   2. Render <PrintInvoice documentTitle="..." ... />
 */
export default function GravurePrintLayout({ result, form }) {
  const { user } = useAuth();

  if (!result) return null;

  const {
    materialLines,
    totalMaterialQty,
    laminationRatePerKg,
    slittingRatePerKg,
    pouchRatePerKg,
    slittingCharge,
    pouchCharge,
    wastagePercent,
    wastageAmount,
    preServiceTotal,
    basePricePerKg,
    servicePercent,
    serviceAmount,
    adjustedTotal,
    pricePerKg,
    taxPercent,
    taxAmountPerKg,
    pricePerKgExclTax,
    selectedCompanies,
    selectedRates,
  } = result;

  const normalColors = parseInt(form.normalColors, 10) || 0;
  const metallicColorsEnabled =
    typeof form.metallicColorsEnabled === "boolean"
      ? form.metallicColorsEnabled
      : Number(form.metallicColors || 0) > 0;
  const metallicColors = metallicColorsEnabled ? 1 : 0;
  const mattFinishColors = form.mattFinish ? 1 : 0;
  const normalColorRate = Number(selectedRates?.normalColorRate ?? 0);
  const metallicColorRate = Number(selectedRates?.metallicColorRate ?? 0);
  const mattFinishRate = Number(selectedRates?.mattFinishRate ?? 0);
  const slittingAmount = Number(slittingCharge ?? slittingRatePerKg ?? 0);
  const pouchAmount = Number(pouchCharge ?? pouchRatePerKg ?? 0);

  function companySubtitle(name) {
    if (!name) return undefined;

    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <CompanyIcon className="w-3 h-3" />
        <span>{name}</span>
      </span>
    );
  }

  function companyMetaValue(name) {
    if (!name) return "—";
    if (isOwnGravureCompany(name)) return "Own";
    return name;
  }

  const roundedTotalAmount = Math.round(adjustedTotal || 0);
  const roundedPricePerKg = Math.round(pricePerKg || 0);
  const roundedTotalDisplay = roundedTotalAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const roundedPriceDisplay = roundedPricePerKg.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const roundedTaxAmountPerKg = Math.round(taxAmountPerKg || 0);
  const roundedPricePerKgExclTax = Math.round(pricePerKgExclTax || 0);
  const generatedBy = user?.username?.trim() || "System";
  const documentDateTime = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  /* ── Numbered line items ── */
  const items = [
    /* Materials (one row each) */
    ...materialLines.map((line) => {
      const micron = form.materials[line.key]?.micron;
      const baseName = MATERIAL_NAMES[line.key] ?? line.key;
      return {
        key: line.key,
        label: micron ? `${baseName} · ${micron}μ` : baseName,
        qty: line.qty,
        price: line.price,
        amount: line.amount,
      };
    }),
    /* Printing charges */
    normalColors > 0
      ? {
        key: "printing-normal",
        label: "Normal Colors",
        subtitle: companySubtitle(selectedCompanies?.normalColor),
        qty: normalColors,
        unit: "clr",
        price: normalColorRate,
        amount: normalColors * normalColorRate,
      }
      : null,
    metallicColorsEnabled
      ? {
        key: "printing-metallic",
        label: "Metallic Colors",
        subtitle: companySubtitle(selectedCompanies?.metallicColor),
        qty: null,
        price: null,
        amount: metallicColorRate,
      }
      : null,
    form.mattFinish
      ? {
        key: "printing-matt",
        label: "Matt Finish",
        subtitle: companySubtitle(selectedCompanies?.mattFinish),
        qty: null,
        price: null,
        amount: mattFinishRate,
      }
      : null,
    /* Lamination */
    laminationRatePerKg > 0
      ? {
        key: "lamination",
        label:
          form.lamination === "single"
            ? "Single Lamination"
            : "Double Lamination",
        subtitle:
          form.lamination === "single"
            ? companySubtitle(selectedCompanies?.singleLamination)
            : companySubtitle(selectedCompanies?.doubleLamination),
        qty: null,
        price: null,
        amount: laminationRatePerKg,
      }
      : null,
    /* Slitting */
    slittingAmount > 0
      ? {
        key: "slitting",
        label: "Slitting",
        subtitle: companySubtitle(selectedCompanies?.slitting),
        qty: totalMaterialQty,
        price: slittingRatePerKg,
        amount: slittingAmount,
      }
      : null,
    /* Pouch making */
    pouchAmount > 0
      ? {
        key: "pouch",
        label: `Pouch Making (${form.pouchSize}${form.pouchType ? ` · ${getPouchTypeLabel(form.pouchType)}` : ""})`,
        subtitle: companySubtitle(selectedCompanies?.pouch),
        qty: totalMaterialQty,
        price: pouchRatePerKg,
        amount: pouchAmount,
      }
      : null,
  ].filter(Boolean);

  /* ── Adjustment rows: wastage then service ── */
  const adjustments = [
    wastagePercent > 0
      ? {
        label: `Wastage @ ${wastagePercent}%`,
        amount: wastageAmount,
        bold: false,
      }
      : null,
    {
      label: "Total Cost",
      amount: preServiceTotal,
      bold: true,
    },
    {
      type: "divider",
    },
    {
      label: `Base Price / Kg @ ${fmt(totalMaterialQty)} Kgs`,
      amount: basePricePerKg,
      bold: false,
    },
    servicePercent > 0
      ? {
        label: `Service/Kg @ ${servicePercent}%`,
        amount: serviceAmount,
        bold: true,
      }
      : null,
  ].filter(Boolean);

  /* ── Processed metadata: only info not in line items or requiring summary ── */
  const laminationLabel =
    form.lamination === "single"
      ? "Single"
      : form.lamination === "double"
        ? "Double"
        : "None";

  const slittingLabel = form.slitting ? "Yes" : "No";
  const pouchLabel = form.pouchSize || "—";
  const laminationCompany =
    form.lamination === "single"
      ? companyMetaValue(selectedCompanies?.singleLamination)
      : form.lamination === "double"
        ? companyMetaValue(selectedCompanies?.doubleLamination)
        : "—";
  const colorExpression = `${normalColors} + ${metallicColors} + ${mattFinishColors}`;

  /* Print metadata block in paired 2-column rows. */
  const metaRows = [
    {
      label: "Pouch Size",
      value: pouchLabel,
      label2: "No. Of Colours",
      value2: colorExpression,
    },
    {
      label: "Pouch Type",
      value: form.pouchType ? getPouchTypeLabel(form.pouchType) : "—",
      label2: "Pouch Co.",
      value2: companyMetaValue(selectedCompanies?.pouch),
    },
    {
      label: "Lamination",
      value: laminationLabel,
      label2: "Lamination Co.",
      value2: laminationCompany,
    },
    {
      label: "Slitting",
      value: slittingLabel,
      label2: "Slitting Co.",
      value2: companyMetaValue(selectedCompanies?.slitting),
    },
    {
      label: "Total Weight",
      value: `${fmt(totalMaterialQty)} Kgs`,
      label2: "Price / Kg",
      value2: `₹ ${roundedPriceDisplay}`,
    },
  ];

  return (
    <PrintInvoice
      documentTitle="Gravure Quote"
      documentNo={null}
      documentDate={documentDateTime}
      customer={form.quoteName?.trim()}
      partyPrimaryLabel="CUSTOMER"
      partyPrimaryValue={form.quoteName?.trim()}
      partySecondaryLabel="PREPARED BY"
      partySecondaryValue={generatedBy}
      metaRows={metaRows}
      items={items}
      adjustments={adjustments}
      totalQty={totalMaterialQty}
      totalAmount={roundedTotalAmount}
      showTotalRow={false}
      showAmountWords={false}
      totalAmountDisplay={roundedTotalDisplay}
      amountWords={amountInWords(roundedTotalAmount)}
      pricePerKg={roundedPricePerKg}
      pricePerKgDisplay={roundedPriceDisplay}
      pricePerKgWords={amountInWords(roundedPricePerKg)}
      taxPercent={taxPercent}
      taxAmount={roundedTaxAmountPerKg}
      exclusiveAmount={roundedPricePerKgExclTax}
      exclusiveLabel="Exclusive of Tax (/Kg)"
      footerShowBoxes={false}
    />
  );
}
