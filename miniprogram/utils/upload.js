"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseMockImage = chooseMockImage;
const feedback_1 = require("./feedback");
const maxImageSizeBytes = 5 * 1024 * 1024;
async function chooseMockImage() {
    const authorized = await ensurePrivacyAuthorized();
    if (!authorized) {
        return null;
    }
    const localImage = await chooseLocalImage();
    if (!localImage) {
        return null;
    }
    (0, feedback_1.showLoading)("上传中");
    try {
        return await uploadImageFile(localImage.tempFilePath);
    }
    catch (_a) {
        (0, feedback_1.showToast)("图片上传失败，请稍后重试");
        return null;
    }
    finally {
        (0, feedback_1.hideLoading)();
    }
}
function ensurePrivacyAuthorized() {
    const maybeAuthorize = wx.requirePrivacyAuthorize;
    if (!maybeAuthorize) {
        return Promise.resolve(true);
    }
    return new Promise((resolve) => {
        maybeAuthorize({
            success() {
                resolve(true);
            },
            fail() {
                (0, feedback_1.showToast)("需要授权后才能选择图片");
                resolve(false);
            }
        });
    });
}
function chooseLocalImage() {
    return new Promise((resolve) => {
        wx.chooseMedia({
            count: 1,
            mediaType: ["image"],
            sourceType: ["album", "camera"],
            success(result) {
                const file = result.tempFiles[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                if (file.size > maxImageSizeBytes) {
                    (0, feedback_1.showToast)("图片不能超过 5MB");
                    resolve(null);
                    return;
                }
                resolve(file);
            },
            fail() {
                resolve(null);
            }
        });
    });
}
function uploadImageFile(filePath) {
    const app = getApp();
    const token = app.globalData.token;
    return new Promise((resolve, reject) => {
        wx.uploadFile({
            url: `${app.globalData.apiBaseUrl}/uploads/image`,
            filePath,
            name: "file",
            header: Object.assign({}, (token ? { Authorization: `Bearer ${token}` } : {})),
            success(result) {
                var _a, _b;
                try {
                    const response = JSON.parse(result.data);
                    if (result.statusCode >= 200 && result.statusCode < 300 && response.success && response.data) {
                        resolve(response.data);
                        return;
                    }
                    (0, feedback_1.showToast)(((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "图片上传失败");
                    reject(new Error(((_b = response.error) === null || _b === void 0 ? void 0 : _b.message) || "图片上传失败"));
                }
                catch (_c) {
                    reject(new Error("图片上传响应异常"));
                }
            },
            fail(error) {
                reject(error);
            }
        });
    });
}
