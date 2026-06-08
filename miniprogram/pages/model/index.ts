import { hideLoading, showLoading, showToast } from "../../utils/feedback";
import { request } from "../../utils/request";
import { chooseMockImage, type MockUploadedImage } from "../../utils/upload";

interface UserPhoto {
  _id: string;
  imageUrl: string;
  isActiveModel: boolean;
  displayName: string;
  auditStatus: "pending" | "pass" | "reject";
}

interface ModelCard extends UserPhoto {
  auditText: string;
  selected: boolean;
}

const defaultModelImage = "https://placehold.co/768x1024/png?text=Default+Model";
const auditTextMap: Record<UserPhoto["auditStatus"], string> = {
  pending: "审核中",
  pass: "可使用",
  reject: "未通过"
};

Page({
  data: {
    loading: false,
    currentModelImage: defaultModelImage,
    currentModelName: "系统默认模特",
    currentModelTypeText: "系统默认模特",
    currentAuditText: "可使用",
    hasPersonalModel: false,
    modelCards: [] as ModelCard[]
  },

  onShow() {
    this.loadModel();
  },

  async loadModel() {
    this.setData({
      loading: true
    });

    try {
      const response = await request<{ items: UserPhoto[] }>({
        url: "/user-photos"
      });
      const items = response.data?.items ?? [];
      const preferredType = wx.getStorageSync("preferredModelType") as string;
      const preferredModelId = wx.getStorageSync("preferredModelPhotoId") as string;
      const activeModel = preferredType === "default_model"
        ? null
        : items.find((item) => item._id === preferredModelId) ?? items.find((item) => item.isActiveModel) ?? null;
      const modelCards = items.map((item) => ({
        ...item,
        auditText: auditTextMap[item.auditStatus] ?? "未知",
        selected: Boolean(activeModel && item._id === activeModel._id)
      }));

      this.setData({
        currentModelImage: activeModel?.imageUrl ?? defaultModelImage,
        currentModelName: activeModel?.displayName || "系统默认模特",
        currentModelTypeText: activeModel ? "我的专属模特" : "系统默认模特",
        currentAuditText: activeModel ? auditTextMap[activeModel.auditStatus] : "可使用",
        hasPersonalModel: Boolean(activeModel),
        modelCards,
        loading: false
      });
    } catch {
      this.setData({
        loading: false
      });
      showToast("模特加载失败");
    }
  },

  async onUploadModel() {
    const uploaded: MockUploadedImage | null = await chooseMockImage();

    if (!uploaded) {
      return;
    }

    showLoading("保存中");

    try {
      const response = await request<{ photo: UserPhoto }>({
        url: "/user-photos",
        method: "POST",
        data: {
          imageUrl: uploaded.imageUrl,
          imageMeta: uploaded.imageMeta,
          displayName: "我的模特"
        }
      });
      const photo = response.data?.photo;

      if (photo) {
        wx.setStorageSync("preferredModelType", "personal_model");
        wx.setStorageSync("preferredModelPhotoId", photo._id);
      }

      showToast("已设置", "success");
      this.loadModel();
    } catch {
      showToast("保存失败");
    } finally {
      hideLoading();
    }
  },

  onUseDefault() {
    wx.setStorageSync("preferredModelType", "default_model");
    wx.removeStorageSync("preferredModelPhotoId");

    this.setData({
      currentModelImage: defaultModelImage,
      currentModelName: "系统默认模特",
      currentModelTypeText: "系统默认模特",
      currentAuditText: "可使用",
      hasPersonalModel: false,
      modelCards: (this.data.modelCards as ModelCard[]).map((item) => ({
        ...item,
        selected: false
      }))
    });
    showToast("已切换为默认模特", "success");
  },

  async onSelectLocalModel(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    const model = (this.data.modelCards as ModelCard[]).find((item) => item._id === id);

    if (!model) {
      return;
    }

    if (model.auditStatus !== "pass") {
      showToast("该模特暂不可使用");
      return;
    }

    showLoading("切换中");

    try {
      await request({
        url: `/user-photos/${model._id}/activate`,
        method: "POST"
      });
      wx.setStorageSync("preferredModelType", "personal_model");
      wx.setStorageSync("preferredModelPhotoId", model._id);

      this.setData({
        currentModelImage: model.imageUrl,
        currentModelName: model.displayName,
        currentModelTypeText: "我的专属模特",
        currentAuditText: auditTextMap[model.auditStatus],
        hasPersonalModel: true,
        modelCards: (this.data.modelCards as ModelCard[]).map((item) => ({
          ...item,
          selected: item._id === id
        }))
      });
      showToast("已切换模特", "success");
    } catch {
      showToast("切换失败，请稍后重试");
    } finally {
      hideLoading();
    }
  }
});
