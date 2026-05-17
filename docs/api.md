# API 文档

当前后端为 Fastify + TypeScript 骨架，所有数据使用内存 mock store。返回格式统一为：

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

错误返回格式：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "details": {}
  }
}
```

除 `POST /api/auth/wechat-login` 和 `GET /health` 外，接口需要 Header：

```http
Authorization: Bearer mock-token-user_mock_001
```

## POST /api/auth/wechat-login

微信登录 mock 接口。当前不会请求微信服务端，只根据 `code` 生成 mock openid。

请求：

```json
{
  "code": "mock-code",
  "nickname": "微信用户",
  "avatarUrl": ""
}
```

响应：

```json
{
  "success": true,
  "data": {
    "token": "mock-token-user_xxx",
    "user": {
      "_id": "user_xxx",
      "openid": "openid_mock-code",
      "credits": 3
    }
  },
  "error": null
}
```

## GET /api/users/me

获取当前用户。

响应：

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_mock_001",
      "credits": 3,
      "plan": "free"
    }
  },
  "error": null
}
```

## POST /api/clothing-items

创建衣物。当前只保存图片引用，不做真实文件上传。

请求：

```json
{
  "imageUrl": "mock://cloth/top.png",
  "imageMeta": {
    "sizeBytes": 102400,
    "mimeType": "image/jpeg"
  },
  "sourceType": "album",
  "sourceUrl": null,
  "category": "top",
  "color": "白",
  "season": ["all"],
  "occasion": ["casual"],
  "note": ""
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| sourceType | camera、album、web_image、product_image |
| category | top、bottom、dress、shoes、bag、accessory |
| imageMeta.sizeBytes | 最大 5MB |
| imageMeta.mimeType | image/jpeg、image/png、image/webp |

## GET /api/clothing-items

获取当前用户衣柜。

响应：

```json
{
  "success": true,
  "data": {
    "items": []
  },
  "error": null
}
```

## DELETE /api/clothing-items/:id

软删除当前用户的一件衣物。

响应：

```json
{
  "success": true,
  "data": {
    "deleted": true
  },
  "error": null
}
```

## POST /api/user-photos

上传用户全身照并设为“我的模特”。当前只保存图片引用，审核状态默认为 `pass`。

请求：

```json
{
  "imageUrl": "mock://model/me.jpg",
  "imageMeta": {
    "sizeBytes": 204800,
    "mimeType": "image/jpeg"
  },
  "displayName": "我的模特"
}
```

## GET /api/user-photos

获取当前用户的模特照片。

响应：

```json
{
  "success": true,
  "data": {
    "items": []
  },
  "error": null
}
```

## POST /api/ai/outfit-render

创建 AI 试穿任务。必须通过 `ImageGenerationAdapter`，当前实现为 mock。接口会先检查 credits，再扣减 1 次额度并写入 credit_logs，随后异步处理任务。mock 任务创建后会先进入 `queued`/`running` 状态，约 3 秒后变为 `success` 并写入结果图。

请求：

```json
{
  "modelType": "personal_model",
  "modelPhotoId": "model_001",
  "clothingItemIds": ["cloth_001"],
  "mode": "quick",
  "scene": "casual",
  "style": "clean_realistic",
  "shareable": true
}
```

说明：

- `modelType` 可选，未传时优先使用当前用户的“我的模特”，否则使用默认模特。
- `modelPhotoId` 在使用 `personal_model` 时可传；未传则使用当前激活模特。
- `scene` 传 `mock_fail` 可触发 mock 失败，用于测试失败退款。

响应：

```json
{
  "success": true,
  "data": {
    "taskId": "task_xxx",
    "status": "queued",
    "estimatedSeconds": 3
  },
  "error": null
}
```

## GET /api/ai/tasks/:taskId

查询 AI 任务状态。

响应：

```json
{
  "success": true,
  "data": {
    "task": {
      "_id": "task_xxx",
      "status": "success",
      "resultImageUrl": "https://placehold.co/768x1024/png?text=Mock+Outfit"
    }
  },
  "error": null
}
```

## GET /api/credits/logs

查询额度流水。credit_logs 为审计数据，不做普通删除。

响应：

```json
{
  "success": true,
  "data": {
    "items": []
  },
  "error": null
}
```

## POST /api/privacy/delete-account

删除账号 mock 流程。当前执行软删除，并返回异步清理排队状态。

响应：

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "cleanupStatus": "queued"
  },
  "error": null
}
```
