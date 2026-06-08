"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../utils/request");
const feedback_1 = require("../../utils/feedback");
const recentTaskStorageKey = "recentOutfitTasks";
const pendingStyleStorageKey = "pendingTryonStyle";
const pendingClothingItemIdsStorageKey = "pendingTryonClothingItemIds";
const styleLabelMap = {
    clean_realistic: "简洁写实",
    commute: "通勤",
    casual: "休闲",
    date: "约会",
    premium: "高级感",
    travel: "旅行"
};
const styleTemplates = [
    { title: "通勤", value: "commute", description: "利落、克制，适合办公室", tone: "冷静蓝灰" },
    { title: "约会", value: "date", description: "柔和一点，保留氛围感", tone: "柔光浅粉" },
    { title: "周末", value: "casual", description: "舒适自然，适合日常出门", tone: "轻松绿色" },
    { title: "旅行", value: "travel", description: "轻松上镜，颜色更明亮", tone: "晴天蓝" },
    { title: "高级感", value: "premium", description: "更干净的光影和质感", tone: "黑白低饱和" },
    { title: "极简", value: "clean_realistic", description: "简洁写实，少做夸张修饰", tone: "干净白底" }
];
const cubeSlotDefs = [
    { label: "上装", categories: ["top", "outerwear"], className: "slot-top" },
    { label: "下装", categories: ["bottom", "dress"], className: "slot-bottom" },
    { label: "鞋包", categories: ["shoes", "bag", "accessory"], className: "slot-shoes" }
];
const categoryLabelMap = {
    top: "上衣",
    bottom: "下装",
    dress: "裙装",
    shoes: "鞋包",
    bag: "包袋",
    accessory: "配饰",
    outerwear: "外套"
};
Page({
    data: {
        loading: false,
        recentResults: [],
        styleTemplates,
        clothingItems: [],
        cubeSlots: cubeSlotDefs.map((slot) => ({
            label: slot.label,
            itemId: "",
            imageUrl: "",
            hint: "待上传",
            filled: false,
            className: `cube-slot ${slot.className}`
        })),
        cubeItemIds: [],
        cubeReady: false,
        cubeTitle: "搭配魔方",
        cubeDesc: "从衣柜里自动拼一套，上装、下装和鞋包都能单独替换。",
        cubeButtonText: "使用这套",
        cubeIndex: 0,
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
            const cubeState = this.buildCubeState(clothingItems, this.data.cubeIndex);
            this.setData(Object.assign(Object.assign({ recentResults,
                clothingItems }, cubeState), { recommendationTitle: clothingItems.length ? "衣柜推荐组合" : "先上传衣服", recommendationDesc: clothingItems.length
                    ? "从你的衣柜里先挑几件，去试穿页微调"
                    : "衣柜有单品后，会在这里展示推荐组合", recommendationItems: clothingItems.slice(0, 3), loading: false }));
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
    sortItems(items) {
        return [...items].sort((a, b) => {
            var _a, _b;
            const bTime = new Date((_a = b.createdAt) !== null && _a !== void 0 ? _a : 0).getTime();
            const aTime = new Date((_b = a.createdAt) !== null && _b !== void 0 ? _b : 0).getTime();
            return bTime - aTime;
        });
    },
    pickItemByCategories(items, categories, offset, usedIds) {
        const pool = this.sortItems(items).filter((item) => categories.includes(item.category) && !usedIds.includes(item._id));
        if (!pool.length) {
            return null;
        }
        return pool[offset % pool.length];
    },
    buildCubeState(items, cubeIndex) {
        const usedIds = [];
        const cubeSlots = cubeSlotDefs.map((slot, slotIndex) => {
            var _a, _b, _c;
            const picked = this.pickItemByCategories(items, slot.categories, cubeIndex + slotIndex, usedIds);
            if (picked) {
                usedIds.push(picked._id);
            }
            return {
                label: slot.label,
                itemId: (_a = picked === null || picked === void 0 ? void 0 : picked._id) !== null && _a !== void 0 ? _a : "",
                imageUrl: (_b = picked === null || picked === void 0 ? void 0 : picked.imageUrl) !== null && _b !== void 0 ? _b : "",
                hint: picked ? `${(_c = categoryLabelMap[picked.category]) !== null && _c !== void 0 ? _c : picked.category} · ${picked.color}` : "待上传",
                filled: Boolean(picked),
                className: picked
                    ? `cube-slot ${slot.className} is-filled`
                    : `cube-slot ${slot.className}`
            };
        });
        const cubeReady = usedIds.length > 0;
        return {
            cubeSlots,
            cubeItemIds: usedIds,
            cubeReady,
            cubeTitle: cubeReady ? "搭配魔方" : "搭配魔方待填充",
            cubeDesc: cubeReady
                ? `已拼好 ${usedIds.length} 件衣物，可直接带去 AI 试穿。`
                : "先上传几件上衣、下装或鞋包，魔方会自动组成一套。",
            cubeButtonText: cubeReady ? "使用这套" : "去上传衣服"
        };
    },
    refreshCube(cubeIndex) {
        this.setData(Object.assign({ cubeIndex }, this.buildCubeState(this.data.clothingItems, cubeIndex)));
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
    onShuffleCube() {
        this.refreshCube(this.data.cubeIndex + 1);
    },
    onUseCube() {
        if (!this.data.cubeReady) {
            wx.switchTab({
                url: "/pages/closet/index"
            });
            return;
        }
        wx.setStorageSync(pendingClothingItemIdsStorageKey, this.data.cubeItemIds);
        wx.switchTab({
            url: "/pages/tryon/index"
        });
    },
    onUseTemplate(event) {
        const style = event.currentTarget.dataset.style;
        wx.setStorageSync(pendingStyleStorageKey, style);
        wx.switchTab({
            url: "/pages/tryon/index"
        });
    }
});
