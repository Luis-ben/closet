"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../utils/request");
const feedback_1 = require("../../utils/feedback");
const defaultModelImage = "https://placehold.co/768x1024/png?text=Default+Model";
const recentTaskStorageKey = "recentOutfitTasks";
const pendingStyleStorageKey = "pendingTryonStyle";
const pendingClothingItemIdsStorageKey = "pendingTryonClothingItemIds";
const categoryOptions = [
    { label: "全部", value: "all" },
    { label: "上衣", value: "top" },
    { label: "下装", value: "bottom" },
    { label: "外套", value: "outerwear" },
    { label: "鞋包", value: "shoes_bags" },
    { label: "配饰", value: "accessory" }
];
const styleOptions = [
    { label: "简洁写实", value: "clean_realistic" },
    { label: "通勤", value: "commute" },
    { label: "休闲", value: "casual" },
    { label: "约会", value: "date" },
    { label: "高级感", value: "premium" },
    { label: "旅行", value: "travel" }
];
const categoryLabelMap = {
    top: "上衣",
    bottom: "下装",
    dress: "裙装",
    shoes: "鞋包",
    bag: "鞋包",
    accessory: "配饰",
    outerwear: "外套"
};
const styleLabelMap = styleOptions.reduce((map, item) => {
    map[item.value] = item.label;
    return map;
}, {});
const slotLabels = ["上衣", "下装", "鞋包"];
Page({
    data: {
        credits: 0,
        modelType: "default_model",
        modelTitle: "系统默认模特",
        modelPhotoId: "",
        modelImage: defaultModelImage,
        clothingItems: [],
        displayClothingItems: [],
        selectedClothingItems: [],
        selectedClothingItemIds: [],
        selectedSlots: slotLabels.map((label) => ({
            label,
            itemId: "",
            imageUrl: "",
            categoryLabel: "",
            hasItem: false
        })),
        categoryOptions,
        activeCategory: "all",
        styleOptions,
        styleValue: "clean_realistic",
        loading: false,
        submitting: false,
        outfitNotice: "",
        generateDisabled: true,
        generateButtonText: "请选择衣物",
        bottomText: "已选 0 件｜消耗 1 次"
    },
    onShow() {
        this.applyPendingStyle();
        this.loadPageData();
    },
    applyPendingStyle() {
        const pendingStyle = wx.getStorageSync(pendingStyleStorageKey);
        if (pendingStyle) {
            this.setData({
                styleValue: pendingStyle
            });
            wx.removeStorageSync(pendingStyleStorageKey);
        }
    },
    readPendingClothingItemIds() {
        const pendingIds = wx.getStorageSync(pendingClothingItemIdsStorageKey);
        if (!pendingIds) {
            return [];
        }
        wx.removeStorageSync(pendingClothingItemIdsStorageKey);
        return Array.isArray(pendingIds)
            ? pendingIds.filter((id) => typeof id === "string" && id)
            : [];
    },
    async loadPageData() {
        var _a, _b, _c, _d, _e, _f;
        this.setData({
            loading: true
        });
        try {
            const [meResponse, clothingResponse, photoResponse] = await Promise.all([
                (0, request_1.request)({ url: "/users/me" }),
                (0, request_1.request)({ url: "/clothing-items" }),
                (0, request_1.request)({ url: "/user-photos" })
            ]);
            const clothingItems = (_b = (_a = clothingResponse.data) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [];
            const pendingSelectedIds = this.readPendingClothingItemIds();
            const baseSelectedIds = pendingSelectedIds.length
                ? pendingSelectedIds
                : this.data.selectedClothingItemIds;
            const selectedClothingItemIds = baseSelectedIds.filter((id) => clothingItems.some((item) => item._id === id)).slice(0, 3);
            const modelState = this.resolveModel((_d = (_c = photoResponse.data) === null || _c === void 0 ? void 0 : _c.items) !== null && _d !== void 0 ? _d : []);
            this.setData(Object.assign(Object.assign({ credits: (_f = (_e = meResponse.data) === null || _e === void 0 ? void 0 : _e.user.credits) !== null && _f !== void 0 ? _f : 0 }, modelState), { clothingItems, outfitNotice: pendingSelectedIds.length
                    ? `已从搭配魔方带入 ${selectedClothingItemIds.length} 件衣物和推荐风格，可继续微调`
                    : "", loading: false }));
            this.syncView(selectedClothingItemIds, this.data.activeCategory);
        }
        catch (_g) {
            this.setData({
                loading: false
            });
            (0, feedback_1.showToast)("试穿台加载失败，请稍后重试");
            this.syncCanGenerate();
        }
    },
    resolveModel(items) {
        const preferredType = wx.getStorageSync("preferredModelType");
        const preferredModelId = wx.getStorageSync("preferredModelPhotoId");
        const passModels = items.filter((item) => item.auditStatus !== "reject");
        const preferredModel = passModels.find((item) => item._id === preferredModelId);
        const activeModel = passModels.find((item) => item.isActiveModel);
        const selectedModel = preferredType === "default_model" ? null : preferredModel !== null && preferredModel !== void 0 ? preferredModel : activeModel;
        if (!selectedModel) {
            return {
                modelType: "default_model",
                modelTitle: "系统默认模特",
                modelPhotoId: "",
                modelImage: defaultModelImage
            };
        }
        return {
            modelType: "personal_model",
            modelTitle: selectedModel.displayName || "我的专属模特",
            modelPhotoId: selectedModel._id,
            modelImage: selectedModel.imageUrl
        };
    },
    filterItems(items, category) {
        if (category === "all") {
            return items;
        }
        if (category === "shoes_bags") {
            return items.filter((item) => item.category === "shoes" || item.category === "bag");
        }
        return items.filter((item) => item.category === category);
    },
    toDisplayItems(items, selectedIds) {
        return items.map((item) => {
            var _a;
            return (Object.assign(Object.assign({}, item), { categoryLabel: (_a = categoryLabelMap[item.category]) !== null && _a !== void 0 ? _a : item.category, selected: selectedIds.includes(item._id) }));
        });
    },
    buildSelectedSlots(selectedItems) {
        return slotLabels.map((label) => {
            var _a, _b, _c;
            const item = selectedItems.find((selectedItem) => this.getSlotLabel(selectedItem.category) === label);
            return {
                label,
                itemId: (_a = item === null || item === void 0 ? void 0 : item._id) !== null && _a !== void 0 ? _a : "",
                imageUrl: (_b = item === null || item === void 0 ? void 0 : item.imageUrl) !== null && _b !== void 0 ? _b : "",
                categoryLabel: (_c = item === null || item === void 0 ? void 0 : item.categoryLabel) !== null && _c !== void 0 ? _c : "",
                hasItem: Boolean(item)
            };
        });
    },
    getSlotLabel(category) {
        if (category === "bottom" || category === "dress") {
            return "下装";
        }
        if (category === "shoes" || category === "bag" || category === "accessory") {
            return "鞋包";
        }
        return "上衣";
    },
    normalizeSelectedIds(selectedIds) {
        const nextIds = [];
        const usedSlots = [];
        selectedIds.forEach((id) => {
            const item = this.data.clothingItems.find((clothingItem) => clothingItem._id === id);
            if (!item) {
                return;
            }
            const slotLabel = this.getSlotLabel(item.category);
            if (usedSlots.includes(slotLabel)) {
                const replaceIndex = nextIds.findIndex((nextId) => {
                    const nextItem = this.data.clothingItems.find((clothingItem) => clothingItem._id === nextId);
                    return nextItem ? this.getSlotLabel(nextItem.category) === slotLabel : false;
                });
                if (replaceIndex >= 0) {
                    nextIds[replaceIndex] = id;
                }
                return;
            }
            usedSlots.push(slotLabel);
            nextIds.push(id);
        });
        return nextIds.slice(0, 3);
    },
    syncView(selectedClothingItemIds, activeCategory) {
        const normalizedSelectedIds = this.normalizeSelectedIds(selectedClothingItemIds);
        const allDisplayItems = this.toDisplayItems(this.data.clothingItems, normalizedSelectedIds);
        const selectedClothingItems = allDisplayItems.filter((item) => item.selected);
        const displayClothingItems = this.toDisplayItems(this.filterItems(this.data.clothingItems, activeCategory), normalizedSelectedIds);
        this.setData({
            selectedClothingItemIds: normalizedSelectedIds,
            selectedClothingItems,
            selectedSlots: this.buildSelectedSlots(selectedClothingItems),
            displayClothingItems
        });
        this.syncCanGenerate();
    },
    syncCanGenerate() {
        const selectedCount = this.data.selectedClothingItemIds.length;
        const hasCredits = this.data.credits > 0;
        const hasSelected = selectedCount > 0;
        const disabled = !hasCredits || !hasSelected || this.data.submitting;
        let buttonText = "生成试穿图";
        if (!hasSelected) {
            buttonText = "请选择衣物";
        }
        else if (!hasCredits) {
            buttonText = "次数不足";
        }
        this.setData({
            generateDisabled: disabled,
            generateButtonText: buttonText,
            bottomText: `已选 ${selectedCount} 件｜消耗 1 次`
        });
    },
    onOpenModel() {
        wx.navigateTo({
            url: "/pages/model/index"
        });
    },
    onToggleCloth(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.data.clothingItems.find((clothingItem) => clothingItem._id === id);
        if (!item) {
            return;
        }
        const alreadySelected = this.data.selectedClothingItemIds.includes(id);
        const selectedIdsWithoutSameSlot = this.data.selectedClothingItemIds.filter((selectedId) => {
            const selectedItem = this.data.clothingItems.find((clothingItem) => clothingItem._id === selectedId);
            if (!selectedItem || alreadySelected) {
                return true;
            }
            return this.getSlotLabel(selectedItem.category) !== this.getSlotLabel(item.category);
        });
        if (!alreadySelected && selectedIdsWithoutSameSlot.length >= 3) {
            (0, feedback_1.showToast)("最多选择 3 件衣物");
            return;
        }
        const selected = alreadySelected
            ? this.data.selectedClothingItemIds.filter((itemId) => itemId !== id)
            : [...selectedIdsWithoutSameSlot, id].slice(0, 3);
        this.syncView(selected, this.data.activeCategory);
    },
    onRemoveSelected(event) {
        const id = event.currentTarget.dataset.id;
        if (!id) {
            return;
        }
        const selected = this.data.selectedClothingItemIds.filter((itemId) => itemId !== id);
        this.syncView(selected, this.data.activeCategory);
    },
    onCategoryChange(event) {
        const activeCategory = event.detail.value;
        this.setData({
            activeCategory
        });
        this.syncView(this.data.selectedClothingItemIds, activeCategory);
    },
    onStyleChange(event) {
        this.setData({
            styleValue: event.detail.value
        });
    },
    onUploadCloth() {
        wx.navigateTo({
            url: "/pages/cloth/edit"
        });
    },
    saveRecentTask(taskId) {
        var _a;
        const tasks = wx.getStorageSync(recentTaskStorageKey) || [];
        const nextTasks = [
            {
                taskId,
                style: this.data.styleValue,
                styleText: (_a = styleLabelMap[this.data.styleValue]) !== null && _a !== void 0 ? _a : this.data.styleValue,
                clothingCount: this.data.selectedClothingItemIds.length,
                createdAt: new Date().toISOString(),
                status: "queued",
                resultImageUrl: ""
            },
            ...tasks.filter((item) => item.taskId !== taskId)
        ].slice(0, 20);
        wx.setStorageSync(recentTaskStorageKey, nextTasks);
    },
    async onGenerate() {
        var _a;
        if (!this.data.selectedClothingItemIds.length) {
            (0, feedback_1.showToast)("请先选择衣物");
            return;
        }
        if (this.data.credits <= 0) {
            (0, feedback_1.showToast)("生成次数不足，请去我的页面获取更多次数");
            return;
        }
        this.setData({
            submitting: true
        });
        this.syncCanGenerate();
        try {
            const response = await (0, request_1.request)({
                url: "/ai/outfit-render",
                method: "POST",
                data: {
                    modelType: this.data.modelType,
                    modelPhotoId: this.data.modelPhotoId || undefined,
                    clothingItemIds: this.data.selectedClothingItemIds,
                    mode: "quick",
                    scene: this.data.styleValue,
                    style: this.data.styleValue,
                    shareable: true
                }
            });
            const taskId = (_a = response.data) === null || _a === void 0 ? void 0 : _a.taskId;
            if (!taskId) {
                (0, feedback_1.showToast)("任务创建失败，请稍后重试");
                return;
            }
            this.saveRecentTask(taskId);
            wx.navigateTo({
                url: `/pages/task/status?taskId=${taskId}`
            });
        }
        catch (_b) {
            (0, feedback_1.showToast)("提交失败，衣物或模特可能暂不可用");
        }
        finally {
            this.setData({
                submitting: false
            });
            this.syncCanGenerate();
        }
    }
});
