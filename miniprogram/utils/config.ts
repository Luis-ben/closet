export const runtimeConfig = {
  // Before submitting for review, replace this with a configured HTTPS request domain.
  apiBaseUrl: "http://localhost:3000/api",
  enableMockTokenFallback: true,
  mockToken: "mock-token-user_mock_001"
};

export function assertRuntimeConfig() {
  const accountInfo = wx.getAccountInfoSync?.();
  const envVersion = accountInfo?.miniProgram?.envVersion ?? "develop";
  const isRelease = envVersion === "release";
  const usesLocalhost = /^http:\/\/localhost(?::\d+)?\/api$/i.test(runtimeConfig.apiBaseUrl);

  if (isRelease && usesLocalhost) {
    throw new Error("正式版小程序不能使用 localhost API 地址");
  }

  if (isRelease && runtimeConfig.enableMockTokenFallback) {
    throw new Error("正式版小程序不能启用 mock token fallback");
  }
}
