import { createId, nowIso } from "../utils/ids";
import type {
  AiTaskRecord,
  ClothingItemRecord,
  CreditLogRecord,
  UserPhotoRecord,
  UserRecord
} from "./types";

const createdAt = nowIso();

export const defaultUser: UserRecord = {
  _id: "user_mock_001",
  openid: "openid_mock_001",
  nickname: "Mock User",
  avatarUrl: "",
  plan: "free",
  credits: 3,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null
};

export const defaultModelPhoto: UserPhotoRecord = {
  _id: "default_model_001",
  userId: "system",
  imageUrl: "https://placehold.co/768x1024/png?text=Default+Model",
  type: "default_model",
  isActiveModel: true,
  displayName: "默认模特",
  auditStatus: "pass",
  createdAt,
  updatedAt: createdAt,
  deletedAt: null
};

export const store = {
  users: [defaultUser] as UserRecord[],
  clothingItems: [] as ClothingItemRecord[],
  userPhotos: [] as UserPhotoRecord[],
  aiTasks: [] as AiTaskRecord[],
  creditLogs: [
    {
      _id: createId("credit_log"),
      userId: defaultUser._id,
      change: defaultUser.credits,
      reason: "signup",
      taskId: null,
      balanceAfter: defaultUser.credits,
      createdAt
    }
  ] as CreditLogRecord[]
};
