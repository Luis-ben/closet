"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chooseMockImage = chooseMockImage;
const feedback_1 = require("./feedback");
const request_1 = require("./request");
const maxImageSizeBytes = 5 * 1024 * 1024;
async function chooseMockImage(options = {}) {
    var _a;
    const authorized = await ensurePrivacyAuthorized();
    if (!authorized) {
        return null;
    }
    const localImage = await chooseLocalImage((_a = options.sourceType) !== null && _a !== void 0 ? _a : "album");
    if (!localImage) {
        return null;
    }
    (0, feedback_1.showLoading)("上传中");
    try {
        return await uploadImageFile(localImage);
    }
    catch (_b) {
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
function chooseLocalImage(sourceType) {
    return new Promise((resolve) => {
        wx.chooseMedia({
            count: 1,
            mediaType: ["image"],
            sourceType: [sourceType],
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
async function uploadImageFile(file) {
    const mimeType = getMimeType(file.tempFilePath);
    const tokenResponse = await (0, request_1.request)({
        url: "/uploads/image-token",
        method: "POST",
        data: {
            fileName: file.tempFilePath.split("/").pop() || "image.png",
            mimeType,
            sizeBytes: file.size
        }
    });
    const uploadToken = tokenResponse.data;
    if (!uploadToken) {
        throw new Error("上传凭证获取失败");
    }
    if (uploadToken.provider === "wechat-cloud") {
        return uploadToWechatCloud(file.tempFilePath, uploadToken);
    }
    if (uploadToken.provider === "cos") {
        return uploadToCos(file.tempFilePath, uploadToken);
    }
    return uploadToLocalServer(file.tempFilePath);
}
function uploadToLocalServer(filePath) {
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
function uploadToCos(filePath, uploadToken) {
    const uploadUrl = uploadToken.uploadUrl;
    const imageUrl = uploadToken.imageUrl;
    if (!uploadUrl || !imageUrl) {
        return Promise.reject(new Error("COS 上传凭证不完整"));
    }
    return new Promise((resolve, reject) => {
        wx.getFileSystemManager().readFile({
            filePath,
            success(fileResult) {
                var _a;
                wx.request({
                    url: uploadUrl,
                    method: "PUT",
                    data: fileResult.data,
                    header: (_a = uploadToken.headers) !== null && _a !== void 0 ? _a : {},
                    success(result) {
                        if (result.statusCode >= 200 && result.statusCode < 300) {
                            resolve({
                                imageUrl,
                                imageMeta: uploadToken.imageMeta
                            });
                            return;
                        }
                        reject(new Error("COS 上传失败"));
                    },
                    fail(error) {
                        reject(error);
                    }
                });
            },
            fail(error) {
                reject(error);
            }
        });
    });
}
function uploadToWechatCloud(filePath, uploadToken) {
    const cloudPath = uploadToken.cloudPath;
    const imageUrl = uploadToken.imageUrl;
    if (!cloudPath || !imageUrl) {
        return Promise.reject(new Error("微信云上传凭证不完整"));
    }
    return new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
            cloudPath,
            filePath,
            success() {
                resolve({
                    imageUrl,
                    imageMeta: uploadToken.imageMeta
                });
            },
            fail(error) {
                reject(error);
            }
        });
    });
}
function getMimeType(filePath) {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
        return "image/jpeg";
    }
    if (lowerPath.endsWith(".webp")) {
        return "image/webp";
    }
    return "image/png";
}
