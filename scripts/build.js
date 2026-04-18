/**
 * Build script for Backlog2Redmine Extension.
 * Validates manifest, copies files to dist/, and prepares for packaging.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const MANIFEST_SRC = path.join(__dirname, '..', 'manifest.json');
const MANIFEST_DIST = path.join(DIST_DIR, 'manifest.json');

console.log('🔨 Building Backlog2Redmine Extension...\n');

// Step 1: Clean dist directory
console.log('📁 Step 1: Cleaning dist directory...');
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  console.log('   ✓ Cleaned dist/');
} else {
  console.log('   ✓ dist/ does not exist, skipping clean');
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// Step 2: Copy manifest
console.log('\n📄 Step 2: Copying manifest.json...');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_SRC, 'utf-8'));
console.log(`   ✓ Extension: ${manifest.name} v${manifest.version}`);
fs.copyFileSync(MANIFEST_SRC, MANIFEST_DIST);

// Step 3: Copy source files
console.log('\n📂 Step 3: Copying source files...');
const copyDir = (src, dest, base = '') => {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath, path.join(base, entry.name));
    } else if (entry.isFile() && /\.(js|html|css)$/.test(entry.name)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`   ✓ ${path.join(base, entry.name)}`);
    }
  }
};

copyDir(SRC_DIR, DIST_DIR);

// Step 4: Copy assets
console.log('\n🎨 Step 4: Copying assets...');
const ASSETS_SRC = path.join(__dirname, '..', 'assets');
const ASSETS_DIST = path.join(DIST_DIR, 'assets');
if (fs.existsSync(ASSETS_SRC)) {
  fs.cpSync(ASSETS_SRC, ASSETS_DIST, { recursive: true });
  console.log('   ✓ assets/ copied');
}

// Step 4b: Copy locales
console.log('\n🌐 Step 4b: Copying locales...');
const LOCALES_SRC = path.join(__dirname, '..', '_locales');
const LOCALES_DIST = path.join(DIST_DIR, '_locales');
if (fs.existsSync(LOCALES_SRC)) {
  fs.cpSync(LOCALES_SRC, LOCALES_DIST, { recursive: true });
  console.log('   ✓ _locales/ copied');
}

// Step 5: Validate manifest
console.log('\n✅ Step 5: Validating manifest...');
const requiredKeys = ['manifest_version', 'name', 'version', 'description', 'permissions'];
const missingKeys = requiredKeys.filter(key => !manifest[key]);
if (missingKeys.length > 0) {
  console.error(`   ✗ Missing required keys: ${missingKeys.join(', ')}`);
  process.exit(1);
}
console.log('   ✓ Manifest is valid');

// Step 6: Summary
console.log('\n📊 Build Summary:');
console.log(`   • Extension: ${manifest.name}`);
console.log(`   • Version: ${manifest.version}`);
console.log(`   • Manifest: ${manifest.manifest_version}`);
console.log(`   • Output: ${DIST_DIR}`);
console.log('\n✨ Build completed successfully!\n');
console.log('📦 To create ZIP package, run: npm run build:zip\n');
