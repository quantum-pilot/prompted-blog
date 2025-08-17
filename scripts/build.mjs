#!/usr/bin/env node

import * as esbuild from 'esbuild';
import { existsSync, mkdirSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Ensure dist directory exists
if (!existsSync(resolve(rootDir, 'dist'))) {
  mkdirSync(resolve(rootDir, 'dist'), { recursive: true });
}

// Check for watch mode
const isWatch = process.argv.includes('--watch');

console.log('Building in production mode...');

// Create alias configuration
const alias = {
  'oauth-handler': resolve(rootDir, 'src/oauth-handler.ts'),
  '@app/shared': resolve(rootDir, 'shared')
};

// Build options - always optimized for production
const buildOptions = {
  entryPoints: [resolve(rootDir, 'src/main.ts')],
  bundle: true,
  outfile: resolve(rootDir, 'dist/main.js'),
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  metafile: true,
  
  // Tree-shaking configuration - always enabled
  treeShaking: true,
  
  // Always minify for production
  minify: true,
  
  // Define build-time constants for production
  define: {
    'process.env.NODE_ENV': '"production"',
    '__DEV__': 'false',
  },
  
  // Alias configuration
  alias,
  
  // External dependencies (if any should not be bundled)
  external: [],
  
  // Loader configuration for various file types
  loader: {
    '.ts': 'ts',
    '.css': 'css',
    '.svg': 'dataurl',
  },
  
  // Resolve extensions
  resolveExtensions: ['.ts', '.js', '.json'],
  
  // Banner for the output file
  banner: {
    js: `// Build: ${new Date().toISOString()} - Mode: production`,
  },
  
  // Always drop console and debugger statements for production
  drop: ['console', 'debugger'],
  pure: ['console.log', 'console.debug'],
};

// Copy assets function
function copyAssets() {
  // Copy HTML files to dist
  try {
    cpSync(resolve(rootDir, 'index.html'), resolve(rootDir, 'dist/index.html'));
    cpSync(resolve(rootDir, 'src/oauth-callback.html'), resolve(rootDir, 'dist/oauth-callback.html'));
    console.log('HTML files copied successfully');
  } catch (error) {
    console.warn('Warning: Could not copy HTML files:', error.message);
  }

  const assetsSource = resolve(rootDir, 'assets');
  const assetsDest = resolve(rootDir, 'dist/assets');
  
  if (existsSync(assetsSource)) {
    try {
      mkdirSync(assetsDest, { recursive: true });
      
      // Copy CSS files
      const cssSource = resolve(assetsSource, 'css');
      if (existsSync(cssSource)) {
        cpSync(cssSource, resolve(assetsDest, 'css'), { recursive: true });
      }
      
      // Copy other asset files (css, js, svg)
      const files = ['*.css', '*.js', '*.svg'];
      files.forEach(pattern => {
        try {
          cpSync(resolve(assetsSource, pattern), assetsDest, { recursive: false });
        } catch (e) {
          // Silently ignore if no files match the pattern
        }
      });
      
      console.log('Assets copied successfully');
    } catch (error) {
      console.warn('Warning: Could not copy all assets:', error.message);
    }
  }
}

// Build function
async function build() {
  try {
    if (isWatch) {
      // Watch mode for development
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
      
      // Copy assets initially
      copyAssets();
      
    } else {
      // Single build
      const result = await esbuild.build(buildOptions);
      
      // Copy assets after build
      copyAssets();
      
      // Output build statistics
      if (result.metafile) {
        const outputs = Object.keys(result.metafile.outputs);
        outputs.forEach(output => {
          const info = result.metafile.outputs[output];
          const size = (info.bytes / 1024).toFixed(2);
          console.log(`  ${output}: ${size} KB`);
        });
      }
      
      console.log('Build completed successfully');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();