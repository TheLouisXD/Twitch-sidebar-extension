import { execSync } from "node:child_process"
import { mkdirSync, existsSync, statSync, readFileSync } from "node:fs"
import { resolve, join } from "node:path"
import { createHash } from "node:crypto"

const root = resolve(import.meta.dirname, "..")
const releaseDir = join(root, "release")

if (!existsSync(releaseDir)) {
  mkdirSync(releaseDir, { recursive: true })
}

const chromeManifest = JSON.parse(
  readFileSync(join(root, "manifests", "manifest.chrome.json"), "utf8")
)
const version = chromeManifest.version || "1.0"

function sha256(filePath) {
  const fileBuffer = readFileSync(filePath)
  return createHash("sha256").update(fileBuffer).digest("hex")
}

const shouldBuild = !process.argv.includes("--no-build") && !process.env.SKIP_BUILD

if (shouldBuild) {
  console.log("==> 1. Compilando extensiones para Chrome y Firefox...")
  execSync("npm run build:all", { cwd: root, stdio: "inherit" })
} else {
  console.log("==> 1. Omitiendo compilación (ya compilado con npm run build:all)...")
}

console.log(`\n==> 2. Empaquetando para Chrome Web Store (v${version})...`)
const chromeDist = join(root, "dist-chrome")
const chromeZipRelease = join(releaseDir, `twitch-live-sidebar-chrome-v${version}.zip`)
const chromeZipRoot = join(root, `twitch-live-sidebar-v${version}.zip`)

// Crear ZIP con los contenidos de dist-chrome en la raíz del archivo
execSync(`tar -a -c -f "${chromeZipRelease}" *`, { cwd: chromeDist })
execSync(`tar -a -c -f "${chromeZipRoot}" *`, { cwd: chromeDist })

console.log(`\n==> 3. Empaquetando para Firefox Add-ons (AMO) (v${version})...`)
const firefoxDist = join(root, "dist-firefox")
const firefoxZipRelease = join(releaseDir, `twitch-live-sidebar-firefox-v${version}.zip`)
const firefoxZipRoot = join(root, `twitch-live-sidebar-firefox-v${version}.zip`)

execSync(`tar -a -c -f "${firefoxZipRelease}" *`, { cwd: firefoxDist })
execSync(`tar -a -c -f "${firefoxZipRoot}" *`, { cwd: firefoxDist })

console.log(`\n==> 4. Empaquetando código fuente para Mozilla AMO (v${version})...`)
const sourceZipRelease = join(releaseDir, `twitch-live-sidebar-firefox-v${version}-SOURCE.zip`)
const sourceZipRoot = join(root, `twitch-live-sidebar-firefox-v${version}-SOURCE.zip`)

// Incluir archivos fuente para que revisores de Mozilla puedan reproducir el build
const sourceFiles = [
  "src",
  "public",
  "manifests",
  "tests",
  "index.html",
  "vite.config.js",
  "eslint.config.js",
  "package.json",
  "package-lock.json",
  "BUILD.md",
  "README.md",
  "LICENSE",
  ".prettierrc.json"
]
execSync(`tar -a -c -f "${sourceZipRelease}" ${sourceFiles.join(" ")}`, { cwd: root })
execSync(`tar -a -c -f "${sourceZipRoot}" ${sourceFiles.join(" ")}`, { cwd: root })

console.log("\n==> 5. Verificando paquetes creados:")
const packages = [
  { name: `Chrome Web Store ZIP (v${version})`, path: chromeZipRelease },
  { name: `Firefox AMO ZIP (v${version})`, path: firefoxZipRelease },
  { name: `Firefox Source ZIP (v${version})`, path: sourceZipRelease }
]

for (const pkg of packages) {
  const stats = statSync(pkg.path)
  const hash = sha256(pkg.path)
  console.log(`\n📦 ${pkg.name}:`)
  console.log(`   Ruta:   ${pkg.path}`)
  console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`)
  console.log(`   SHA256: ${hash}`)

  // Verificar que el zip no esté vacío y contenga manifest.json si no es fuente
  const listing = execSync(`tar -tf "${pkg.path}"`, { encoding: "utf8" })
  const files = listing.trim().split(/\r?\n/)
  console.log(`   Archivos contenidos: ${files.length}`)
  if (!pkg.name.includes("Source")) {
    const hasManifest = files.includes("manifest.json")
    const hasBackground = files.includes("background.js")
    const hasIndex = files.includes("index.html")
    if (!hasManifest || !hasBackground || !hasIndex) {
      throw new Error(`¡Falta archivo crítico en ${pkg.name}!`)
    }
    console.log(`   Estructura: Correcta (manifest.json, background.js, index.html en la raíz)`)
  }
}

console.log("\n✅ ¡Todos los paquetes se generaron y verificaron con éxito!")
