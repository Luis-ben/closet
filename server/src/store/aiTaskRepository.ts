import { createId, nowIso } from "../utils/ids";
import { getDataStoreProvider, store } from ".";
import type { AiMode, AiTaskRecord, ModelType } from "./types";
import { getMongoDb } from "./mongo";

interface CreateAiTaskInput {
  taskId?: string;
  userId: string;
  modelType: ModelType;
  modelPhotoId: string | null;
  clothingItemIds: string[];
  mode: AiMode;
  scene: string | null;
  style: string | null;
  shareable: boolean;
}

interface CompleteTaskInput {
  taskId: string;
  resultImageUrl: string;
  costEstimate: number;
  completedAt: string;
}

interface FailTaskInput {
  taskId: string;
  errorCode: string;
  errorMessage: string;
  completedAt: string;
}

export interface AiTaskRepository {
  create(input: CreateAiTaskInput): Promise<AiTaskRecord>;
  findActiveByUser(taskId: string, userId: string): Promise<AiTaskRecord | null>;
  findById(taskId: string): Promise<AiTaskRecord | null>;
  findNextQueued(): Promise<AiTaskRecord | null>;
  markRunning(taskId: string, updatedAt: string): Promise<AiTaskRecord | null>;
  markSuccess(input: CompleteTaskInput): Promise<void>;
  markFailed(input: FailTaskInput): Promise<void>;
}

function createAiTask(input: CreateAiTaskInput): AiTaskRecord {
  const now = nowIso();

  return {
    _id: input.taskId ?? createId("task"),
    userId: input.userId,
    modelType: input.modelType,
    modelPhotoId: input.modelPhotoId,
    clothingItemIds: input.clothingItemIds,
    mode: input.mode,
    scene: input.scene,
    style: input.style,
    shareable: input.shareable,
    promptVersion: "mock-v1",
    status: "queued",
    resultImageUrl: null,
    retryCount: 0,
    errorCode: null,
    errorMessage: null,
    costEstimate: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    deletedAt: null
  };
}

class MemoryAiTaskRepository implements AiTaskRepository {
  async create(input: CreateAiTaskInput): Promise<AiTaskRecord> {
    const task = createAiTask(input);
    store.aiTasks.push(task);

    return task;
  }

  async findActiveByUser(taskId: string, userId: string): Promise<AiTaskRecord | null> {
    return (
      store.aiTasks.find((item) => item._id === taskId && item.userId === userId && !item.deletedAt) ??
      null
    );
  }

  async findById(taskId: string): Promise<AiTaskRecord | null> {
    return store.aiTasks.find((item) => item._id === taskId && !item.deletedAt) ?? null;
  }

  async findNextQueued(): Promise<AiTaskRecord | null> {
    const queuedTasks = store.aiTasks
      .filter((item) => item.status === "queued" && !item.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return queuedTasks[0] ?? null;
  }

  async markRunning(taskId: string, updatedAt: string): Promise<AiTaskRecord | null> {
    const task = store.aiTasks.find(
      (item) => item._id === taskId && item.status === "queued" && !item.deletedAt
    );

    if (!task) {
      return null;
    }

    task.status = "running";
    task.updatedAt = updatedAt;

    return task;
  }

  async markSuccess(input: CompleteTaskInput): Promise<void> {
    const task = await this.findById(input.taskId);

    if (!task) {
      return;
    }

    task.status = "success";
    task.resultImageUrl = input.resultImageUrl;
    task.costEstimate = input.costEstimate;
    task.completedAt = input.completedAt;
    task.updatedAt = input.completedAt;
  }

  async markFailed(input: FailTaskInput): Promise<void> {
    const task = await this.findById(input.taskId);

    if (!task) {
      return;
    }

    task.status = "failed";
    task.errorCode = input.errorCode;
    task.errorMessage = input.errorMessage;
    task.completedAt = input.completedAt;
    task.updatedAt = input.completedAt;
  }
}

class MongoAiTaskRepository implements AiTaskRepository {
  async create(input: CreateAiTaskInput): Promise<AiTaskRecord> {
    const db = await getMongoDb();
    const task = createAiTask(input);

    await db.collection<AiTaskRecord>("ai_tasks").insertOne(task);

    return task;
  }

  async findActiveByUser(taskId: string, userId: string): Promise<AiTaskRecord | null> {
    const db = await getMongoDb();

    return db.collection<AiTaskRecord>("ai_tasks").findOne({
      _id: taskId,
      userId,
      deletedAt: null
    });
  }

  async findById(taskId: string): Promise<AiTaskRecord | null> {
    const db = await getMongoDb();

    return db.collection<AiTaskRecord>("ai_tasks").findOne({
      _id: taskId,
      deletedAt: null
    });
  }

  async findNextQueued(): Promise<AiTaskRecord | null> {
    const db = await getMongoDb();

    return db.collection<AiTaskRecord>("ai_tasks").findOne(
      {
        status: "queued",
        deletedAt: null
      },
      {
        sort: {
          createdAt: 1
        }
      }
    );
  }

  async markRunning(taskId: string, updatedAt: string): Promise<AiTaskRecord | null> {
    const db = await getMongoDb();

    return db.collection<AiTaskRecord>("ai_tasks").findOneAndUpdate(
      {
        _id: taskId,
        status: "queued",
        deletedAt: null
      },
      {
        $set: {
          status: "running",
          updatedAt
        }
      },
      {
        returnDocument: "after"
      }
    );
  }

  async markSuccess(input: CompleteTaskInput): Promise<void> {
    const db = await getMongoDb();
    await db.collection<AiTaskRecord>("ai_tasks").updateOne(
      {
        _id: input.taskId,
        deletedAt: null
      },
      {
        $set: {
          status: "success",
          resultImageUrl: input.resultImageUrl,
          costEstimate: input.costEstimate,
          completedAt: input.completedAt,
          updatedAt: input.completedAt
        }
      }
    );
  }

  async markFailed(input: FailTaskInput): Promise<void> {
    const db = await getMongoDb();
    await db.collection<AiTaskRecord>("ai_tasks").updateOne(
      {
        _id: input.taskId,
        deletedAt: null
      },
      {
        $set: {
          status: "failed",
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          completedAt: input.completedAt,
          updatedAt: input.completedAt
        }
      }
    );
  }
}

const memoryAiTaskRepository = new MemoryAiTaskRepository();
const mongoAiTaskRepository = new MongoAiTaskRepository();

export function getAiTaskRepository(): AiTaskRepository {
  return getDataStoreProvider() === "mongodb" ? mongoAiTaskRepository : memoryAiTaskRepository;
}
