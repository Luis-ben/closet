import { request } from "../../utils/request";
import { showLoading, hideLoading, showToast } from "../../utils/feedback";

interface ClothingItem {
  _id: string;
  imageUrl: string;
  sourceType: string;
  category: string;
  color: string;
  useCount: number;
}

interface DisplayClothingItem extends ClothingItem {
  categoryLabel: string;
  sourceLabel: string;
}

interface UserPhoto {
  _id: string;
  imageUrl: string;
  isActiveModel: boolean;
  auditStatus?: "pending" | "pass" | "reject";
}

const defaultModelImage = "https://placehold.co/768x1024/png?text=Default+Model";
const categoryBaseOptions = [
  { label: "全部", value: "all" },
  { label: "上衣", value: "top" },
  { label: "下装", value: "bottom" },
  { label: "外套", value: "outerwear" },
  { label: "鞋包", value: "shoes_bags" },
  { label: "配饰", value: "accessory" }
];

const categoryLabelMap: Record<string, string> = {
  top: "上衣",
  bottom: "下装",
  dress: "裙装",
  shoes: "鞋包",
  bag: "鞋包",
  accessory: "配饰",
  outerwear: "外套"
};

const sourceLabelMap: Record<string, string> = {
  camera: "相机",
  album: "相册",
  web_image: "网图",
  product_image: "商品图"
};

Page({
  data: {
    categoryOptions: categoryBaseOptions,
    activeCategory: "all",
    allItems: [] as ClothingItem[],
    items: [] as DisplayClothingItem[],
    loading: false,
    modelImage: defaultModelImage,
    modelText: "系统默认模特",
    modelHint: "AI 将使用这个模特生成试穿图"
  },

  onShow() {
    this.loadPageData();
  },

  async loadPageData() {
    this.setData({
      loading: true
    });

    try {
      const [clothingResponse, photoResponse] = await Promise.all([
        request<{ items: ClothingItem[] }>({ url: "/clothing-items" }),
        request<{ items: UserPhoto[] }>({ url: "/user-photos" })
      ]);
      const allItems = clothingResponse.data?.items ?? [];
      const activeModel = this.resolveActiveModel(photoResponse.data?.items ?? []);

      this.setData({
        allItems,
        modelImage: activeModel?.imageUrl ?? defaultModelImage,
        modelText: activeModel ? "我的专属模特" : "系统默认模特",
        loading: false
      });
      this.syncCategoryView(this.data.activeCategory);
    } catch {
      this.setData({
        loading: false
      });
      showToast("衣柜加载失败，请稍后重试");
    }
  },

  resolveActiveModel(items: UserPhoto[]) {
    const preferredType = wx.getStorageSync("preferredModelType") as string;
    const preferredModelId = wx.getStorageSync("preferredModelPhotoId") as string;

    if (preferredType === "default_model") {
      return null;
    }

    return (
      items.find((item) => item._id === preferredModelId && item.auditStatus !== "reject") ??
      items.find((item) => item.isActiveModel && item.auditStatus !== "reject") ??
      null
    );
  },

  buildCategoryOptions(items: ClothingItem[]) {
    return categoryBaseOptions.map((option) => ({
      ...option,
      label: `${option.label} ${this.countByCategory(items, option.value)}`
    }));
  },

  countByCategory(items: ClothingItem[], category: string) {
    return this.filterItems(items, category).length;
  },

  filterItems(items: ClothingItem[], category: string) {
    if (category === "all") {
      return items;
    }

    if (category === "shoes_bags") {
      return items.filter((item) => item.category === "shoes" || item.category === "bag");
    }

    return items.filter((item) => item.category === category);
  },

  toDisplayItems(items: ClothingItem[]): DisplayClothingItem[] {
    return items.map((item) => ({
      ...item,
      categoryLabel: categoryLabelMap[item.category] ?? item.category,
      sourceLabel: sourceLabelMap[item.sourceType] ?? "图片"
    }));
  },

  syncCategoryView(activeCategory: string) {
    this.setData({
      activeCategory,
      categoryOptions: this.buildCategoryOptions(this.data.allItems),
      items: this.toDisplayItems(this.filterItems(this.data.allItems, activeCategory))
    });
  },

  onSelectCategory(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
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

  confirmDeleteCloth(): Promise<boolean> {
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

  async onDeleteCloth(event: WechatMiniprogram.CustomEvent) {
    const id = event.currentTarget.dataset.id as string;

    if (!id) {
      return;
    }

    const confirmed = await this.confirmDeleteCloth();

    if (!confirmed) {
      return;
    }

    showLoading("删除中");

    try {
      await request({
        url: `/clothing-items/${id}`,
        method: "DELETE"
      });
      showToast("已删除", "success");
      await this.loadPageData();
    } catch {
      showToast("删除失败，请稍后重试");
    } finally {
      hideLoading();
    }
  }
});
