const axios = require("axios");

// Biến lưu token
let accessToken = "";
let refreshToken = process.env.BITRIX_REFRESH_TOKEN;

// 🔄 Hàm refresh access token bằng refresh token
async function refreshAccessToken() {
    try {
        const response = await axios.get(`${process.env.BITRIX_DOMAIN}/oauth/token/`, {
            params: {
                grant_type: "refresh_token",
                client_id: process.env.BITRIX_CLIENT_ID,
                client_secret: process.env.BITRIX_CLIENT_SECRET,
                refresh_token: refreshToken,
            },
        });

        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token; // Cập nhật refresh token mới
        console.log("🔄 Token refreshed successfully!");
    } catch (error) {
        console.error("❌ Error refreshing token:", error.response?.data || error.message);
        throw new Error("Failed to refresh token");
    }
}

// ✅ Middleware đảm bảo có token hợp lệ trước khi gọi API
async function ensureValidToken() {
    if (!accessToken) {
        await refreshAccessToken();
    }
    return accessToken;
}

// 📌 Hàm gửi request tới Bitrix24 API
async function bitrixRequest(method, endpoint, data = {}) {
    try {
        const token = await ensureValidToken(); // Đảm bảo token hợp lệ

        const url = `${process.env.BITRIX_DOMAIN}/rest/${endpoint}`;

        const response = await axios({
            method,
            url,
            data,
            params: { auth: token },
        });

        return response.data;
    } catch (error) {
        console.error("❌ Bitrix API error:", error.response?.data || error.message);
        throw error;
    }
}

// ✅ Export đúng
module.exports = bitrixRequest;
