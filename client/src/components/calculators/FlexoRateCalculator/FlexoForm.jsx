import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import FormStack from "../../form/FormStack";
import FormSection from "../../form/FormSection";
import TextField from "../../form/TextField";
import RadioField from "../../form/RadioField";
import SelectField from "../../form/SelectField";
import CreatableSelect from "../../ui/CreatableSelect";
import useCustomerNames from "../../../hooks/useCustomerNames";
import ProcessTableRow from "../formRows/ProcessTableRow";
import ChargeColumnHeader from "../formRows/ChargeColumnHeader";
import { PROCESS_TABLE_GRID_NO_RATE } from "../formRows/chargeRowGrid";
import { ProcessIcon } from "../../ui/Icons";
import {
  makeInitialForm,
  WASTAGE_OPTIONS,
  CONVERSION_MATERIAL_TYPES,
  PRINTING_COLORS_OPTIONS,
} from "./formConfig";
import {
  useFlexoSettings,
  getLiveRollSizeOptions,
} from "../../../context/FlexoSettingsContext";
import { useAuth } from "../../../context/AuthContext";
import {
  getFlexoCompanyOptions,
  makeFlexoChargeOptionRenderer,
  findFlexoCompanyByName,
  getCompanyCoverSizeOptions,
} from "./processCompanyOptions";

const MATERIAL_TYPE_OPTIONS = CONVERSION_MATERIAL_TYPES.map((t) => ({
  value: t,
  label: t,
}));

// Values stay bare "1".."8" to match the printingColors keys the calc reads.
const formatPrintColours = (v) => `${v} Colour`;

