import { useState, useImperativeHandle, forwardRef, useEffect, useRef } from "react";
import FormStack from "../../form/FormStack";
import FormSection from "../../form/FormSection";
import TextField from "../../form/TextField";
import NumberField from "../../form/NumberField";
import SelectField from "../../form/SelectField";
import RadioField from "../../form/RadioField";
import DateField from "../../form/DateField";
import CreatableSelect from "../../ui/CreatableSelect";
import useCustomerNames from "../../../hooks/useCustomerNames";
import ProcessTableRow from "../formRows/ProcessTableRow";
import ChargeColumnHeader from "../formRows/ChargeColumnHeader";
import { PROCESS_TABLE_GRID } from "../formRows/chargeRowGrid";
import { ProcessIcon } from "../../ui/Icons";
import {
  makeInitialForm,
  FLAT_ITEMS,
  DROPDOWN_SEEDS,
  storeFlatChargePrice,
} from "./formConfig";
import {
  useFlexoSettings,
  getCurrentRate,
  getLiveRollSizeOptions,
} from "../../../context/FlexoSettingsContext";
import { PRINTING_COLORS_OPTIONS } from "../../../constants/flexoRateCalc";
import ItemRow from "../ItemRow";
import {
  getFlexoCompanyOptions,
  makeFlexoChargeOptionRenderer,
  findFlexoCompanyByName,
  getCompanyCoverSizeOptions,
} from "../FlexoRateCalculator/processCompanyOptions";

/* ─── Price compute helpers ──────────────────────────────────────────────── */

// A rate switched off in settings contributes nothing to the job cost.
function cellPrice(cell) {
  if (!cell || cell.isAvailable === false) return 0;
  return cell.price ?? 0;
}

function findCoverSizeDoc(companyCoverSizes, company, coverSize) {
  return (companyCoverSizes?.[company.id] ?? []).find(
    (cs) => cs.coverSize === coverSize,
  );
}

function computeRollSizePrice(materialType, rollSizeSpec, settings) {
  if (!materialType || !rollSizeSpec || !settings) return 0;
  // Prefer the newer rollSizeRates model; fall back to conversionRates
  const rollSizeCell = settings.rollSizeRates?.[materialType]?.[rollSizeSpec];
  if (rollSizeCell) return getCurrentRate(rollSizeCell);
  const convCell = settings.conversionRates?.[materialType]?.rates?.[rollSizeSpec];
  return getCurrentRate(convCell);
}

function computePrintingPrice(
  coverSize,
  printColors,
  settings,
  company,
  companyCoverSizes,
) {
  if (!coverSize || !printColors) return 0;
  if (company) {
    const doc = findCoverSizeDoc(companyCoverSizes, company, coverSize);
    return doc?.printingColors?.[String(printColors)]?.price ?? 0;
  }
  if (!settings) return 0;
  return getCurrentRate(settings.printingRates?.[coverSize]?.[String(printColors)]);
}

function computeGussetPrice(coverSize, settings, company, companyCoverSizes) {
  if (!coverSize) return 0;
  if (company) {
    const doc = findCoverSizeDoc(companyCoverSizes, company, coverSize);
    return cellPrice(doc?.gussetRate);
  }
  if (!settings) return 0;
  return getCurrentRate(settings.gussetRates?.[coverSize]);
}

function computeCuttingPrice(coverSize, settings, company, companyCoverSizes) {
  if (!coverSize) return 0;
  if (company) {
    const doc = findCoverSizeDoc(companyCoverSizes, company, coverSize);
    return cellPrice(doc?.cuttingRate);
  }
  if (!settings) return 0;
  return getCurrentRate(settings.cuttingRates?.[coverSize]);
}

function computeOpaquePrice(settings, company) {
  if (company) return cellPrice(company.charges?.opack);
  return getCurrentRate(settings?.opackRate);
}

function computePunchingPrice(settings, company) {
  if (company) return cellPrice(company.charges?.punching);
  return getCurrentRate(settings?.punchingRate);
}

