const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');

/**
 * Uploads project artifact to Google Drive using OAuth2 Refresh Token.
 * Handles authentication, finding existing files, and overwriting/creating files.
 * After successful upload, registers the version in Dev Tool Platform backend.
 */
async function uploadToDrive() {
  const {
    GDRIVE_CLIENT_ID: clientId,
    GDRIVE_CLIENT_SECRET: clientSecret,
    GDRIVE_REFRESH_TOKEN: refreshToken,
    GDRIVE_FOLDER_ID: folderId,
    VERSION: version,
    BACKEND_URL: backendUrl,
    BACKEND_API_KEY: backendApiKey
  } = process.env;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing Google Drive OAuth2 credentials (ID, Secret, or Token).');
    process.exit(1);
  }

  const fileName = `Backlog2Redmine-v${version}.zip`;
  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  let fileId = null;

  try {
    console.log(`🔍 Searching for existing file: ${fileName}...`);
    const listRes = await drive.files.list({
      q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const existingFile = listRes.data.files[0];
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(filePath),
    };

    if (existingFile) {
      console.log(`🔄 Updating existing file (ID: ${existingFile.id})...`);
      await drive.files.update({
        fileId: existingFile.id,
        media: media,
      });
      fileId = existingFile.id;
      console.log('✅ Update successful!');
    } else {
      console.log('📤 Creating new file...');
      const createRes = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
      });
      fileId = createRes.data.id;
      console.log('✅ Upload successful!');
    }

    // ✅ Register version in backend
    if (backendUrl && fileId) {
      await registerVersion(fileId, version, filePath);
    } else if (!backendUrl) {
      console.warn('⚠️ BACKEND_URL not set, skipping version registration');
    }

  } catch (error) {
    console.error('❌ Google Drive Upload Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

/**
 * Registers version information in Dev Tool Platform backend.
 * @param {string} fileId - Google Drive file ID
 * @param {string} versionNumber - Version number (e.g., "1.8.3")
 * @param {string} filePath - Path to the zip file for checksum/size calculation
 */
async function registerVersion(fileId, versionNumber, filePath) {
  const backendUrl = process.env.BACKEND_URL;
  const backendApiKey = process.env.BACKEND_API_KEY;

  if (!backendUrl) {
    console.warn('⚠️ BACKEND_URL not set, skipping version registration');
    return;
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

  // Calculate file size and checksum
  const fileStats = fs.statSync(filePath);
  const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
  const fileHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

  const payload = {
    name: `Backlog2Redmine v${versionNumber}`,
    version_number: versionNumber,
    description: 'Automated release from CI/CD pipeline',
    is_latest: true,
    google_drive_file_id: fileId,
    file_size: `${fileSizeMB} MB`,
    checksum: `sha256:${fileHash}`,
    changelog: changelog,
    release_date: new Date().toISOString()
  };

  console.log('📝 Registering version in backend...');
  console.log(`   Version: ${versionNumber}`);
  console.log(`   File ID: ${fileId}`);
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
      console.log(`✅ Version ${versionNumber} registered successfully!`);
      console.log(`   Backend ID: ${result.id}`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Backend API error (${response.status}):`, errorText);
    }
  } catch (error) {
    console.error('❌ Failed to register version:', error.message);
    // Don't exit process - upload was successful, backend registration is optional
  }
}

uploadToDrive();
