import { showToast } from "../../utils/feedback";
import { request } from "../../utils/request";
import { chooseMockImage, type MockUploadedImage } from "../../utils/upload";

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
    imageMeta: null as MockUploadedImage["imageMeta"] | null,
    sourceType: "album",
    sourceOptions,
    categoryOptions,
    category: "",
    colorOptions,
    color: "黑",
    seasonOptions,
    season: [] as string[],
    occasionOptions,
    occasion: [] as string[],
    note: "",
    saving: false,
    saveDisabled: true
  },

  async onChooseImage() {
    const sourceType = this.data.sourceType as "album" | "camera" | "web_image" | "product_image";
    const uploaded = await chooseMockImage({
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

  onSourceChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const sourceType = event.detail.value;

    this.setData({
      sourceType
    });
  },

  onCategoryChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      category: event.detail.value
    });
    this.syncSaveState();
  },

  onColorChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      color: event.detail.value
    });
  },

  onSeasonChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({
      season: event.detail.value
    });
  },

  onOccasionChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({
      occasion: event.detail.value
    });
  },

  onNoteInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      note: event.detail.value
    });
  },

  syncSaveState() {
    this.setData({
      saveDisabled: !this.data.imageUrl || !this.data.category || this.data.saving
    });
  },

  getApiCategory(category: string) {
    if (category === "shoes_bags") {
      return "shoes";
    }

    return category;
  },

  getApiOccasion(occasion: string[]) {
    return occasion.map((item) => (item === "travel" ? "casual" : item));
  },

  async onSave() {
    if (!this.data.imageUrl || !this.data.imageMeta) {
      showToast("请先选择图片");
      return;
    }

    if (!this.data.category) {
      showToast("请选择衣物分类");
      return;
    }

    this.setData({
      saving: true
    });
    this.syncSaveState();

    try {
      await request({
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

      showToast("已保存到衣柜", "success");
      wx.switchTab({
        url: "/pages/closet/index"
      });
    } catch {
      showToast("保存失败，请检查图片和分类");
    } finally {
      this.setData({
        saving: false
      });
      this.syncSaveState();
    }
  }
});
