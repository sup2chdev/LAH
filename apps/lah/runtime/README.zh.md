# LAH 本地运行时

[English](README.md) | 中文

此 Cordis 插件提供 `lah-local` 模型适配器和四个只读工具：`list_directory`、`search_files`、`search_content` 和 `read_file`。上游 agent loop（智能体循环）负责参数验证、执行调度、请求历史，以及工具结果后的继续执行。LAH 不包含或训练模型。

适配器向 HTTP(S) loopback API 根路径发送原生 OpenAI chat-completions 请求。典型 endpoint 为 `http://127.0.0.1:1234/v1`；模型 ID 必须与服务器配置完全一致。请求不包含授权头、占位密钥、用户 ID 或遥测。服务器必须提供 chat-completions SSE（Server-Sent Events）流及终止 finish reason 和 `[DONE]`，理解模型的 tool calling 模板，并支持 `stream_options.include_usage`。上下文窗口大小由用户配置；LAH 不根据模型名称推断该值。缺失的 token 用量保持未知。

插件必填字段为 `model` 和 `workspace`。`endpoint`、`contextWindow`、`maxTokens`、`requestTimeoutMs`、`maxFileBytes`、`maxOutputChars`、`maxResults`、`maxVisitedEntries`、`maxDepth` 和 `excludedDirectories` 的默认值由 [config.ts](config.ts) 定义并经 loader 验证。`appVersion` 控制公开的 LAH User-Agent。运行中的插件固定使用一组连接和工作区配置；设置变更会创建新的会话或运行时，不会修改活动请求。

路径相对于规范化后的选定目录解析。目录遍历、外部符号链接或 junction、Windows 设备路径别名及备用数据流均被拒绝。递归搜索不跟随链接，并跳过配置的目录名。文本必须采用 UTF-8 编码、符合文件大小上限，且不包含空字节。搜索查询是字面子串；不支持正则表达式或 shell 命令。结果显式报告截断。打开文件后会检查其身份，但此进程内读取器不能替代操作系统沙箱，无法防御另一进程持续替换文件系统条目的行为。

预览版向模型提供完整的四工具菜单。不使用 SubLLM 路由或置信度估计。工具输出为规范 JSON 文本，位置相对于工作区；执行前的呈现将调用标记为读取或搜索操作。插件通过可撤销的 Cordis effects 注册适配器和工具，卸载时会移除这些贡献。

固定的[工具卡片](tool-menu.json)和[可观察状态参考](advisor-state.md)定义第一份读取与搜索开发数据集的输入，不将 advisor 连接到应用。

桌面应用的 [kernel 组合](../kernel.ts) 是实际消费者。它仅挂载上游 agent 服务和此插件；不包含 DeepSeek 适配器、凭据、账号、遥测、终端或进程工具。
