import fs from 'fs';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';
import axios from 'axios';
import { google } from 'googleapis';

/* ─── biến môi trường ─── */
const { AF_JWT_TOKEN, AF_APP_ID, GDRIVE_FOLDER, GDRIVE_CRED } = process.env;
if (!AF_JWT_TOKEN || !AF_APP_ID || !GDRIVE_FOLDER || !GDRIVE_CRED) {
  console.error('⛔ Thiếu ENV. Xem README.');
  process.exit(1);
}

/* ─── Google Drive auth ─── */
const creds = JSON.parse(Buffer.from(GDRIVE_CRED, 'base64').toString());
const auth  = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/drive.file']
});
const drive = google.drive({ version: 'v3', auth });

/* ─── date range CLI ─── */
const [ , , FROM = '2025-07-05', TO = '2025-07-05' ] = process.argv;
const TZ  = 'Asia%2FHo_Chi_Minh';
const HUB = 'hq1';              // hq2 nếu app ở EU

/* ─── Pull-API URL ─── */
const url = `https://${HUB}.appsflyer.com/api/raw-data/export/app/${encodeURIComponent(AF_APP_ID)}` +
            `/installs_report/v5?from=${FROM}&to=${TO}&timezone=${TZ}`;

console.log(`▶ Pulling installs ${FROM} → ${TO}`);
const res = await axios.get(url, {
  responseType : 'stream',
  headers      : {
    Authorization   : `Bearer ${AF_JWT_TOKEN}`,
    'Accept-Encoding': 'gzip'
  }
});

/* ─── save tmp → unzip ─── */
const gzPath  = `/tmp/installs_${FROM}_${TO}.csv.gz`;
const csvPath = gzPath.slice(0, -3);
await pipeline(res.data, fs.createWriteStream(gzPath));
await pipeline(fs.createReadStream(gzPath), zlib.createGunzip(), fs.createWriteStream(csvPath));

/* ─── upload Drive ─── */
const up = await drive.files.create({
  media: { mimeType: 'text/csv', body: fs.createReadStream(csvPath) },
  requestBody: { name: `installs_${FROM}_${TO}.csv`, parents: [ GDRIVE_FOLDER ] }
});
console.log(`✅ https://drive.google.com/file/d/${up.data.id}`);

/* ─── dọn tmp ─── */
fs.unlinkSync(gzPath); fs.unlinkSync(csvPath);
