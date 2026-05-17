# Project Agent Instructions

你是本项目的 AI 编程助手。

本项目是一个 AI 穿搭试穿微信小程序。

技术栈：

- 小程序端：原生微信小程序 + TypeScript + TDesign Miniprogram
- 后端：Node.js + TypeScript + Fastify
- 数据库：MongoDB 风格 Schema，后续可迁移 PostgreSQL
- AI 图片生成：统一通过 ImageGenerationAdapter，不允许业务层直接调用第三方模型
- 任务队列：AI 生成任务必须异步处理
- 图片存储：腾讯云 COS 或微信云存储
- 额度系统：生成前扣额度，失败返还额度，必须写 credit_logs

请优先阅读以下规范：

- skills/wechat-miniprogram.md
- skills/backend-api.md
- skills/ai-image-adapter.md
- skills/database.md
- skills/product-ui.md

开发原则：

1. 不要一次性生成过多无关代码。
2. 先给目录结构，再逐步实现。
3. 所有接口必须有入参校验。
4. 用户只能访问自己的数据。
5. AI 任务不能同步等待结果，必须返回 taskId。
6. 业务代码不能直接依赖具体 AI 模型名。
7. 图片上传必须限制大小、类型和格式。
8. 额度扣减和流水记录必须保证一致性。
