"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const feedback_1 = require("../../utils/feedback");
const request_1 = require("../../utils/request");
const upload_1 = require("../../utils/upload");
const defaultModelImage = "https://placehold.co/768x1024/png?text=Default+Model";
const auditTextMap = {
    pending: "审核中",
    pass: "可使用",
    reject: "未通过"
};
Page({
    data: {
        loading: false,
        currentModelImage: defaultModelImage,
        currentModelName: "系统默认模特",
        currentModelTypeText: "系统默认模特",
        currentAuditText: "可使用",
        hasPersonalModel: false,
        modelCards: []
    },
    onShow() {
        this.loadModel();
    },
    async loadModel() {
        var _a, _b, _c, _d, _e;
        this.setData({
            loading: true
        });
        try {
            const response = await (0, request_1.request)({
                url: "/user-photos"
            });
            const items = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [];
            const preferredType = wx.getStorageSync("preferredModelType");
            const preferredModelId = wx.getStorageSync("preferredModelPhotoId");
            const activeModel = preferredType === "default_model"
                ? null
                : (_d = (_c = items.find((item) => item._id === preferredModelId)) !== null && _c !== void 0 ? _c : items.find((item) => item.isActiveModel)) !== null && _d !== void 0 ? _d : null;
            const modelCards = items.map((item) => {
                var _a;
                return (Object.assign(Object.assign({}, item), { auditText: (_a = auditTextMap[item.auditStatus]) !== null && _a !== void 0 ? _a : "未知", selected: Boolean(activeModel && item._id === activeModel._id) }));
            });
            this.setData({
                currentModelImage: (_e = activeModel === null || activeModel === void 0 ? void 0 : activeModel.imageUrl) !== null && _e !== void 0 ? _e : defaultModelImage,
                currentModelName: (activeModel === null || activeModel === void 0 ? void 0 : activeModel.displayName) || "系统默认模特",
                currentModelTypeText: activeModel ? "我的专属模特" : "系统默认模特",
                currentAuditText: activeModel ? auditTextMap[activeModel.auditStatus] : "可使用",
                hasPersonalModel: Boolean(activeModel),
                modelCards,
                loading: false
            });
        }
        catch (_f) {
            this.setData({
                loading: false
            });
            (0, feedback_1.showToast)("模特加载失败");
        }
    },
    async onUploadModel() {
        var _a;
        const uploaded = await (0, upload_1.chooseMockImage)();
        if (!uploaded) {
            return;
        }
        (0, feedback_1.showLoading)("保存中");
        try {
            const response = await (0, request_1.request)({
                url: "/user-photos",
                method: "POST",
                data: {
                    imageUrl: uploaded.imageUrl,
                    imageMeta: uploaded.imageMeta,
                    displayName: "我的模特"
                }
            });
            const photo = (_a = response.data) === null || _a === void 0 ? void 0 : _a.photo;
            if (photo) {
                wx.setStorageSync("preferredModelType", "personal_model");
                wx.setStorageSync("preferredModelPhotoId", photo._id);
            }
            (0, feedback_1.showToast)("已设置", "success");
            this.loadModel();
        }
        catch (_b) {
            (0, feedback_1.showToast)("保存失败");
        }
        finally {
            (0, feedback_1.hideLoading)();
        }
    },
    onUseDefault() {
        wx.setStorageSync("preferredModelType", "default_model");
        wx.removeStorageSync("preferredModelPhotoId");
        this.setData({
            currentModelImage: defaultModelImage,
            currentModelName: "系统默认模特",
            currentModelTypeText: "系统默认模特",
            currentAuditText: "可使用",
            hasPersonalModel: false,
            modelCards: this.data.modelCards.map((item) => (Object.assign(Object.assign({}, item), { selected: false })))
        });
        (0, feedback_1.showToast)("已切换为默认模特", "success");
    },
    async onSelectLocalModel(event) {
        const id = event.currentTarget.dataset.id;
        const model = this.data.modelCards.find((item) => item._id === id);
        if (!model) {
            return;
        }
        if (model.auditStatus !== "pass") {
            (0, feedback_1.showToast)("该模特暂不可使用");
            return;
        }
        (0, feedback_1.showLoading)("切换中");
        try {
            await (0, request_1.request)({
                url: `/user-photos/${model._id}/activate`,
                method: "POST"
            });
            wx.setStorageSync("preferredModelType", "personal_model");
            wx.setStorageSync("preferredModelPhotoId", model._id);
            this.setData({
                currentModelImage: model.imageUrl,
                currentModelName: model.displayName,
                currentModelTypeText: "我的专属模特",
                currentAuditText: auditTextMap[model.auditStatus],
                hasPersonalModel: true,
                modelCards: this.data.modelCards.map((item) => (Object.assign(Object.assign({}, item), { selected: item._id === id })))
            });
            (0, feedback_1.showToast)("已切换模特", "success");
        }
        catch (_a) {
            (0, feedback_1.showToast)("切换失败，请稍后重试");
        }
        finally {
            (0, feedback_1.hideLoading)();
        }
    }
});
