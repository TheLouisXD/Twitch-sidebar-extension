import { createContext, useContext } from "react"

export const I18nContext = createContext()
export function useI18n() {
  return useContext(I18nContext)
}
