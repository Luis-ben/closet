"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../../utils/request");
const feedback_1 = require("../../utils/feedback");
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
let pollingTimer;
let navigateTimer;
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
    onLoad(options) {
        var _a;
        const taskId = (_a = options.taskId) !== null && _a !== void 0 ? _a : "";
        if (!taskId) {
            this.setData({
                status: "failed",
                statusText: statusTextMap.failed,
                hintText: "缺少任务 ID，请重新发起试穿",
                progress: 100,
                showFailedActions: true
            });
            return;
        }
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
        }, 2000);
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
    updateRecentTask(task) {
        const tasks = (wx.getStorageSync(recentTaskStorageKey) || []).map((item) => {
            var _a;
            if (item.taskId !== task._id) {
                return item;
            }
            return Object.assign(Object.assign({}, item), { status: task.status, resultImageUrl: (_a = task.resultImageUrl) !== null && _a !== void 0 ? _a : "", clothingCount: task.clothingItemIds.length });
        });
        wx.setStorageSync(recentTaskStorageKey, tasks);
    },
    async pollTask() {
        var _a, _b, _c;
        if (!this.data.taskId) {
            return;
        }
        try {
            const response = await (0, request_1.request)({
                url: `/ai/tasks/${this.data.taskId}`
            });
            const task = (_a = response.data) === null || _a === void 0 ? void 0 : _a.task;
            if (!task) {
                return;
            }
            this.setData({
                status: task.status,
                statusText: statusTextMap[task.status],
                hintText: hintTextMap[task.status],
                progress: progressMap[task.status],
                resultImageUrl: (_b = task.resultImageUrl) !== null && _b !== void 0 ? _b : "",
                errorMessage: (_c = task.errorMessage) !== null && _c !== void 0 ? _c : "",
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
        }
        catch (_d) {
            (0, feedback_1.showToast)("任务查询失败，请稍后重试");
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
    scheduleResultNavigation(taskId) {
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
        }, 900);
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
