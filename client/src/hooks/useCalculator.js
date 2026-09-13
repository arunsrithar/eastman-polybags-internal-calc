import { useState, useRef, useEffect } from "react";
import { saveQuote } from "../utils/quoteStorage";
import { getNextQuoteId } from "../utils/quotesApi";
import { useToast } from "../components/ui/Toast";

/**
 * useCalculator — shared state + handlers for all calculator containers.
 *
 * Encapsulates: form state, result calculation, save validation,
 * quote storage (async — local or remote), toast notifications,
 * form reset, and print.
 *
 * @param {object}   options
 * @param {string}   options.calcKey        — quote storage key
 * @param {Function} options.calculateFn    — pure calculation function (form → result | null)
 * @param {Function} options.makeInitialForm — form state factory
 * @param {Function} options.buildPayload   — (name, form, calc) → save payload object
 * @param {string}   options.toastMessage   — toast body text on save
 */
export default function useCalculator({
  calcKey,
  calculateFn,
  makeInitialForm,
  buildPayload,
  toastMessage,
}) {
  const [form, setForm] = useState(() => makeInitialForm());
  const [result, setResult] = useState(() => calculateFn(makeInitialForm()));
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [quoteId, setQuoteId] = useState("");
  const formRef = useRef(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    getNextQuoteId(calcKey).then(setQuoteId).catch(() => {});
  }, [calcKey]);

  function handleFormChange(formData) {
    setForm(formData);
    setResult(calculateFn(formData));
    setSaveError(null);
  }

  async function handleSave() {
    if (saving) return;

    const name = form.quoteName.trim();
    if (!name) {
      setSaveError("Enter a customer name before saving.");
      return;
    }

    const calc = calculateFn(form);
    if (!calc) {
      setSaveError("Fill in required fields before saving.");
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      await saveQuote(calcKey, buildPayload(name, form, calc));
      window.dispatchEvent(
        new CustomEvent("quotes-updated", { detail: calcKey }),
      );
      showToast(name, toastMessage);
      formRef.current?.reset();
      getNextQuoteId(calcKey).then(setQuoteId).catch(() => {});
    } catch (err) {
      setSaveError(
        err?.message ? `Couldn't save — ${err.message}` : "Couldn't save — try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    formRef.current?.reset();
  }

  function handlePrint() {
    window.print();
  }

  return {
    form,
    result,
    saveError,
    saving,
    formRef,
    toast,
    quoteId,
    handleFormChange,
    handleSave,
    handleReset,
    handlePrint,
  };
}
