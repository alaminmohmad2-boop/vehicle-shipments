import { CURRENCIES } from "@/lib/shipping";

/** Suggestions (USD, SDG and others) for any input with list="currency-codes". */
export function CurrencyList() {
  return (
    <datalist id="currency-codes">
      {CURRENCIES.map((code) => (
        <option key={code} value={code} />
      ))}
    </datalist>
  );
}
