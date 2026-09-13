import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  fetchFlexoSettings,
  updateFlexoMaterialPrice as apiUpdateMaterialPrice,
  updateFlexoConversionRate as apiUpdateConversion,
  updateFlexoPrintingRate as apiUpdatePrinting,
  updateFlexoGussetRate as apiUpdateGusset,
  updateFlexoCuttingRate as apiUpdateCutting,
  updateFlexoChargeRate as apiUpdateCharge,
  addFlexoPrintingRow as apiAddPrintingRow,
  deleteFlexoPrintingRow as apiDeletePrintingRow,
  toggleFlexoPrintingRow as apiTogglePrintingRow,
  updateFlexoRollSizeRate as apiUpdateRollSizeRate,
  addFlexoRollSizeRow as apiAddRollSizeRow,
  deleteFlexoRollSizeRow as apiDeleteRollSizeRow,
  toggleFlexoRollSizeEnabled as apiToggleRollSizeEnabled,
  fetchFlexoCompanies as apiFetchFlexoCompanies,
  createFlexoCompany as apiCreateFlexoCompany,
  updateFlexoCompanyCharge as apiUpdateFlexoCompanyCharge,
  deleteFlexoCompany as apiDeleteFlexoCompany,
  restoreFlexoCompany as apiRestoreFlexoCompany,
  permanentDeleteFlexoCompany as apiPermanentDeleteFlexoCompany,
  fetchFlexoCompanyCoverSizes as apiFetchCompanyCoverSizes,
  addFlexoCompanyCoverSize as apiAddCompanyCoverSize,
  deleteFlexoCompanyCoverSize as apiDeleteCompanyCoverSize,
  toggleFlexoCompanyCoverSize as apiToggleCompanyCoverSize,
  updateFlexoCompanyCoverSizeRate as apiUpdateCompanyCoverSizeRate,
} from "../utils/settingsApi";
import {
  CONVERSION_RATES,
  PRINTING_RATES,
  GUSSET_RATES,
  CUTTING_RATES,
  PUNCHING_RATE,
  OPACK_RATE,
} from "../constants/flexoRateCalc";

const FlexoSettingsContext = createContext(null);

// ── Helpers — derive current rate from history[0] ──────────────────────────
export function getCurrentRate(rateObj) {
  return rateObj?.history?.[0]?.rate ?? 0;
}

// Roll size options for a material, straight from the live rate table so the
// dropdown can only ever offer sizes that have a rate behind them.
export function getLiveRollSizeOptions(settings, materialType) {
  return Object.entries(settings?.rollSizeRates?.[materialType] ?? {})
    .filter(([, entry]) => entry.enabled !== false)
    .map(([key]) => key)
    .sort((a, b) => parseFloat(a) - parseFloat(b));
}

// ── Fallback settings from constants (used when API unreachable) ───────────
function buildFallbackSettings() {
  const now = new Date().toISOString();
  const entry = (r) => ({
    history: [{ rate: r, changedBy: "System", changedAt: now }],
  });

  const conversionRates = {};
  for (const [mat, sizes] of Object.entries(CONVERSION_RATES)) {
    const rates = {};
    for (const [size, rate] of Object.entries(sizes)) {
      rates[size] = entry(rate);
    }
    conversionRates[mat] = { label: mat, rates };
  }

  const printingRates = {};
  for (const [cover, colors] of Object.entries(PRINTING_RATES)) {
    printingRates[cover] = {};
    for (const [c, rate] of Object.entries(colors)) {
      printingRates[cover][String(c)] = entry(rate);
    }
  }

  const gussetRates = {};
  for (const [cover, rate] of Object.entries(GUSSET_RATES)) {
    gussetRates[cover] = entry(rate);
  }

  const cuttingRates = {};
  for (const [cover, rate] of Object.entries(CUTTING_RATES)) {
    cuttingRates[cover] = entry(rate);
  }

  return {
    materials: {},
    conversionRates,
    printingRates,
    gussetRates,
    cuttingRates,
    punchingRate: {
      label: "Punching",
      unit: "₹/unit",
      history: [{ rate: PUNCHING_RATE, changedBy: "System", changedAt: now }],
    },
    opackRate: {
      label: "Opack",
      unit: "₹/unit",
      history: [{ rate: OPACK_RATE, changedBy: "System", changedAt: now }],
    },
  };
}

