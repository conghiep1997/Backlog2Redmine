/**
 * Build ZIP package for Chrome Web Store submission.
 * Creates Backlog2Redmine.zip from dist/ directory.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUTPUT_DIR = path.join(__dirname, '..');
const MANIFEST = path.join(DIST_DIR, 'manifest.json');

console.log('📦 Creating Chrome Extension package...\n');

// Check if dist exists
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ dist/ directory not found. Run `npm run build` first.\n');
  process.exit(1);
}

// Read manifest for version
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
const version = manifest.version;
const OUTPUT_FILE = path.join(OUTPUT_DIR, `Backlog2Redmine-v${version}.zip`);

// Create ZIP
const output = fs.createWriteStream(OUTPUT_FILE);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ Package created: ${path.basename(OUTPUT_FILE)}`);
  console.log(`   Size: ${sizeMB} MB`);
  console.log(`   Location: ${OUTPUT_FILE}`);
  console.log('\n📤 Upload to Chrome Web Store:');
  console.log('   https://chrome.google.com/webstore/devconsole\n');
});

archive.on('error', (err) => {
  console.error('❌ Failed to create package:', err);
  process.exit(1);
});

archive.pipe(output);

// Add all files from dist/
archive.directory(DIST_DIR, false);

archive.finalize();

console.log('⏳ Compressing files...\n');
