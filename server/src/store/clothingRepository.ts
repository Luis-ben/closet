import { AppError } from "../utils/errors";
import { createId, nowIso } from "../utils/ids";
import { getDataStoreProvider, store } from ".";
import type {
  ClothingItemRecord,
  ClothingSourceType
} from "./types";
import { getMongoDb } from "./mongo";

type ClothingCategory = ClothingItemRecord["category"];

interface CreateClothingItemInput {
  userId: string;
  imageUrl: string;
  sourceType: ClothingSourceType;
  sourceUrl: string | null;
  category: ClothingCategory;
  color: string;
  season: string[];
  occasion: string[];
  note: string;
}

export interface ClothingRepository {
  create(input: CreateClothingItemInput): Promise<ClothingItemRecord>;
  listActiveByUser(userId: string): Promise<ClothingItemRecord[]>;
  findActiveByUser(itemId: string, userId: string): Promise<ClothingItemRecord | null>;
  findManyActiveByUser(itemIds: string[], userId: string): Promise<ClothingItemRecord[]>;
  softDeleteByUser(itemId: string, userId: string): Promise<boolean>;
  softDeleteAllByUser(userId: string): Promise<number>;
  incrementUseCounts(userId: string, itemIds: string[], updatedAt: string): Promise<void>;
}

function createClothingItem(input: CreateClothingItemInput): ClothingItemRecord {
  const now = nowIso();

  return {
    _id: createId("cloth"),
    userId: input.userId,
    imageUrl: input.imageUrl,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    category: input.category,
    color: input.color,
    season: input.season,
    occasion: input.occasion,
    note: input.note,
    useCount: 0,
    status: "normal",
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

function sortNewestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function preserveInputOrder(
  itemIds: string[],
  items: ClothingItemRecord[]
): ClothingItemRecord[] {
  const byId = new Map(items.map((item) => [item._id, item]));

  return itemIds.flatMap((itemId) => {
    const item = byId.get(itemId);
    return item ? [item] : [];
  });
}

class MemoryClothingRepository implements ClothingRepository {
  async create(input: CreateClothingItemInput): Promise<ClothingItemRecord> {
    const item = createClothingItem(input);
    store.clothingItems.push(item);

    return item;
  }

  async listActiveByUser(userId: string): Promise<ClothingItemRecord[]> {
    return sortNewestFirst(
      store.clothingItems.filter((item) => item.userId === userId && item.status === "normal")
    );
  }

  async findActiveByUser(itemId: string, userId: string): Promise<ClothingItemRecord | null> {
    return (
      store.clothingItems.find(
        (item) => item._id === itemId && item.userId === userId && item.status === "normal"
      ) ?? null
    );
  }

  async findManyActiveByUser(
    itemIds: string[],
    userId: string
  ): Promise<ClothingItemRecord[]> {
    const items = store.clothingItems.filter(
      (item) => itemIds.includes(item._id) && item.userId === userId && item.status === "normal"
    );

    return preserveInputOrder(itemIds, items);
  }

  async softDeleteByUser(itemId: string, userId: string): Promise<boolean> {
    const item = await this.findActiveByUser(itemId, userId);

    if (!item) {
      return false;
    }

    const now = nowIso();
    item.status = "deleted";
    item.deletedAt = now;
    item.updatedAt = now;

    return true;
  }

  async softDeleteAllByUser(userId: string): Promise<number> {
    const now = nowIso();
    let deletedCount = 0;

    for (const item of store.clothingItems) {
      if (item.userId === userId && item.status !== "deleted") {
        item.status = "deleted";
        item.deletedAt = now;
        item.updatedAt = now;
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  async incrementUseCounts(userId: string, itemIds: string[], updatedAt: string): Promise<void> {
    for (const item of store.clothingItems) {
      if (item.userId === userId && itemIds.includes(item._id) && item.status === "normal") {
        item.useCount += 1;
        item.updatedAt = updatedAt;
      }
    }
  }
}

class MongoClothingRepository implements ClothingRepository {
  async create(input: CreateClothingItemInput): Promise<ClothingItemRecord> {
    const db = await getMongoDb();
    const item = createClothingItem(input);

    await db.collection<ClothingItemRecord>("clothing_items").insertOne(item);

    return item;
  }

  async listActiveByUser(userId: string): Promise<ClothingItemRecord[]> {
    const db = await getMongoDb();

    return db
      .collection<ClothingItemRecord>("clothing_items")
      .find({
        userId,
        status: "normal"
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findActiveByUser(itemId: string, userId: string): Promise<ClothingItemRecord | null> {
    const db = await getMongoDb();

    return db.collection<ClothingItemRecord>("clothing_items").findOne({
      _id: itemId,
      userId,
      status: "normal"
    });
  }

  async findManyActiveByUser(
    itemIds: string[],
    userId: string
  ): Promise<ClothingItemRecord[]> {
    const db = await getMongoDb();
    const items = await db
      .collection<ClothingItemRecord>("clothing_items")
      .find({
        _id: {
          $in: itemIds
        },
        userId,
        status: "normal"
      })
      .toArray();

    return preserveInputOrder(itemIds, items);
  }

  async softDeleteByUser(itemId: string, userId: string): Promise<boolean> {
    const db = await getMongoDb();
    const now = nowIso();
    const result = await db.collection<ClothingItemRecord>("clothing_items").updateOne(
      {
        _id: itemId,
        userId,
        status: "normal"
      },
      {
        $set: {
          status: "deleted",
          deletedAt: now,
          updatedAt: now
        }
      }
    );

    return result.modifiedCount > 0;
  }

  async softDeleteAllByUser(userId: string): Promise<number> {
    const db = await getMongoDb();
    const now = nowIso();
    const result = await db.collection<ClothingItemRecord>("clothing_items").updateMany(
      {
        userId,
        status: {
          $ne: "deleted"
        }
      },
      {
        $set: {
          status: "deleted",
          deletedAt: now,
          updatedAt: now
        }
      }
    );

    return result.modifiedCount;
  }

  async incrementUseCounts(userId: string, itemIds: string[], updatedAt: string): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    const db = await getMongoDb();
    await db.collection<ClothingItemRecord>("clothing_items").updateMany(
      {
        _id: {
          $in: itemIds
        },
        userId,
        status: "normal"
      },
      {
        $inc: {
          useCount: 1
        },
        $set: {
          updatedAt
        }
      }
    );
  }
}

const memoryClothingRepository = new MemoryClothingRepository();
const mongoClothingRepository = new MongoClothingRepository();

export function assertAllClothingItemsFound(
  requestedIds: string[],
  items: ClothingItemRecord[]
): void {
  if (items.length !== requestedIds.length) {
    throw new AppError(404, "CLOTHING_ITEM_NOT_FOUND", "衣物不存在");
  }
}

export function getClothingRepository(): ClothingRepository {
  return getDataStoreProvider() === "mongodb" ? mongoClothingRepository : memoryClothingRepository;
}
