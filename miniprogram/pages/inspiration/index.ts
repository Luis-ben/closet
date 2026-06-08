import { request } from "../../utils/request";
import { showToast } from "../../utils/feedback";

interface ClothingItem {
  _id: string;
  imageUrl: string;
  category: string;
  color: string;
  createdAt?: string;
}

interface AiTask {
  _id: string;
  status: "queued" | "running" | "success" | "failed";
  resultImageUrl: string | null;
  clothingItemIds: string[];
  style: string | null;
  createdAt: string;
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

interface RecentResult {
  taskId: string;
  imageUrl: string;
  title: string;
  subtitle: string;
}

interface CubeSlot {
  label: string;
  itemId: string;
  imageUrl: string;
  hint: string;
  filled: boolean;
  className: string;
}

const recentTaskStorageKey = "recentOutfitTasks";
const pendingStyleStorageKey = "pendingTryonStyle";
const pendingClothingItemIdsStorageKey = "pendingTryonClothingItemIds";
const styleLabelMap: Record<string, string> = {
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

const categoryLabelMap: Record<string, string> = {
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
    recentResults: [] as RecentResult[],
    styleTemplates,
    clothingItems: [] as ClothingItem[],
    cubeSlots: cubeSlotDefs.map((slot) => ({
      label: slot.label,
      itemId: "",
      imageUrl: "",
      hint: "待上传",
      filled: false,
      className: `cube-slot ${slot.className}`
    })) as CubeSlot[],
    cubeItemIds: [] as string[],
    cubeReady: false,
    cubeTitle: "搭配魔方",
    cubeDesc: "从衣柜里自动拼一套，上装、下装和鞋包都能单独替换。",
    cubeStyleValue: "commute",
    cubeStyleLabel: "通勤方案",
    cubeStyleTone: "冷静蓝灰",
    cubeButtonText: "使用这套",
    cubeIndex: 0,
    recommendationTitle: "先上传衣服",
    recommendationDesc: "衣柜有单品后，会在这里展示推荐组合",
    recommendationItems: [] as ClothingItem[]
  },

  onShow() {
    this.loadInspiration();
  },

  async loadInspiration() {
    this.setData({
      loading: true
    });

    try {
      const [recentResults, clothingResponse] = await Promise.all([
        this.loadRecentResults(),
        request<{ items: ClothingItem[] }>({ url: "/clothing-items" })
      ]);
      const clothingItems = clothingResponse.data?.items ?? [];
      const cubeState = this.buildCubeState(clothingItems, this.data.cubeIndex);

      this.setData({
        recentResults,
        clothingItems,
        ...cubeState,
        recommendationTitle: clothingItems.length ? "衣柜推荐组合" : "先上传衣服",
        recommendationDesc: clothingItems.length
          ? "从你的衣柜里先挑几件，去试穿页微调"
          : "衣柜有单品后，会在这里展示推荐组合",
        recommendationItems: clothingItems.slice(0, 3),
        loading: false
      });
    } catch {
      this.setData({
        loading: false
      });
      showToast("灵感加载失败");
    }
  },

  async loadRecentResults(): Promise<RecentResult[]> {
    const cachedTasks = ((wx.getStorageSync(recentTaskStorageKey) as RecentTaskStorage[]) || []).slice(0, 10);
    const results = await Promise.all(
      cachedTasks.map(async (cachedTask) => {
        try {
          const response = await request<{ task: AiTask }>({
            url: `/ai/tasks/${cachedTask.taskId}`
          });
          const task = response.data?.task;

          if (!task || task.status !== "success" || !task.resultImageUrl) {
            return null;
          }

          return {
            taskId: cachedTask.taskId,
            imageUrl: task.resultImageUrl,
            title: styleLabelMap[task.style ?? ""] ?? cachedTask.styleText,
            subtitle: `${task.clothingItemIds.length} 件衣物`
          };
        } catch {
          return cachedTask.resultImageUrl
            ? {
                taskId: cachedTask.taskId,
                imageUrl: cachedTask.resultImageUrl,
                title: cachedTask.styleText,
                subtitle: `${cachedTask.clothingCount} 件衣物`
              }
            : null;
        }
      })
    );

    return results.filter((item): item is RecentResult => Boolean(item));
  },

  sortItems(items: ClothingItem[]) {
    return [...items].sort((a, b) => {
      const bTime = new Date(b.createdAt ?? 0).getTime();
      const aTime = new Date(a.createdAt ?? 0).getTime();

      return bTime - aTime;
    });
  },

  pickItemByCategories(items: ClothingItem[], categories: string[], offset: number, usedIds: string[]) {
    const pool = this.sortItems(items).filter(
      (item: ClothingItem) => categories.includes(item.category) && !usedIds.includes(item._id)
    );

    if (!pool.length) {
      return null;
    }

    return pool[offset % pool.length];
  },

  buildCubeState(items: ClothingItem[], cubeIndex: number) {
    const usedIds: string[] = [];
    const styleTemplate = styleTemplates[cubeIndex % styleTemplates.length];
    const cubeSlots = cubeSlotDefs.map((slot, slotIndex) => {
      const picked = this.pickItemByCategories(items, slot.categories, cubeIndex + slotIndex, usedIds);

      if (picked) {
        usedIds.push(picked._id);
      }

      return {
        label: slot.label,
        itemId: picked?._id ?? "",
        imageUrl: picked?.imageUrl ?? "",
        hint: picked ? `${categoryLabelMap[picked.category] ?? picked.category} · ${picked.color}` : "待上传",
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
        ? `已拼好 ${usedIds.length} 件衣物，推荐 ${styleTemplate.title} 风格。`
        : "先上传几件上衣、下装或鞋包，魔方会自动组成一套。",
      cubeStyleValue: styleTemplate.value,
      cubeStyleLabel: `${styleTemplate.title}方案`,
      cubeStyleTone: styleTemplate.tone,
      cubeButtonText: cubeReady ? "使用这套" : "去上传衣服"
    };
  },

  refreshCube(cubeIndex: number) {
    this.setData({
      cubeIndex,
      ...this.buildCubeState(this.data.clothingItems, cubeIndex)
    });
  },

  onGoTryon() {
    wx.switchTab({
      url: "/pages/tryon/index"
    });
  },

  onOpenResult(event: WechatMiniprogram.TouchEvent) {
    const taskId = event.currentTarget.dataset.id as string;

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
    wx.setStorageSync(pendingStyleStorageKey, this.data.cubeStyleValue);
    wx.switchTab({
      url: "/pages/tryon/index"
    });
  },

  onUseTemplate(event: WechatMiniprogram.TouchEvent) {
    const style = event.currentTarget.dataset.style as string;

    wx.setStorageSync(pendingStyleStorageKey, style);
    wx.switchTab({
      url: "/pages/tryon/index"
    });
  }
});
