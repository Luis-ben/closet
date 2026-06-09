import { defaultModelPhoto, store as memoryStore } from "./mockStore";

export type DataStoreProvider = "memory" | "mongodb";

export function getDataStoreProvider(): DataStoreProvider {
  const provider = process.env.DATA_STORE_PROVIDER ?? "memory";

  if (provider === "memory" || provider === "mongodb") {
    return provider;
  }

  throw new Error(`不支持的数据存储类型：${provider}`);
}

export function assertDataStoreReady(): void {
  const provider = getDataStoreProvider();

  if (process.env.NODE_ENV === "production" && provider === "memory") {
    throw new Error("生产环境不能使用内存 data store，请配置 DATA_STORE_PROVIDER=mongodb");
  }

  if (provider === "mongodb") {
    throw new Error("DATA_STORE_PROVIDER=mongodb 已声明，但 MongoDB data store 尚未实现");
  }
}

export const dataStore = memoryStore;
export const store = dataStore;

export { defaultModelPhoto };

export function getDataStore() {
  return dataStore;
}
