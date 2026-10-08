import { useEffect } from "react"
import { I18nContext } from "./i18n-context.js"
import { localSet } from "./platform.js"
import { useStoredValue } from "./hooks/useStoredValue.js"
import { translations } from "./locales/translations.js"

const normalizeLanguage = (value) => (value === "es" ? "es" : "en")

export function I18nProvider({ children }) {
  const { value: lang } = useStoredValue("language", "en", normalizeLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  function changeLang(newLang) {
    if (newLang !== "es" && newLang !== "en") return
    localSet({ language: newLang }).catch(console.error)
  }

  function t(key, ...args) {
    const val = translations[lang]?.[key] ?? translations.en[key] ?? key
    return typeof val === "function" ? val(...args) : val
  }

  return <I18nContext.Provider value={{ lang, changeLang, t }}>{children}</I18nContext.Provider>
}
