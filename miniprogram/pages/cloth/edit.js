"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const feedback_1 = require("../../utils/feedback");
const request_1 = require("../../utils/request");
const upload_1 = require("../../utils/upload");
const categoryOptions = [
    { label: "上衣", value: "top" },
    { label: "下装", value: "bottom" },
    { label: "外套", value: "outerwear" },
    { label: "鞋包", value: "shoes_bags" },
    { label: "配饰", value: "accessory" }
];
const colorOptions = ["白", "黑", "灰", "蓝", "棕", "米", "其他"].map((value) => ({
    label: value,
    value
}));
const seasonOptions = [
    { label: "春", value: "spring" },
    { label: "夏", value: "summer" },
    { label: "秋", value: "autumn" },
    { label: "冬", value: "winter" }
];
const occasionOptions = [
    { label: "通勤", value: "commute" },
    { label: "休闲", value: "casual" },
    { label: "约会", value: "date" },
    { label: "旅行", value: "travel" },
    { label: "正式", value: "formal" }
];
const sourceOptions = [
    { label: "相册", value: "album" },
    { label: "拍照", value: "camera" },
    { label: "网图截图", value: "web_image" },
    { label: "商品图", value: "product_image" }
];
Page({
    data: {
        imageUrl: "",
        imageMeta: null,
        sourceType: "album",
        sourceOptions,
        categoryOptions,
        category: "",
        colorOptions,
        color: "黑",
        seasonOptions,
        season: [],
        occasionOptions,
        occasion: [],
        note: "",
        saving: false,
        saveDisabled: true
    },
    async onChooseImage() {
        const sourceType = this.data.sourceType;
        const uploaded = await (0, upload_1.chooseMockImage)({
            sourceType: sourceType === "camera" ? "camera" : "album"
        });
        if (!uploaded) {
            return;
        }
        this.setData({
            imageUrl: uploaded.imageUrl,
            imageMeta: uploaded.imageMeta
        });
        this.syncSaveState();
    },
    onSourceChange(event) {
        const sourceType = event.detail.value;
        this.setData({
            sourceType
        });
    },
    onCategoryChange(event) {
        this.setData({
            category: event.detail.value
        });
        this.syncSaveState();
    },
    onColorChange(event) {
        this.setData({
            color: event.detail.value
        });
    },
    onSeasonChange(event) {
        this.setData({
            season: event.detail.value
        });
    },
    onOccasionChange(event) {
        this.setData({
            occasion: event.detail.value
        });
    },
    onNoteInput(event) {
        this.setData({
            note: event.detail.value
        });
    },
    syncSaveState() {
        this.setData({
            saveDisabled: !this.data.imageUrl || !this.data.category || this.data.saving
        });
    },
    getApiCategory(category) {
        if (category === "shoes_bags") {
            return "shoes";
        }
        return category;
    },
    getApiOccasion(occasion) {
        return occasion.map((item) => (item === "travel" ? "casual" : item));
    },
    async onSave() {
        if (!this.data.imageUrl || !this.data.imageMeta) {
            (0, feedback_1.showToast)("请先选择图片");
            return;
        }
        if (!this.data.category) {
            (0, feedback_1.showToast)("请选择衣物分类");
            return;
        }
        this.setData({
            saving: true
        });
        this.syncSaveState();
        try {
            await (0, request_1.request)({
                url: "/clothing-items",
                method: "POST",
                data: {
                    imageUrl: this.data.imageUrl,
                    imageMeta: this.data.imageMeta,
                    sourceType: this.data.sourceType,
                    category: this.getApiCategory(this.data.category),
                    color: this.data.color,
                    season: this.data.season,
                    occasion: this.getApiOccasion(this.data.occasion),
                    note: this.data.note
                }
            });
            (0, feedback_1.showToast)("已保存到衣柜", "success");
            wx.switchTab({
                url: "/pages/closet/index"
            });
        }
        catch (_a) {
            (0, feedback_1.showToast)("保存失败，请检查图片和分类");
        }
        finally {
            this.setData({
                saving: false
            });
            this.syncSaveState();
        }
    }
});
