import { translateText as tx } from "../locales/translateText";
import { useLanguage as useUILanguage } from "../context/LanguageContext";
import { IMaskInput } from "react-imask";

/**
 * Telefon raqami uchun input — kutubxona (react-imask) orqali maska qo'yilgan.
 * Faqat raqam kiritiladi, harf yozib bo'lmaydi. Format: +998 90 123 45 67
 */
export default function PhoneInput({ value, onChange, placeholder = "+998 90 123 45 67", ...rest }) {
  useUILanguage();
  const digits = String(value || "").replace(/\D/g, "");
  const displayValue = digits.length === 9 && !String(value).startsWith("+")
    ? `+998${digits}` : (value || "");
  return (
    <IMaskInput
      mask="+{998} 00 000 00 00"
      lazy={false}
      placeholderChar="_"
      unmask={false}
      inputMode="tel"
      type="tel"
      value={displayValue}
      onPaste={(event) => {
        const pasted = event.clipboardData.getData("text").trim();
        const pastedDigits = pasted.replace(/\D/g, "");
        if (pastedDigits.length === 9 && !pasted.startsWith("+")) {
          event.preventDefault();
          onChange?.(`+998${pastedDigits}`);
        }
      }}
      onAccept={(val) => onChange && onChange(val)}
      placeholder={tx(placeholder)}
      className="input-base"
      style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}
      {...rest}
    />
  );
}
