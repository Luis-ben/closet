import { request } from "../../utils/request";
import { hideLoading, showLoading, showToast } from "../../utils/feedback";

interface AiTask {
  _id: string;
  resultImageUrl: string | null;
  modelType: "personal_model" | "default_model";
  clothingItemIds: string[];
  style: string | null;
  createdAt: string;
  completedAt?: string | null;
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

const recentTaskStorageKey = "recentOutfitTasks";

Page({
  data: {
    taskId: "",
    resultImageUrl: "",
    imageLoadFailed: false,
    modelText: "默认模特",
    clothingCount: 0,
    styleText: "简洁写实",
    generatedAtText: "",
    loading: false
  },

  onLoad(options: Record<string, string | undefined>) {
    const taskId = options.taskId ?? "";
    this.setData({
      taskId
    });
    this.loadResult(taskId);
  },

  async loadResult(taskId: string) {
    if (!taskId) {
      showToast("缺少任务 ID");
      return;
    }

    this.setData({
      loading: true,
      imageLoadFailed: false
    });

    try {
      const response = await request<{ task: AiTask }>({
        url: `/ai/tasks/${taskId}`
      });
      const task = response.data?.task;
      const imageUrl = task?.resultImageUrl ?? "";

      this.setData({
        resultImageUrl: imageUrl,
        modelText: task?.modelType === "personal_model" ? "我的专属模特" : "系统默认模特",
        clothingCount: task?.clothingItemIds.length ?? 0,
        styleText: this.getStyleText(task?.style ?? null),
        generatedAtText: this.formatTime(task?.completedAt || task?.createdAt || ""),
        loading: false
      });

      if (task && imageUrl) {
        this.updateRecentTask(task);
      }
    } catch {
      this.setData({
        loading: false
      });
      showToast("结果加载失败");
    }
  },

  updateRecentTask(task: AiTask) {
    const tasks = ((wx.getStorageSync(recentTaskStorageKey) as RecentTaskStorage[]) || []).map((item) => {
      if (item.taskId !== task._id) {
        return item;
      }

      return {
        ...item,
        status: "success" as const,
        resultImageUrl: task.resultImageUrl ?? "",
        clothingCount: task.clothingItemIds.length
      };
    });

    wx.setStorageSync(recentTaskStorageKey, tasks);
  },

  getStyleText(style: string | null) {
    const styleMap: Record<string, string> = {
      commute: "通勤",
      casual: "休闲",
      date: "约会",
      clean_realistic: "简洁写实",
      premium: "高级感",
      travel: "旅行"
    };

    return style ? styleMap[style] ?? style : "简洁写实";
  },

  formatTime(value: string) {
    if (!value) {
      return "刚刚";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "刚刚";
    }

    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");

    return `${month}-${day} ${hour}:${minute}`;
  },

  onImageError() {
    this.setData({
      imageLoadFailed: true
    });
  },

  saveLocalImage(filePath: string) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success() {
        showToast("已保存到相册", "success");
      },
      fail() {
        wx.showModal({
          title: "需要相册权限",
          content: "请在设置中允许保存图片到相册。",
          confirmText: "打开设置",
          cancelText: "取消",
          success(result) {
            if (result.confirm) {
              wx.openSetting({});
            }
          }
        });
      }
    });
  },

  onSave() {
    if (!this.data.resultImageUrl) {
      showToast("图片不可用");
      return;
    }

    showLoading("保存中");

    if (/^https?:\/\//.test(this.data.resultImageUrl)) {
      wx.downloadFile({
        url: this.data.resultImageUrl,
        success: (result) => {
          hideLoading();

          if (result.statusCode >= 200 && result.statusCode < 300) {
            this.saveLocalImage(result.tempFilePath);
            return;
          }

          showToast("图片下载失败");
        },
        fail: () => {
          hideLoading();
          showToast("图片下载失败");
        }
      });
      return;
    }

    hideLoading();
    this.saveLocalImage(this.data.resultImageUrl);
  },

  onRegenerate() {
    wx.switchTab({
      url: "/pages/tryon/index"
    });
  },

  onShareAppMessage() {
    return {
      title: "帮我看看这套穿搭",
      path: `/pages/result/detail?taskId=${this.data.taskId}`
    };
  }
});
