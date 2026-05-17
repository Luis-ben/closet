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
}

interface AppWithGlobalData {
  globalData: {
    apiBaseUrl: string;
    token?: string;
  };
}

export function request<T>(options: RequestOptions): Promise<ApiResponse<T>> {
  const app = getApp<AppWithGlobalData>();
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
