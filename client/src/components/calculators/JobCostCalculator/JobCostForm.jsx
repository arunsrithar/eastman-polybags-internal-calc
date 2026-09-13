import { useState, useImperativeHandle, forwardRef, useEffect, useRef } from "react";
import FormStack from "../../form/FormStack";
import FormSection from "../../form/FormSection";
import TextField from "../../form/TextField";
import NumberField from "../../form/NumberField";
import SelectField from "../../form/SelectField";
import DateField from "../../form/DateField";
import ItemRow from "../ItemRow";
import IOSToggle from "../../ui/IOSToggle";
import CreatableSelect from "../../ui/CreatableSelect";
import useCustomerNames from "../../../hooks/useCustomerNames";
import ProcessCountCompanyRow from "../formRows/ProcessCountCompanyRow";
import ToggleCompanyRow from "../formRows/ToggleCompanyRow";
import LaminationPillRow from "../formRows/LaminationPillRow";
import ChargeColumnHeader from "../formRows/ChargeColumnHeader";
import ChargeQtyInput from "../formRows/ChargeQtyInput";
import {
  PrinterIcon,
  LayersIcon,
  ScissorsIcon,
  PouchIcon,
} from "../../ui/Icons";
import {
  getProcessCompanyOptions,
  makeCompanyOptionRenderer,
} from "../GravureRateCalculator/processCompanyOptions";
import {
  makeInitialForm,
  MATERIAL_ITEMS,
  FLAT_ITEMS,
  DROPDOWN_SEEDS,
  storeFlatChargePrice,
} from "./formConfig";
import {
  useGravureSettings,
  buildRatesFromSettings,
  getCurrentPrice,
} from "../../../context/GravureSettingsContext";
import {
  NORMAL_COLOR_RATE,
  METALLIC_COLOR_RATE,
  MATT_FINISH_RATE,
  SINGLE_LAM_RATE,
  DOUBLE_LAM_RATE,
  SLITTING_RATE,
  DEFAULT_POUCH_RATE,
} from "../../../constants/gravureRates";
import { POUCH_TYPE_OPTIONS, getPouchTypeLabel } from "../../../constants/pouchTypes";
import { fmt } from "../../../utils/format";

/* ─── Rate resolution helpers ────────────────────────────────────────────── */

const PROCESS_RATE_KEY = {
  normalColor: "normalColorRate",
  metallicColor: "metallicColorRate",
  mattFinish: "mattFinishRate",
  singleLamination: "singleLamRate",
  doubleLamination: "doubleLamRate",
  slitting: "slittingRate",
};

const PROCESS_FALLBACK = {
  normalColor: NORMAL_COLOR_RATE,
  metallicColor: METALLIC_COLOR_RATE,
  mattFinish: MATT_FINISH_RATE,
  singleLamination: SINGLE_LAM_RATE,
  doubleLamination: DOUBLE_LAM_RATE,
  slitting: SLITTING_RATE,
};

function resolveProcessRate(processKey, companyName, companies, rates) {
  const company = (companies ?? []).find(
    (c) => c.name === companyName && c.isActive !== false,
  );
  if (company) {
    const proc = company.processes?.[processKey];
    if (proc?.isAvailable !== false && Number.isFinite(proc?.price)) {
      return proc.price;
    }
  }
  const rateKey = PROCESS_RATE_KEY[processKey];
  return (rateKey ? rates?.[rateKey] : undefined) ?? PROCESS_FALLBACK[processKey] ?? 0;
}

function computeLaminationPrice(lamItem, companies, rates) {
  if (lamItem.laminationType === "none") return 0;
  const processKey =
    lamItem.laminationType === "double" ? "doubleLamination" : "singleLamination";
  return resolveProcessRate(processKey, lamItem.laminationCompany, companies, rates);
}

function computeSlittingPrice(slitItem, companies, rates) {
  return resolveProcessRate("slitting", slitItem.slittingCompany, companies, rates);
}

