import { assertRuntimeConfig, runtimeConfig } from "./utils/config";
import { request } from "./utils/request";

interface LoginResponse {
  token: string;
}

App({
  globalData: {
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    token: runtimeConfig.enableMockTokenFallback ? runtimeConfig.mockToken : "",
    loginPromise: null as Promise<void> | null
  },

  onLaunch() {
    try {
      assertRuntimeConfig();
    } catch (error) {
      wx.showModal({
        title: "配置不可发布",
        content: error instanceof Error ? error.message : "当前运行配置不适合正式发布",
        showCancel: false
      });
      return;
    }

    this.globalData.loginPromise = this.loginWithWechat();
  },

  async loginWithWechat() {
    try {
      const code = await this.getWechatLoginCode();
      const response = await request<LoginResponse>({
        url: "/auth/wechat-login",
        method: "POST",
        data: {
          code
        },
        skipAuth: true
      });
      const token = response.data?.token;

      if (token) {
        this.globalData.token = token;
      }
    } catch {
      if (!runtimeConfig.enableMockTokenFallback) {
        this.globalData.token = "";
      }
    }
  },

  getWechatLoginCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.login({
        success(result) {
          if (result.code) {
            resolve(result.code);
            return;
          }

          reject(new Error("微信登录失败"));
        },
        fail(error) {
          reject(error);
        }
      });
    });
  }
});
