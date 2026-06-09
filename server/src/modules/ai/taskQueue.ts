import type { FastifyInstance } from "fastify";
import { getAiTaskRepository } from "../../store/aiTaskRepository";
import type { ImageGenerationAdapter } from "./imageGenerationAdapter";
import { processOutfitTask } from "./taskProcessor";

export type AiTaskQueueProvider = "memory" | "database";

interface AiTaskQueue {
  enqueue(taskId: string, adapter: ImageGenerationAdapter): Promise<void>;
  startWorker(app: FastifyInstance, adapter: ImageGenerationAdapter): void;
}

const DEFAULT_WORKER_INTERVAL_MS = 5000;

export function getAiTaskQueueProvider(): AiTaskQueueProvider {
  const provider = process.env.AI_TASK_QUEUE_PROVIDER ?? "memory";

  if (provider === "memory" || provider === "database") {
    return provider;
  }

  throw new Error(`不支持的 AI_TASK_QUEUE_PROVIDER：${provider}`);
}

export function assertAiTaskQueueReady(): void {
  if (process.env.NODE_ENV === "production" && getAiTaskQueueProvider() === "memory") {
    throw new Error("生产环境不能使用内存 AI 任务队列，请配置 AI_TASK_QUEUE_PROVIDER=database 或接入真实队列");
  }
}

class MemoryAiTaskQueue implements AiTaskQueue {
  async enqueue(taskId: string, adapter: ImageGenerationAdapter): Promise<void> {
    setTimeout(() => {
      void processOutfitTask(taskId, adapter);
    }, 0);
  }

  startWorker(): void {
    // Memory queue runs each task directly after enqueue in development.
  }
}

class DatabaseAiTaskQueue implements AiTaskQueue {
  private adapter: ImageGenerationAdapter | null = null;

  async enqueue(_taskId: string, adapter: ImageGenerationAdapter): Promise<void> {
    // The queued task is already persisted in ai_tasks; kick the worker once to reduce latency.
    await this.processNext(this.adapter ?? adapter);
  }

  startWorker(app: FastifyInstance, adapter: ImageGenerationAdapter): void {
    this.adapter = adapter;
    const intervalMs = Number(process.env.AI_TASK_WORKER_INTERVAL_MS ?? DEFAULT_WORKER_INTERVAL_MS);

    if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
      throw new Error("AI_TASK_WORKER_INTERVAL_MS 必须至少为 1000 毫秒");
    }

    const timer = setInterval(() => {
      void this.processNext(adapter);
    }, intervalMs);

    timer.unref();

    app.addHook("onClose", async () => {
      clearInterval(timer);
    });
  }

  private async processNext(adapter: ImageGenerationAdapter): Promise<void> {
    const task = await getAiTaskRepository().findNextQueued();

    if (!task) {
      return;
    }

    await processOutfitTask(task._id, adapter);
  }
}

const memoryAiTaskQueue = new MemoryAiTaskQueue();
const databaseAiTaskQueue = new DatabaseAiTaskQueue();

export function getAiTaskQueue(): AiTaskQueue {
  return getAiTaskQueueProvider() === "database" ? databaseAiTaskQueue : memoryAiTaskQueue;
}
