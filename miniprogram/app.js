"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./utils/config");
const request_1 = require("./utils/request");
App({
    globalData: {
        apiBaseUrl: config_1.runtimeConfig.apiBaseUrl,
        token: config_1.runtimeConfig.enableMockTokenFallback ? config_1.runtimeConfig.mockToken : "",
        loginPromise: null
    },
    onLaunch() {
        try {
            (0, config_1.assertRuntimeConfig)();
        }
        catch (error) {
            wx.showModal({
                title: "配置不可发布",
                content: error instanceof Error ? error.message : "当前运行配置不适合正式发布",
                showCancel: false
            });
            return;
        }
        this.globalData.loginPromise = this.loginWithWechat();
    },
    async loginWithWechat() {
        var _a;
        try {
            const code = await this.getWechatLoginCode();
            const response = await (0, request_1.request)({
                url: "/auth/wechat-login",
                method: "POST",
                data: {
                    code
                },
                skipAuth: true
            });
            const token = (_a = response.data) === null || _a === void 0 ? void 0 : _a.token;
            if (token) {
                this.globalData.token = token;
            }
        }
        catch (_b) {
            if (!config_1.runtimeConfig.enableMockTokenFallback) {
                this.globalData.token = "";
            }
        }
    },
    getWechatLoginCode() {
        return new Promise((resolve, reject) => {
            wx.login({
                success(result) {
                    if (result.code) {
                        resolve(result.code);
                        return;
                    }
                    reject(new Error("微信登录失败"));
                },
                fail(error) {
                    reject(error);
                }
            });
        });
    }
});
