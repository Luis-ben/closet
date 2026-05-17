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
Page({
    data: {
        categoryOptions: categoryBaseOptions,
        activeCategory: "all",
        allItems: [],
        items: [],
        loading: false,
        modelImage: defaultModelImage,
        modelText: "系统默认模特",
        modelHint: "AI 将使用这个模特生成试穿图"
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
                loading: false
            });
            this.syncCategoryView(this.data.activeCategory);
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
    countByCategory(items, category) {
        return this.filterItems(items, category).length;
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
    toDisplayItems(items) {
        return items.map((item) => {
            var _a, _b;
            return (Object.assign(Object.assign({}, item), { categoryLabel: (_a = categoryLabelMap[item.category]) !== null && _a !== void 0 ? _a : item.category, sourceLabel: (_b = sourceLabelMap[item.sourceType]) !== null && _b !== void 0 ? _b : "图片" }));
        });
    },
    syncCategoryView(activeCategory) {
        this.setData({
            activeCategory,
            categoryOptions: this.buildCategoryOptions(this.data.allItems),
            items: this.toDisplayItems(this.filterItems(this.data.allItems, activeCategory))
        });
    },
    onSelectCategory(event) {
        this.syncCategoryView(event.detail.value);
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
