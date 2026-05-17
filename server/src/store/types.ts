export type UserPlan = "free" | "vip" | "shop";
export type ClothingSourceType = "camera" | "album" | "web_image" | "product_image";
export type ClothingStatus = "normal" | "deleted";
export type ModelType = "personal_model" | "default_model";
export type AuditStatus = "pending" | "pass" | "reject";
export type AiTaskStatus = "queued" | "running" | "success" | "failed";
export type AiMode = "quick" | "high" | "shop";

export interface UserRecord {
  _id: string;
  openid: string;
  nickname: string;
  avatarUrl: string;
  plan: UserPlan;
  credits: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ClothingItemRecord {
  _id: string;
  userId: string;
  imageUrl: string;
  sourceType: ClothingSourceType;
  sourceUrl: string | null;
  category: string;
  color: string;
  season: string[];
  occasion: string[];
  note: string;
  useCount: number;
  status: ClothingStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UserPhotoRecord {
  _id: string;
  userId: string;
  imageUrl: string;
  type: ModelType;
  isActiveModel: boolean;
  displayName: string;
  auditStatus: AuditStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AiTaskRecord {
  _id: string;
  userId: string;
  modelType: ModelType;
  modelPhotoId: string | null;
  clothingItemIds: string[];
  mode: AiMode;
  scene: string | null;
  style: string | null;
  shareable: boolean;
  promptVersion: string;
  status: AiTaskStatus;
  resultImageUrl: string | null;
  retryCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  costEstimate: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}

export interface CreditLogRecord {
  _id: string;
  userId: string;
  change: number;
  reason: "signup" | "pay" | "generate" | "refund" | "admin";
  taskId: string | null;
  balanceAfter: number;
  createdAt: string;
}
