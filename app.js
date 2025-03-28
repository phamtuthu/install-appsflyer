require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { ensureValidToken } = require("./bitrixAuth");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Hàng đợi xử lý yêu cầu
let requestQueue = [];
let isProcessing = false;

// Route kiểm tra API hoạt động
app.get("/", (req, res) => {
    res.send("🚀 Bitrix24 Call Handler is running!");
});

// Xử lý POST từ Bitrix24
app.post("/bx24-event-handler", async (req, res) => {
    const callEndData = req.body.data;
    const callId = callEndData?.CALL_ID;

    if (!callId) {
        return res.status(400).send("❌ Missing CALL_ID in request.");
    }

    console.log(`📞 Received request for Call ID: ${callId}`);
    requestQueue.push({ callId, res });

    if (!isProcessing) {
        processNextRequest();
    }
});

// Xử lý hàng đợi
async function processNextRequest() {
    if (requestQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const { callId, res } = requestQueue.shift();

    try {
        const { crmEntityId, crmEntityType, callFailedCode, callDuration, callstartdate } =
            await getVoximplantStatistic(callId);

        if (!crmEntityId) {
            res.status(400).send("❌ Missing CRM_ENTITY_ID.");
            return processNextRequest();
        }

        if (crmEntityType === "DEAL") {
            await updateDealField(crmEntityId, callFailedCode, callDuration, callstartdate, res);
        } else if (crmEntityType === "CONTACT") {
            const dealId = await findDealByContact(crmEntityId);
            if (dealId) {
                await updateDealField(dealId, callFailedCode, callDuration, callstartdate, res);
            }
            await updateContactField(crmEntityId, callFailedCode, callDuration, callstartdate, res);
        } else {
            res.status(400).send("❌ Unsupported CRM_ENTITY_TYPE.");
        }
    } catch (error) {
        console.error("❌ Error processing request:", error);
    }

    processNextRequest();
}

// Hàm lấy thống kê cuộc gọi
async function getVoximplantStatistic(callId) {
    const accessToken = await ensureValidToken();
    const apiUrl = `${process.env.BITRIX_DOMAIN}/rest/voximplant.statistic.get/?FILTER[CALL_ID]=${callId}&auth=${accessToken}`;

    const response = await axios.get(apiUrl);
    const result = response.data?.result?.[0];

    return {
        crmEntityId: result?.CRM_ENTITY_ID,
        crmEntityType: result?.CRM_ENTITY_TYPE,
        callFailedCode: result?.CALL_FAILED_REASON,
        callDuration: result?.CALL_DURATION,
        callstartdate: result?.CALL_START_DATE,
    };
}

// Hàm cập nhật Deal
async function updateDealField(dealId, callFailedCode, callDuration, callstartdate, res) {
    const accessToken = await ensureValidToken();
    const apiUrl = `${process.env.BITRIX_DOMAIN}/rest/crm.deal.update.json/?ID=${dealId}&auth=${accessToken}`;

    const fieldsToUpdate = {
        UF_CRM_668BB634B111F: callFailedCode,
        UF_CRM_66C2B64134A71: callDuration,
        UF_CRM_1733474117: convertTimezone(callstartdate, 7),
    };

    await axios.post(apiUrl, { fields: fieldsToUpdate });
    res.send(`✅ Deal ID ${dealId} updated successfully.`);
}

// Hàm cập nhật Contact
async function updateContactField(contactId, callFailedCode, callDuration, callstartdate, res) {
    const accessToken = await ensureValidToken();
    const apiUrl = `${process.env.BITRIX_DOMAIN}/rest/crm.contact.update.json/?ID=${contactId}&auth=${accessToken}`;

    const fieldsToUpdate = {
        UF_CRM_66CBE81B02C06: callDuration,
        UF_CRM_668F763F5D533: callFailedCode,
        UF_CRM_1733471904291: convertTimezone(callstartdate, 7),
    };

    await axios.post(apiUrl, { fields: fieldsToUpdate });
    res.send(`✅ Contact ID ${contactId} updated successfully.`);
}

// Tìm Deal ID từ Contact ID
async function findDealByContact(contactId) {
    const accessToken = await ensureValidToken();
    const apiUrl = `${process.env.BITRIX_DOMAIN}/rest/crm.deal.list/?FILTER[CONTACT_ID]=${contactId}&auth=${accessToken}`;

    const response = await axios.get(apiUrl);
    return response.data?.result?.[0]?.ID;
}

// Chuyển đổi múi giờ
function convertTimezone(dateString, targetOffset) {
    const date = new Date(dateString);
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    return new Date(utc + targetOffset * 3600000).toISOString();
}

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
