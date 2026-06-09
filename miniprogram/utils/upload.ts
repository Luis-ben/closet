import { showLoading, hideLoading, showToast } from "./feedback";
import { request, type ApiResponse } from "./request";

export interface UploadedImage {
  imageUrl: string;
  imageMeta: {
    sizeBytes: number;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
  };
}

export type MockUploadedImage = UploadedImage;

interface ChooseImageOptions {
  sourceType?: "album" | "camera";
}

interface AppWithGlobalData {
  globalData: {
    apiBaseUrl: string;
    token?: string;
  };
}

interface UploadResponse {
  imageUrl: string;
  imageMeta: UploadedImage["imageMeta"];
}

interface UploadTokenResponse {
  provider: "local" | "cos" | "wechat-cloud";
  objectKey: string;
  uploadUrl: string | null;
  imageUrl: string | null;
  headers: Record<string, string> | null;
  formData: Record<string, string> | null;
  cloudPath: string | null;
  imageMeta: UploadedImage["imageMeta"];
  expiresAt: string;
}

const maxImageSizeBytes = 5 * 1024 * 1024;

export async function chooseMockImage(options: ChooseImageOptions = {}): Promise<MockUploadedImage | null> {
  const authorized = await ensurePrivacyAuthorized();

  if (!authorized) {
    return null;
  }

  const localImage = await chooseLocalImage(options.sourceType ?? "album");

  if (!localImage) {
    return null;
  }

  showLoading("上传中");

  try {
    return await uploadImageFile(localImage);
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

function chooseLocalImage(sourceType: "album" | "camera"): Promise<WechatMiniprogram.MediaFile | null> {
  return new Promise((resolve) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: [sourceType],
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

async function uploadImageFile(file: WechatMiniprogram.MediaFile): Promise<UploadedImage> {
  const mimeType = getMimeType(file.tempFilePath);
  const tokenResponse = await request<UploadTokenResponse>({
    url: "/uploads/image-token",
    method: "POST",
    data: {
      fileName: file.tempFilePath.split("/").pop() || "image.png",
      mimeType,
      sizeBytes: file.size
    }
  });
  const uploadToken = tokenResponse.data;

  if (!uploadToken) {
    throw new Error("上传凭证获取失败");
  }

  if (uploadToken.provider === "wechat-cloud") {
    return uploadToWechatCloud(file.tempFilePath, uploadToken);
  }

  if (uploadToken.provider === "cos") {
    return uploadToCos(file.tempFilePath, uploadToken);
  }

  return uploadToLocalServer(file.tempFilePath);
}

function uploadToLocalServer(filePath: string): Promise<UploadedImage> {
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

function uploadToCos(filePath: string, uploadToken: UploadTokenResponse): Promise<UploadedImage> {
  const uploadUrl = uploadToken.uploadUrl;
  const imageUrl = uploadToken.imageUrl;

  if (!uploadUrl || !imageUrl) {
    return Promise.reject(new Error("COS 上传凭证不完整"));
  }

  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success(fileResult) {
        wx.request({
          url: uploadUrl,
          method: "PUT",
          data: fileResult.data,
          header: uploadToken.headers ?? {},
          success(result) {
            if (result.statusCode >= 200 && result.statusCode < 300) {
              resolve({
                imageUrl,
                imageMeta: uploadToken.imageMeta
              });
              return;
            }

            reject(new Error("COS 上传失败"));
          },
          fail(error) {
            reject(error);
          }
        });
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function uploadToWechatCloud(filePath: string, uploadToken: UploadTokenResponse): Promise<UploadedImage> {
  const cloudPath = uploadToken.cloudPath;
  const imageUrl = uploadToken.imageUrl;

  if (!cloudPath || !imageUrl) {
    return Promise.reject(new Error("微信云上传凭证不完整"));
  }

  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success() {
        resolve({
          imageUrl,
          imageMeta: uploadToken.imageMeta
        });
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function getMimeType(filePath: string): UploadedImage["imageMeta"]["mimeType"] {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}
