"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../utils/request");
const feedback_1 = require("../../utils/feedback");
const recentTaskStorageKey = "recentOutfitTasks";
Page({
    data: {
        taskId: "",
        resultImageUrl: "",
        imageLoadFailed: false,
        modelText: "默认模特",
        clothingCount: 0,
        styleText: "简洁写实",
        generatedAtText: "",
        loading: false
    },
    onLoad(options) {
        var _a;
        const taskId = (_a = options.taskId) !== null && _a !== void 0 ? _a : "";
        this.setData({
            taskId
        });
        this.loadResult(taskId);
    },
    async loadResult(taskId) {
        var _a, _b, _c, _d;
        if (!taskId) {
            (0, feedback_1.showToast)("缺少任务 ID");
            return;
        }
        this.setData({
            loading: true,
            imageLoadFailed: false
        });
        try {
            const response = await (0, request_1.request)({
                url: `/ai/tasks/${taskId}`
            });
            const task = (_a = response.data) === null || _a === void 0 ? void 0 : _a.task;
            const imageUrl = (_b = task === null || task === void 0 ? void 0 : task.resultImageUrl) !== null && _b !== void 0 ? _b : "";
            this.setData({
                resultImageUrl: imageUrl,
                modelText: (task === null || task === void 0 ? void 0 : task.modelType) === "personal_model" ? "我的专属模特" : "系统默认模特",
                clothingCount: (_c = task === null || task === void 0 ? void 0 : task.clothingItemIds.length) !== null && _c !== void 0 ? _c : 0,
                styleText: this.getStyleText((_d = task === null || task === void 0 ? void 0 : task.style) !== null && _d !== void 0 ? _d : null),
                generatedAtText: this.formatTime((task === null || task === void 0 ? void 0 : task.completedAt) || (task === null || task === void 0 ? void 0 : task.createdAt) || ""),
                loading: false
            });
            if (task && imageUrl) {
                this.updateRecentTask(task);
            }
        }
        catch (_e) {
            this.setData({
                loading: false
            });
            (0, feedback_1.showToast)("结果加载失败");
        }
    },
    updateRecentTask(task) {
        const tasks = (wx.getStorageSync(recentTaskStorageKey) || []).map((item) => {
            var _a;
            if (item.taskId !== task._id) {
                return item;
            }
            return Object.assign(Object.assign({}, item), { status: "success", resultImageUrl: (_a = task.resultImageUrl) !== null && _a !== void 0 ? _a : "", clothingCount: task.clothingItemIds.length });
        });
        wx.setStorageSync(recentTaskStorageKey, tasks);
    },
    getStyleText(style) {
        var _a;
        const styleMap = {
            commute: "通勤",
            casual: "休闲",
            date: "约会",
            clean_realistic: "简洁写实",
            premium: "高级感",
            travel: "旅行"
        };
        return style ? (_a = styleMap[style]) !== null && _a !== void 0 ? _a : style : "简洁写实";
    },
    formatTime(value) {
        if (!value) {
            return "刚刚";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "刚刚";
        }
        const month = `${date.getMonth() + 1}`.padStart(2, "0");
        const day = `${date.getDate()}`.padStart(2, "0");
        const hour = `${date.getHours()}`.padStart(2, "0");
        const minute = `${date.getMinutes()}`.padStart(2, "0");
        return `${month}-${day} ${hour}:${minute}`;
    },
    onImageError() {
        this.setData({
            imageLoadFailed: true
        });
    },
    saveLocalImage(filePath) {
        wx.saveImageToPhotosAlbum({
            filePath,
            success() {
                (0, feedback_1.showToast)("已保存到相册", "success");
            },
            fail() {
                wx.showModal({
                    title: "需要相册权限",
                    content: "请在设置中允许保存图片到相册。",
                    confirmText: "打开设置",
                    cancelText: "取消",
                    success(result) {
                        if (result.confirm) {
                            wx.openSetting({});
                        }
                    }
                });
            }
        });
    },
    onSave() {
        if (!this.data.resultImageUrl) {
            (0, feedback_1.showToast)("图片不可用");
            return;
        }
        (0, feedback_1.showLoading)("保存中");
        if (/^https?:\/\//.test(this.data.resultImageUrl)) {
            wx.downloadFile({
                url: this.data.resultImageUrl,
                success: (result) => {
                    (0, feedback_1.hideLoading)();
                    if (result.statusCode >= 200 && result.statusCode < 300) {
                        this.saveLocalImage(result.tempFilePath);
                        return;
                    }
                    (0, feedback_1.showToast)("图片下载失败");
                },
                fail: () => {
                    (0, feedback_1.hideLoading)();
                    (0, feedback_1.showToast)("图片下载失败");
                }
            });
            return;
        }
        (0, feedback_1.hideLoading)();
        this.saveLocalImage(this.data.resultImageUrl);
    },
    onRegenerate() {
        wx.switchTab({
            url: "/pages/tryon/index"
        });
    },
    onShareAppMessage() {
        return {
            title: "帮我看看这套穿搭",
            path: `/pages/result/detail?taskId=${this.data.taskId}`
        };
    }
});