// ── Build rates object for calculateFlexoRate ─────────────────────────────
export function buildFlexoRatesFromSettings(settings) {
  const conversionRates = {};
  for (const [mat, { rates }] of Object.entries(settings.conversionRates)) {
    conversionRates[mat] = {};
    for (const [size, cell] of Object.entries(rates)) {
      conversionRates[mat][size] = getCurrentRate(cell);
    }
  }

  const printingRates = {};
  for (const [cover, colors] of Object.entries(settings.printingRates)) {
    printingRates[cover] = {};
    for (const [c, cell] of Object.entries(colors)) {
      if (c === "enabled") continue;
      printingRates[cover][Number(c)] = getCurrentRate(cell);
    }
  }

  const gussetRates = {};
  for (const [cover, cell] of Object.entries(settings.gussetRates)) {
    gussetRates[cover] = getCurrentRate(cell);
  }

  const cuttingRates = {};
  for (const [cover, cell] of Object.entries(settings.cuttingRates)) {
    cuttingRates[cover] = getCurrentRate(cell);
  }

  const rollSizeRates = {};
  for (const [mat, sizes] of Object.entries(settings.rollSizeRates ?? {})) {
    rollSizeRates[mat] = {};
    for (const [size, cell] of Object.entries(sizes)) {
      rollSizeRates[mat][size] = getCurrentRate(cell);
    }
  }

  return {
    conversionRates,
    printingRates,
    gussetRates,
    cuttingRates,
    rollSizeRates,
    punchingRate: getCurrentRate(settings.punchingRate),
    opackRate: getCurrentRate(settings.opackRate),
  };
}

