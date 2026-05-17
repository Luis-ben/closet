# AI Closet Mini Program

一个属于我自己的 AI 穿搭试穿微信小程序项目。

项目目标是让用户上传衣物和个人模特图，在小程序里完成衣柜管理、AI 试穿、结果查看，以及后续的额度、支付和会员能力扩展。

## 项目简介

当前仓库是一个可继续迭代的项目骨架，已经包含：

- 微信原生小程序前端
- `Node.js + TypeScript + Fastify` 后端
- 统一接口响应和 `Zod` 入参校验
- 图片上传接口与本地 mock 存储
- AI 试穿异步任务流程
- 额度扣减、失败返还、`credit_logs` 流水
- `ImageGenerationAdapter` 抽象层

当前仍以 mock 数据和 mock AI 为主，适合继续开发真实登录、真实存储、真实数据库和真实 AI 服务接入。

## 技术栈

- 小程序端：原生微信小程序 + TypeScript + TDesign Miniprogram
- 后端：Node.js + TypeScript + Fastify + Zod
- 数据层：当前为内存 mock store，后续迁移 MongoDB 风格 Schema 或 PostgreSQL
- AI 图片生成：统一走 `ImageGenerationAdapter`
- 文件存储：当前本地 `uploads/`，生产建议使用腾讯云 COS 或微信云存储

## 目录结构

```text
miniprogram/  微信小程序端
server/       Fastify 后端
docs/         项目文档
scripts/      辅助脚本
skills/       项目规范
```

## 当前功能

- 首页、衣柜、灵感、我的 Tab 页面
- 上传衣物
- 上传个人模特图
- 创建 AI 试穿任务
- 轮询任务状态
- 查看生成结果
- 查看用户额度与额度流水
- 隐私删除账号 mock 流程

## 本地开发

### 1. 启动后端

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

默认服务地址：

```text
http://localhost:3000
```

健康检查：

```text
GET /health
```

### 2. 启动小程序

```bash
cd miniprogram
npm install
```

然后使用微信开发者工具打开：

```text
miniprogram/
```

再执行：

```text
工具 -> 构建 npm
```

当前本地小程序请求地址在 [app.ts](D:/desktop/closet/miniprogram/app.ts:1)：

```ts
apiBaseUrl: "http://localhost:3000/api"
```

## 环境变量配置

后端本地配置文件：

```text
server/.env
```

基于 [server/.env.example](D:/desktop/closet/server/.env.example:1) 创建：

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

IMAGE_GENERATION_PROVIDER=mock

CHATGPT_IMAGE2_BASE_URL=https://image.codesonline.dev/v1
CHATGPT_IMAGE2_API_KEY=
CHATGPT_IMAGE2_MODEL=gpt-image-2
CHATGPT_IMAGE2_SIZE=9:16
CHATGPT_IMAGE2_QUALITY=high
CHATGPT_IMAGE2_STYLE=natural
CHATGPT_IMAGE2_RESPONSE_FORMAT=url
CHATGPT_IMAGE2_TIMEOUT_MS=120000

PUBLIC_BASE_URL=http://localhost:3000
UPLOAD_DIR=uploads
```

说明：

- `server/.env` 不会上传到 GitHub。
- `CHATGPT_IMAGE2_API_KEY` 这类密钥只能放在本地或服务器环境变量中。
- 如果后面接入 COS、Redis、MongoDB、微信登录，也应该继续走环境变量，不要写死进代码。

## GitHub 发布前的安全说明

这个仓库已经通过 `.gitignore` 排除了以下敏感或无关文件：

- `server/.env`
- 所有本地 `node_modules/`
- 构建产物 `dist/`
- 本地上传目录 `server/uploads/`
- 调试日志 `*.log`

这意味着：

- 你的 API Key 不会跟着仓库上传
- 本地测试图片不会跟着仓库上传
- 调试日志不会跟着仓库上传

仍然要注意：

- 不要把任何密钥直接写进 `.ts`、`.js`、`.json` 文件
- 不要把生产数据库连接串写进 README
- 不要把微信 `AppSecret` 提交到仓库

## 微信小程序配置提醒

公开仓库前后，建议你检查这些配置：

- `miniprogram/project.config.json` 里的 `appid` 是否需要替换成你正式使用的小程序 AppID
- 真机调试或上线时，要把 `localhost` 改成可访问的 HTTPS 域名
- 微信后台要配置 `request`、`uploadFile`、`downloadFile` 合法域名

## AI 试穿的架构约束

这个项目后续开发时要一直守住几个原则：

- AI 任务必须异步处理，创建后只返回 `taskId`
- 业务层不能直接调用具体模型，必须通过 `ImageGenerationAdapter`
- 创建任务前必须检查额度
- 额度扣减和 `credit_logs` 必须保持一致
- 任务失败必须返还额度
- 用户只能访问自己的数据

## 接口文档

接口说明见 [api.md](D:/desktop/closet/docs/api.md:1)。

项目整理笔记见 [obsidian-ai-closet-build-notes.md](D:/desktop/closet/docs/obsidian-ai-closet-build-notes.md:1)。

## 上传到 GitHub 的步骤

仓库初始化后，可以按下面流程发布：

```bash
git init
git add .
git commit -m "chore: initialize AI closet mini program"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

如果远程仓库已经建好了，把 `<你的 GitHub 仓库地址>` 换成：

```text
https://github.com/<your-name>/<your-repo>.git
```

## 后续计划

下一步适合继续补齐：

- 真实微信登录
- 真实数据库
- COS 或微信云存储
- 生产级任务队列
- 真实 AI 图片生成
- 内容安全审核
- 支付与会员体系