const MATERIAL_TYPE_OPTIONS = [
  { value: "PP", label: "PP" },
  { value: "HM", label: "HM" },
  { value: "LD", label: "LD" },
];

// Values stay bare "1".."8" to match the printingColors keys in price settings.
const formatPrintColours = (v) => `${v} Colour`;

const PROCESSING_CHARGE_KEYS = [
  "rollSize",
  "printing",
  "gusset",
  "cutting",
  "opaque",
  "punching",
];

/* ─── FlexoJobCostForm ───────────────────────────────────────────────────── */
export default forwardRef(function FlexoJobCostForm(
  { onProceed, saveError = null, quoteId = "" },
  ref,
) {
  const { settings, companies, companyCoverSizes, fetchCompanyCoverSizes } =
    useFlexoSettings();
  const customerNames = useCustomerNames();
  const [form, setForm] = useState(() => makeInitialForm(settings));

  const pendingSyncRef = useRef(null);

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
  const gussetCompanyObj = findFlexoCompanyByName(companies, form.gussetCompany);
  const cuttingCompanyObj = findFlexoCompanyByName(companies, form.cuttingCompany);
  const opackCompanyObj = findFlexoCompanyByName(companies, form.opackCompany);
  const punchingCompanyObj = findFlexoCompanyByName(
    companies,
    form.punchingCompany,
  );

  // Cover sizes are company-scoped only — nothing to fall back to until a
  // printing company is selected (the static seed list this used to fall
  // back to isn't backed by any real rate data).
  const liveCoverSizeOptions = printingCompanyObj
    ? getCompanyCoverSizeOptions(companyCoverSizes, printingCompanyObj.id)
    : [];

  const liveRollSizeOptions = getLiveRollSizeOptions(settings, form.materialType);

  useEffect(() => {
    if (!form.printingCompany) return;
    const company = findFlexoCompanyByName(companies, form.printingCompany);
    if (company && !companyCoverSizes[company.id]) {
      fetchCompanyCoverSizes(company.id);
    }
  }, [form.printingCompany, companies, companyCoverSizes, fetchCompanyCoverSizes]);

  useEffect(() => {
    if (!form.gussetCompany) return;
    const company = findFlexoCompanyByName(companies, form.gussetCompany);
    if (company && !companyCoverSizes[company.id]) {
      fetchCompanyCoverSizes(company.id);
    }
  }, [form.gussetCompany, companies, companyCoverSizes, fetchCompanyCoverSizes]);

  useEffect(() => {
    if (!form.cuttingCompany) return;
    const company = findFlexoCompanyByName(companies, form.cuttingCompany);
    if (company && !companyCoverSizes[company.id]) {
      fetchCompanyCoverSizes(company.id);
    }
  }, [form.cuttingCompany, companies, companyCoverSizes, fetchCompanyCoverSizes]);

  // Auto-fill material price when materialType changes or settings load
  useEffect(() => {
    if (!settings?.materials) return;
    const matPrice = settings.materials[form.materialType]?.priceHistory?.[0]?.price;
    if (!matPrice) return;
    const current = form.items.material?.price;
    if (String(current) === String(matPrice)) return;
    setForm((prev) => {
      const next = {
        ...prev,
        items: {
          ...prev.items,
          material: { ...prev.items.material, price: String(matPrice) },
        },
      };
      pendingSyncRef.current = next;
      return next;
    });
  }, [form.materialType, settings?.materials]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill processing charge prices from spec fields + settings (company-aware)
  useEffect(() => {
    if (!settings) return;
    const newPrices = {
      rollSize: String(computeRollSizePrice(form.materialType, form.rollSizeSpec, settings)),
      printing: String(
        computePrintingPrice(
          form.coverSize,
          form.printColors,
          settings,
          printingCompanyObj,
          companyCoverSizes,
        ),
      ),
      gusset: String(
        computeGussetPrice(form.coverSize, settings, gussetCompanyObj, companyCoverSizes),
      ),
      cutting: String(
        computeCuttingPrice(form.coverSize, settings, cuttingCompanyObj, companyCoverSizes),
      ),
      opaque: String(computeOpaquePrice(settings, opackCompanyObj)),
      punching: String(computePunchingPrice(settings, punchingCompanyObj)),
    };
    setForm((prev) => {
      const nextItems = { ...prev.items };
      let changed = false;
      for (const [key, price] of Object.entries(newPrices)) {
        if (nextItems[key]?.price !== price) {
          nextItems[key] = { ...nextItems[key], price };
          changed = true;
        }
      }
      if (!changed) return prev;
      const next = { ...prev, items: nextItems };
      pendingSyncRef.current = next;
      return next;
    });
  }, [
    form.materialType,
    form.rollSizeSpec,
    form.coverSize,
    form.printColors,
    settings,
    printingCompanyObj,
    gussetCompanyObj,
    cuttingCompanyObj,
    opackCompanyObj,
    punchingCompanyObj,
    companyCoverSizes,
  ]);

  // Auto-derive processing charge qty from material qty
  const totalMaterialQty = parseFloat(form.items.material?.qty) || 0;

  useEffect(() => {
    const qty = String(totalMaterialQty);
    setForm((prev) => {
      const nextItems = { ...prev.items };
      let changed = false;
      for (const key of PROCESSING_CHARGE_KEYS) {
        if (nextItems[key]?.qty !== qty) {
          nextItems[key] = { ...nextItems[key], qty };
          changed = true;
        }
      }
      if (!changed) return prev;
      const next = { ...prev, items: nextItems };
      pendingSyncRef.current = next;
      return next;
    });
  }, [totalMaterialQty]);

  // Fire pending onProceed after each render
  useEffect(() => {
    if (pendingSyncRef.current) {
      onProceed?.(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }
  });

  function resetForm() {
    const next = makeInitialForm(settings);
    setForm(next);
    onProceed?.(next);
  }

  useImperativeHandle(ref, () => ({ reset: resetForm }));

  function setField(key, val) {
    const next = { ...form, [key]: val };
    setForm(next);
    onProceed?.(next);
  }

  function setItem(itemKey, field, val) {
    if (field === "price" && (itemKey === "packingCharges" || itemKey === "transportCharges")) {
      storeFlatChargePrice(itemKey, val);
    }
    const next = {
      ...form,
      items: {
        ...form.items,
        [itemKey]: { ...form.items[itemKey], [field]: val },
      },
    };
    setForm(next);
    onProceed?.(next);
  }

  function setProcessingPrice(itemKey, val) {
    setItem(itemKey, "price", val);
  }

  function toggleItem(itemKey) {
    const next = {
      ...form,
      items: {
        ...form.items,
        [itemKey]: {
          ...form.items[itemKey],
          enabled: !form.items[itemKey].enabled,
        },
      },
    };
    setForm(next);
    onProceed?.(next);
  }

  // Handle materialType change — also triggers material price sync via useEffect
  function handleMaterialTypeChange(val) {
    // Clear rollSizeSpec when material changes (roll sizes differ per material)
    setForm((prev) => {
      const next = { ...prev, materialType: val, rollSizeSpec: "" };
      onProceed?.(next);
      return next;
    });
  }

  return (
    <FormStack>
      {/* ── Quote ID & Customer Name ── */}
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

      {/* ── Job Details ── */}
      <FormSection title="Job Details">
        <TextField
          label="Invoice No"
          placeholder="e.g. INV-001"
          inline
          value={form.invNo}
          onChange={(v) => setField("invNo", v)}
        />
        <TextField
          label="Job Card No"
          placeholder="e.g. JC-001"
          inline
          value={form.jobCardNo}
          onChange={(v) => setField("jobCardNo", v)}
        />
        <DateField
          label="Job Card Date"
          value={form.jobCardDate}
          onChange={(v) => setField("jobCardDate", v)}
        />
        <DateField
          label="Dispatch Date"
          value={form.dispatchDate}
          onChange={(v) => setField("dispatchDate", v)}
        />
        <DateField
          label="Billing Date"
          value={form.billingDate}
          onChange={(v) => setField("billingDate", v)}
        />
        <NumberField
          label="Billing Rate"
          unit="₹"
          width="w-40"
          value={form.billingRate}
          onChange={(v) => setField("billingRate", v)}
          min={0}
          placeholder="0.00"
        />
        <NumberField
          label="No. of Bundles"
          width="w-40"
          value={form.noOfBundles}
          onChange={(v) => setField("noOfBundles", v)}
          min={0}
          placeholder="0"
        />
        <SelectField
          label="Job Work Place"
          placeholder="Select or type"
          inline
          width="flex-1"
          storageKey="flexo-job-cost-workplaces"
          defaultOptions={DROPDOWN_SEEDS.jobWorkPlaces}
          value={form.jobWorkPlace}
          onChange={(v) => setField("jobWorkPlace", v)}
        />
      </FormSection>

      {/* ── Specifications ── */}
      <FormSection title="Specifications">
        <RadioField
          name="materialType"
          label="Material Type"
          options={MATERIAL_TYPE_OPTIONS}
          value={form.materialType}
          onChange={handleMaterialTypeChange}
        />
        <NumberField
          label="Material Price"
          unit="₹"
          width="w-40"
          value={form.items.material.price}
          onChange={(v) => setItem("material", "price", v)}
          min={0}
          placeholder="0.00"
        />
        <NumberField
          label="Material Qty"
          unit="kg"
          width="w-48"
          value={form.items.material.qty}
          onChange={(v) => setItem("material", "qty", v)}
          min={0}
          placeholder="0.00"
        />
        <NumberField
          label="Micron"
          width="w-40"
          value={form.micron}
          onChange={(v) => setField("micron", v)}
          min={0}
          placeholder="0"
        />
      </FormSection>

      {/* ── Processing Charges — one table, seven rows ── */}
      <FormSection
        title="Processing Charges"
        icon={<ProcessIcon className="size-3.5" />}
      >
        <ChargeColumnHeader
          columns={["Process", "Detail", "Supplier", "Rate ₹/kg"]}
          grid={PROCESS_TABLE_GRID}
        />
        <ProcessTableRow
          label="Roll Size"
          on={form.items.rollSize.enabled}
          onToggle={() => toggleItem("rollSize")}
          price={form.items.rollSize.price}
          onPriceChange={(v) => setProcessingPrice("rollSize", v)}
          detail={
            <CreatableSelect
              value={form.rollSizeSpec}
              onChange={(v) => setField("rollSizeSpec", v)}
              defaultOptions={liveRollSizeOptions}
              placeholder="Select size"
              creatable={false}
              persistOptions={false}
              emptyMessage="No roll sizes configured"
            />
          }
        />
        <ProcessTableRow
          label="Cover Size"
          detail={
            <CreatableSelect
              value={form.coverSize}
              onChange={(v) => setField("coverSize", v)}
              defaultOptions={liveCoverSizeOptions}
              placeholder={
                printingCompanyObj ? "Select cover size" : "Select a company first"
              }
              creatable={false}
              persistOptions={false}
              emptyMessage="No cover sizes for this company"
              disabled={!printingCompanyObj}
            />
          }
        />
        <ProcessTableRow
          label="Printing"
          on={form.items.printing.enabled}
          onToggle={() => toggleItem("printing")}
          price={form.items.printing.price}
          onPriceChange={(v) => setProcessingPrice("printing", v)}
          detail={
            <CreatableSelect
              value={form.printColors}
              onChange={(v) => setField("printColors", v)}
              defaultOptions={PRINTING_COLORS_OPTIONS}
              formatLabel={formatPrintColours}
              placeholder="Colours"
              creatable={false}
              persistOptions={false}
            />
          }
          supplier={
            <CreatableSelect
              value={form.printingCompany}
              onChange={(v) => setField("printingCompany", v)}
              defaultOptions={companyOptions}
              placeholder="Select company"
              creatable={false}
              disabled={!form.items.printing.enabled}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
        <ProcessTableRow
          label="Gusset"
          on={form.items.gusset.enabled}
          onToggle={() => toggleItem("gusset")}
          price={form.items.gusset.price}
          onPriceChange={(v) => setProcessingPrice("gusset", v)}
          supplier={
            <CreatableSelect
              value={form.gussetCompany}
              onChange={(v) => setField("gussetCompany", v)}
              defaultOptions={companyOptions}
              placeholder="Select company"
              creatable={false}
              disabled={!form.items.gusset.enabled}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
        <ProcessTableRow
          label="Cutting"
          on={form.items.cutting.enabled}
          onToggle={() => toggleItem("cutting")}
          price={form.items.cutting.price}
          onPriceChange={(v) => setProcessingPrice("cutting", v)}
          supplier={
            <CreatableSelect
              value={form.cuttingCompany}
              onChange={(v) => setField("cuttingCompany", v)}
              defaultOptions={companyOptions}
              placeholder="Select company"
              creatable={false}
              disabled={!form.items.cutting.enabled}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
        <ProcessTableRow
          label="Opack"
          on={form.items.opaque.enabled}
          onToggle={() => toggleItem("opaque")}
          price={form.items.opaque.price}
          onPriceChange={(v) => setProcessingPrice("opaque", v)}
          supplier={
            <CreatableSelect
              value={form.opackCompany}
              onChange={(v) => setField("opackCompany", v)}
              defaultOptions={companyOptions}
              renderOption={opackOptionRenderer}
              placeholder="Select company"
              creatable={false}
              disabled={!form.items.opaque.enabled}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
        <ProcessTableRow
          label="Punching"
          on={form.items.punching.enabled}
          onToggle={() => toggleItem("punching")}
          price={form.items.punching.price}
          onPriceChange={(v) => setProcessingPrice("punching", v)}
          supplier={
            <CreatableSelect
              value={form.punchingCompany}
              onChange={(v) => setField("punchingCompany", v)}
              defaultOptions={companyOptions}
              renderOption={punchingOptionRenderer}
              placeholder="Select company"
              creatable={false}
              disabled={!form.items.punching.enabled}
              persistOptions={false}
              emptyMessage="No companies found"
            />
          }
        />
      </FormSection>

      {/* ── Weights ── */}
      <FormSection title="Weights">
        <NumberField
          label="Finished Weight"
          value={form.finishedWeight}
          onChange={(v) => setField("finishedWeight", v)}
          min={0}
          unit="kg"
          width="w-48"
          placeholder="0.00"
        />
        <NumberField
          label="Dispatch Weight"
          value={form.dispatchWeight}
          onChange={(v) => setField("dispatchWeight", v)}
          min={0}
          unit="kg"
          width="w-48"
          placeholder="0.00"
        />
      </FormSection>

      {/* ── Tax ── */}
      <FormSection>
        <SelectField
          label="Tax"
          placeholder="18"
          inline
          unit="%"
          storageKey="flexo-job-cost-tax"
          defaultOptions={["0", "5", "12", "18", "28"]}
          value={form.tax}
          onChange={(v) => setField("tax", v)}
        />
      </FormSection>

      {/* ── Other Charges (packing + transport) ── */}
      <FormSection title="Other Charges">
        {FLAT_ITEMS.map((def) => (
          <ItemRow
            key={def.key}
            def={def}
            item={form.items[def.key]}
            onToggle={() => toggleItem(def.key)}
            onChange={(field, val) => setItem(def.key, field, val)}
          />
        ))}
      </FormSection>
    </FormStack>
  );
});
