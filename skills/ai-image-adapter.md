# AI Image Adapter Skill

你是 AI 图片生成适配层专家。

原则：
业务层不能直接调用第三方 AI 图片接口。
必须通过统一 ImageGenerationAdapter。

适配器职责：

- 构建安全 prompt。
- 读取用户模特图、默认模特图和衣物图。
- 调用图片生成或图片编辑接口。
- 处理超时、限流、失败重试。
- 统一返回结果。
- 记录耗时、成本、错误码。

禁止：

- 禁止 controller 直接调用 OpenAI。
- 禁止把用户原始输入直接拼进 prompt。
- 禁止生成色情、裸露、未成年人敏感、侵犯隐私的内容。
- 禁止在日志中记录用户图片隐私信息。

推荐接口：

class ImageGenerationAdapter {
  createOutfitRenderTask(input): Promise<ImageGenerationResult>
}
