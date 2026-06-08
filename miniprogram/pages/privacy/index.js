"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../utils/request");
const feedback_1 = require("../../utils/feedback");
const localStateKeys = {
    preferredModelType: "preferredModelType",
    preferredModelPhotoId: "preferredModelPhotoId",
    recentOutfitTasks: "recentOutfitTasks",
    pendingTryonClothingItemIds: "pendingTryonClothingItemIds",
    pendingTryonStyle: "pendingTryonStyle"
};
Page({
    confirmDanger(title, content) {
        return new Promise((resolve) => {
            wx.showModal({
                title,
                content,
                confirmText: "确认",
                confirmColor: "#D64545",
                cancelText: "取消",
                success(result) {
                    resolve(result.confirm);
                },
                fail() {
                    resolve(false);
                }
            });
        });
    },
    async onDeleteAllClothing() {
        const confirmed = await this.confirmDanger("删除全部衣物？", "删除后，衣物将不会出现在试穿选择中。");
        if (!confirmed) {
            return;
        }
        (0, feedback_1.showLoading)("删除中");
        try {
            await (0, request_1.request)({
                url: "/privacy/delete-clothing-items",
                method: "POST"
            });
            wx.removeStorageSync(localStateKeys.pendingTryonClothingItemIds);
            wx.removeStorageSync(localStateKeys.recentOutfitTasks);
            (0, feedback_1.showToast)("已删除衣物", "success");
        }
        catch (_a) {
            (0, feedback_1.showToast)("删除失败，请稍后重试");
        }
        finally {
            (0, feedback_1.hideLoading)();
        }
    },
    async onDeleteModels() {
        const confirmed = await this.confirmDanger("删除我的模特？", "删除后，将临时使用系统默认模特生成试穿图。");
        if (!confirmed) {
            return;
        }
        (0, feedback_1.showLoading)("删除中");
        try {
            await (0, request_1.request)({
                url: "/privacy/delete-models",
                method: "POST"
            });
            wx.setStorageSync(localStateKeys.preferredModelType, "default_model");
            wx.removeStorageSync(localStateKeys.preferredModelPhotoId);
            (0, feedback_1.showToast)("已删除模特", "success");
        }
        catch (_a) {
            (0, feedback_1.showToast)("删除失败，请稍后重试");
        }
        finally {
            (0, feedback_1.hideLoading)();
        }
    },
    async onDeleteAccount() {
        const confirmed = await this.confirmDanger("注销账号？", "账号数据会进入清理流程，此操作需要谨慎确认。");
        if (!confirmed) {
            return;
        }
        (0, feedback_1.showLoading)("提交中");
        try {
            await (0, request_1.request)({
                url: "/privacy/delete-account",
                method: "POST"
            });
            this.clearLocalAccountState();
            (0, feedback_1.showToast)("已提交删除", "success");
            wx.switchTab({
                url: "/pages/profile/index"
            });
        }
        catch (_a) {
            (0, feedback_1.showToast)("删除失败，请稍后重试");
        }
        finally {
            (0, feedback_1.hideLoading)();
        }
    },
    clearLocalAccountState() {
        const app = getApp();
        Object.keys(localStateKeys).forEach((key) => {
            const storageKey = localStateKeys[key];
            wx.removeStorageSync(storageKey);
        });
        app.globalData.token = "";
        app.globalData.loginPromise = null;
    }
});
