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

// Get build mode from environment or arguments
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

console.log(`Building in ${isProduction ? 'production' : 'development'} mode...`);

// Use different oauth handler based on environment
const oauthHandler = isProduction 
  ? 'src/oauth-handler.prod.ts' 
  : 'src/oauth-handler.dev.ts';

// Create alias for oauth-handler to point to the right version
const alias = {
  'oauth-handler': resolve(rootDir, oauthHandler)
};

// Common build options
const buildOptions = {
  entryPoints: [resolve(rootDir, 'src/main.ts')],
  bundle: true,
  outfile: resolve(rootDir, 'dist/main.js'),
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  metafile: true,
  
  // Tree-shaking configuration
  treeShaking: true,
  
  // Production-specific optimizations
  minify: isProduction,
  
  // Define build-time constants
  define: {
    'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
    '__DEV__': (!isProduction).toString(),
  },
  
  // Alias oauth-handler to the appropriate version
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
    js: `// Build: ${new Date().toISOString()} - Mode: ${isProduction ? 'production' : 'development'}`,
  },
};

// Production-specific dead code elimination
if (isProduction) {
  // Add production-specific plugins or settings
  buildOptions.drop = ['console', 'debugger'];
  buildOptions.pure = ['console.log', 'console.debug'];
  
  // No need for content scanning - we're using separate entry points!
  // Production build uses oauth-handler.prod.ts which doesn't import mock-oauth at all
}

// Copy assets function
function copyAssets() {
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
        
        // No need to check for mock-oauth - we're using separate entry points!
      }
      
      console.log(`Build completed successfully in ${isProduction ? 'production' : 'development'} mode`);
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();