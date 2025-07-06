import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_TOKEN = process.env.APPSFLYER_TOKEN;
const APP_ID = process.env.APPSFLYER_APP_ID;
const TIMEZONE = 'Asia%2FHo_Chi_Minh';
const ADDITIONAL_FIELDS = 'blocked_reason_rule,store_reinstall_date';

function getDateStrings() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const toISODate = (date) => date.toISOString().split('T')[0];
  return {
    from: toISODate(yesterday),
    to: toISODate(today)
  };
}

async function fetchInstalls() {
  const { from, to } = getDateStrings();

  const initUrl = `https://hq1.appsflyer.com/api/raw-data/export/app/${APP_ID}/installs_report/v5`;

  try {
    const initRes = await axios.get(initUrl, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`
      },
      params: {
        from,
        to,
        timezone: TIMEZONE,
        additional_fields: ADDITIONAL_FIELDS
      },
      maxRedirects: 0, // Important to capture the redirect URL
      validateStatus: (status) => status >= 200 && status < 400 // Accept 3xx
    });

    // Extract redirect URL
    const redirectUrl = initRes.headers.location;
    if (!redirectUrl) throw new Error('Redirect URL not found.');

    // Now fetch actual CSV stream
    const csvResponse = await axios.get(redirectUrl, { responseType: 'stream' });

    const outputPath = path.join(__dirname, `installs_${from}.csv`);
    const writer = fs.createWriteStream(outputPath);

    csvResponse.data.pipe(writer);

    writer.on('finish', () => {
      console.log(`✅ Saved report to ${outputPath}`);
    });

    writer.on('error', (err) => {
      console.error('❌ Error writing file:', err);
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

fetchInstalls();
