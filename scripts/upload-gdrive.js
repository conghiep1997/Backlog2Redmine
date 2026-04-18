const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

/**
 * Uploads project artifact to Google Drive using OAuth2 Refresh Token.
 * Handles authentication, finding existing files, and overwriting/creating files.
 */
async function uploadToDrive() {
  const {
    GDRIVE_CLIENT_ID: clientId,
    GDRIVE_CLIENT_SECRET: clientSecret,
    GDRIVE_REFRESH_TOKEN: refreshToken,
    GDRIVE_FOLDER_ID: folderId,
    VERSION: version
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
      console.log('✅ Update successful!');
    } else {
      console.log('📤 Creating new file...');
      await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
      });
      console.log('✅ Upload successful!');
    }
  } catch (error) {
    console.error('❌ Google Drive Upload Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

uploadToDrive();
