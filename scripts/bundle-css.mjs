#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// Ensure dist directory exists
const distDir = resolve(rootDir, "dist");
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

async function bundleCSS() {
  try {
    // Find all CSS module files
    const cssFiles = await glob("src/**/*.module.css", {
      cwd: rootDir,
      absolute: true,
    });

    console.log(`Found ${cssFiles.length} CSS module files`);

    let bundledCSS = "";

    // Process each CSS file
    for (const file of cssFiles) {
      const content = readFileSync(file, "utf-8");
      const relativePath = file.replace(rootDir, "").replace(/\\/g, "/");

      bundledCSS += `/* Source: ${relativePath} */\n`;
      bundledCSS += content;
      bundledCSS += "\n\n";
    }

    // Also include the main app.module.css
    const appCSSPath = resolve(rootDir, "src/app.module.css");
    if (existsSync(appCSSPath) && !cssFiles.includes(appCSSPath)) {
      const appCSS = readFileSync(appCSSPath, "utf-8");
      bundledCSS = `/* Source: /src/app.module.css */\n${appCSS}\n\n${bundledCSS}`;
    }

    // Write bundled CSS
    const outputPath = resolve(distDir, "styles.css");
    writeFileSync(outputPath, bundledCSS);

    console.log(`CSS bundled to: ${outputPath}`);
  } catch (error) {
    console.error("CSS bundling failed:", error);
    process.exit(1);
  }
}

// Check if glob is installed, if not, use a simple alternative
async function checkGlob() {
  try {
    await import("glob");
    return true;
  } catch {
    // Install glob if not present
    console.log("Installing glob for CSS bundling...");
    const { execSync } = await import("child_process");
    execSync("npm install --save-dev glob", { stdio: "inherit" });
    return true;
  }
}

// Run bundling
checkGlob().then(() => bundleCSS());