/* ─── FlexoForm ──────────────────────────────────────────────────────────── */
export default forwardRef(function FlexoForm(
  { onProceed, saveError = null, quoteId = "" },
  ref,
) {
  const customerNames = useCustomerNames();
  const [form, setForm] = useState(() => makeInitialForm());
  const [savingPriceByMaterial, setSavingPriceByMaterial] = useState({});
  const {
    settings,
    updateMaterialPrice,
    companies,
    companyCoverSizes,
    fetchCompanyCoverSizes,
  } = useFlexoSettings();
  const { canEditPrices } = useAuth();
  const canEditMaterialPrice = canEditPrices("flexo-rate-calc");

  const companyOptions = getFlexoCompanyOptions(companies);
  const punchingOptionRenderer = makeFlexoChargeOptionRenderer(
    companies,
    "punching",
  );
  const opackOptionRenderer = makeFlexoChargeOptionRenderer(companies, "opack");

  const printingCompanyObj = findFlexoCompanyByName(
    companies,
    form.printingCompany,
  );

  // Fetch cover sizes for any company selected across the printing/gusset/cutting rows
  useEffect(() => {
    for (const companyName of [
      form.printingCompany,
      form.gussetCompany,
      form.cuttingCompany,
    ]) {
      if (!companyName) continue;
      const company = findFlexoCompanyByName(companies, companyName);
      if (company && !companyCoverSizes[company.id]) {
        fetchCompanyCoverSizes(company.id);
      }
    }
  }, [
    form.printingCompany,
    form.gussetCompany,
    form.cuttingCompany,
    companies,
    companyCoverSizes,
    fetchCompanyCoverSizes,
  ]);

  // Derive roll size options from live enabled rollSizeRates for selected material, sorted numerically
  const liveRollSizeOptions = getLiveRollSizeOptions(
    settings,
    form.conversionMaterial,
  );

  // Cover sizes are company-scoped only — nothing to fall back to until a
  // printing company is selected (the global rate tables this used to read
  // from are no longer editable anywhere).
  const liveCoverSizeOptions = printingCompanyObj
    ? getCompanyCoverSizeOptions(companyCoverSizes, printingCompanyObj.id)
    : [];

  function getLiveMaterialPrice(materialKey) {
    if (!materialKey) return 0;
    return settings?.materials?.[materialKey]?.priceHistory?.[0]?.price ?? 0;
  }

  function withLiveMaterialPrice(nextForm) {
    if (!nextForm.conversionMaterial) return nextForm;
    const liveMaterialPrice = getLiveMaterialPrice(nextForm.conversionMaterial);

    return {
      ...nextForm,
      materialPrice: String(liveMaterialPrice),
    };
  }

  function resetForm() {
    const next = withLiveMaterialPrice(makeInitialForm());
    setForm(next);
    onProceed?.(next);
  }

  useImperativeHandle(ref, () => ({ reset: resetForm }));

  function setField(key, val) {
    const next = { ...form, [key]: val };
    setForm(next);
    onProceed?.(next);
  }

  async function handleMaterialPriceSave(material, value) {
    const price = parseFloat(value);
    if (!material || !Number.isFinite(price) || price < 0) return;

    const current = getLiveMaterialPrice(material);
    if (String(current) === String(price)) return;
    if (savingPriceByMaterial[material]) return;

    setSavingPriceByMaterial((prev) => ({ ...prev, [material]: true }));
    try {
      await updateMaterialPrice(material, price);
    } finally {
      setSavingPriceByMaterial((prev) => ({ ...prev, [material]: false }));
    }
  }

  return (
    <FormStack>
      {/* ── Customer ── */}
      <FormSection>
        <TextField
          label="Quote ID"
          value={quoteId}
          disabled
          placeholder="Auto-generated"
        />
        <div className="card-section">
          <p className="field-label mb-1.5">Customer Name</p>
          <CreatableSelect
            storageKey="customer-names"
            defaultOptions={customerNames}
            value={form.quoteName}
            onChange={(v) => setField("quoteName", v)}
            placeholder="e.g. Rajesh Traders"
            creatable
            persistOptions={false}
          />
          {saveError && <p className="text-xs text-red-500 mt-1">{saveError}</p>}
        </div>
      </FormSection>

      {/* ── Material ── */}
      <FormSection title="Material">
        <RadioField
          name="conversionMaterial"
          options={MATERIAL_TYPE_OPTIONS}
          value={form.conversionMaterial}
          onChange={(v) => {
            const next = withLiveMaterialPrice({
              ...form,
              conversionMaterial: v,
              rollSize: "",
            });
            setForm(next);
            onProceed?.(next);
          }}
        />
        <SelectField
          label="Material Price"
          placeholder="₹ price"
          inline
          unit="₹"
          width="w-48"
          storageKey={`flexo-price-history-${form.conversionMaterial}`}
          defaultOptions={(settings?.materials?.[form.conversionMaterial]?.priceHistory ?? []).map((e) => String(e.price)).filter((v, i, a) => a.indexOf(v) === i)}
          value={form.conversionMaterial ? String(getLiveMaterialPrice(form.conversionMaterial) || "") : ""}
          onChange={(v) => {
            setField("materialPrice", v);
            handleMaterialPriceSave(form.conversionMaterial, v);
          }}
          disabled={!canEditMaterialPrice || !form.conversionMaterial || Boolean(savingPriceByMaterial[form.conversionMaterial])}
          persistOptions={false}
        />
      </FormSection>

      {/* ── Processing Charges — one table, six rows ── */}
      {/* Rates are resolved calc-side from the selected company (or global
          settings), never stored as an editable price here, so there's no
          Rate column — showRate={false} on every row. Roll Size, Printing and
          Cover Size have no on/off concept in this calculator (unlike Gusset/
          Cutting/Opack/Punching, which are real toggles), so they render a
          locked always-on toggle purely so their labels line up with the
          rows that do toggle. Printing Colors is its own row (Cover Size
          sources the company for it, so it comes second), using the same
          "N Colour" select Flexo Job Cost uses rather than pill buttons. */}
      <FormSection
        title="Processing Charges"
        icon={<ProcessIcon className="size-3.5" />}
      >
        <ChargeColumnHeader
          columns={["Process", "Detail", "Supplier"]}
          grid={PROCESS_TABLE_GRID_NO_RATE}
        />
        <ProcessTableRow
          label="Roll Size"
          showRate={false}
          detail={
            <CreatableSelect
              value={form.rollSize}
              onChange={(v) => setField("rollSize", v)}
              defaultOptions={liveRollSizeOptions}
              placeholder="Select size"
              creatable={false}
              persistOptions={false}
            />
          }
        />
        <ProcessTableRow
          label="Printing"
          showRate={false}
          supplier={
            <CreatableSelect
              value={form.printingCompany}
              onChange={(v) => setField("printingCompany", v)}
              defaultOptions={companyOptions}
              placeholder="Select company"
              creatable={false}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
        <ProcessTableRow
          label="Cover Size"
          showRate={false}
          supplier={
            <CreatableSelect
              value={form.coverSize}
              onChange={(v) => setField("coverSize", v)}
              defaultOptions={liveCoverSizeOptions}
              placeholder={
                printingCompanyObj ? "Select cover size" : "Select a company first"
              }
              formatLabel={(v) => v.replace(/\s*[xX×]\s*/, " x ")}
              creatable={false}
              persistOptions={false}
              disabled={!printingCompanyObj}
            />
          }
        />
        <ProcessTableRow
          label="Printing Colors"
          showRate={false}
          supplier={
            <CreatableSelect
              value={form.printingColors}
              onChange={(v) => setField("printingColors", v)}
              defaultOptions={PRINTING_COLORS_OPTIONS}
              formatLabel={formatPrintColours}
              placeholder="Select colours"
              creatable={false}
              persistOptions={false}
              disabled={!form.coverSize}
            />
          }
        />
        <ProcessTableRow
          label="Gusset"
          showRate={false}
          on={form.gusset}
          onToggle={() => setField("gusset", !form.gusset)}
          supplier={
            <CreatableSelect
              value={form.gussetCompany}
              onChange={(v) => setField("gussetCompany", v)}
              defaultOptions={companyOptions}
              placeholder="Select company"
              creatable={false}
              disabled={!form.gusset}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
        <ProcessTableRow
          label="Cutting"
          showRate={false}
          on={form.cutting}
          onToggle={() => setField("cutting", !form.cutting)}
          supplier={
            <CreatableSelect
              value={form.cuttingCompany}
              onChange={(v) => setField("cuttingCompany", v)}
              defaultOptions={companyOptions}
              placeholder="Select company"
              creatable={false}
              disabled={!form.cutting}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
        <ProcessTableRow
          label="Opack"
          showRate={false}
          on={form.opack}
          onToggle={() => setField("opack", !form.opack)}
          supplier={
            <CreatableSelect
              value={form.opackCompany}
              onChange={(v) => setField("opackCompany", v)}
              defaultOptions={companyOptions}
              renderOption={opackOptionRenderer}
              placeholder="Select company"
              creatable={false}
              disabled={!form.opack}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
        <ProcessTableRow
          label="Punching"
          showRate={false}
          on={form.punching}
          onToggle={() => setField("punching", !form.punching)}
          supplier={
            <CreatableSelect
              value={form.punchingCompany}
              onChange={(v) => setField("punchingCompany", v)}
              defaultOptions={companyOptions}
              renderOption={punchingOptionRenderer}
              placeholder="Select company"
              creatable={false}
              disabled={!form.punching}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
      </FormSection>

      {/* ── Wastage & Service ── */}
      <FormSection>
        <SelectField
          label="Wastage"
          placeholder="0"
          inline
          unit="%"
          storageKey="flexo-wastage"
          defaultOptions={WASTAGE_OPTIONS}
          value={form.wastage}
          onChange={(v) => setField("wastage", v)}
        />
        <SelectField
          label="Service"
          placeholder="0"
          inline
          unit="%"
          storageKey="flexo-service"
          defaultOptions={WASTAGE_OPTIONS}
          value={form.service}
          onChange={(v) => setField("service", v)}
        />
        <SelectField
          label="Tax"
          placeholder="18"
          inline
          unit="%"
          storageKey="flexo-tax"
          defaultOptions={["0", "5", "12", "18", "28"]}
          value={form.tax}
          onChange={(v) => setField("tax", v)}
        />
      </FormSection>
    </FormStack>
  );
});
