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

  const fileName = `Backlog2Redmine-v${version}.zip`;
  const filePath = path.join(process.cwd(), fileName);

  // Calculate file size and checksum (if file exists locally)
  let fileSizeMB = 'N/A';
  let fileHash = 'N/A';
  
  if (fs.existsSync(filePath)) {
    const fileStats = fs.statSync(filePath);
    fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
    fileHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  }

  // Read changelog from file (first 10 lines)
  let changelog = ['Bug fixes and improvements'];
  if (fs.existsSync('CHANGELOG.md')) {
    const changelogContent = fs.readFileSync('CHANGELOG.md', 'utf8');
    changelog = changelogContent
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .slice(0, 10)
      .map(line => line.trim().replace(/^[-*]\s*/, '- '));
  }

  const payload = {
    name: `Backlog2Redmine v${version}`,
    version_number: version,
    description: 'Automated release from CI/CD pipeline',
    is_latest: true,
    download_url: downloadUrl,
    file_size: fileSizeMB !== 'N/A' ? `${fileSizeMB} MB` : 'N/A',
    checksum: fileHash !== 'N/A' ? `sha256:${fileHash}` : 'N/A',
    changelog: changelog,
    release_date: new Date().toISOString()
  };

  console.log('📝 Registering version in backend...');
  console.log(`   Version: ${version}`);
  console.log(`   Download URL: ${downloadUrl}`);
  console.log(`   Size: ${fileSizeMB} MB`);
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
