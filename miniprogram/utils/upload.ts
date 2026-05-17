import { showLoading, hideLoading, showToast } from "./feedback";
import type { ApiResponse } from "./request";

export interface MockUploadedImage {
  imageUrl: string;
  imageMeta: {
    sizeBytes: number;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
  };
}

interface AppWithGlobalData {
  globalData: {
    apiBaseUrl: string;
    token?: string;
  };
}

interface UploadResponse {
  imageUrl: string;
  imageMeta: MockUploadedImage["imageMeta"];
}

const maxImageSizeBytes = 5 * 1024 * 1024;

export async function chooseMockImage(): Promise<MockUploadedImage | null> {
  const authorized = await ensurePrivacyAuthorized();

  if (!authorized) {
    return null;
  }

  const localImage = await chooseLocalImage();

  if (!localImage) {
    return null;
  }

  showLoading("上传中");

  try {
    return await uploadImageFile(localImage.tempFilePath);
  } catch {
    showToast("图片上传失败，请稍后重试");
    return null;
  } finally {
    hideLoading();
  }
}

function ensurePrivacyAuthorized(): Promise<boolean> {
  const maybeAuthorize = wx.requirePrivacyAuthorize as
    | undefined
    | ((option: {
        success: () => void;
        fail: () => void;
      }) => void);

  if (!maybeAuthorize) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    maybeAuthorize({
      success() {
        resolve(true);
      },
      fail() {
        showToast("需要授权后才能选择图片");
        resolve(false);
      }
    });
  });
}

function chooseLocalImage(): Promise<WechatMiniprogram.MediaFile | null> {
  return new Promise((resolve) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success(result) {
        const file = result.tempFiles[0];

        if (!file) {
          resolve(null);
          return;
        }

        if (file.size > maxImageSizeBytes) {
          showToast("图片不能超过 5MB");
          resolve(null);
          return;
        }

        resolve(file);
      },
      fail() {
        resolve(null);
      }
    });
  });
}

function uploadImageFile(filePath: string): Promise<MockUploadedImage> {
  const app = getApp<AppWithGlobalData>();
  const token = app.globalData.token;

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/uploads/image`,
      filePath,
      name: "file",
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(result) {
        try {
          const response = JSON.parse(result.data) as ApiResponse<UploadResponse>;

          if (result.statusCode >= 200 && result.statusCode < 300 && response.success && response.data) {
            resolve(response.data);
            return;
          }

          showToast(response.error?.message || "图片上传失败");
          reject(new Error(response.error?.message || "图片上传失败"));
        } catch {
          reject(new Error("图片上传响应异常"));
        }
      },
      fail(error) {
        reject(error);
      }
    });
  });
}
