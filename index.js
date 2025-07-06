import express from 'express';
import dotenv from 'dotenv';
import hc from '@api/hc'; // giả sử bạn có thư viện SDK riêng

dotenv.config(); // Load biến môi trường từ .env

const app = express();
const PORT = process.env.PORT || 3000;

// Xác thực với AppsFlyer token
hc.auth(process.env.APPSFLYER_TOKEN);

app.get('/fetch', async (req, res) => {
  try {
    const { from = '2025-07-01', to = '2025-07-02', media_source = 'facebook' } = req.query;

    const result = await hc.getAppIdInstalls_reportV5({
      from,
      to,
      media_source,
      timezone: 'Asia%2FHo_Chi_Minh',
      additional_fields: process.env.APPSFLYER_FIELDS,
      'app-id': process.env.APPSFLYER_APP_ID,
      accept: 'text/csv',
    });

    res.setHeader('Content-Type', 'text/csv');
    res.send(result.data);
  } catch (error) {
    console.error(error?.response?.data || error.message);
    res.status(500).send('Lỗi khi gọi AppsFlyer API');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
