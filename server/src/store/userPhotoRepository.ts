import { AppError } from "../utils/errors";
import { createId, nowIso } from "../utils/ids";
import { getDataStoreProvider, store } from ".";
import type { UserPhotoRecord } from "./types";
import { getMongoDb } from "./mongo";

interface CreatePersonalModelInput {
  userId: string;
  imageUrl: string;
  displayName: string;
}

export interface UserPhotoRepository {
  createPersonalModel(input: CreatePersonalModelInput): Promise<UserPhotoRecord>;
  listByUser(userId: string): Promise<UserPhotoRecord[]>;
  findActivePersonalModel(userId: string): Promise<UserPhotoRecord | null>;
  findPassPersonalModelById(photoId: string, userId: string): Promise<UserPhotoRecord | null>;
  activatePersonalModel(photoId: string, userId: string): Promise<UserPhotoRecord>;
  softDeleteAllByUser(userId: string): Promise<number>;
}

function createPersonalModel(input: CreatePersonalModelInput): UserPhotoRecord {
  const now = nowIso();

  return {
    _id: createId("model"),
    userId: input.userId,
    imageUrl: input.imageUrl,
    type: "personal_model",
    isActiveModel: true,
    displayName: input.displayName,
    auditStatus: "pass",
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

function sortNewestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

class MemoryUserPhotoRepository implements UserPhotoRepository {
  async createPersonalModel(input: CreatePersonalModelInput): Promise<UserPhotoRecord> {
    const now = nowIso();

    for (const photo of store.userPhotos) {
      if (photo.userId === input.userId && photo.type === "personal_model" && !photo.deletedAt) {
        photo.isActiveModel = false;
        photo.updatedAt = now;
      }
    }

    const photo = createPersonalModel(input);
    store.userPhotos.push(photo);

    return photo;
  }

  async listByUser(userId: string): Promise<UserPhotoRecord[]> {
    return sortNewestFirst(
      store.userPhotos.filter((photo) => photo.userId === userId && !photo.deletedAt)
    );
  }

  async findActivePersonalModel(userId: string): Promise<UserPhotoRecord | null> {
    return (
      store.userPhotos.find(
        (photo) =>
          photo.userId === userId &&
          photo.type === "personal_model" &&
          photo.isActiveModel &&
          photo.auditStatus === "pass" &&
          !photo.deletedAt
      ) ?? null
    );
  }

  async findPassPersonalModelById(
    photoId: string,
    userId: string
  ): Promise<UserPhotoRecord | null> {
    return (
      store.userPhotos.find(
        (photo) =>
          photo._id === photoId &&
          photo.userId === userId &&
          photo.type === "personal_model" &&
          photo.auditStatus === "pass" &&
          !photo.deletedAt
      ) ?? null
    );
  }

  async activatePersonalModel(photoId: string, userId: string): Promise<UserPhotoRecord> {
    const model = await this.findPassPersonalModelById(photoId, userId);

    if (!model) {
      throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
    }

    const now = nowIso();

    for (const photo of store.userPhotos) {
      if (photo.userId === userId && photo.type === "personal_model" && !photo.deletedAt) {
        photo.isActiveModel = photo._id === model._id;
        photo.updatedAt = now;
      }
    }

    return model;
  }

  async softDeleteAllByUser(userId: string): Promise<number> {
    const now = nowIso();
    let deletedCount = 0;

    for (const photo of store.userPhotos) {
      if (photo.userId === userId && !photo.deletedAt) {
        photo.deletedAt = now;
        photo.isActiveModel = false;
        photo.updatedAt = now;
        deletedCount += 1;
      }
    }

    return deletedCount;
  }
}

class MongoUserPhotoRepository implements UserPhotoRepository {
  async createPersonalModel(input: CreatePersonalModelInput): Promise<UserPhotoRecord> {
    const db = await getMongoDb();
    const now = nowIso();
    const photo = createPersonalModel(input);

    await db.collection<UserPhotoRecord>("user_photos").updateMany(
      {
        userId: input.userId,
        type: "personal_model",
        deletedAt: null
      },
      {
        $set: {
          isActiveModel: false,
          updatedAt: now
        }
      }
    );

    await db.collection<UserPhotoRecord>("user_photos").insertOne(photo);

    return photo;
  }

  async listByUser(userId: string): Promise<UserPhotoRecord[]> {
    const db = await getMongoDb();

    return db
      .collection<UserPhotoRecord>("user_photos")
      .find({
        userId,
        deletedAt: null
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findActivePersonalModel(userId: string): Promise<UserPhotoRecord | null> {
    const db = await getMongoDb();

    return db.collection<UserPhotoRecord>("user_photos").findOne({
      userId,
      type: "personal_model",
      isActiveModel: true,
      auditStatus: "pass",
      deletedAt: null
    });
  }

  async findPassPersonalModelById(
    photoId: string,
    userId: string
  ): Promise<UserPhotoRecord | null> {
    const db = await getMongoDb();

    return db.collection<UserPhotoRecord>("user_photos").findOne({
      _id: photoId,
      userId,
      type: "personal_model",
      auditStatus: "pass",
      deletedAt: null
    });
  }

  async activatePersonalModel(photoId: string, userId: string): Promise<UserPhotoRecord> {
    const db = await getMongoDb();
    const model = await this.findPassPersonalModelById(photoId, userId);

    if (!model) {
      throw new AppError(404, "MODEL_PHOTO_NOT_FOUND", "我的模特不存在");
    }

    const now = nowIso();
    await db.collection<UserPhotoRecord>("user_photos").updateMany(
      {
        userId,
        type: "personal_model",
        deletedAt: null
      },
      [
        {
          $set: {
            isActiveModel: {
              $eq: ["$_id", model._id]
            },
            updatedAt: now
          }
        }
      ]
    );

    return {
      ...model,
      isActiveModel: true,
      updatedAt: now
    };
  }

  async softDeleteAllByUser(userId: string): Promise<number> {
    const db = await getMongoDb();
    const now = nowIso();
    const result = await db.collection<UserPhotoRecord>("user_photos").updateMany(
      {
        userId,
        deletedAt: null
      },
      {
        $set: {
          deletedAt: now,
          isActiveModel: false,
          updatedAt: now
        }
      }
    );

    return result.modifiedCount;
  }
}

const memoryUserPhotoRepository = new MemoryUserPhotoRepository();
const mongoUserPhotoRepository = new MongoUserPhotoRepository();

export function getUserPhotoRepository(): UserPhotoRepository {
  return getDataStoreProvider() === "mongodb" ? mongoUserPhotoRepository : memoryUserPhotoRepository;
}
