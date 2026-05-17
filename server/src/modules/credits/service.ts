import { store } from "../../store/mockStore";
import type { CreditLogRecord } from "../../store/types";
import { AppError } from "../../utils/errors";
import { createId, nowIso } from "../../utils/ids";

export function ensureCredits(userId: string, amount: number): void {
  const user = store.users.find((item) => item._id === userId && !item.deletedAt);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
  }

  if (user.credits < amount) {
    throw new AppError(402, "CREDIT_NOT_ENOUGH", "生成次数不足");
  }
}

export function deductCredits(userId: string, amount: number, taskId: string): CreditLogRecord {
  ensureCredits(userId, amount);

  const user = store.users.find((item) => item._id === userId);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
  }

  user.credits -= amount;
  user.updatedAt = nowIso();

  const log: CreditLogRecord = {
    _id: createId("credit_log"),
    userId,
    change: -amount,
    reason: "generate",
    taskId,
    balanceAfter: user.credits,
    createdAt: nowIso()
  };

  store.creditLogs.push(log);
  return log;
}

export function refundCredits(userId: string, amount: number, taskId: string): CreditLogRecord {
  const user = store.users.find((item) => item._id === userId && !item.deletedAt);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "用户不存在");
  }

  user.credits += amount;
  user.updatedAt = nowIso();

  const log: CreditLogRecord = {
    _id: createId("credit_log"),
    userId,
    change: amount,
    reason: "refund",
    taskId,
    balanceAfter: user.credits,
    createdAt: nowIso()
  };

  store.creditLogs.push(log);
  return log;
}
