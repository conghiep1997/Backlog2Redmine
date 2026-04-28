/**
 * Script to reset the versions table and seed data from CHANGELOG.md
 * This script:
 * 1. Drops the versions table
 * 2. Recreates it with the new schema (without file_size and checksum)
 * 3. Parses CHANGELOG.md and inserts all versions
 * 
 * Usage: node scripts/reset-db-from-changelog.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';
const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');

// Parse CHANGELOG.md to extract all versions
function parseChangelog(content) {
  const versions = [];
  const versionRegex = /^## \[([0-9.]+)\] - ([0-9]{4}-[0-9]{2}-[0-9]{2})/gm;
  
  let match;
  while ((match = versionRegex.exec(content)) !== null) {
    const versionNumber = match[1];
    const releaseDate = match[2];
    
    // Extract the section for this version
    const sectionStart = match.index;
    const nextVersionMatch = /^## \[/m.exec(content.slice(sectionStart + 1));
    const sectionEnd = nextVersionMatch ? sectionStart + 1 + nextVersionMatch.index : content.length;
    const sectionContent = content.slice(sectionStart, sectionEnd);
    
    // Parse changelog items
    const changelog = sectionContent
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.trim().replace(/^[-*]\s*/, '- '));
    
    // Extract features/changes for description
    const firstFeature = changelog.length > 0 ? changelog[0].replace('- ', '') : 'Bug fixes and improvements';
    const description = firstFeature.length > 200 ? firstFeature.substring(0, 197) + '...' : firstFeature;
    
    versions.push({
      version_number: versionNumber,
      release_date: releaseDate,
      changelog,
      description,
    });
  }
  
  return versions;
}

// Database operations via API
async function dropAndRecreateTable() {
  console.log('🗑️  Dropping versions table...');
  
  try {
    // Note: This requires direct database access, not through API
    // We'll delete all versions instead
    const versions = await fetch(`${BACKEND_URL}/api/versions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_API_KEY ? { 'Authorization': `Bearer ${BACKEND_API_KEY}` } : {})
      }
    });
    
    if (versions.ok) {
      const versionsList = await versions.json();
      console.log(`   Found ${versionsList.length} existing versions`);
      
      // Delete all existing versions
      for (const version of versionsList) {
        const deleteResponse = await fetch(`${BACKEND_URL}/api/versions/${version.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(BACKEND_API_KEY ? { 'Authorization': `Bearer ${BACKEND_API_KEY}` } : {})
          }
        });
        
        if (deleteResponse.ok) {
          console.log(`   ✓ Deleted version ${version.version_number}`);
        }
      }
    }
  } catch (error) {
    console.error('   ⚠️  Error cleaning existing versions:', error.message);
  }
}

async function createVersion(versionData) {
  const payload = {
    name: `Backlog2Redmine v${versionData.version_number}`,
    version_number: versionData.version_number,
    description: versionData.description,
    is_latest: false, // Will be set to true for the latest version
    release_date: new Date(versionData.release_date).toISOString(),
    changelog: versionData.changelog,
    download_url: `https://github.com/conghiep1997/Backlog2Redmine/releases/download/v${versionData.version_number}/Backlog2Redmine-v${versionData.version_number}.zip`
  };
  
  const response = await fetch(`${BACKEND_URL}/api/versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(BACKEND_API_KEY ? { 'Authorization': `Bearer ${BACKEND_API_KEY}` } : {})
    },
    body: JSON.stringify(payload)
  });
  
  if (response.ok) {
    const result = await response.json();
    return result;
  } else {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }
}

async function seedVersions() {
  console.log('\n📖 Reading CHANGELOG.md...');
  
  if (!fs.existsSync(CHANGELOG_PATH)) {
    throw new Error(`CHANGELOG.md not found at ${CHANGELOG_PATH}`);
  }
  
  const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const versions = parseChangelog(changelogContent);
  
  console.log(`   ✓ Found ${versions.length} versions in CHANGELOG.md\n`);
  
  // Drop and recreate table (delete all existing versions)
  await dropAndRecreateTable();
  
  console.log('\n📝 Inserting versions...\n');
  
  // Insert versions (oldest first, so latest is last)
  const reversedVersions = versions.slice().reverse();
  
  for (let i = 0; i < reversedVersions.length; i++) {
    const version = reversedVersions[i];
    const isLatest = i === reversedVersions.length - 1;
    
    console.log(`   Creating version ${version.version_number} (${version.release_date})...`);
    
    try {
      const payload = {
        name: `Backlog2Redmine v${version.version_number}`,
        version_number: version.version_number,
        description: version.description,
        is_latest: isLatest,
        release_date: new Date(version.release_date).toISOString(),
        changelog: version.changelog,
        download_url: `https://github.com/conghiep1997/Backlog2Redmine/releases/download/v${version.version_number}/Backlog2Redmine-v${version.version_number}.zip`
      };
      
      const response = await fetch(`${BACKEND_URL}/api/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(BACKEND_API_KEY ? { 'Authorization': `Bearer ${BACKEND_API_KEY}` } : {})
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✓ Created version ${version.version_number} (ID: ${result.id})${isLatest ? ' ⭐ LATEST' : ''}`);
      } else {
        const errorText = await response.text();
        console.error(`   ✗ Failed to create version ${version.version_number}: ${errorText}`);
      }
    } catch (error) {
      console.error(`   ✗ Error creating version ${version.version_number}:`, error.message);
    }
  }
  
  console.log('\n✅ Database seeding completed!\n');
}

// Execute
seedVersions().catch(error => {
  console.error('\n❌ Seeding failed:', error.message);
  process.exit(1);
});
