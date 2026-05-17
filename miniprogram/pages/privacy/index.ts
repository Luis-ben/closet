import { request } from "../../utils/request";
import { hideLoading, showLoading, showToast } from "../../utils/feedback";

Page({
  confirmDanger(title: string, content: string): Promise<boolean> {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        confirmText: "确认",
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

  async onDeleteAllClothing() {
    const confirmed = await this.confirmDanger("删除全部衣物？", "删除后，衣物将不会出现在试穿选择中。");

    if (confirmed) {
      showToast("批量删除接口待接入");
    }
  },

  async onDeleteModels() {
    const confirmed = await this.confirmDanger("删除我的模特？", "删除后，将临时使用系统默认模特生成试穿图。");

    if (confirmed) {
      showToast("模特删除接口待接入");
    }
  },

  async onDeleteAccount() {
    const confirmed = await this.confirmDanger("注销账号？", "账号数据会进入清理流程，此操作需要谨慎确认。");

    if (!confirmed) {
      return;
    }

    showLoading("提交中");

    try {
      await request({
        url: "/privacy/delete-account",
        method: "POST"
      });
      showToast("已提交删除", "success");
    } catch {
      showToast("删除失败，请稍后重试");
    } finally {
      hideLoading();
    }
  }
});