function computePouchPrice(pouchItem, settings, companies) {
  if (!pouchItem.pouchCompany || !pouchItem.pouchSize || !pouchItem.pouchType) return 0;
  const activeCompanies = (companies ?? []).filter((c) => c.isActive !== false);
  const company = activeCompanies.find((c) => c.name === pouchItem.pouchCompany);
  if (!company) return 0;
  const entry = (settings?.pouches ?? []).find(
    (p) =>
      p.companyId === company.id &&
      `${p.length} x ${p.breadth}` === pouchItem.pouchSize,
  );
  const typeConfig = entry?.types?.[pouchItem.pouchType];
  if (typeConfig?.isAvailable === false) return 0;
  return typeConfig?.price ?? DEFAULT_POUCH_RATE;
}

function pouchEntrySize(entry) {
  return `${entry.length} x ${entry.breadth}`;
}

/* ─── JobCostForm ────────────────────────────────────────────────────────── */
export default forwardRef(function JobCostForm(
  { onProceed, saveError = null, quoteId = "" },
  ref,
) {
  const { settings, companies } = useGravureSettings();
  const rates = settings ? buildRatesFromSettings(settings) : null;

  const customerNames = useCustomerNames();
  const [form, setForm] = useState(() => makeInitialForm(rates, settings));

  const pendingSyncRef = useRef(null);
  const didSyncMaterials = useRef(false);

  // Sync material prices when settings change mid-session
  useEffect(() => {
    if (!settings?.materials) return;
    setForm((prev) => {
      const nextItems = { ...prev.items };
      let changed = false;
      const MAT_MAP = {
        polyster: "polyester",
        silverPolyster: "silverPet",
        boppSilver: "bopp",
        ldnLdop: "ldRoll",
      };
      for (const [itemKey, settingsKey] of Object.entries(MAT_MAP)) {
        const settingsPrice = getCurrentPrice(settings.materials[settingsKey]);
        if (settingsPrice && String(nextItems[itemKey]?.price) !== String(settingsPrice)) {
          nextItems[itemKey] = { ...nextItems[itemKey], price: String(settingsPrice) };
          changed = true;
        }
      }
      if (!changed) return prev;
      const next = { ...prev, items: nextItems };
      if (didSyncMaterials.current) pendingSyncRef.current = next;
      didSyncMaterials.current = true;
      return next;
    });
  }, [settings?.materials]);

  // Derive total material qty (sum of enabled material items)
  const totalMaterialQty = MATERIAL_ITEMS.reduce((sum, def) => {
    const item = form.items[def.key];
    if (!item?.enabled) return sum;
    return sum + (parseFloat(item.qty) || 0);
  }, 0);

  // Fire any pending onProceed callbacks after render
  useEffect(() => {
    if (pendingSyncRef.current) {
      onProceed?.(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }
  });

  function resetForm() {
    const freshRates = settings ? buildRatesFromSettings(settings) : null;
    const next = makeInitialForm(freshRates, settings);
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
    if (
      field === "price" &&
      (itemKey === "packingCharges" || itemKey === "transportCharge")
    ) {
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

  function setChargeItemFields(itemKey, fields) {
    const merged = { ...form.items[itemKey], ...fields };
    let price = merged.price;

    if (itemKey === "printingCharges") {
      // Picking a company auto-fills that row's rate — unless this same call
      // is a manual edit of the rate field itself. Each row's own rate and qty
      // feed the per-component total-cost calc directly; there's no combined
      // rate to derive here.
      if ("normalColorCompany" in fields && !("normalColorPrice" in fields)) {
        merged.normalColorPrice = String(
          resolveProcessRate("normalColor", merged.normalColorCompany, companies, rates),
        );
      }
      if ("metallicColorCompany" in fields && !("metallicColorPrice" in fields)) {
        merged.metallicColorPrice = String(
          resolveProcessRate("metallicColor", merged.metallicColorCompany, companies, rates),
        );
      }
      if ("mattFinishCompany" in fields && !("mattFinishPrice" in fields)) {
        merged.mattFinishPrice = String(
          resolveProcessRate("mattFinish", merged.mattFinishCompany, companies, rates),
        );
      }
    } else if (itemKey === "laminationCharges" && !("price" in fields)) {
      price = String(computeLaminationPrice(merged, companies, rates));
    } else if (itemKey === "slittingCharges" && !("price" in fields)) {
      price = String(computeSlittingPrice(merged, companies, rates));
    } else if (itemKey === "pouchMakingCharges" && !("price" in fields)) {
      price = String(computePouchPrice(merged, settings, companies));
    }

    const next = {
      ...form,
      items: { ...form.items, [itemKey]: { ...merged, price } },
    };
    setForm(next);
    onProceed?.(next);
  }

  function toggleItem(itemKey) {
    const next = {
      ...form,
      items: {
        ...form.items,
        [itemKey]: { ...form.items[itemKey], enabled: !form.items[itemKey].enabled },
      },
    };
    setForm(next);
    onProceed?.(next);
  }

  /* ── Company option helpers ── */
  const activeCompanies = (companies ?? []).filter((c) => c.isActive !== false);

  const normalColorOptions = getProcessCompanyOptions(companies, "normalColor");
  const metallicColorOptions = getProcessCompanyOptions(companies, "metallicColor");
  const mattFinishOptions = getProcessCompanyOptions(companies, "mattFinish");
  const singleLamOptions = getProcessCompanyOptions(companies, "singleLamination");
  const doubleLamOptions = getProcessCompanyOptions(companies, "doubleLamination");
  const slittingOptions = getProcessCompanyOptions(companies, "slitting");

  const renderNormalColor = makeCompanyOptionRenderer(companies, "normalColor");
  const renderMetallicColor = makeCompanyOptionRenderer(companies, "metallicColor");
  const renderMattFinish = makeCompanyOptionRenderer(companies, "mattFinish");
  const renderSingleLam = makeCompanyOptionRenderer(companies, "singleLamination");
  const renderDoubleLam = makeCompanyOptionRenderer(companies, "doubleLamination");
  const renderSlitting = makeCompanyOptionRenderer(companies, "slitting");

  /* ── Pouch data ── */
  const activeCompanyById = new Map(activeCompanies.map((c) => [c.id, c]));
  const allPouchEntries = (settings?.pouches ?? []).filter(
    (e) => e.companyId && activeCompanyById.has(e.companyId),
  );
  const pouchCompanyByName = new Map(activeCompanies.map((c) => [c.name, c]));
  const pouchItem = form.items.pouchMakingCharges;

  // Company is chosen first; size options are scoped to that company and
  // reset whenever the company changes.
  const filteredPouchCompanyOptions = activeCompanies
    .filter((c) => allPouchEntries.some((e) => e.companyId === c.id))
    .map((c) => ({ value: c.name, label: c.name }));

  const filteredPouchSizeOptions = pouchItem.pouchCompany
    ? Array.from(new Set(
        allPouchEntries
          .filter((e) => {
            const company = pouchCompanyByName.get(pouchItem.pouchCompany);
            return company && e.companyId === company.id;
          })
          .map(pouchEntrySize),
      )).sort((a, b) => a.localeCompare(b))
    : [];

  function findPouchEntry(companyName, size) {
    if (!companyName || !size) return null;
    const company = pouchCompanyByName.get(companyName);
    if (!company) return null;
    return (
      allPouchEntries.find(
        (e) => e.companyId === company.id && pouchEntrySize(e) === size,
      ) ?? null
    );
  }

  const selectedPouchEntry = findPouchEntry(pouchItem.pouchCompany, pouchItem.pouchSize);

  const filteredPouchTypeOptions = selectedPouchEntry
    ? POUCH_TYPE_OPTIONS.filter(
        (type) => selectedPouchEntry?.types?.[type.value]?.isAvailable !== false,
      )
    : [];

  function handlePouchCompanyChange(nextCompany) {
    setChargeItemFields("pouchMakingCharges", {
      pouchCompany: nextCompany,
      pouchSize: "",
      pouchType: "",
    });
  }

  function handlePouchSizeChange(nextSize) {
    const nextEntry = findPouchEntry(pouchItem.pouchCompany, nextSize);
    const currentType = pouchItem.pouchType;
    const nextType =
      nextEntry && nextEntry?.types?.[currentType]?.isAvailable !== false
        ? currentType
        : "";
    setChargeItemFields("pouchMakingCharges", { pouchSize: nextSize, pouchType: nextType });
  }

  function handlePouchTypeChange(nextType) {
    setChargeItemFields("pouchMakingCharges", { pouchType: nextType });
  }

  /* ── Lamination type change ── */
  function handleLaminationTypeChange(newType) {
    if (newType === "none") {
      setChargeItemFields("laminationCharges", {
        laminationType: "none",
        enabled: false,
      });
      return;
    }

    const newProcessKey = newType === "double" ? "doubleLamination" : "singleLamination";
    const available = getProcessCompanyOptions(companies, newProcessKey);
    const companyStillValid = available.some(
      (o) => o.value === form.items.laminationCharges.laminationCompany,
    );
    setChargeItemFields("laminationCharges", {
      laminationType: newType,
      enabled: true,
      laminationCompany: companyStillValid ? form.items.laminationCharges.laminationCompany : "",
    });
  }

  /* ── Convenience aliases ── */
  const printItem = form.items.printingCharges;
  const lamItem = form.items.laminationCharges;
  const slitItem = form.items.slittingCharges;
  const lamIsDouble = lamItem.laminationType === "double";

  return (
    <FormStack>
      {/* ── Customer & Quote ID ── */}
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
        <DateField
          label="Job Card Date"
          value={form.jobCardDate}
          onChange={(v) => setField("jobCardDate", v)}
        />
        <TextField
          label="Job Card No"
          placeholder="e.g. JC-001"
          inline
          value={form.jobCardNo}
          onChange={(v) => setField("jobCardNo", v)}
        />
        <SelectField
          label="Job Work Company"
          placeholder="Select or type"
          inline
          width="flex-1"
          storageKey="job-cost-companies"
          defaultOptions={DROPDOWN_SEEDS.jobWorkCompanies}
          value={form.jobWorkCompany}
          onChange={(v) => setField("jobWorkCompany", v)}
        />
        <TextField
          label="Billing No"
          placeholder="e.g. B-001"
          inline
          value={form.billingNo}
          onChange={(v) => setField("billingNo", v)}
        />
        <DateField
          label="Billing Date"
          value={form.billingDate}
          onChange={(v) => setField("billingDate", v)}
        />
        <DateField
          label="Dispatch Date"
          value={form.dispatchDate}
          onChange={(v) => setField("dispatchDate", v)}
        />
        <TextField
          label="Final Size"
          placeholder="e.g. 10 x 12"
          inline
          value={form.finalSize}
          onChange={(v) => setField("finalSize", v)}
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
      </FormSection>

      {/* ── Specifications ── */}
      <FormSection title="Specifications">
        <TextField
          label="Film"
          placeholder="e.g. PET / BOPP"
          inline
          value={form.film}
          onChange={(v) => setField("film", v)}
        />
        <SelectField
          label="Micron"
          placeholder="Select"
          inline
          width="w-40"
          storageKey="job-cost-microns"
          defaultOptions={DROPDOWN_SEEDS.microns}
          value={form.micron}
          onChange={(v) => setField("micron", v)}
        />
        <SelectField
          label="No. of Colours"
          placeholder="Select"
          inline
          width="w-40"
          storageKey="job-cost-colours"
          defaultOptions={DROPDOWN_SEEDS.colours}
          value={form.noOfColours}
          onChange={(v) => setField("noOfColours", v)}
        />
      </FormSection>

      {/* ── Materials ── */}
      <FormSection title="Materials">
        {MATERIAL_ITEMS.map((def) => (
          <ItemRow
            key={def.key}
            def={def}
            item={form.items[def.key]}
            onToggle={() => toggleItem(def.key)}
            onChange={(field, val) => setItem(def.key, field, val)}
          />
        ))}
      </FormSection>

      {/* ── Material total hint ── */}
      {totalMaterialQty > 0 && (
        <div className="px-1 -mb-2">
          <span className="text-xs text-label-3">
            Material total: <span className="font-medium tabular-nums">{fmt(totalMaterialQty)} kg</span>
          </span>
        </div>
      )}

      {/* ── Printing Charges ── */}
      <FormSection title="Printing Charges" icon={<PrinterIcon className="size-3.5" />}>
        <ChargeColumnHeader columns={["Component", "Qty", "Supplier", "Rate"]} hasQty />
        <ProcessCountCompanyRow
          label="Normal Colors"
          connector={null}
          value={printItem.normalColors}
          onValueChange={(v) => setChargeItemFields("printingCharges", { normalColors: v })}
          qty={printItem.normalColorQty}
          onQtyChange={(v) => setChargeItemFields("printingCharges", { normalColorQty: v })}
          companyValue={printItem.normalColorCompany}
          onCompanyChange={(v) => setChargeItemFields("printingCharges", { normalColorCompany: v })}
          companyOptions={normalColorOptions}
          renderCompanyOption={renderNormalColor}
          companyDisabled={Number(printItem.normalColors || 0) <= 0}
          price={printItem.normalColorPrice}
          onPriceChange={(v) => setChargeItemFields("printingCharges", { normalColorPrice: v })}
          priceUnit="/color"
        />
        <ToggleCompanyRow
          label="Metallic Colors"
          connector={null}
          on={printItem.metallicEnabled}
          onToggle={() => setChargeItemFields("printingCharges", { metallicEnabled: !printItem.metallicEnabled })}
          qty={printItem.metallicColorQty}
          onQtyChange={(v) => setChargeItemFields("printingCharges", { metallicColorQty: v })}
          companyValue={printItem.metallicColorCompany}
          onCompanyChange={(v) => setChargeItemFields("printingCharges", { metallicColorCompany: v })}
          companyOptions={metallicColorOptions}
          renderCompanyOption={renderMetallicColor}
          price={printItem.metallicColorPrice}
          onPriceChange={(v) => setChargeItemFields("printingCharges", { metallicColorPrice: v })}
        />
        <ToggleCompanyRow
          label="Matt Finish"
          connector={null}
          on={printItem.mattFinish}
          onToggle={() => setChargeItemFields("printingCharges", { mattFinish: !printItem.mattFinish })}
          qty={printItem.mattFinishQty}
          onQtyChange={(v) => setChargeItemFields("printingCharges", { mattFinishQty: v })}
          companyValue={printItem.mattFinishCompany}
          onCompanyChange={(v) => setChargeItemFields("printingCharges", { mattFinishCompany: v })}
          companyOptions={mattFinishOptions}
          renderCompanyOption={renderMattFinish}
          price={printItem.mattFinishPrice}
          onPriceChange={(v) => setChargeItemFields("printingCharges", { mattFinishPrice: v })}
          priceUnit="/kg"
        />
      </FormSection>

      {/* ── Lamination ── */}
      <FormSection title="Lamination" icon={<LayersIcon className="size-3.5" />}>
        <ChargeColumnHeader columns={["Type", "Qty", "Supplier", "Rate"]} hasQty />
        <LaminationPillRow
          value={lamItem.laminationType}
          onChange={handleLaminationTypeChange}
          qty={lamItem.qty}
          onQtyChange={(v) => setChargeItemFields("laminationCharges", { qty: v })}
          companyValue={lamItem.laminationCompany}
          onCompanyChange={(v) => setChargeItemFields("laminationCharges", { laminationCompany: v })}
          companyOptions={lamIsDouble ? doubleLamOptions : singleLamOptions}
          renderCompanyOption={lamIsDouble ? renderDoubleLam : renderSingleLam}
          price={lamItem.price}
          onPriceChange={(v) => setChargeItemFields("laminationCharges", { price: v })}
        />
      </FormSection>

      {/* ── Slitting ── */}
      <FormSection title="Slitting" icon={<ScissorsIcon className="size-3.5" />}>
        <ToggleCompanyRow
          label="Slitting Charges"
          connector={null}
          on={slitItem.enabled}
          onToggle={() => toggleItem("slittingCharges")}
          qty={slitItem.qty}
          onQtyChange={(v) => setChargeItemFields("slittingCharges", { qty: v })}
          companyValue={slitItem.slittingCompany}
          onCompanyChange={(v) => setChargeItemFields("slittingCharges", { slittingCompany: v })}
          companyOptions={slittingOptions}
          renderCompanyOption={renderSlitting}
          price={slitItem.price}
          onPriceChange={(v) => setChargeItemFields("slittingCharges", { price: v })}
          priceUnit="/kg"
        />
      </FormSection>

      {/* ── Pouch Making ── */}
      <FormSection title="Pouch Making" icon={<PouchIcon className="size-3.5" />}>
        <div className="card-section">
          <div className="grid items-center gap-2 min-w-0 grid-cols-[16rem_minmax(0,1fr)]">
            <div className="flex items-center gap-2 min-w-0">
              <IOSToggle on={pouchItem.enabled} onToggle={() => toggleItem("pouchMakingCharges")} />
              <span className={`text-sm font-medium shrink-0 ${pouchItem.enabled ? "text-label" : "text-label-3"}`}>
                Pouch Making Charges
              </span>
            </div>
            <div className={`min-w-0 ${pouchItem.enabled ? "" : "opacity-60"}`}>
              <CreatableSelect
                defaultOptions={filteredPouchCompanyOptions}
                value={pouchItem.pouchCompany}
                onChange={handlePouchCompanyChange}
                placeholder="Select company"
                creatable={false}
                disabled={!pouchItem.enabled}
                emptyMessage="No companies found"
              />
            </div>
          </div>
        </div>
        <div className={`card-section ${pouchItem.enabled ? "" : "opacity-60 pointer-events-none"}`}>
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_7rem_10rem] gap-3">
            <div className="min-w-0">
              <p className="field-label mb-1.5">Pouch Size</p>
              <CreatableSelect
                defaultOptions={filteredPouchSizeOptions}
                value={pouchItem.pouchSize}
                onChange={handlePouchSizeChange}
                placeholder="Search pouch size..."
                creatable={false}
                persistOptions={false}
                emptyMessage="No pouch sizes found"
                disabled={!pouchItem.pouchCompany}
              />
            </div>
            <div className="min-w-0">
              <p className="field-label mb-1.5">Pouch Type</p>
              <CreatableSelect
                defaultOptions={filteredPouchTypeOptions}
                value={pouchItem.pouchType}
                onChange={handlePouchTypeChange}
                placeholder="Select type..."
                creatable={false}
                persistOptions={false}
                emptyMessage="No pouch types found"
                disabled={!pouchItem.pouchCompany || !pouchItem.pouchSize}
                formatLabel={getPouchTypeLabel}
                renderOption={(opt) => {
                  const typeKey = typeof opt === "string" ? opt : opt?.value;
                  const label = typeof opt === "string" ? opt : opt?.label ?? typeKey;
                  const price = selectedPouchEntry?.types?.[typeKey]?.price;
                  return (
                    <span className="flex items-center justify-between gap-4">
                      <span>{label}</span>
                      <span className="text-xs text-label-3 tabular-nums">
                        {Number.isFinite(price) ? `₹${fmt(price)}/kg` : "-"}
                      </span>
                    </span>
                  );
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="field-label mb-1.5">Qty</p>
              <ChargeQtyInput
                qty={pouchItem.qty}
                onQtyChange={(v) => setChargeItemFields("pouchMakingCharges", { qty: v })}
              />
            </div>
            <div className="min-w-0">
              <p className="field-label mb-1.5">Rate</p>
              <div className="flex items-center input-base p-0 overflow-hidden">
                <span className="px-3 text-label-3 text-sm border-r border-separator shrink-0">₹</span>
                <input
                  type="number"
                  min="0"
                  value={pouchItem.price}
                  onChange={(e) => setChargeItemFields("pouchMakingCharges", { price: e.target.value })}
                  placeholder="0.00"
                  className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none input-no-spinner"
                />
                <span className="px-2 text-label-3 text-xs shrink-0">/kg</span>
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      {/* ── Wastage & Tax ── */}
      <FormSection>
        <SelectField
          label="Wastage"
          placeholder="0"
          inline
          unit="%"
          defaultOptions={["0", "1", "2", "3", "4", "5", "8", "10"]}
          value={form.wastage}
          onChange={(v) => setField("wastage", v)}
        />
        <SelectField
          label="Tax"
          placeholder="18"
          inline
          unit="%"
          storageKey="job-cost-tax"
          defaultOptions={["0", "5", "12", "18", "28"]}
          value={form.tax}
          onChange={(v) => setField("tax", v)}
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
