#!/usr/bin/env node

import * as esbuild from "esbuild";
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = resolve(rootDir, "dist");

// Check for watch mode
const isWatch = process.argv.includes("--watch");

console.log(`Building in ${isWatch ? "watch" : "production"} mode...`);

// Build options - always optimized for production
const buildOptions = {
  entryPoints: [resolve(rootDir, "src/main.ts")],
  bundle: true,
  outfile: resolve(distDir, "main.js"),
  format: "esm",
  target: "es2020",
  platform: "browser",
  sourcemap: true,
  metafile: true,
  treeShaking: true,
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    __DEV__: "false",
  },
  alias: {
    "oauth-handler": resolve(rootDir, "src/oauth-handler.ts"),
    "@app/shared": resolve(rootDir, "shared"),
  },
  loader: {
    ".ts": "ts",
    ".css": "css",
    ".svg": "dataurl",
  },
  resolveExtensions: [".ts", ".js", ".json"],
  banner: {
    js: `// Build: ${new Date().toISOString()}`,
  },
  drop: ["console", "debugger"],
  pure: ["console.log", "console.debug"],
};

// Simplified copy function
function copyAssets() {
  // Ensure dist directory exists
  mkdirSync(distDir, { recursive: true });

  const copyTasks = [
    // Main index.html
    { src: "index.html", dest: "dist/index.html" },
    // OAuth callback (with directory creation)
    {
      src: "src/oauth-callback.html",
      dest: "dist/oauth-callback/index.html",
      createDir: "dist/oauth-callback",
    },
  ];

  // Execute copy tasks using readFile/writeFile for better reliability
  copyTasks.forEach(({ src, dest, createDir }) => {
    const srcPath = resolve(rootDir, src);
    const destPath = resolve(rootDir, dest);

    if (existsSync(srcPath)) {
      try {
        if (createDir) {
          mkdirSync(resolve(rootDir, createDir), { recursive: true });
        }

        // Use readFileSync/writeFileSync instead of cpSync for HTML files
        const content = readFileSync(srcPath, "utf8");
        writeFileSync(destPath, content, "utf8");
        console.log(`✓ Copied ${src} → ${dest}`);
      } catch (error) {
        console.error(`Failed to copy ${src}:`, error.message);
      }
    }
  });

  // Copy assets directory if it exists
  const assetsSource = resolve(rootDir, "assets");
  if (existsSync(assetsSource)) {
    try {
      cpSync(assetsSource, resolve(distDir, "assets"), {
        recursive: true,
        force: true,
      });
      console.log("✓ Assets copied");
    } catch (error) {
      console.warn("Warning: Could not copy assets:", error.message);
    }
  }
}

// Build function
async function build() {
  try {
    // Copy assets first
    copyAssets();

    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("✓ Watching for changes...");
    } else {
      const result = await esbuild.build(buildOptions);

      // Output build size
      if (result.metafile) {
        const output = result.metafile.outputs[resolve(distDir, "main.js")];
        if (output) {
          console.log(
            `✓ Built main.js (${(output.bytes / 1024).toFixed(2)} KB)`
          );
        }
      }

      console.log("✓ Build completed successfully");
    }
  } catch (error) {
    console.error("✗ Build failed:", error);
    process.exit(1);
  }
}

// Run build
build();
