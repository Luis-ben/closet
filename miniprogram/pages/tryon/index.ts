import { request } from "../../utils/request";
import { showToast } from "../../utils/feedback";

interface ClothingItem {
  _id: string;
  imageUrl: string;
  category: string;
  color: string;
}

interface DisplayClothingItem extends ClothingItem {
  categoryLabel: string;
  selected: boolean;
}

interface UserPhoto {
  _id: string;
  imageUrl: string;
  isActiveModel: boolean;
  auditStatus?: "pending" | "pass" | "reject";
  displayName?: string;
}

interface SelectedSlot {
  label: string;
  itemId: string;
  imageUrl: string;
  categoryLabel: string;
  hasItem: boolean;
}

interface RecentTaskStorage {
  taskId: string;
  style: string;
  styleText: string;
  clothingCount: number;
  createdAt: string;
  status: "queued" | "running" | "success" | "failed";
  resultImageUrl: string;
}

const defaultModelImage = "https://placehold.co/768x1024/png?text=Default+Model";
const recentTaskStorageKey = "recentOutfitTasks";
const pendingStyleStorageKey = "pendingTryonStyle";

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

const categoryLabelMap: Record<string, string> = {
  top: "上衣",
  bottom: "下装",
  dress: "裙装",
  shoes: "鞋包",
  bag: "鞋包",
  accessory: "配饰",
  outerwear: "外套"
};

const styleLabelMap: Record<string, string> = styleOptions.reduce((map, item) => {
  map[item.value] = item.label;
  return map;
}, {} as Record<string, string>);

const slotLabels = ["上衣", "下装", "鞋包"];

