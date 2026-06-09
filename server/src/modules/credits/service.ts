import type { CreditLogRecord } from "../../store/types";
import { getCreditRepository } from "../../store/creditRepository";

export async function ensureCredits(userId: string, amount: number): Promise<void> {
  await getCreditRepository().ensureCredits(userId, amount);
}

export async function deductCredits(
  userId: string,
  amount: number,
  taskId: string
): Promise<CreditLogRecord> {
  return getCreditRepository().deductCredits(userId, amount, taskId);
}

export async function refundCredits(
  userId: string,
  amount: number,
  taskId: string
): Promise<CreditLogRecord> {
  return getCreditRepository().refundCredits(userId, amount, taskId);
}
