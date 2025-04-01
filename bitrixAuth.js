const axios = require("axios");
require("dotenv").config();

let BITRIX_ACCESS_TOKEN = process.env.BITRIX_ACCESS_TOKEN;
let BITRIX_REFRESH_TOKEN = process.env.BITRIX_REFRESH_TOKEN;
const BITRIX_DOMAIN = process.env.BITRIX_DOMAIN;

// ⚙️ Thông tin Railway API
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const ENV_ID = process.env.RAILWAY_ENV_ID;

async function refreshBitrixToken() {
  try {
    const url = `${BITRIX_DOMAIN}/oauth/token/`;
    const params = {
      grant_type: "refresh_token",
      client_id: process.env.BITRIX_CLIENT_ID,
      client_secret: process.env.BITRIX_CLIENT_SECRET,
      refresh_token: BITRIX_REFRESH_TOKEN
    };

    const response = await axios.post(url, params);
    if (response.data.access_token) {
      BITRIX_ACCESS_TOKEN = response.data.access_token;
      BITRIX_REFRESH_TOKEN = response.data.refresh_token;

      console.log("✅ Token refreshed successfully!");

      // Cập nhật vào biến môi trường của Node.js
      process.env.BITRIX_ACCESS_TOKEN = BITRIX_ACCESS_TOKEN;
      process.env.BITRIX_REFRESH_TOKEN = BITRIX_REFRESH_TOKEN;

      // 🔄 Gọi API cập nhật token vào Railway Variables
      await updateRailwayToken("BITRIX_ACCESS_TOKEN", BITRIX_ACCESS_TOKEN);
      await updateRailwayToken("BITRIX_REFRESH_TOKEN", BITRIX_REFRESH_TOKEN);
    } else {
      throw new Error("Failed to refresh token");
    }
  } catch (error) {
    console.error("❌ Error refreshing token:", error.message);
  }
}

// 📌 Hàm cập nhật biến môi trường trên Railway
async function updateRailwayToken(variableName, variableValue) {
  try {
    const response = await axios.put(
      `https://backboard.railway.app/v1/projects/${PROJECT_ID}/environments/${ENV_ID}/variables`,
      [{ name: variableName, value: variableValue }],
      {
        headers: {
          Authorization: `Bearer ${RAILWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Updated Railway variable: ${variableName}`);
  } catch (error) {
    console.error(`❌ Failed to update Railway variable: ${variableName}`, error.response?.data || error.message);
  }
}

// 📌 Gửi request Bitrix API + kiểm tra lỗi 401
async function bitrixRequest(endpoint, method = "POST", data = {}) {
  try {
    const url = `${BITRIX_DOMAIN}/rest/${endpoint}`;
    const response = await axios({
      url,
      method,
      data,
      headers: { Authorization: `Bearer ${BITRIX_ACCESS_TOKEN}` }
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.warn("🔄 Token expired. Refreshing...");
      await refreshBitrixToken();

      // Gửi lại request với token mới
      return bitrixRequest(endpoint, method, data);
    } else {
      console.error("❌ Bitrix API error:", error.message);
      throw error;
    }
  }
}

module.exports = bitrixRequest;
/*const axios = require("axios");

let accessToken = "";
let refreshToken = process.env.BITRIX_REFRESH_TOKEN;

// 🌍 Lấy domain Bitrix từ biến môi trường
const BITRIX_DOMAIN = process.env.BITRIX_DOMAIN;

// 🔄 Hàm refresh Access Token
async function refreshAccessToken() {
    try {
        const response = await axios.get(`${BITRIX_DOMAIN}/oauth/token/`, {
            params: {
                grant_type: "refresh_token",
                client_id: process.env.BITRIX_CLIENT_ID,
                client_secret: process.env.BITRIX_CLIENT_SECRET,
                refresh_token: refreshToken,
            },
        });

        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token; // Cập nhật refresh token mới
        console.log("🔄 Token refreshed successfully!", accessToken);
    } catch (error) {
        console.error("❌ Error refreshing token:", error.response?.data || error.message);
        throw new Error("Failed to refresh access token");
    }
}

// 🌟 Middleware đảm bảo token hợp lệ trước khi gửi request
async function ensureValidToken() {
    if (!accessToken) {
        await refreshAccessToken();
    }
    return accessToken;
}

// 🚀 Gửi request tới Bitrix24
async function bitrixRequest(method, httpMethod = "POST", params = {}) {
    try {
        const token = await ensureValidToken(); // 🔄 Đảm bảo token hợp lệ
        const url = `${BITRIX_DOMAIN}/rest/${method}?auth=${token}`; // 🔥 Sử dụng token đúng

        console.log(`📤 Sending request to: ${url}`);

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
/*const axios = require("axios");

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
        const url = `${process.env.BITRIX_DOMAIN}/rest/${process.env.BITRIX_AUTH_TOKEN}/${method}`;
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
*/
