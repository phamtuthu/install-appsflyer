const express = require("express");
const bodyParser = require("body-parser");
const bitrixRequest = require("./bitrixAuth"); // Import hàm gọi API Bitrix

const app = express();

app.use(express.json());
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

  const callId = callData.CALL_ID;
  console.log(`📞 Received call event for CALL_ID: ${callId}`);

  try {
    // 🔥 Bước 1: Lấy thông tin cuộc gọi từ Bitrix
    const callStats = await bitrixRequest(`/voximplant.statistic.get/?FILTER[CALL_ID]=${callId}`);
    console.log("📊 Bitrix call stats:", callStats);

    if (!callStats?.result?.length) {
      throw new Error("❌ No call data found in Bitrix.");
    }

    const callInfo = callStats.result[0];
    const { CRM_ENTITY_ID, CRM_ENTITY_TYPE, CALL_FAILED_REASON, CALL_DURATION, CALL_START_DATE } = callInfo;

    if (!CRM_ENTITY_ID) {
      throw new Error("❌ CRM_ENTITY_ID is missing.");
    }

    console.log(`📌 Found CRM_ENTITY_ID: ${CRM_ENTITY_ID}, Type: ${CRM_ENTITY_TYPE}`);

    // 🔥 Bước 2: Cập nhật vào Deal hoặc Contact
    if (CRM_ENTITY_TYPE === "DEAL") {
      await updateDeal(CRM_ENTITY_ID, CALL_FAILED_REASON, CALL_DURATION, CALL_START_DATE);
    } else if (CRM_ENTITY_TYPE === "CONTACT") {
      const dealData = await bitrixRequest(`/crm.deal.list/?FILTER[CONTACT_ID]=${CRM_ENTITY_ID}`);
      console.log("📋 Deals linked to Contact:", dealData);

      if (dealData?.result?.length) {
        await updateDeal(dealData.result[0].ID, CALL_FAILED_REASON, CALL_DURATION, CALL_START_DATE);
      } else {
        await updateContact(CRM_ENTITY_ID, CALL_DURATION, CALL_FAILED_REASON, CALL_START_DATE);
      }
    }

    res.send("✅ Call data processed successfully.");
  } catch (error) {
    console.error("❌ Error processing request:", error.message);
    res.status(500).send(error.message);
  }
});

// 📌 Hàm cập nhật Deal
async function updateDeal(dealId, callFailedCode, callDuration, callStartDate) {
  const fieldsToUpdate = {
    "UF_CRM_668BB634B111F": callFailedCode,  // Trạng thái cuộc gọi
    "UF_CRM_66C2B64134A71": callDuration,   // Thời gian gọi
    "UF_CRM_1733474117": callStartDate,     // Ngày gọi
  };

  console.log(`📌 Updating Deal ID: ${dealId}`, fieldsToUpdate);
  const response = await bitrixRequest(`/crm.deal.update.json/?ID=${dealId}`, "POST", { fields: fieldsToUpdate });
  console.log("📌 Update Deal Response:", response);
}

// 📌 Hàm cập nhật Contact
async function updateContact(contactId, callDuration, callStatus, lastCallDate) {
  const fieldsToUpdate = {
    "UF_CRM_66CBE81B02C06": callDuration,      // Thời gian gọi
    "UF_CRM_668F763F5D533": callStatus,        // Trạng thái cuộc gọi
    "UF_CRM_1733471904291": lastCallDate,      // Ngày cuối gọi
  };

  console.log(`📌 Updating Contact ID: ${contactId}`, fieldsToUpdate);
  const response = await bitrixRequest(`/crm.contact.update.json/?ID=${contactId}`, "POST", { fields: fieldsToUpdate });
  console.log("📌 Update Contact Response:", response);
}

// 🚀 Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}/`);
});
