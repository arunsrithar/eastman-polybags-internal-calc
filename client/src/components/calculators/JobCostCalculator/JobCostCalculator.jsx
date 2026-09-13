import CalculatorHeader from "../../layout/CalculatorHeader";
import { JobCostIcon } from "../../ui/Icons";
import JobCostForm from "./JobCostForm";
import JobCostResult from "./JobCostResult";
import JobCostPrintLayout from "./JobCostPrintLayout";
import { makeInitialForm } from "./formConfig";
import { calculateJobCost } from "../../../utils/calculators/jobCost";
import useCalculator from "../../../hooks/useCalculator";
import { useAuth } from "../../../context/AuthContext";
import {
  useGravureSettings,
  buildRatesFromSettings,
} from "../../../context/GravureSettingsContext";

const buildPayload = (name, form, calc) => ({
  quoteName: name,
  pricePerKg: calc.costOfJob,
  form: { ...form, quoteName: name },
});

export default function JobCostCalculator() {
  const { canSaveQuote } = useAuth();
  const { settings, companies, loading, companiesLoading } = useGravureSettings();

  const rates = settings ? buildRatesFromSettings(settings) : null;

  const {
    form,
    result,
    saveError,
    formRef,
    toast,
    quoteId,
    handleFormChange,
    handleSave,
    handleReset,
    handlePrint,
  } = useCalculator({
    calcKey: "job-cost",
    calculateFn: calculateJobCost,
    makeInitialForm: () => makeInitialForm(rates, settings),
    buildPayload,
    toastMessage: "Saved the job cost calculation successfully",
  });

  if (loading || companiesLoading) {
    return (
      <div className="calc-shell flex items-center justify-center min-h-[40vh]">
        <div className="text-label-3 text-sm animate-pulse">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="calc-shell">
      {toast}
      <CalculatorHeader
        icon={JobCostIcon}
        title="Job Cost Calculator"
        subtitle="Calculate total job cost and cost per kg"
        onSave={canSaveQuote("job-cost") ? handleSave : null}
        onPrint={handlePrint}
        onReset={handleReset}
      />

      {/* 2-column layout: form | breakdown */}
      <div className="calc-grid">
        {/* Left — Form */}
        <div className="calc-column">
          <JobCostForm
            ref={formRef}
            onProceed={handleFormChange}
            saveError={saveError}
            quoteId={quoteId}
          />
        </div>

        {/* Right — Breakdown */}
        <div className="calc-column" data-print-area>
          <div className="print:hidden">
            <JobCostResult result={result} form={form} />
          </div>
          <JobCostPrintLayout result={result} form={form} />
        </div>
      </div>
    </div>
  );
}
