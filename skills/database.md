# Database Skill

核心集合/表：
- users
- clothing_items
- user_photos
- ai_tasks
- credit_logs

要求：
- 所有数据必须有 createdAt。
- 重要数据必须有 updatedAt。
- 支持软删除。
- userId 必须建索引。
- ai_tasks.status 必须建索引。
- credit_logs 作为审计流水，不允许随便删除。

额度逻辑：
- 创建 AI 任务前检查 credits。
- 成功创建任务时扣减 credits。
- 扣减额度必须写 credit_logs。
- AI 任务失败时返还 credits。
- 返还额度也必须写 credit_logs。