"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showToast = showToast;
exports.showLoading = showLoading;
exports.hideLoading = hideLoading;
exports.showConfirm = showConfirm;
function showToast(title, icon = "none") {
    wx.showToast({
        title,
        icon
    });
}
function showLoading(title = "加载中") {
    wx.showLoading({
        title,
        mask: true
    });
}
function hideLoading() {
    wx.hideLoading();
}
function showConfirm(content) {
    return new Promise((resolve) => {
        wx.showModal({
            title: "确认",
            content,
            confirmText: "确定",
            cancelText: "取消",
            success(result) {
                resolve(result.confirm);
            },
            fail() {
                resolve(false);
            }
        });
    });
}
