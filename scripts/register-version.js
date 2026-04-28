const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Registers the newly created GitHub Release version in the backend database.
 * Called by GitHub Actions workflow after a release is created/updated.
 */
async function registerVersion() {
  const {
    BACKEND_URL: backendUrl,
    BACKEND_API_KEY: backendApiKey,
    VERSION: version,
    DOWNLOAD_URL: downloadUrl
  } = process.env;

  // Validate required environment variables
  if (!backendUrl) {
    console.error('❌ Missing BACKEND_URL environment variable.');
    process.exit(1);
  }

  if (!version) {
    console.error('❌ Missing VERSION environment variable.');
    process.exit(1);
  }

  if (!downloadUrl) {
    console.error('❌ Missing DOWNLOAD_URL environment variable.');
    process.exit(1);
  }

  // Read changelog from file (extract current version section)
  let changelog = ['Bug fixes and improvements'];
  if (fs.existsSync('CHANGELOG.md')) {
    const changelogContent = fs.readFileSync('CHANGELOG.md', 'utf8');
    // Extract the section for current version
    const versionSection = extractChangelogSection(changelogContent, version);
    if (versionSection) {
      changelog = versionSection
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
        // Keep original line (with leading spaces) to preserve indentation
        .map(line => line);
    }
  }

  // Helper function to extract changelog section for a specific version
  function extractChangelogSection(content, version) {
    // Match the version header (e.g., "## [1.8.3] - 2026-04-26")
    const versionRegex = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'm');
    const lines = content.split('\n');
    let inSection = false;
    const sectionLines = [];
    
    for (const line of lines) {
      // Check if we've entered the target version section
      if (versionRegex.test(line)) {
        inSection = true;
        continue;
      }
      
      // Check if we've entered another version section (stop here)
      if (inSection && line.startsWith('## [')) {
        break;
      }
      
      // If we're in the target section, collect the line
      if (inSection) {
        sectionLines.push(line);
      }
    }
    
    return sectionLines.join('\n');
  }

  const payload = {
    name: `Backlog2Redmine v${version}`,
    version_number: version,
    description: 'Automated release from CI/CD pipeline',
    is_latest: true,
    download_url: downloadUrl,
    changelog: changelog,
    release_date: new Date().toISOString()
  };

    console.log('📝 Registering version in backend...');
    console.log(`   Version: ${version}`);
    console.log(`   Download URL: ${downloadUrl}`);
    console.log(`   Changes: ${changelog.length} items`);

  try {
    const response = await fetch(`${backendUrl}/api/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(backendApiKey ? { 'Authorization': `Bearer ${backendApiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Version ${version} registered successfully!`);
      console.log(`   Backend ID: ${result.id}`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Backend API error (${response.status}):`, errorText);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to register version:', error.message);
    process.exit(1);
  }
}

registerVersion();
