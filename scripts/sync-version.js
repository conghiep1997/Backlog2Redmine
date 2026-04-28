/**
 * Synchronizes extension version with backend after build and packaging.
 * This script should be run after npm run build:zip
 * It reads the version from manifest.json, locates the created ZIP file,
 * and calls the register-version.js script with appropriate environment variables.
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'manifest.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const MANIFEST_DIST = path.join(DIST_DIR, 'manifest.json');

// Configuration - update these for your deployment
const BACKEND_URL = process.env.BACKEND_URL || 'https://dev-tool-platform-backend.onrender.com';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || ''; // Set via environment if needed

// Optional: Set to your GitHub repository download pattern
// For GitHub Releases: https://github.com/{org}/{repo}/releases/download/v{version}/{asset}
// For direct hosting: customize as needed
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Hipppo';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Backlog2Redmine';
const USE_GITHUB_RELEASES = process.env.USE_GITHUB_RELEASES || 'true';

async function syncVersion() {
  console.log('🔄 Synchronizing extension version with backend...\n');

  try {
    // 1. Read version from manifest.json
    if (!fs.existsSync(MANIFEST_PATH)) {
      throw new Error(`Manifest not found at ${MANIFEST_PATH}`);
    }
    
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    const version = manifest.version;
    const name = manifest.name;
    
    console.log(`📦 Extension: ${name} v${version}`);

    // 2. Verify dist/ exists (should have been built already)
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error(`dist/ directory not found. Please run "npm run build" first.`);
    }

    // 3. Verify ZIP file exists (should have been created by build:zip)
    const zipFileName = `Backlog2Redmine-v${version}.zip`;
    const zipFilePath = path.join(__dirname, '..', zipFileName);
    
    if (!fs.existsSync(zipFilePath)) {
      throw new Error(`ZIP file not found at ${zipFilePath}. Please run "npm run build:zip" first.`);
    }
    
    const fileStats = fs.statSync(zipFilePath);
    const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
    console.log(`📦 Package: ${zipFileName} (${fileSizeMB} MB)`);

    // 4. Determine download URL
    let downloadUrl = '';
    
    if (USE_GITHUB_RELEASES.toLowerCase() === 'true') {
      // GitHub Releases URL pattern
      const assetName = `Backlog2Redmine-v${version}.zip`;
      downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/${assetName}`;
    } else {
      // Custom download URL - should be set via environment variable
      downloadUrl = process.env.DOWNLOAD_URL || '';
      if (!downloadUrl) {
        throw new Error('DOWNLOAD_URL environment variable must be set when not using GitHub Releases');
      }
    }
    
    console.log(`🔗 Download URL: ${downloadUrl}`);

    // 5. Set environment variables and call register-version.js
    console.log('\n🚀 Registering version with backend...');
    
    const { spawn } = require('child_process');
    const registerScript = path.join(__dirname, 'register-version.js');
    
    const env = {
      ...process.env,
      BACKEND_URL,
      BACKEND_API_KEY,
      VERSION: version,
      DOWNLOAD_URL: downloadUrl
    };
    
    // Remove NODE_OPTIONS to avoid interference
    delete env.NODE_OPTIONS;
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [registerScript], { 
        env,
        stdio: 'inherit' // Forward stdio to parent process
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Version synchronization completed successfully!');
          resolve();
        } else {
          console.error(`\n❌ Version synchronization failed with exit code ${code}`);
          reject(new Error(`Registration script exited with code ${code}`));
        }
      });
      
      child.on('error', (err) => {
        console.error(`\n❌ Failed to execute registration script:`, err);
        reject(err);
      });
    });
    
  } catch (error) {
    console.error(`\n❌ Version synchronization failed:`, error.message);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  syncVersion().catch(error => {
    process.exit(1);
  });
}

module.exports = { syncVersion };