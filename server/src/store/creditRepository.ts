import type { ClientSession, Db } from "mongodb";
import { AppError } from "../utils/errors";
import { createId, nowIso } from "../utils/ids";
import { getDataStoreProvider, store } from ".";
import type { CreditLogRecord, UserRecord } from "./types";
import { getMongoClient, getMongoDb } from "./mongo";

export interface CreditRepository {
  listLogs(userId: string): Promise<CreditLogRecord[]>;
  ensureCredits(userId: string, amount: number): Promise<void>;
  deductCredits(userId: string, amount: number, taskId: string): Promise<CreditLogRecord>;
  refundCredits(userId: string, amount: number, taskId: string): Promise<CreditLogRecord>;
}

function createCreditLog(
  userId: string,
  change: number,
  reason: CreditLogRecord["reason"],
  taskId: string | null,
  balanceAfter: number
): CreditLogRecord {
  return {
    _id: createId("credit_log"),
    userId,
    change,
    reason,
    taskId,
    balanceAfter,
    createdAt: nowIso()
  };
}

class MemoryCreditRepository implements CreditRepository {
  async listLogs(userId: string): Promise<CreditLogRecord[]> {
    return store.creditLogs
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async ensureCredits(userId: string, amount: number): Promise<void> {
    const user = store.users.find((item) => item._id === userId && !item.deletedAt);

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
    }

    if (user.credits < amount) {
      throw new AppError(402, "CREDIT_NOT_ENOUGH", "生成次数不足");
    }
  }

  async deductCredits(userId: string, amount: number, taskId: string): Promise<CreditLogRecord> {
    await this.ensureCredits(userId, amount);

    const user = store.users.find((item) => item._id === userId && !item.deletedAt);

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
    }

    user.credits -= amount;
    user.updatedAt = nowIso();

    const log = createCreditLog(userId, -amount, "generate", taskId, user.credits);
    store.creditLogs.push(log);

    return log;
  }

  async refundCredits(userId: string, amount: number, taskId: string): Promise<CreditLogRecord> {
    const user = store.users.find((item) => item._id === userId && !item.deletedAt);

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
    }

    user.credits += amount;
    user.updatedAt = nowIso();

    const log = createCreditLog(userId, amount, "refund", taskId, user.credits);
    store.creditLogs.push(log);

    return log;
  }
}

class MongoCreditRepository implements CreditRepository {
  async listLogs(userId: string): Promise<CreditLogRecord[]> {
    const db = await getMongoDb();

    return db
      .collection<CreditLogRecord>("credit_logs")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async ensureCredits(userId: string, amount: number): Promise<void> {
    const db = await getMongoDb();
    const user = await db.collection<UserRecord>("users").findOne({
      _id: userId,
      deletedAt: null
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
    }

    if (user.credits < amount) {
      throw new AppError(402, "CREDIT_NOT_ENOUGH", "生成次数不足");
    }
  }

  async deductCredits(userId: string, amount: number, taskId: string): Promise<CreditLogRecord> {
    return runMongoCreditTransaction(async (db, session) => {
      const now = nowIso();
      const users = db.collection<UserRecord>("users");
      const user = await users.findOneAndUpdate(
        {
          _id: userId,
          deletedAt: null,
          credits: {
            $gte: amount
          }
        },
        {
          $inc: {
            credits: -amount
          },
          $set: {
            updatedAt: now
          }
        },
        {
          returnDocument: "after",
          session
        }
      );

      if (!user) {
        const existingUser = await users.findOne({ _id: userId, deletedAt: null }, { session });

        if (!existingUser) {
          throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
        }

        throw new AppError(402, "CREDIT_NOT_ENOUGH", "生成次数不足");
      }

      const log = createCreditLog(userId, -amount, "generate", taskId, user.credits);
      await db.collection<CreditLogRecord>("credit_logs").insertOne(log, { session });

      return log;
    });
  }

  async refundCredits(userId: string, amount: number, taskId: string): Promise<CreditLogRecord> {
    return runMongoCreditTransaction(async (db, session) => {
      const now = nowIso();
      const user = await db.collection<UserRecord>("users").findOneAndUpdate(
        {
          _id: userId,
          deletedAt: null
        },
        {
          $inc: {
            credits: amount
          },
          $set: {
            updatedAt: now
          }
        },
        {
          returnDocument: "after",
          session
        }
      );

      if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
      }

      const log = createCreditLog(userId, amount, "refund", taskId, user.credits);
      await db.collection<CreditLogRecord>("credit_logs").insertOne(log, { session });

      return log;
    });
  }
}

async function runMongoCreditTransaction<T>(
  operation: (db: Db, session: ClientSession) => Promise<T>
): Promise<T> {
  const db = await getMongoDb();
  const client = getMongoClient();

  if (!client) {
    throw new Error("MongoDB client 未初始化，无法执行额度事务");
  }

  const session = client.startSession();

  try {
    let transactionResult: T | undefined;
    await session.withTransaction(async () => {
      transactionResult = await operation(db, session);
    });

    if (transactionResult === undefined) {
      throw new Error("额度事务未返回结果");
    }

    return transactionResult;
  } finally {
    await session.endSession();
  }
}

const memoryCreditRepository = new MemoryCreditRepository();
const mongoCreditRepository = new MongoCreditRepository();

export function getCreditRepository(): CreditRepository {
  return getDataStoreProvider() === "mongodb" ? mongoCreditRepository : memoryCreditRepository;
}
