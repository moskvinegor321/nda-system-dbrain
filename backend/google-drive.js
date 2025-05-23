const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const KEYFILEPATH = path.join(__dirname, 'google-service-account.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const FOLDER_ID = '1-6QkkEtYlHvaM7ILMZ5jgVlss6hIB2Fq';

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

async function uploadToGoogleDrive(localPath, filename, mimeType = 'application/pdf') {
  const authClient = await auth.getClient();
  const driveService = google.drive({ version: 'v3', auth: authClient });

  const fileMetadata = {
    name: filename,
    parents: [FOLDER_ID],
  };
  const media = {
    mimeType,
    body: fs.createReadStream(localPath),
  };

  const file = await driveService.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
  });
  return file.data;
}

module.exports = { uploadToGoogleDrive }; 