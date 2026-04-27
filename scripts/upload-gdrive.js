const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');

/**
 * Uploads project artifact to Google Drive using Service Account.
 * Handles authentication, finding existing files, and overwriting/creating files.
 * After successful upload, registers the version in Dev Tool Platform backend.
 */
async function uploadToDrive() {
  const {
    GDRIVE_SERVICE_ACCOUNT_KEY: serviceAccountKeyPath,
    GDRIVE_FOLDER_ID: folderId,
    VERSION: version,
    BACKEND_URL: backendUrl,
    BACKEND_API_KEY: backendApiKey
  } = process.env;

  // Validate required environment variables
  if (!folderId) {
    console.error('❌ Missing GDRIVE_FOLDER_ID environment variable.');
    process.exit(1);
  }

  if (!version) {
    console.error('❌ Missing VERSION environment variable.');
    process.exit(1);
  }

  // Determine service account key file path
  let keyFilePath = serviceAccountKeyPath;
  if (!keyFilePath) {
    // Default to service-account-key.json in project root
    keyFilePath = path.join(process.cwd(), 'service-account-key.json');
  }
  keyFilePath = path.resolve(keyFilePath);

  if (!fs.existsSync(keyFilePath)) {
    console.error(`❌ Service account key file not found at: ${keyFilePath}`);
    console.error('   Set GDRIVE_SERVICE_ACCOUNT_KEY environment variable or place service-account-key.json in project root.');
    process.exit(1);
  }

  const fileName = `Backlog2Redmine-v${version}.zip`;
  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Authenticate using Service Account
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  let fileId = null;

  let fileStream;
  try {
    console.log(`🔍 Searching for existing file: ${fileName}...`);
    const escapedFileName = fileName.replace(/'/g, "\\'");
    const listRes = await drive.files.list({
      q: `name = '${escapedFileName}' and '${folderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const existingFile = listRes.data.files[0];
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    fileStream = fs.createReadStream(filePath);
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let fileStream;
      try {
        fileStream = fs.createReadStream(filePath);
        const media = {
          mimeType: 'application/zip',
          body: fileStream,
        };

        if (existingFile) {
          console.log(`🔄 Updating existing file (ID: ${existingFile.id})... (attempt ${attempt}/${maxRetries})`);
          await drive.files.update({
            fileId: existingFile.id,
            media: media,
          });
          fileId = existingFile.id;
          console.log('✅ Update successful!');
        } else {
          console.log(`📤 Creating new file... (attempt ${attempt}/${maxRetries})`);
          const createRes = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
          });
          fileId = createRes.data.id;
          console.log('✅ Upload successful!');
        }
        break;
      } catch (retryError) {
        lastError = retryError;
        if (attempt < maxRetries) {
          console.warn(`⚠️ Attempt ${attempt} failed, retrying... (${retryError.message})`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      } finally {
        if (fileStream) {
          fileStream.close();
        }
      }
    }
    
    if (!fileId) {
      throw lastError;
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
