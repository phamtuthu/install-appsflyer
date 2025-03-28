const axios = require("axios");

let accessToken = "";
let refreshToken = process.env.BITRIX_REFRESH_TOKEN;

// Hàm lấy access token mới bằng refresh token
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
    }
}

// Middleware để đảm bảo access token hợp lệ trước khi gọi API
async function ensureValidToken() {
    if (!accessToken) {
        await refreshAccessToken();
    }
    return accessToken;
}

// Gửi request tới Bitrix24

async function bitrixRequest(method, httpMethod = "POST", params = {}) {
    try {
        const url = `${process.env.BITRIX_DOMAIN}/rest/${process.env.BITRIX_AUTH_TOKEN}${method}`;
        const response = await axios({
            method: httpMethod,
            url: url,
            data: params,
            headers: { "Content-Type": "application/json" },
        });

        if (response.data.error) {
            throw new Error(`❌ Bitrix API error: ${response.data.error_description || response.data.error}`);
        }

        return response.data;
    } catch (error) {
        console.error(`❌ Bitrix API request failed: ${error.message}`);
        throw error;
    }
}

module.exports = bitrixRequest;