Page({
  data: {
    credits: 0,
    modelType: "default_model",
    modelTitle: "系统默认模特",
    modelPhotoId: "",
    modelImage: defaultModelImage,
    clothingItems: [] as ClothingItem[],
    displayClothingItems: [] as DisplayClothingItem[],
    selectedClothingItems: [] as DisplayClothingItem[],
    selectedClothingItemIds: [] as string[],
    selectedSlots: slotLabels.map((label) => ({
      label,
      itemId: "",
      imageUrl: "",
      categoryLabel: "",
      hasItem: false
    })) as SelectedSlot[],
    categoryOptions,
    activeCategory: "all",
    styleOptions,
    styleValue: "clean_realistic",
    loading: false,
    submitting: false,
    generateDisabled: true,
    generateButtonText: "请选择衣物",
    bottomText: "已选 0 件｜消耗 1 次"
  },

  onShow() {
    this.applyPendingStyle();
    this.loadPageData();
  },

  applyPendingStyle() {
    const pendingStyle = wx.getStorageSync(pendingStyleStorageKey) as string;

    if (pendingStyle) {
      this.setData({
        styleValue: pendingStyle
      });
      wx.removeStorageSync(pendingStyleStorageKey);
    }
  },

  async loadPageData() {
    this.setData({
      loading: true
    });

    try {
      const [meResponse, clothingResponse, photoResponse] = await Promise.all([
        request<{ user: { credits: number } }>({ url: "/users/me" }),
        request<{ items: ClothingItem[] }>({ url: "/clothing-items" }),
        request<{ items: UserPhoto[] }>({ url: "/user-photos" })
      ]);
      const clothingItems = clothingResponse.data?.items ?? [];
      const selectedClothingItemIds = (this.data.selectedClothingItemIds as string[]).filter((id) =>
        clothingItems.some((item) => item._id === id)
      );
      const modelState = this.resolveModel(photoResponse.data?.items ?? []);

      this.setData({
        credits: meResponse.data?.user.credits ?? 0,
        ...modelState,
        clothingItems,
        loading: false
      });
      this.syncView(selectedClothingItemIds, this.data.activeCategory);
    } catch {
      this.setData({
        loading: false
      });
      showToast("试穿台加载失败，请稍后重试");
      this.syncCanGenerate();
    }
  },

  resolveModel(items: UserPhoto[]) {
    const preferredType = wx.getStorageSync("preferredModelType") as string;
    const preferredModelId = wx.getStorageSync("preferredModelPhotoId") as string;
    const passModels = items.filter((item) => item.auditStatus !== "reject");
    const preferredModel = passModels.find((item) => item._id === preferredModelId);
    const activeModel = passModels.find((item) => item.isActiveModel);
    const selectedModel = preferredType === "default_model" ? null : preferredModel ?? activeModel;

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

  filterItems(items: ClothingItem[], category: string) {
    if (category === "all") {
      return items;
    }

    if (category === "shoes_bags") {
      return items.filter((item) => item.category === "shoes" || item.category === "bag");
    }

    return items.filter((item) => item.category === category);
  },

  toDisplayItems(items: ClothingItem[], selectedIds: string[]): DisplayClothingItem[] {
    return items.map((item) => ({
      ...item,
      categoryLabel: categoryLabelMap[item.category] ?? item.category,
      selected: selectedIds.includes(item._id)
    }));
  },

  buildSelectedSlots(selectedItems: DisplayClothingItem[]): SelectedSlot[] {
    return slotLabels.map((label, index) => {
      const item = selectedItems[index];

      return {
        label,
        itemId: item?._id ?? "",
        imageUrl: item?.imageUrl ?? "",
        categoryLabel: item?.categoryLabel ?? "",
        hasItem: Boolean(item)
      };
    });
  },

  syncView(selectedClothingItemIds: string[], activeCategory: string) {
    const allDisplayItems = this.toDisplayItems(this.data.clothingItems, selectedClothingItemIds);
    const selectedClothingItems = allDisplayItems.filter((item: DisplayClothingItem) => item.selected);
    const displayClothingItems = this.toDisplayItems(
      this.filterItems(this.data.clothingItems, activeCategory),
      selectedClothingItemIds
    );

    this.setData({
      selectedClothingItemIds,
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
    } else if (!hasCredits) {
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

  onToggleCloth(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    const alreadySelected = this.data.selectedClothingItemIds.includes(id);

    if (!alreadySelected && this.data.selectedClothingItemIds.length >= 3) {
      showToast("最多选择 3 件衣物");
      return;
    }

    const selected = alreadySelected
      ? (this.data.selectedClothingItemIds as string[]).filter((itemId) => itemId !== id)
      : [...this.data.selectedClothingItemIds, id];

    this.syncView(selected, this.data.activeCategory);
  },

  onRemoveSelected(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;

    if (!id) {
      return;
    }

    const selected = (this.data.selectedClothingItemIds as string[]).filter((itemId) => itemId !== id);
    this.syncView(selected, this.data.activeCategory);
  },

  onCategoryChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const activeCategory = event.detail.value;

    this.setData({
      activeCategory
    });
    this.syncView(this.data.selectedClothingItemIds, activeCategory);
  },

  onStyleChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      styleValue: event.detail.value
    });
  },

  onUploadCloth() {
    wx.navigateTo({
      url: "/pages/cloth/edit"
    });
  },

  saveRecentTask(taskId: string) {
    const tasks = (wx.getStorageSync(recentTaskStorageKey) as RecentTaskStorage[]) || [];
    const nextTasks = [
      {
        taskId,
        style: this.data.styleValue,
        styleText: styleLabelMap[this.data.styleValue] ?? this.data.styleValue,
        clothingCount: this.data.selectedClothingItemIds.length,
        createdAt: new Date().toISOString(),
        status: "queued" as const,
        resultImageUrl: ""
      },
      ...tasks.filter((item) => item.taskId !== taskId)
    ].slice(0, 20);

    wx.setStorageSync(recentTaskStorageKey, nextTasks);
  },

  async onGenerate() {
    if (!this.data.selectedClothingItemIds.length) {
      showToast("请先选择衣物");
      return;
    }

    if (this.data.credits <= 0) {
      showToast("生成次数不足，请去我的页面获取更多次数");
      return;
    }

    this.setData({
      submitting: true
    });
    this.syncCanGenerate();

    try {
      const response = await request<{ taskId: string }>({
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
      const taskId = response.data?.taskId;

      if (!taskId) {
        showToast("任务创建失败，请稍后重试");
        return;
      }

      this.saveRecentTask(taskId);
      wx.navigateTo({
        url: `/pages/task/status?taskId=${taskId}`
      });
    } catch {
      showToast("提交失败，衣物或模特可能暂不可用");
    } finally {
      this.setData({
        submitting: false
      });
      this.syncCanGenerate();
    }
  }
});
