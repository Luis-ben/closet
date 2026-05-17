"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../utils/request");
const feedback_1 = require("../../utils/feedback");
const recentTaskStorageKey = "recentOutfitTasks";
const pendingStyleStorageKey = "pendingTryonStyle";
const styleLabelMap = {
    clean_realistic: "简洁写实",
    commute: "通勤",
    casual: "休闲",
    date: "约会",
    premium: "高级感",
    travel: "旅行"
};
const styleTemplates = [
    { title: "通勤", value: "commute", description: "利落、克制，适合办公室" },
    { title: "约会", value: "date", description: "柔和一点，保留氛围感" },
    { title: "周末", value: "casual", description: "舒适自然，适合日常出门" },
    { title: "旅行", value: "travel", description: "轻松上镜，颜色更明亮" },
    { title: "高级感", value: "premium", description: "更干净的光影和质感" },
    { title: "极简", value: "clean_realistic", description: "简洁写实，少做夸张修饰" }
];
Page({
    data: {
        loading: false,
        recentResults: [],
        styleTemplates,
        clothingItems: [],
        recommendationTitle: "先上传衣服",
        recommendationDesc: "衣柜有单品后，会在这里展示推荐组合",
        recommendationItems: []
    },
    onShow() {
        this.loadInspiration();
    },
    async loadInspiration() {
        var _a, _b;
        this.setData({
            loading: true
        });
        try {
            const [recentResults, clothingResponse] = await Promise.all([
                this.loadRecentResults(),
                (0, request_1.request)({ url: "/clothing-items" })
            ]);
            const clothingItems = (_b = (_a = clothingResponse.data) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [];
            this.setData({
                recentResults,
                clothingItems,
                recommendationTitle: clothingItems.length ? "衣柜推荐组合" : "先上传衣服",
                recommendationDesc: clothingItems.length
                    ? "从你的衣柜里先挑几件，去试穿页微调"
                    : "衣柜有单品后，会在这里展示推荐组合",
                recommendationItems: clothingItems.slice(0, 3),
                loading: false
            });
        }
        catch (_c) {
            this.setData({
                loading: false
            });
            (0, feedback_1.showToast)("灵感加载失败");
        }
    },
    async loadRecentResults() {
        const cachedTasks = (wx.getStorageSync(recentTaskStorageKey) || []).slice(0, 10);
        const results = await Promise.all(cachedTasks.map(async (cachedTask) => {
            var _a, _b, _c;
            try {
                const response = await (0, request_1.request)({
                    url: `/ai/tasks/${cachedTask.taskId}`
                });
                const task = (_a = response.data) === null || _a === void 0 ? void 0 : _a.task;
                if (!task || task.status !== "success" || !task.resultImageUrl) {
                    return null;
                }
                return {
                    taskId: cachedTask.taskId,
                    imageUrl: task.resultImageUrl,
                    title: (_c = styleLabelMap[(_b = task.style) !== null && _b !== void 0 ? _b : ""]) !== null && _c !== void 0 ? _c : cachedTask.styleText,
                    subtitle: `${task.clothingItemIds.length} 件衣物`
                };
            }
            catch (_d) {
                return cachedTask.resultImageUrl
                    ? {
                        taskId: cachedTask.taskId,
                        imageUrl: cachedTask.resultImageUrl,
                        title: cachedTask.styleText,
                        subtitle: `${cachedTask.clothingCount} 件衣物`
                    }
                    : null;
            }
        }));
        return results.filter((item) => Boolean(item));
    },
    onGoTryon() {
        wx.switchTab({
            url: "/pages/tryon/index"
        });
    },
    onOpenResult(event) {
        const taskId = event.currentTarget.dataset.id;
        if (!taskId) {
            return;
        }
        wx.navigateTo({
            url: `/pages/result/detail?taskId=${taskId}`
        });
    },
    onUseTemplate(event) {
        const style = event.currentTarget.dataset.style;
        // TODO: When tryon supports richer template params, pass scene presets here too.
        wx.setStorageSync(pendingStyleStorageKey, style);
        wx.switchTab({
            url: "/pages/tryon/index"
        });
    }
});
