import { request } from "../../utils/request";
import { showToast } from "../../utils/feedback";

interface AiTask {
  _id: string;
  status: "queued" | "running" | "success" | "failed";
  resultImageUrl: string | null;
  errorMessage: string | null;
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

const recentTaskStorageKey = "recentOutfitTasks";
const statusTextMap = {
  queued: "正在排队生成",
  running: "AI 正在为你试穿搭配",
  success: "生成完成",
  failed: "生成失败"
};
const hintTextMap = {
  queued: "通常需要 10-30 秒",
  running: "请不要关闭页面",
  success: "正在打开生成结果",
  failed: "生成遇到问题，请稍后重试"
};
const progressMap = {
  queued: 20,
  running: 70,
  success: 100,
  failed: 100
};

let pollingTimer: number | undefined;
let navigateTimer: number | undefined;

Page({
  data: {
    taskId: "",
    status: "queued",
    statusText: statusTextMap.queued,
    hintText: hintTextMap.queued,
    progress: 20,
    resultImageUrl: "",
    errorMessage: "",
    showFailedActions: false,
    hasNavigated: false
  },

  onLoad(options: Record<string, string | undefined>) {
    const taskId = options.taskId ?? "";
    this.setData({
      taskId
    });
    this.startPolling();
  },

  onUnload() {
    this.stopPolling();
    this.stopNavigateTimer();
  },

  startPolling() {
    this.pollTask();
    pollingTimer = setInterval(() => {
      this.pollTask();
    }, 2000) as unknown as number;
  },

  stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = undefined;
    }
  },

  stopNavigateTimer() {
    if (navigateTimer) {
      clearTimeout(navigateTimer);
      navigateTimer = undefined;
    }
  },

  updateRecentTask(task: AiTask) {
    const tasks = ((wx.getStorageSync(recentTaskStorageKey) as RecentTaskStorage[]) || []).map((item) => {
      if (item.taskId !== task._id) {
        return item;
      }

      return {
        ...item,
        status: task.status,
        resultImageUrl: task.resultImageUrl ?? "",
        clothingCount: task.clothingItemIds.length
      };
    });

    wx.setStorageSync(recentTaskStorageKey, tasks);
  },

  async pollTask() {
    if (!this.data.taskId) {
      return;
    }

    try {
      const response = await request<{ task: AiTask }>({
        url: `/ai/tasks/${this.data.taskId}`
      });
      const task = response.data?.task;

      if (!task) {
        return;
      }

      this.setData({
        status: task.status,
        statusText: statusTextMap[task.status],
        hintText: hintTextMap[task.status],
        progress: progressMap[task.status],
        resultImageUrl: task.resultImageUrl ?? "",
        errorMessage: task.errorMessage ?? "",
        showFailedActions: task.status === "failed"
      });

      if (task.status === "success") {
        this.stopPolling();
        this.updateRecentTask(task);
        this.scheduleResultNavigation(task._id);
      }

      if (task.status === "failed") {
        this.stopPolling();
        this.updateRecentTask(task);
      }
    } catch {
      showToast("任务查询失败，请稍后重试");
      this.stopPolling();
      this.setData({
        status: "failed",
        statusText: statusTextMap.failed,
        hintText: "任务状态暂时不可用",
        progress: 100,
        showFailedActions: true
      });
    }
  },

  scheduleResultNavigation(taskId: string) {
    if (this.data.hasNavigated) {
      return;
    }

    this.setData({
      hasNavigated: true
    });
    navigateTimer = setTimeout(() => {
      wx.redirectTo({
        url: `/pages/result/detail?taskId=${taskId}`
      });
    }, 900) as unknown as number;
  },

  onRetry() {
    wx.switchTab({
      url: "/pages/tryon/index"
    });
  },

  onBackTryon() {
    wx.switchTab({
      url: "/pages/tryon/index"
    });
  }
});
