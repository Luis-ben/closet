"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = request;
function request(options) {
    const app = getApp();
    const baseUrl = app.globalData.apiBaseUrl;
    const token = app.globalData.token;
    return new Promise((resolve, reject) => {
        var _a;
        wx.request({
            url: `${baseUrl}${options.url}`,
            method: (_a = options.method) !== null && _a !== void 0 ? _a : "GET",
            data: options.data,
            header: Object.assign({ "content-type": "application/json" }, (token ? { Authorization: `Bearer ${token}` } : {})),
            success(response) {
                var _a;
                const body = response.data;
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve(body);
                    return;
                }
                reject((_a = body.error) !== null && _a !== void 0 ? _a : new Error("请求失败"));
            },
            fail(error) {
                reject(error);
            }
        });
    });
}
