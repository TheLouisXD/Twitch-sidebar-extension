import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { ACCENTS } from "../src/preferences.js"

const root = fileURLToPath(new URL("../", import.meta.url))
const readCss = (file) => readFileSync(`${root}/src/${file}`, "utf8")

const gxChromeFiles = [
  "pages/MainPage.css",
  "pages/SettingsPage.css",
  "components/SearchBar.css",
  "components/TwitchCard.css"
]
const gxAccentLiterals =
  /#fa1e4e|#a01231|#1f060b|#ff3b68|rgba\(\s*250,\s*30,\s*78|rgba\(\s*160,\s*18,\s*49/i

test("GX chrome follows the selected accent instead of the original red literals", () => {
  for (const file of gxChromeFiles) {
    const css = readCss(file)
    assert.doesNotMatch(css, gxAccentLiterals, `${file} still hardcodes the GX red palette`)
    assert.match(css, /var\(--tw-accent(?:-dark|-deep)?\)/, `${file} does not use accent variables`)
  }

  const themesCss = readCss("pages/ThemesPage.css")
  assert.match(themesCss, /linear-gradient\(var\(--tw-accent-dark\), var\(--tw-accent-deep\)\)/)

  const indexCss = readCss("index.css")
  assert.match(indexCss, /--tw-border:\s*var\(--tw-accent-dark\)/)
  assert.match(indexCss, /--tw-overlay-subtle:\s*color-mix\(in srgb, var\(--tw-accent\)/)
})

test("every accent defines a distinct deep tone for GX gradients", () => {
  const deepTones = ACCENTS.map((accent) => accent.vars["--tw-accent-deep"])
  assert.equal(new Set(deepTones).size, ACCENTS.length)
  for (const tone of deepTones) assert.match(tone, /^#[0-9a-f]{6}$/i)
})

test("Aero theme styles cover core views and respect light color-scheme", () => {
  const indexCss = readCss("index.css")
  assert.match(indexCss, /\[data-theme="aero"\]\s*\{[\s\S]*color-scheme:\s*light;/)

  for (const file of [
    "pages/MainPage.css",
    "pages/SettingsPage.css",
    "pages/ThemesPage.css",
    "pages/NotificationsPage.css",
    "pages/LoginPage.css",
    "components/SearchBar.css",
    "components/TwitchCard.css",
    "components/SessionStatus.css"
  ]) {
    const css = readCss(file)
    assert.match(css, /\[data-theme="aero"\]/, `${file} is missing Aero theme rules`)
  }
})

test("favorite star button is top-right and hover-to-reveal while keeping active favorites visible", () => {
  const cardCss = readCss("components/TwitchCard.css")
  assert.match(
    cardCss,
    /\.tc-star-btn\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*4px;[\s\S]*right:\s*4px;/
  )
  assert.match(cardCss, /\.tc-star-btn\s*\{[\s\S]*opacity:\s*0;/)
  assert.match(cardCss, /\.tc-card:hover\s+\.tc-star-btn/)
  assert.match(cardCss, /\.tc-card:focus-within\s+\.tc-star-btn/)
  assert.match(cardCss, /\.tc-star-btn--active\s*\{[\s\S]*opacity:\s*1;/)
})
