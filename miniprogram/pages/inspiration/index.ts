import { request } from "../../utils/request";
import { showToast } from "../../utils/feedback";

interface ClothingItem {
  _id: string;
  imageUrl: string;
  category: string;
  color: string;
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

const recentTaskStorageKey = "recentOutfitTasks";
const pendingStyleStorageKey = "pendingTryonStyle";
const styleLabelMap: Record<string, string> = {
  clean_realistic: "简洁写实",
  commute: "通勤",
  casual: "休闲",
  date: "约会",
  premium: "高级感",
  travel: "旅行"
};

const styleTemplates = [
  { title: "通勤", value: "commute", description: "利落、克制，适合办公室" },
  { title: "约会", value: "date", description: "柔和一点，保留氛围感" },
  { title: "周末", value: "casual", description: "舒适自然，适合日常出门" },
  { title: "旅行", value: "travel", description: "轻松上镜，颜色更明亮" },
  { title: "高级感", value: "premium", description: "更干净的光影和质感" },
  { title: "极简", value: "clean_realistic", description: "简洁写实，少做夸张修饰" }
];

Page({
  data: {
    loading: false,
    recentResults: [] as RecentResult[],
    styleTemplates,
    clothingItems: [] as ClothingItem[],
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

      this.setData({
        recentResults,
        clothingItems,
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

  onUseTemplate(event: WechatMiniprogram.TouchEvent) {
    const style = event.currentTarget.dataset.style as string;

    // TODO: When tryon supports richer template params, pass scene presets here too.
    wx.setStorageSync(pendingStyleStorageKey, style);
    wx.switchTab({
      url: "/pages/tryon/index"
    });
  }
});
