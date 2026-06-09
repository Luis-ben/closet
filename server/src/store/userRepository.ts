import type { ClientSession, Db } from "mongodb";
import { createId, nowIso } from "../utils/ids";
import { getDataStoreProvider, store } from ".";
import type { CreditLogRecord, UserRecord } from "./types";
import { getMongoClient, getMongoDb } from "./mongo";

interface UpsertWechatUserInput {
  openid: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface UserRepository {
  findActiveById(userId: string): Promise<UserRecord | null>;
  findActiveByOpenid(openid: string): Promise<UserRecord | null>;
  upsertWechatUser(input: UpsertWechatUserInput): Promise<UserRecord>;
}

function createSignupCreditLog(user: UserRecord, createdAt: string): CreditLogRecord {
  return {
    _id: createId("credit_log"),
    userId: user._id,
    change: user.credits,
    reason: "signup",
    taskId: null,
    balanceAfter: user.credits,
    createdAt
  };
}

class MemoryUserRepository implements UserRepository {
  async findActiveById(userId: string): Promise<UserRecord | null> {
    return store.users.find((item) => item._id === userId && !item.deletedAt) ?? null;
  }

  async findActiveByOpenid(openid: string): Promise<UserRecord | null> {
    return store.users.find((item) => item.openid === openid && !item.deletedAt) ?? null;
  }

  async upsertWechatUser(input: UpsertWechatUserInput): Promise<UserRecord> {
    const now = nowIso();
    const existing = await this.findActiveByOpenid(input.openid);

    if (existing) {
      existing.nickname = input.nickname ?? existing.nickname;
      existing.avatarUrl = input.avatarUrl ?? existing.avatarUrl;
      existing.updatedAt = now;
      return existing;
    }

    const user: UserRecord = {
      _id: createId("user"),
      openid: input.openid,
      nickname: input.nickname ?? "微信用户",
      avatarUrl: input.avatarUrl ?? "",
      plan: "free",
      credits: 3,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    store.users.push(user);
    store.creditLogs.push(createSignupCreditLog(user, now));

    return user;
  }
}

class MongoUserRepository implements UserRepository {
  async findActiveById(userId: string): Promise<UserRecord | null> {
    const db = await getMongoDb();

    return db.collection<UserRecord>("users").findOne({
      _id: userId,
      deletedAt: null
    });
  }

  async findActiveByOpenid(openid: string): Promise<UserRecord | null> {
    const db = await getMongoDb();

    return db.collection<UserRecord>("users").findOne({
      openid,
      deletedAt: null
    });
  }

  async upsertWechatUser(input: UpsertWechatUserInput): Promise<UserRecord> {
    const db = await getMongoDb();
    const existing = await this.findActiveByOpenid(input.openid);
    const now = nowIso();

    if (existing) {
      const nextUser = {
        ...existing,
        nickname: input.nickname ?? existing.nickname,
        avatarUrl: input.avatarUrl ?? existing.avatarUrl,
        updatedAt: now
      };
      await db.collection<UserRecord>("users").updateOne(
        { _id: existing._id, deletedAt: null },
        {
          $set: {
            nickname: nextUser.nickname,
            avatarUrl: nextUser.avatarUrl,
            updatedAt: now
          }
        }
      );

      return nextUser;
    }

    return this.createUserWithSignupCreditLog(db, input, now);
  }

  private async createUserWithSignupCreditLog(
    db: Db,
    input: UpsertWechatUserInput,
    now: string
  ): Promise<UserRecord> {
    const user: UserRecord = {
      _id: createId("user"),
      openid: input.openid,
      nickname: input.nickname ?? "微信用户",
      avatarUrl: input.avatarUrl ?? "",
      plan: "free",
      credits: 3,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    const creditLog = createSignupCreditLog(user, now);
    const client = getMongoClient();

    if (!client) {
      await this.insertUserAndSignupLog(db, user, creditLog);
      return user;
    }

    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        await this.insertUserAndSignupLog(db, user, creditLog, session);
      });
    } catch (error) {
      if (this.isTransactionUnsupported(error)) {
        await this.insertUserAndSignupLog(db, user, creditLog);
      } else {
        throw error;
      }
    } finally {
      await session.endSession();
    }

    return user;
  }

  private async insertUserAndSignupLog(
    db: Db,
    user: UserRecord,
    creditLog: CreditLogRecord,
    session?: ClientSession
  ): Promise<void> {
    await db.collection<UserRecord>("users").insertOne(user, { session });
    await db.collection<CreditLogRecord>("credit_logs").insertOne(creditLog, { session });
  }

  private isTransactionUnsupported(error: unknown): boolean {
    return error instanceof Error && /Transaction numbers are only allowed|replica set|standalone/i.test(error.message);
  }
}

const memoryUserRepository = new MemoryUserRepository();
const mongoUserRepository = new MongoUserRepository();

export function getUserRepository(): UserRepository {
  return getDataStoreProvider() === "mongodb" ? mongoUserRepository : memoryUserRepository;
}
