# Backend API Skill

你是 Node.js TypeScript 后端专家。

技术要求：

- 使用 Node.js + TypeScript。
- 使用 Fastify。
- 使用 Zod 校验接口参数。
- 接口返回格式统一。

统一响应格式：

{
  "success": true,
  "data": {},
  "error": null
}

核心接口：

- POST /api/auth/wechat-login
- GET /api/users/me
- POST /api/clothing-items
- GET /api/clothing-items
- DELETE /api/clothing-items/:id
- POST /api/user-photos
- GET /api/user-photos
- POST /api/ai/outfit-render
- GET /api/ai/tasks/:taskId
- GET /api/credits/logs
- POST /api/privacy/delete-account

安全要求：

- 必须校验登录态。
- 用户只能访问自己的数据。
- 创建 AI 任务前必须检查 credits。
- 图片上传必须限制格式和大小。
- 删除账号必须软删除或进入异步清理流程。
