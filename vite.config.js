import { defineConfig, build } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"
import { copyFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const target = process.env.BROWSER_TARGET || "chrome"
if (!["chrome", "firefox"].includes(target)) throw new Error(`Unsupported browser: ${target}`)
const root = fileURLToPath(new URL(".", import.meta.url))
const outDir = resolve(root, `dist-${target}`)
const jsTarget = target === "firefox" ? "firefox115" : "chrome116"

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "build-browser-extension",
      apply: "build",
      async closeBundle() {
        // A standalone classic script works in Firefox background.scripts and
        // Chrome service_worker. Shared modules are bundled without imports.
        await build({
          configFile: false,
          root,
          publicDir: false,
          build: {
            outDir,
            emptyOutDir: false,
            target: jsTarget,
            minify: false,
            lib: {
              entry: resolve(root, "src/background.js"),
              name: "TwitchSidebarBackground",
              formats: ["iife"],
              fileName: () => "background.js"
            }
          }
        })
        copyFileSync(
          resolve(root, `manifests/manifest.${target}.json`),
          resolve(outDir, "manifest.json")
        )
      }
    }
  ],
  build: { outDir, emptyOutDir: true, target: jsTarget }
})
