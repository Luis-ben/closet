# AI 衣镜上线检查清单

更新时间：2026-06-09

## 当前结论

当前代码已经达到“可继续真实联调、可给产品方看页面方向”的标准；还没有达到“直接提交微信审核并正式上线”的完整生产标准。

主要原因：

- 小程序请求域名仍是本地 `http://localhost:3000/api`，提交审核前必须替换成已备案并配置在微信公众平台的 HTTPS 合法域名。
- 后端当前开发默认使用内存 data store，服务重启会丢数据；生产启动会拒绝内存 data store，正式上线必须配置并启用 MongoDB。
- 登录接口已具备微信 `code2Session` 和签名 token 代码路径；正式上线仍必须配置真实 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`AUTH_TOKEN_SECRET`，并接入数据库保存真实用户数据。
- AI 生成适配器可通过统一 adapter 接入；生产环境已要求非内存队列、对象存储和真实内容安全 provider，但正式模型、内容安全云服务、费用监控仍需真实联调。

## 已完成

- 小程序页面结构：试穿、衣柜、灵感、上传、任务状态、结果、我的、隐私页均已存在。
- 页面视觉：已改成浅灰白、图片优先、低装饰的 Google 系风格。
- 衣柜页：支持相册式浏览、来源筛选、分类统计、最近导入。
- 灵感页：支持搭配魔方、换一组、一键带入试穿页，并同步带入推荐风格。
- 试穿页：最多 3 件衣物，按上衣/下装/鞋包槽位替换；生成接口只返回 taskId。
- 上传限制：前端限制 5MB；后端限制 JPG、PNG、WebP 和 5MB。
- 接口校验：后端核心接口使用 Zod 校验参数。
- 用户隔离：衣物、模特、任务、额度接口均按当前 userId 过滤。
- AI 任务：创建后异步处理，不同步等待结果。
- 额度逻辑：创建任务前检查额度，扣减写 `credit_logs`；失败返还也写 `credit_logs`。
- 隐私：提供隐私设置页和账号软删除接口。
- 隐私删除：已接入删除全部衣物、删除全部模特、注销账号接口。
- 模特管理：已接入后端激活接口，避免本地偏好和后端状态不一致。
- 版本保护：旧版已推送到 `codex/backup-pre-ui-optimization-20260608` 分支。

## 本轮新增加固

- AI 生成接口拒绝重复衣物 ID。
- 扣额度成功后再创建并入队任务，避免留下未扣费的幽灵任务。
- 任务处理器只处理 `queued` 状态，避免重复执行。
- 任务状态页缺少 `taskId` 时直接展示失败操作，不再空轮询。
- 小程序启动改为 `wx.login -> /auth/wechat-login`，并保留开发期 mock token fallback。
- 新增 `miniprogram/utils/config.ts` 集中管理 API 地址和 mock fallback。
- 小程序正式版运行时会检查配置，发现 `localhost` 或 mock token fallback 会提示不可发布。
- 后端 `NODE_ENV=production` 时会检查 AI provider、HTTPS `PUBLIC_BASE_URL`、上传目录/存储配置、`DATABASE_URL`，不满足则拒绝启动。
- 后端登录已改为可配置微信 `code2Session`，生产环境强制校验微信 AppID/Secret 和签名 token secret。
- 后端 token 已从开发用 mock 前缀升级为 HMAC 签名 token，包含过期时间；mock token 只允许非生产环境使用。
- 衣物和模特创建已统一图片输入校验；生产环境禁止 `mock://`、`wxfile://` 和任意外部 HTTP 图片，必须使用对象存储或本服务上传目录图片，并提交 `imageMeta`。
- 后端业务模块已从直接依赖 `mockStore` 收口到统一 `store/index.ts` 数据入口，为替换真实数据库做准备。
- 后端生产启动已增加 data store provider 检查，避免配置了 `DATABASE_URL` 但实际仍跑内存数据层。
- 已加入 MongoDB 驱动、连接管理和核心集合索引初始化；登录、用户查询、衣物、模特、AI 任务、额度扣减/返还和 credit_logs 查询已接入仓储层。
- 生成链路已改为仓储读写：创建任务前校验用户自己的衣物/模特，任务异步状态更新、失败返还额度、成功递增衣物使用次数均走统一数据层。
- 隐私删除已改为通过仓储软删除衣物和模特；注销账号会软删除用户并清理关联衣物/模特。
- AI 任务调度已抽象为队列：开发环境可用内存队列，生产环境禁止内存队列，可通过数据库持久队列轮询 `queued` 任务。
- 图片存储已抽象为 `IMAGE_STORAGE_PROVIDER`：生产环境禁止本地图片存储，支持按 COS 公网前缀或微信云存储 `cloud://` 校验图片来源。
- 内容安全已抽象为 `CONTENT_SAFETY_PROVIDER`：衣物图片/备注、模特图片/名称、试穿场景/风格会在入库或扣费前审核；生产环境禁止 mock 审核 provider。
- 隐私页删除衣物/模特不再是占位提示，已接真实后端接口。
- 模特选择从本地 TODO 改为 `/user-photos/:id/activate` 后端激活接口。
- 隐私删除成功后会清理本地模特偏好、待试穿衣物、最近任务等缓存；注销账号后会清理本地 token。
- 新版静态页面预览：`docs/ui-preview.html`。

