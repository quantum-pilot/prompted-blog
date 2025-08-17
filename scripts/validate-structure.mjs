#!/usr/bin/env node

/**
 * Repository structure validation script
 * Enforces separation between styles and debugger agents
 * Validates file line limits per agent specifications
 */

import fs from "fs";
import path from "path";

const RULES = {
  e2e: {
    styles: /^[a-z-]+-styles\.spec\.ts$/,
    bugs: /^[a-z-]+-bug-[a-z0-9-]+\.spec\.ts$/,
    flows: /^[a-z-]+-flow\.spec\.ts$/,
  },
  components: {
    structure: {
      required: ["index.ts"],
      optional: ["*.module.css", "__tests__/*.test.ts"],
    },
  },
  lineLimits: {
    component: 100, // Components: ≤100 TS lines
    styles: 100, // CSS modules: ≤100 lines
    worker: 100, // Cloudflare workers: ≤100 TS lines
    test: 100, // Tests: aim for ≤100 lines
    utils: 100, // Foundation utilities: ≤100 lines
  },
};

class StructureValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  countCodeLines(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Count non-empty, non-comment lines for more accurate measurement
    let codeLines = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Handle block comments
      if (trimmed.startsWith("/*")) {
        inBlockComment = true;
      }
      if (inBlockComment) {
        if (trimmed.endsWith("*/")) {
          inBlockComment = false;
        }
        continue;
      }

      // Skip single-line comments
      if (trimmed.startsWith("//")) continue;

      // For CSS, skip pure comment lines
      if (
        filePath.endsWith(".css") &&
        trimmed.startsWith("/*") &&
        trimmed.endsWith("*/")
      ) {
        continue;
      }

      codeLines++;
    }

    return { total: lines.length, code: codeLines };
  }

  validateFileLength(filePath, maxLines, fileType) {
    const { total, code } = this.countCodeLines(filePath);
    const relativePath = path.relative(process.cwd(), filePath);

    if (code > maxLines) {
      this.errors.push(
        `${relativePath}: Exceeds ${fileType} line limit\n` +
          `  Code lines: ${code} (max: ${maxLines})\n` +
          `  Total lines: ${total}\n` +
          `  Action: Split into smaller modules`
      );
    } else if (code > maxLines * 0.9) {
      this.warnings.push(
        `${relativePath}: Approaching ${fileType} line limit (${code}/${maxLines} lines)`
      );
    }
  }

  validateE2ETests() {
    const e2ePath = path.join(process.cwd(), "e2e");
    if (!fs.existsSync(e2ePath)) return;

    const files = fs.readdirSync(e2ePath).filter((f) => f.endsWith(".spec.ts"));

    files.forEach((file) => {
      const filePath = path.join(e2ePath, file);
      const isStyles = RULES.e2e.styles.test(file);
      const isBug = RULES.e2e.bugs.test(file);
      const isFlow = RULES.e2e.flows.test(file);

      if (!isStyles && !isBug && !isFlow) {
        this.errors.push(
          `Invalid e2e test naming: ${file}\n` +
            `  Must match one of:\n` +
            `    - *-styles.spec.ts (visual tests by styles agent)\n` +
            `    - *-bug-<id>.spec.ts (bug fixes by frontend-debugger)\n` +
            `    - *-flow.spec.ts (general e2e tests)`
        );
      }

      // Check file content for agent metadata
      const content = fs.readFileSync(filePath, "utf8");
      const firstLine = content.split("\n")[0];

      if (isStyles && !firstLine.includes("@agent: styles")) {
        this.errors.push(
          `${file}: Must start with '// @agent: styles' metadata comment`
        );
      }
      if (isBug && !firstLine.includes("@agent: frontend-debugger")) {
        this.errors.push(
          `${file}: Must start with '// @agent: frontend-debugger' metadata comment`
        );
      }

      // Validate test file length (aiming for <50 lines)
      this.validateFileLength(filePath, RULES.lineLimits.test, "test");
    });
  }

  validateComponents() {
    const componentsPath = path.join(process.cwd(), "src", "components");
    if (!fs.existsSync(componentsPath)) return;

    const components = fs
      .readdirSync(componentsPath)
      .filter((f) => fs.statSync(path.join(componentsPath, f)).isDirectory());

    components.forEach((component) => {
      const componentPath = path.join(componentsPath, component);
      const files = fs.readdirSync(componentPath);

      // Check required files
      RULES.components.structure.required.forEach((required) => {
        if (!files.includes(required)) {
          this.errors.push(
            `Component ${component}: Missing required file ${required}`
          );
        }
      });

      // Validate component TypeScript file length
      const indexPath = path.join(componentPath, "index.ts");
      if (fs.existsSync(indexPath)) {
        this.validateFileLength(
          indexPath,
          RULES.lineLimits.component,
          "component"
        );
      }

      // Check CSS module naming and length
      const cssModules = files.filter((f) => f.endsWith(".module.css"));
      if (cssModules.length > 1) {
        this.errors.push(
          `Component ${component}: Multiple CSS modules found. Should have only one.`
        );
      }
      if (cssModules.length === 1) {
        const cssFile = cssModules[0];
        if (cssFile !== `${component}.module.css`) {
          this.errors.push(
            `Component ${component}: CSS module should be named ${component}.module.css`
          );
        }

        // Validate CSS file length
        const cssPath = path.join(componentPath, cssFile);
        this.validateFileLength(cssPath, RULES.lineLimits.styles, "CSS module");
      }

      // Check test location and length
      const testsPath = path.join(componentPath, "__tests__");
      if (fs.existsSync(testsPath)) {
        const tests = fs.readdirSync(testsPath);
        tests.forEach((test) => {
          if (!test.endsWith(".test.ts")) {
            this.errors.push(
              `Component ${component}: Invalid test file ${test}. Must end with .test.ts`
            );
          }
          if (test.endsWith(".spec.ts")) {
            this.errors.push(
              `Component ${component}: Playwright tests (.spec.ts) should be in e2e/, not component folder`
            );
          }

          // Validate test file length
          const testPath = path.join(testsPath, test);
          if (fs.existsSync(testPath) && test.endsWith(".test.ts")) {
            this.validateFileLength(
              testPath,
              RULES.lineLimits.test,
              "unit test"
            );
          }
        });
      }
    });
  }

  validateWorkers() {
    const workersPath = path.join(process.cwd(), "workers");
    if (!fs.existsSync(workersPath)) return;

    const findTsFiles = (dir, basePath = "") => {
      const results = [];
      const files = fs.readdirSync(dir);

      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        const relativePath = path.join(basePath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && file !== "node_modules" && file !== "dist") {
          results.push(...findTsFiles(fullPath, relativePath));
        } else if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
          // Include both source files and test files
          results.push(fullPath);
        }
      });

      return results;
    };

    const workerFiles = findTsFiles(workersPath);
    workerFiles.forEach((file) => {
      const relativePath = path.relative(process.cwd(), file);
      const isTestFile = file.endsWith(".test.ts");

      // Check for agent metadata comment
      const content = fs.readFileSync(file, "utf8");
      const firstLine = content.split("\n")[0];

      if (!firstLine.includes("@agent: cloudflare-backend")) {
        this.errors.push(
          `${relativePath}: Must start with '// @agent: cloudflare-backend' metadata comment`
        );
      }

      // Validate file length for all files
      if (isTestFile) {
        this.validateFileLength(file, RULES.lineLimits.test, "test");
      } else {
        this.validateFileLength(file, RULES.lineLimits.worker, "worker module");
      }
    });
  }

  validateUtilities() {
    const utilsPath = path.join(process.cwd(), "src", "utils");
    if (!fs.existsSync(utilsPath)) return;

    const findTsFiles = (dir) => {
      const results = [];
      const files = fs.readdirSync(dir);

      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !file.startsWith("__")) {
          results.push(...findTsFiles(fullPath));
        } else if (
          file.endsWith(".ts") &&
          !file.endsWith(".test.ts") &&
          !file.endsWith(".d.ts")
        ) {
          results.push(fullPath);
        }
      });

      return results;
    };

    const utilFiles = findTsFiles(utilsPath);
    utilFiles.forEach((file) => {
      this.validateFileLength(file, RULES.lineLimits.utils, "utility module");
    });
  }

  validateTestSeparation() {
    // Ensure no Playwright tests in component folders
    const componentsPath = path.join(process.cwd(), "src", "components");
    if (!fs.existsSync(componentsPath)) return;

    const findSpecFiles = (dir) => {
      const results = [];
      const files = fs.readdirSync(dir);

      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          results.push(...findSpecFiles(fullPath));
        } else if (file.endsWith(".spec.ts")) {
          results.push(fullPath);
        }
      });

      return results;
    };

    const specFiles = findSpecFiles(componentsPath);
    specFiles.forEach((file) => {
      this.errors.push(
        `Playwright test found in component folder: ${file}\n  Should be in e2e/ directory`
      );
    });
  }

  generateReport() {
    const summary = {
      errors: this.errors.length,
      warnings: this.warnings.length,
      timestamp: new Date().toISOString(),
    };

    const reportPath = path.join(
      process.cwd(),
      "structure-validation-report.json"
    );
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          summary,
          errors: this.errors,
          warnings: this.warnings,
          rules: RULES,
        },
        null,
        2
      )
    );

    return reportPath;
  }

  run() {
    console.log("🔍 Validating repository structure and file limits...\n");

    this.validateE2ETests();
    this.validateComponents();
    this.validateWorkers();
    this.validateUtilities();
    this.validateTestSeparation();

    if (this.errors.length > 0) {
      console.log("❌ Errors found:\n");
      this.errors.forEach((error) => console.log(`  ${error}\n`));
    }

    if (this.warnings.length > 0) {
      console.log("⚠️  Warnings:\n");
      this.warnings.forEach((warning) => console.log(`  ${warning}\n`));
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log("✅ Repository structure is valid!\n");
      console.log("📊 Line limits enforced:");
      console.log("  - Components: ≤100 lines");
      console.log("  - CSS modules: ≤100 lines");
      console.log("  - Workers: ≤100 lines");
      console.log("  - Tests: <50 lines (recommended)");
      console.log("  - Utilities: ≤100 lines\n");
    } else {
      const reportPath = this.generateReport();
      console.log(
        `📄 Full report saved to: ${path.relative(process.cwd(), reportPath)}\n`
      );
    }

    return this.errors.length === 0 ? 0 : 1;
  }
}

// Run validation
const validator = new StructureValidator();
process.exit(validator.run());
