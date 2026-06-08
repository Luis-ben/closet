type HttpMethod = "GET" | "POST" | "DELETE";

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
}

interface RequestOptions {
  url: string;
  method?: HttpMethod;
  data?: string | WechatMiniprogram.IAnyObject | ArrayBuffer;
  skipAuth?: boolean;
}

interface AppWithGlobalData {
  globalData: {
    apiBaseUrl: string;
    token?: string;
    loginPromise?: Promise<void> | null;
  };
}

export async function request<T>(options: RequestOptions): Promise<ApiResponse<T>> {
  const app = getApp<AppWithGlobalData>();

  if (!options.skipAuth && app.globalData.loginPromise) {
    await app.globalData.loginPromise;
  }

  const baseUrl = app.globalData.apiBaseUrl;
  const token = app.globalData.token;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${options.url}`,
      method: options.method ?? "GET",
      data: options.data,
      header: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(response) {
        const body = response.data as ApiResponse<T>;

        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body);
          return;
        }

        reject(body.error ?? new Error("请求失败"));
      },
      fail(error) {
        reject(error);
      }
    });
  });
}
