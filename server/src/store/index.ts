import { defaultModelPhoto, store as memoryStore } from "./mockStore";

export const dataStore = memoryStore;
export const store = dataStore;

export { defaultModelPhoto };

export function getDataStore() {
  return dataStore;
}
