import { request } from "../../utils/request";
import { showLoading, hideLoading, showToast } from "../../utils/feedback";

interface ClothingItem {
  _id: string;
  imageUrl: string;
  sourceType: string;
  category: string;
  color: string;
  useCount: number;
  createdAt?: string;
}

interface DisplayClothingItem extends ClothingItem {
  categoryLabel: string;
  sourceLabel: string;
  albumLabel: string;
  isRecent: boolean;
}

interface ClosetStat {
  label: string;
  value: string;
}

interface SourceOption {
  label: string;
  value: string;
  count: number;
  className: string;
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
    sourceOptions: sourceBaseOptions.map((option) => ({
      ...option,
      count: 0,
      className: "source-chip"
    })) as SourceOption[],
    allItems: [] as ClothingItem[],
    items: [] as DisplayClothingItem[],
    recentItems: [] as DisplayClothingItem[],
    stats: [] as ClosetStat[],
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
        modelHint: activeModel ? "当前会优先使用你的个人模特" : "AI 将使用默认模特生成试穿图",
        loading: false
      });
      this.syncClosetView(this.data.activeCategory, this.data.activeSource);
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

  buildSourceOptions(items: ClothingItem[], activeSource: string): SourceOption[] {
    return sourceBaseOptions.map((option) => {
      const count = this.countBySource(items, option.value);
      const classNames = ["source-chip"];

      if (option.value === activeSource) {
        classNames.push("is-active");
      }

      return {
        ...option,
        label: option.value === "all" ? "全部来源" : option.label,
        count,
        className: classNames.join(" ")
      };
    });
  },

  countByCategory(items: ClothingItem[], category: string) {
    return this.filterItems(items, category).length;
  },

  countBySource(items: ClothingItem[], source: string) {
    return this.filterBySource(items, source).length;
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

  filterBySource(items: ClothingItem[], source: string) {
    if (source === "all") {
      return items;
    }

    return items.filter((item) => item.sourceType === source);
  },

  sortItems(items: ClothingItem[]) {
    return [...items].sort((a, b) => {
      const bTime = new Date(b.createdAt ?? 0).getTime();
      const aTime = new Date(a.createdAt ?? 0).getTime();

      return bTime - aTime;
    });
  },

  toDisplayItems(items: ClothingItem[]): DisplayClothingItem[] {
    return items.map((item, index) => {
      const sourceLabel = sourceLabelMap[item.sourceType] ?? "图片";

      return {
        ...item,
        categoryLabel: categoryLabelMap[item.category] ?? item.category,
        sourceLabel,
        albumLabel: `${sourceLabel} · ${categoryLabelMap[item.category] ?? item.category}`,
        isRecent: index < albumPreviewLimit
      };
    });
  },

  buildStats(items: ClothingItem[]): ClosetStat[] {
    const sourceCount = this.countBySource(items, "album");
    const outfitReadyCount = ["top", "bottom", "dress", "shoes", "bag"].reduce(
      (total, category) => total + this.countByCategory(items, category),
      0
    );

    return [
      { label: "总衣物", value: `${items.length}` },
      { label: "相册导入", value: `${sourceCount}` },
      { label: "可试穿", value: `${outfitReadyCount}` }
    ];
  },

  syncClosetView(activeCategory: string, activeSource: string) {
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

  onSelectCategory(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.syncClosetView(event.detail.value, this.data.activeSource);
  },

  onSelectSource(event: WechatMiniprogram.TouchEvent) {
    const source = event.currentTarget.dataset.source as string;

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
