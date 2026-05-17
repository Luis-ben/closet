"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../utils/request");
const feedback_1 = require("../../utils/feedback");
Page({
    data: {
        credits: 0,
        nickname: "微信用户",
        avatarUrl: "",
        avatarText: "我",
        planText: "FREE",
        loading: false
    },
    onShow() {
        this.loadProfile();
    },
    async loadProfile() {
        var _a, _b;
        this.setData({
            loading: true
        });
        try {
            const response = await (0, request_1.request)({
                url: "/users/me"
            });
            const user = (_a = response.data) === null || _a === void 0 ? void 0 : _a.user;
            const nickname = (user === null || user === void 0 ? void 0 : user.nickname) || "微信用户";
            this.setData({
                credits: (_b = user === null || user === void 0 ? void 0 : user.credits) !== null && _b !== void 0 ? _b : 0,
                nickname,
                avatarUrl: (user === null || user === void 0 ? void 0 : user.avatarUrl) || "",
                avatarText: nickname.slice(0, 1),
                planText: ((user === null || user === void 0 ? void 0 : user.plan) || "free").toUpperCase(),
                loading: false
            });
        }
        catch (_c) {
            this.setData({
                loading: false
            });
            (0, feedback_1.showToast)("资料加载失败");
        }
    },
    onOpenModel() {
        wx.navigateTo({
            url: "/pages/model/index"
        });
    },
    onOpenWorks() {
        wx.switchTab({
            url: "/pages/inspiration/index"
        });
    },
    onOpenPrivacy() {
        wx.navigateTo({
            url: "/pages/privacy/index"
        });
    },
    onContact() {
        (0, feedback_1.showToast)("客服能力即将接入");
    },
    onAbout() {
        (0, feedback_1.showToast)("AI 衣镜 v0.1.0");
    },
    onGetCredits() {
        (0, feedback_1.showToast)("购买功能即将开放");
    }
});
