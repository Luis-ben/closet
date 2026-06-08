"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../utils/request");
const feedback_1 = require("../../utils/feedback");
const defaultModelImage = "https://placehold.co/768x1024/png?text=Default+Model";
const categoryBaseOptions = [
    { label: "全部", value: "all" },
    { label: "上衣", value: "top" },
    { label: "下装", value: "bottom" },
    { label: "外套", value: "outerwear" },
    { label: "鞋包", value: "shoes_bags" },
    { label: "配饰", value: "accessory" }
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
const sourceLabelMap = {
    camera: "相机",
    album: "相册",
    web_image: "网图",
    product_image: "商品图"
};
const sourceBaseOptions = [
    { label: "全部来源", value: "all" },
    { label: "相册", value: "album" },
    { label: "拍照", value: "camera" },
    { label: "网图", value: "web_image" },
    { label: "商品图", value: "product_image" }
];
const albumPreviewLimit = 4;
Page({
    data: {
        categoryOptions: categoryBaseOptions,
        activeCategory: "all",
        activeSource: "all",
        sourceOptions: sourceBaseOptions.map((option) => (Object.assign(Object.assign({}, option), { count: 0, className: "source-chip" }))),
        allItems: [],
        items: [],
        recentItems: [],
        stats: [],
        totalCountText: "0 件衣物",
        loading: false,
        modelImage: defaultModelImage,
        modelText: "系统默认模特",
        modelHint: "AI 将使用这个模特生成试穿图",
        albumHint: "从相册、拍照或商品图中整理单品"
    },
    onShow() {
        this.loadPageData();
    },
    async loadPageData() {
        var _a, _b, _c, _d, _e;
        this.setData({
            loading: true
        });
        try {
            const [clothingResponse, photoResponse] = await Promise.all([
                (0, request_1.request)({ url: "/clothing-items" }),
                (0, request_1.request)({ url: "/user-photos" })
            ]);
            const allItems = (_b = (_a = clothingResponse.data) === null || _a === void 0 ? void 0 : _a.items) !== null && _b !== void 0 ? _b : [];
            const activeModel = this.resolveActiveModel((_d = (_c = photoResponse.data) === null || _c === void 0 ? void 0 : _c.items) !== null && _d !== void 0 ? _d : []);
            this.setData({
                allItems,
                modelImage: (_e = activeModel === null || activeModel === void 0 ? void 0 : activeModel.imageUrl) !== null && _e !== void 0 ? _e : defaultModelImage,
                modelText: activeModel ? "我的专属模特" : "系统默认模特",
                modelHint: activeModel ? "当前会优先使用你的个人模特" : "AI 将使用默认模特生成试穿图",
                loading: false
            });
            this.syncClosetView(this.data.activeCategory, this.data.activeSource);
        }
        catch (_f) {
            this.setData({
                loading: false
            });
            (0, feedback_1.showToast)("衣柜加载失败，请稍后重试");
        }
    },
    resolveActiveModel(items) {
        var _a, _b;
        const preferredType = wx.getStorageSync("preferredModelType");
        const preferredModelId = wx.getStorageSync("preferredModelPhotoId");
        if (preferredType === "default_model") {
            return null;
        }
        return ((_b = (_a = items.find((item) => item._id === preferredModelId && item.auditStatus !== "reject")) !== null && _a !== void 0 ? _a : items.find((item) => item.isActiveModel && item.auditStatus !== "reject")) !== null && _b !== void 0 ? _b : null);
    },
    buildCategoryOptions(items) {
        return categoryBaseOptions.map((option) => (Object.assign(Object.assign({}, option), { label: `${option.label} ${this.countByCategory(items, option.value)}` })));
    },
    buildSourceOptions(items, activeSource) {
        return sourceBaseOptions.map((option) => {
            const count = this.countBySource(items, option.value);
            const classNames = ["source-chip"];
            if (option.value === activeSource) {
                classNames.push("is-active");
            }
            return Object.assign(Object.assign({}, option), { label: option.value === "all" ? "全部来源" : option.label, count, className: classNames.join(" ") });
        });
    },
    countByCategory(items, category) {
        return this.filterItems(items, category).length;
    },
    countBySource(items, source) {
        return this.filterBySource(items, source).length;
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
    filterBySource(items, source) {
        if (source === "all") {
            return items;
        }
        return items.filter((item) => item.sourceType === source);
    },
    sortItems(items) {
        return [...items].sort((a, b) => {
            var _a, _b;
            const bTime = new Date((_a = b.createdAt) !== null && _a !== void 0 ? _a : 0).getTime();
            const aTime = new Date((_b = a.createdAt) !== null && _b !== void 0 ? _b : 0).getTime();
            return bTime - aTime;
        });
    },
    toDisplayItems(items) {
        return items.map((item, index) => {
            var _a, _b, _c;
            const sourceLabel = (_a = sourceLabelMap[item.sourceType]) !== null && _a !== void 0 ? _a : "图片";
            return Object.assign(Object.assign({}, item), { categoryLabel: (_b = categoryLabelMap[item.category]) !== null && _b !== void 0 ? _b : item.category, sourceLabel, albumLabel: `${sourceLabel} · ${(_c = categoryLabelMap[item.category]) !== null && _c !== void 0 ? _c : item.category}`, isRecent: index < albumPreviewLimit });
        });
    },
    buildStats(items) {
        const sourceCount = this.countBySource(items, "album");
        const outfitReadyCount = ["top", "bottom", "dress", "shoes", "bag"].reduce((total, category) => total + this.countByCategory(items, category), 0);
        return [
            { label: "总衣物", value: `${items.length}` },
            { label: "相册导入", value: `${sourceCount}` },
            { label: "可试穿", value: `${outfitReadyCount}` }
        ];
    },
    syncClosetView(activeCategory, activeSource) {
        const sortedItems = this.sortItems(this.data.allItems);
        const categoryFiltered = this.filterItems(sortedItems, activeCategory);
        const visibleItems = this.filterBySource(categoryFiltered, activeSource);
        const displayItems = this.toDisplayItems(visibleItems);
        const recentItems = this.toDisplayItems(sortedItems.slice(0, albumPreviewLimit));
        this.setData({
            activeCategory,
            activeSource,
            categoryOptions: this.buildCategoryOptions(this.data.allItems),
            sourceOptions: this.buildSourceOptions(this.data.allItems, activeSource),
            items: displayItems,
            recentItems,
            stats: this.buildStats(this.data.allItems),
            totalCountText: `${visibleItems.length} 件衣物`,
            albumHint: this.data.allItems.length
                ? "像翻相册一样浏览衣物，点进单品可继续试穿"
                : "从相册、拍照或商品图中整理单品"
        });
    },
    onSelectCategory(event) {
        this.syncClosetView(event.detail.value, this.data.activeSource);
    },
    onSelectSource(event) {
        const source = event.currentTarget.dataset.source;
        this.syncClosetView(this.data.activeCategory, source);
    },
    onUpload() {
        wx.navigateTo({
            url: "/pages/cloth/edit"
        });
    },
    onOpenModel() {
        wx.navigateTo({
            url: "/pages/model/index"
        });
    },
    onGoTryon() {
        wx.switchTab({
            url: "/pages/tryon/index"
        });
    },
    confirmDeleteCloth() {
        return new Promise((resolve) => {
            wx.showModal({
                title: "删除衣物？",
                content: "删除后将不会出现在试穿选择中。",
                confirmText: "删除",
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
    async onDeleteCloth(event) {
        const id = event.currentTarget.dataset.id;
        if (!id) {
            return;
        }
        const confirmed = await this.confirmDeleteCloth();
        if (!confirmed) {
            return;
        }
        (0, feedback_1.showLoading)("删除中");
        try {
            await (0, request_1.request)({
                url: `/clothing-items/${id}`,
                method: "DELETE"
            });
            (0, feedback_1.showToast)("已删除", "success");
            await this.loadPageData();
        }
        catch (_a) {
            (0, feedback_1.showToast)("删除失败，请稍后重试");
        }
        finally {
            (0, feedback_1.hideLoading)();
        }
    }
});
