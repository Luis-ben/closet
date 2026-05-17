import { request } from "../../utils/request";
import { showToast } from "../../utils/feedback";

Page({
  data: {
    credits: 0,
    nickname: "微信用户",
    avatarUrl: "",
    avatarText: "我",
    planText: "FREE",
    loading: false
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    this.setData({
      loading: true
    });

    try {
      const response = await request<{
        user: { credits: number; nickname?: string; avatarUrl?: string; plan?: string };
      }>({
        url: "/users/me"
      });
      const user = response.data?.user;
      const nickname = user?.nickname || "微信用户";

      this.setData({
        credits: user?.credits ?? 0,
        nickname,
        avatarUrl: user?.avatarUrl || "",
        avatarText: nickname.slice(0, 1),
        planText: (user?.plan || "free").toUpperCase(),
        loading: false
      });
    } catch {
      this.setData({
        loading: false
      });
      showToast("资料加载失败");
    }
  },

  onOpenModel() {
    wx.navigateTo({
      url: "/pages/model/index"
    });
  },

  onOpenWorks() {
    wx.switchTab({
      url: "/pages/inspiration/index"
    });
  },

  onOpenPrivacy() {
    wx.navigateTo({
      url: "/pages/privacy/index"
    });
  },

  onContact() {
    showToast("客服能力即将接入");
  },

  onAbout() {
    showToast("AI 衣镜 v0.1.0");
  },

  onGetCredits() {
    showToast("购买功能即将开放");
  }
});
