import { useState, useEffect } from "react";
import { getCustomerNames } from "../utils/quotesApi";

export default function useCustomerNames() {
  const [names, setNames] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getCustomerNames()
      .then((list) => {
        if (!cancelled) setNames(list.sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return names;
}
