let currentLanguage = "uz";
export function setTextLanguage(language) { currentLanguage = language === "ru" ? "ru" : "uz"; }
export function getTextLanguage() { return currentLanguage; }
