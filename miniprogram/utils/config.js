"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtimeConfig = void 0;
exports.assertRuntimeConfig = assertRuntimeConfig;
exports.runtimeConfig = {
    // Before submitting for review, replace this with a configured HTTPS request domain.
    apiBaseUrl: "http://localhost:3000/api",
    enableMockTokenFallback: true,
    mockToken: "mock-token-user_mock_001"
};
function assertRuntimeConfig() {
    var _a, _b, _c;
    const accountInfo = (_a = wx.getAccountInfoSync) === null || _a === void 0 ? void 0 : _a.call(wx);
    const envVersion = (_c = (_b = accountInfo === null || accountInfo === void 0 ? void 0 : accountInfo.miniProgram) === null || _b === void 0 ? void 0 : _b.envVersion) !== null && _c !== void 0 ? _c : "develop";
    const isRelease = envVersion === "release";
    const usesLocalhost = /^http:\/\/localhost(?::\d+)?\/api$/i.test(exports.runtimeConfig.apiBaseUrl);
    if (isRelease && usesLocalhost) {
        throw new Error("正式版小程序不能使用 localhost API 地址");
    }
    if (isRelease && exports.runtimeConfig.enableMockTokenFallback) {
        throw new Error("正式版小程序不能启用 mock token fallback");
    }
}