// ── Provider ───────────────────────────────────────────────────────────────
export function FlexoSettingsProvider({ children, skip = false }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(!skip);
  const [companyCoverSizes, setCompanyCoverSizes] = useState({});
  const [pendingCoverSizes, _setPendingCoverSizes] = useState(() => {
    try {
      const stored = localStorage.getItem("flexo-pending-cover-sizes");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const setPendingCoverSizes = useCallback((updater) => {
    _setPendingCoverSizes((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("flexo-pending-cover-sizes", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (skip) return;
    try {
      const data = await fetchFlexoSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch flexo settings:", err);
      setError(err.message);
      setSettings((prev) => prev ?? buildFallbackSettings());
    } finally {
      setLoading(false);
    }
  }, [skip]);

  const fetchCompanies = useCallback(async () => {
    if (skip) return;
    try {
      const data = await apiFetchFlexoCompanies();
      setCompanies(data);
    } catch (err) {
      console.error("Failed to fetch flexo companies:", err);
    } finally {
      setCompaniesLoading(false);
    }
  }, [skip]);

  useEffect(() => {
    if (!skip) refresh();
  }, [refresh, skip]);

  useEffect(() => {
    if (!skip) fetchCompanies();
  }, [fetchCompanies, skip]);

  useEffect(() => {
    const handleUpdate = () => fetchCompanies();
    window.addEventListener("flexo-companies-updated", handleUpdate);
    return () =>
      window.removeEventListener("flexo-companies-updated", handleUpdate);
  }, [fetchCompanies]);

  const updateMaterialPrice = useCallback(async (material, price) => {
    const updated = await apiUpdateMaterialPrice(material, price);
    setSettings((prev) => ({
      ...prev,
      materials: { ...prev.materials, [material]: updated },
    }));
  }, []);

  const updateConversionRate = useCallback(async (material, rollSize, rate) => {
    const updated = await apiUpdateConversion(material, rollSize, rate);
    setSettings((prev) => ({
      ...prev,
      conversionRates: { ...prev.conversionRates, [material]: updated },
    }));
  }, []);

  const updatePrintingRate = useCallback(
    async (coverSize, colorCount, rate) => {
      const updated = await apiUpdatePrinting(coverSize, colorCount, rate);
      setSettings((prev) => ({
        ...prev,
        printingRates: { ...prev.printingRates, [coverSize]: updated },
      }));
    },
    [],
  );

  const updateGussetRate = useCallback(async (coverSize, rate) => {
    const updated = await apiUpdateGusset(coverSize, rate);
    setSettings((prev) => ({ ...prev, gussetRates: updated }));
  }, []);

  const updateCuttingRate = useCallback(async (size, rate) => {
    const updated = await apiUpdateCutting(size, rate);
    setSettings((prev) => ({ ...prev, cuttingRates: updated }));
  }, []);

  const updateChargeRate = useCallback(async (rateKey, rate) => {
    const updated = await apiUpdateCharge(rateKey, rate);
    setSettings((prev) => ({ ...prev, [rateKey]: updated }));
  }, []);

  const addPrintingCoverSize = useCallback(async (coverSize) => {
    const updated = await apiAddPrintingRow(coverSize);
    setSettings((prev) => ({
      ...prev,
      printingRates: updated.printingRates,
      gussetRates: updated.gussetRates,
      cuttingRates: updated.cuttingRates,
    }));
  }, []);

  const deletePrintingCoverSize = useCallback(async (coverSize) => {
    const updated = await apiDeletePrintingRow(coverSize);
    setSettings((prev) => ({
      ...prev,
      printingRates: updated.printingRates,
      gussetRates: updated.gussetRates,
      cuttingRates: updated.cuttingRates,
    }));
  }, []);

  const togglePrintingCoverSize = useCallback(async (coverSize, enabled) => {
    const updated = await apiTogglePrintingRow(coverSize, enabled);
    setSettings((prev) => ({
      ...prev,
      printingRates: updated.printingRates,
      gussetRates: updated.gussetRates,
      cuttingRates: updated.cuttingRates,
    }));
  }, []);

  const updateRollSizeRate = useCallback(async (material, rollSize, rate) => {
    const updated = await apiUpdateRollSizeRate(material, rollSize, rate);
    setSettings((prev) => ({
      ...prev,
      rollSizeRates: { ...prev.rollSizeRates, [material]: updated },
    }));
  }, []);

  const addRollSizeRow = useCallback(async (material, rollSize) => {
    const updated = await apiAddRollSizeRow(material, rollSize);
    setSettings((prev) => ({
      ...prev,
      rollSizeRates: { ...prev.rollSizeRates, [material]: updated },
    }));
  }, []);

  const deleteRollSizeRow = useCallback(async (material, rollSize) => {
    const updated = await apiDeleteRollSizeRow(material, rollSize);
    setSettings((prev) => ({
      ...prev,
      rollSizeRates: { ...prev.rollSizeRates, [material]: updated },
    }));
  }, []);

  const toggleRollSizeEnabled = useCallback(
    async (material, rollSize, enabled) => {
      const updated = await apiToggleRollSizeEnabled(
        material,
        rollSize,
        enabled,
      );
      setSettings((prev) => ({
        ...prev,
        rollSizeRates: { ...prev.rollSizeRates, [material]: updated },
      }));
    },
    [],
  );

  const createCompany = useCallback(async (name) => {
    const created = await apiCreateFlexoCompany(name);
    setCompanies((prev) => [...prev, created]);
    window.dispatchEvent(new CustomEvent("flexo-companies-updated"));
    return created;
  }, []);

  const updateCompanyCharge = useCallback(
    async (companyId, chargeKey, { price, isAvailable }) => {
      const updated = await apiUpdateFlexoCompanyCharge(companyId, chargeKey, {
        price,
        isAvailable,
      });
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? updated : c)),
      );
      window.dispatchEvent(new CustomEvent("flexo-companies-updated"));
      return updated;
    },
    [],
  );

  const deleteCompany = useCallback(async (companyId) => {
    const deleted = await apiDeleteFlexoCompany(companyId);
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? deleted : c)),
    );
    window.dispatchEvent(new CustomEvent("flexo-companies-updated"));
    return deleted;
  }, []);

  const restoreCompany = useCallback(async (companyId) => {
    const restored = await apiRestoreFlexoCompany(companyId);
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? restored : c)),
    );
    window.dispatchEvent(new CustomEvent("flexo-companies-updated"));
    return restored;
  }, []);

  const permanentDeleteCompany = useCallback(async (companyId) => {
    await apiPermanentDeleteFlexoCompany(companyId);
    setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    setCompanyCoverSizes((prev) => {
      const next = { ...prev };
      delete next[companyId];
      return next;
    });
    window.dispatchEvent(new CustomEvent("flexo-companies-updated"));
  }, []);

  const fetchCompanyCoverSizes = useCallback(async (companyId) => {
    if (!companyId) return [];
    const data = await apiFetchCompanyCoverSizes(companyId);
    setCompanyCoverSizes((prev) => ({ ...prev, [companyId]: data }));
    return data;
  }, []);

  const addCompanyCoverSize = useCallback(async (companyId, coverSize) => {
    const updated = await apiAddCompanyCoverSize(companyId, coverSize);
    setCompanyCoverSizes((prev) => ({ ...prev, [companyId]: updated }));
    return updated;
  }, []);

  const deleteCompanyCoverSize = useCallback(async (companyId, id) => {
    const updated = await apiDeleteCompanyCoverSize(companyId, id);
    setCompanyCoverSizes((prev) => ({ ...prev, [companyId]: updated }));
    return updated;
  }, []);

  const toggleCompanyCoverSize = useCallback(
    async (companyId, id, enabled) => {
      const updated = await apiToggleCompanyCoverSize(companyId, id, enabled);
      setCompanyCoverSizes((prev) => ({ ...prev, [companyId]: updated }));
      return updated;
    },
    [],
  );

  const updateCompanyCoverSizeRate = useCallback(
    async (companyId, id, fields) => {
      const updated = await apiUpdateCompanyCoverSizeRate(
        companyId,
        id,
        fields,
      );
      setCompanyCoverSizes((prev) => ({
        ...prev,
        [companyId]: (prev[companyId] ?? []).map((cs) =>
          cs.id === id ? updated : cs,
        ),
      }));
      return updated;
    },
    [],
  );

  const value = {
    settings,
    loading,
    error,
    refresh,
    updateMaterialPrice,
    updateConversionRate,
    updatePrintingRate,
    updateGussetRate,
    updateCuttingRate,
    updateChargeRate,
    addPrintingCoverSize,
    deletePrintingCoverSize,
    togglePrintingCoverSize,
    updateRollSizeRate,
    addRollSizeRow,
    deleteRollSizeRow,
    toggleRollSizeEnabled,
    companies,
    companiesLoading,
    fetchCompanies,
    createCompany,
    updateCompanyCharge,
    deleteCompany,
    restoreCompany,
    permanentDeleteCompany,
    companyCoverSizes,
    pendingCoverSizes,
    setPendingCoverSizes,
    fetchCompanyCoverSizes,
    addCompanyCoverSize,
    deleteCompanyCoverSize,
    toggleCompanyCoverSize,
    updateCompanyCoverSizeRate,
  };

  return (
    <FlexoSettingsContext.Provider value={value}>
      {children}
    </FlexoSettingsContext.Provider>
  );
}

export function useFlexoSettings() {
  const ctx = useContext(FlexoSettingsContext);
  if (!ctx) {
    throw new Error(
      "useFlexoSettings must be used within FlexoSettingsProvider",
    );
  }
  return ctx;
}