## 页面设计参考

- Google Photos：相册/回忆型产品以图片网格、内容聚合、轻量筛选为主，适合衣柜相册页。
- Google Shopping AI virtual try-on：试穿体验强调模特预览、服装替换、颜色/风格等细化筛选，适合试穿页和搭配魔方。
- Material Design cards / image lists：卡片和图片列表强调清晰边界、低装饰、内容优先，适合小程序整体页面结构。

## 提交微信审核前必须完成

1. 微信后台配置
   - 小程序类目、主体信息、备案、服务内容说明。
   - 配置 request/upload/download 合法域名，必须为 HTTPS。
   - 配置隐私保护指引，覆盖相册、相机、图片上传、昵称头像等实际收集项。

2. 生产后端
   - 生产环境配置 `DATA_STORE_PROVIDER=mongodb`，并连接真实 MongoDB。
   - 为 `userId`、`ai_tasks.status`、关键时间字段建立索引。
   - 配置真实微信登录 `code2Session` 所需的 AppID/Secret，并在微信后台绑定合法域名。
   - 配置生产环境变量：`WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`AUTH_TOKEN_SECRET`、`DATABASE_URL`、`DATA_STORE_PROVIDER`、`PUBLIC_BASE_URL`、`IMAGE_GENERATION_PROVIDER`、`IMAGE_STORAGE_PROVIDER`、`AI_TASK_QUEUE_PROVIDER`、`CONTENT_SAFETY_PROVIDER`。
   - 接入 COS 或微信云存储真实上传流程，避免使用本地 uploads 作为生产图片库。
   - 将 AI task queue 切换为 `database` 或外部队列，并完成多实例/重试策略压测。

3. AI 与安全
   - 生产模型只通过 `ImageGenerationAdapter` 接入。
   - 接入腾讯云或微信云真实内容安全 API，并覆盖图片、文本、生成 prompt 的拒绝/降级策略。
   - 日志不能记录用户图片隐私地址或原始敏感输入。
   - 增加模型超时、重试、限流和成本记录。

4. 发布前验证
   - 微信开发者工具真机预览全流程。
   - 上传相册、拍照、保存到相册权限验证。
   - 生产图片来源验证：外部图片 URL 应被拒绝，上传目录/对象存储图片带 `imageMeta` 才能创建衣物或模特。
   - 额度扣减、失败返还、credit_logs 审计验证。
   - 删除衣物、删除账号、隐私页说明验证。
   - 低额度、无衣物、无模特、任务失败、网络失败等异常态验证。

## 已执行验证

- `miniprogram`: `npx tsc -p tsconfig.json`
- `server`: `npm run build`
- 页面预览截图：`output/playwright/ui-preview.png`
