import { Languages } from "lucide-react";
import { languages } from "../lib/i18n";

export function LanguageToggle({ language, onLanguageChange, t }) {
  return (
    <div className="language-toggle" aria-label={t("language.label")}>
      <Languages size={16} />
      {languages.map((item) => (
        <button
          className={language === item.code ? "active" : ""}
          key={item.code}
          onClick={() => onLanguageChange(item.code)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
