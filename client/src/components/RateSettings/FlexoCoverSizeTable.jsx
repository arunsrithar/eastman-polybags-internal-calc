import { useEffect, useMemo, useState } from "react";
import { useFlexoSettings } from "../../context/FlexoSettingsContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import { compareDimensions } from "../../utils/dimensionUtils";
import { PRINTING_COL_KEYS } from "./flexoSettingsConfig";
import FlexoSizeListColumn from "./flexoCoverSize/FlexoSizeListColumn";
import FlexoCompanyColumn from "./flexoCoverSize/FlexoCompanyColumn";
import FlexoRatesColumn from "./flexoCoverSize/FlexoRatesColumn";

function buildDrafts(coverSize) {
  if (!coverSize) return {};
  const drafts = {
    gusset: String(coverSize.gussetRate?.price ?? 0),
    cutting: String(coverSize.cuttingRate?.price ?? 0),
  };
  for (const colorCount of PRINTING_COL_KEYS) {
    drafts[`printing:${colorCount}`] = String(
      coverSize.printingColors?.[colorCount]?.price ?? 0,
    );
  }
  return drafts;
}

export default function FlexoCoverSizeTable() {
  const {
    companies,
    companyCoverSizes,
    pendingCoverSizes,
    setPendingCoverSizes,
    fetchCompanyCoverSizes,
    addCompanyCoverSize,
    deleteCompanyCoverSize,
    toggleCompanyCoverSize,
    updateCompanyCoverSizeRate,
  } = useFlexoSettings();
  const { canEditPrices } = useAuth();
  const canEdit = canEditPrices("flexo");
  const [toast, showToast] = useToast();

  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [addingSize, setAddingSize] = useState(false);
  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [rateDrafts, setRateDrafts] = useState({});

  const activeCompanies = useMemo(
    () => (companies ?? []).filter((c) => c.isActive !== false),
    [companies],
  );

  useEffect(() => {
    for (const c of activeCompanies) {
      fetchCompanyCoverSizes(c.id);
    }
  }, [activeCompanies, fetchCompanyCoverSizes]);

  const serverSizes = useMemo(() => {
    const sizeSet = new Set();
    for (const compId of Object.keys(companyCoverSizes)) {
      for (const cs of companyCoverSizes[compId] ?? []) {
        sizeSet.add(cs.coverSize);
      }
    }
    return sizeSet;
  }, [companyCoverSizes]);

  useEffect(() => {
    setPendingCoverSizes((prev) => prev.filter((s) => !serverSizes.has(s)));
  }, [serverSizes, setPendingCoverSizes]);

  const distinctSizes = useMemo(() => {
    const merged = new Set([...serverSizes, ...pendingCoverSizes]);
    return [...merged].sort(compareDimensions);
  }, [serverSizes, pendingCoverSizes]);

  const companiesForSize = useMemo(() => {
    if (!selectedSize) return [];
    const result = [];
    for (const company of activeCompanies) {
      const csEntries = companyCoverSizes[company.id] ?? [];
      const entry = csEntries.find((cs) => cs.coverSize === selectedSize);
      if (entry) {
        result.push({ company, coverSizeEntry: entry });
      }
    }
    return result;
  }, [selectedSize, activeCompanies, companyCoverSizes]);

  const unassignedCompanies = useMemo(() => {
    if (!selectedSize) return [];
    const assignedIds = new Set(companiesForSize.map((c) => c.company.id));
    return activeCompanies.filter((c) => !assignedIds.has(c.id));
  }, [selectedSize, companiesForSize, activeCompanies]);

  const selectedEntry = useMemo(() => {
    if (!selectedCompanyId || !selectedSize) return null;
    return companiesForSize.find((c) => c.company.id === selectedCompanyId)?.coverSizeEntry ?? null;
  }, [selectedCompanyId, selectedSize, companiesForSize]);

  useEffect(() => {
    setRateDrafts(buildDrafts(selectedEntry));
  }, [selectedEntry]);

  function closeAddSize() {
    setAddingSize(false);
    setWidthInput("");
    setHeightInput("");
  }

  function handleAddSize() {
    const width = widthInput.trim();
    const height = heightInput.trim();
    if (!canEdit || !width || !height) return;
    const coverSize = `${width}x${height}`;
    if (distinctSizes.includes(coverSize)) {
      setSelectedSize(coverSize);
      closeAddSize();
      return;
    }
    setPendingCoverSizes((prev) => [...prev, coverSize]);
    showToast("Cover Size Added", `"${width} x ${height}" added`);
    setSelectedSize(coverSize);
    setSelectedCompanyId(null);
    closeAddSize();
  }

  function handleSizeInputKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddSize();
      return;
    }
    if (event.key === "Escape") {
      closeAddSize();
    }
  }

  async function handleDeleteSize(size) {
    if (!canEdit) return;
    if (pendingCoverSizes.includes(size)) {
      setPendingCoverSizes((prev) => prev.filter((s) => s !== size));
      if (selectedSize === size) {
        setSelectedSize(null);
        setSelectedCompanyId(null);
      }
      showToast("Cover Size Removed", `"${size}" removed`);
      return;
    }
    const entries = [];
    for (const company of activeCompanies) {
      const csEntries = companyCoverSizes[company.id] ?? [];
      const entry = csEntries.find((cs) => cs.coverSize === size);
      if (entry) entries.push({ companyId: company.id, entryId: entry.id });
    }
    try {
      for (const { companyId, entryId } of entries) {
        await deleteCompanyCoverSize(companyId, entryId);
      }
      if (selectedSize === size) {
        setSelectedSize(null);
        setSelectedCompanyId(null);
      }
      showToast("Cover Size Removed", `"${size}" and all company assignments removed`);
    } catch (err) {
      showToast("Delete Failed", err.message, "error");
    }
  }

  async function handleAddCompanyToSize(companyId) {
    if (!selectedSize || !canEdit) return;
    try {
      await addCompanyCoverSize(companyId, selectedSize);
      setSelectedCompanyId(companyId);
      showToast("Company Added", `Company assigned to ${selectedSize}`);
    } catch (err) {
      showToast("Failed to Add", err.message, "error");
    }
  }

  async function handleDeleteCompanyFromSize(companyId) {
    if (!selectedSize || !canEdit) return;
    const entry = companiesForSize.find((c) => c.company.id === companyId)?.coverSizeEntry;
    if (!entry) return;
    try {
      await deleteCompanyCoverSize(companyId, entry.id);
      if (selectedCompanyId === companyId) setSelectedCompanyId(null);
      showToast("Company Removed", "Company removed from this cover size");
    } catch (err) {
      showToast("Delete Failed", err.message, "error");
    }
  }

  async function handleToggleCompany(companyId, enabled) {
    if (!selectedSize || !canEdit) return;
    const entry = companiesForSize.find((c) => c.company.id === companyId)?.coverSizeEntry;
    if (!entry) return;
    try {
      await toggleCompanyCoverSize(companyId, entry.id, enabled);
    } catch (err) {
      showToast("Update Failed", err.message, "error");
    }
  }

  async function updateRate(patch) {
    if (!selectedCompanyId || !selectedEntry || !canEdit) return;
    try {
      await updateCompanyCoverSizeRate(selectedCompanyId, selectedEntry.id, patch);
    } catch (err) {
      showToast("Update Failed", err.message, "error");
    }
  }

  function handleChangeDraft(key, value) {
    setRateDrafts((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCommitDraft(key, patch, rawValue) {
    const price = Number(rawValue);
    if (!Number.isFinite(price) || price < 0) {
      setRateDrafts(buildDrafts(selectedEntry));
      return;
    }
    await updateRate({ ...patch, price });
  }

  async function handleToggleRate(key, patch, isAvailable) {
    await updateRate({ ...patch, isAvailable });
  }

  return (
    <>
      {toast}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0">
        <FlexoSizeListColumn
          canEdit={canEdit}
          coverSizes={distinctSizes}
          selectedSize={selectedSize}
          onSelectSize={(size) => {
            setSelectedSize(size);
            setSelectedCompanyId(null);
          }}
          onDeleteSize={handleDeleteSize}
          addingSize={addingSize}
          onStartAdd={() => setAddingSize(true)}
          widthInput={widthInput}
          heightInput={heightInput}
          onWidthChange={setWidthInput}
          onHeightChange={setHeightInput}
          onSizeInputKeyDown={handleSizeInputKeyDown}
          onConfirmAdd={handleAddSize}
          onCancelAdd={closeAddSize}
        />

        <FlexoCompanyColumn
          selectedSize={selectedSize}
          companiesForSize={companiesForSize}
          unassignedCompanies={unassignedCompanies}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={setSelectedCompanyId}
          onAddCompany={handleAddCompanyToSize}
          onDeleteCompany={handleDeleteCompanyFromSize}
          onToggleCompany={handleToggleCompany}
          canEdit={canEdit}
        />

        <FlexoRatesColumn
          selectedCoverSize={selectedEntry}
          selectedCompanyName={companiesForSize.find((c) => c.company.id === selectedCompanyId)?.company?.name}
          selectedSizeLabel={selectedSize}
          canEdit={canEdit}
          rateDrafts={rateDrafts}
          onChangeDraft={handleChangeDraft}
          onCommitDraft={handleCommitDraft}
          onToggleRate={handleToggleRate}
        />
      </div>
    </>
  );
}
