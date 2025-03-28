const express = require("express");
const bodyParser = require("body-parser");
const bitrixRequest = require("./bitrixAuth"); // Import hàm gọi API Bitrix

const app = express();
app.use(bodyParser.json()); // Đảm bảo request body là JSON

let requestQueue = [];
let isProcessing = false;

// ✅ Check server status
app.get("/", (req, res) => {
  res.send("✅ App is running!");
});

// 📌 Xử lý webhook từ Bitrix24
// Hỗ trợ JSON
app.use(express.json());

// 🔥 Thêm middleware để hỗ trợ x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.post("/bx24-event-handler", async (req, res) => {
  console.log("📥 Headers:", req.headers);
  console.log("📥 Raw request body:", req.body);

  if (!req.body || Object.keys(req.body).length === 0) {
    console.error("❌ Error: Request body is empty.");
    return res.status(400).json({ error: "Invalid request: Request body is empty." });
  }

  const callData = req.body.data;
  console.log("📞 Extracted callData:", callData);

  if (!callData || !callData.CALL_ID) {
    console.error("❌ Error: CALL_ID is missing.");
    return res.status(400).json({ error: "Invalid request: Missing CALL_ID." });
  }

  console.log(`📞 Received call event for CALL_ID: ${callData.CALL_ID}`);
  res.send("✅ Data received successfully.");
});

// ⏳ Xử lý từng request trong hàng đợi
async function processNextRequest() {
  if (requestQueue.length === 0) {
    console.log("✅ All requests processed.");
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const { callData, res } = requestQueue.shift();
  const callId = callData.CALL_ID;

  try {
    // 🟢 Lấy thông tin cuộc gọi từ Bitrix24
    const callStats = await bitrixRequest(`/voximplant.statistic.get`, "POST", {
      FILTER: { CALL_ID: callId }
    });

    if (!callStats?.result?.length) {
      throw new Error("No call data found.");
    }

    const callInfo = callStats.result[0];
    console.log("📊 Call Info:", callInfo);

    // 🕒 Chuyển đổi thời gian cuộc gọi
    const callStartDate = convertTimezone(callInfo.CALL_START_DATE, 7);

    const { CRM_ENTITY_ID, CRM_ENTITY_TYPE, CALL_FAILED_REASON, CALL_DURATION } = callInfo;

    if (!CRM_ENTITY_ID) {
      throw new Error("Missing CRM_ENTITY_ID.");
    }

    // 🛠 Cập nhật vào Deal hoặc Contact
    if (CRM_ENTITY_TYPE === "DEAL") {
      await updateDeal(CRM_ENTITY_ID, CALL_FAILED_REASON, CALL_DURATION, callStartDate);
    } else if (CRM_ENTITY_TYPE === "CONTACT") {
      const dealData = await bitrixRequest(`/crm.deal.list`, "POST", {
        FILTER: { CONTACT_ID: CRM_ENTITY_ID }
      });

      if (dealData?.result?.length) {
        await updateDeal(dealData.result[0].ID, CALL_FAILED_REASON, CALL_DURATION, callStartDate);
      } else {
        await updateContact(CRM_ENTITY_ID, CALL_DURATION, CALL_FAILED_REASON, callStartDate);
      }
    }

    res.send("✅ Call data processed successfully.");
  } catch (error) {
    console.error("❌ Error processing request:", error.message);
    res.status(500).send(error.message);
  }

  processNextRequest();
}

// 🔄 Chuyển đổi múi giờ & tự động cộng thêm 1 giờ
function convertTimezone(dateString, targetOffset) {
  const date = new Date(dateString);
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const newDate = new Date(utc + targetOffset * 3600000);
  newDate.setHours(newDate.getHours() + 1); // Cộng thêm 1 giờ
  return newDate.toISOString();
}

// 📌 Cập nhật Deal trong Bitrix24
async function updateDeal(dealId, callFailedCode, callDuration, callStartDate) {
  const fieldsToUpdate = {
    "UF_CRM_668BB634B111F": callFailedCode,  // Trạng thái cuộc gọi
    "UF_CRM_66C2B64134A71": callDuration,   // Thời gian gọi
    "UF_CRM_1733474117": callStartDate,     // Ngày gọi
  };

  console.log(`📌 Updating Deal ID: ${dealId}`);
  await bitrixRequest(`/crm.deal.update`, "POST", {
    ID: dealId,
    fields: fieldsToUpdate
  });
}

// 📌 Cập nhật Contact trong Bitrix24
async function updateContact(contactId, callDuration, callStatus, lastCallDate) {
  const fieldsToUpdate = {
    "UF_CRM_66CBE81B02C06": callDuration,      // Thời gian gọi
    "UF_CRM_668F763F5D533": callStatus,        // Trạng thái cuộc gọi
    "UF_CRM_1733471904291": lastCallDate,      // Ngày cuối gọi
  };

  console.log(`📌 Updating Contact ID: ${contactId}`);
  await bitrixRequest(`/crm.contact.update`, "POST", {
    ID: contactId,
    fields: fieldsToUpdate
  });
}

// 🚀 Khởi chạy server trên Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}/`);
});
