# LAH 桌面预览版

[English](README.md) | 中文

LAH 是此 fork 中独立的 Electron 应用。它提供窗口、隔离的 preload 桥接、本地设置与聊天存储、兼容 OpenAI 的适配器，以及四个只读工作区工具。编译后的配置使用此 fork 的 Cordis 服务、AgentRegistry、AgentLoop、SessionStore、SystemPrompt、ToolRuntime 和 LlmRuntime。它不挂载 DeepSeek 账号、凭据流程、计费、遥测、shell 工具或云端模型提供者。

## 启动与构建

此 fork 的 LAH 桌面宿主独立提供新的应用入口，不启动上游 `dsh` 产品。[kernel.ts](kernel.ts) 定义其固定的本地配置组合。上游 CLI（命令行界面）和 agent loop（智能体循环）实现仍可使用，且保持不变。用户要求独立桌面应用，因此需要此宿主；运行时模块仍通过 Cordis 服务使用，工具仍采用标准执行流程。

在仓库根目录执行 `pnpm build:lah`，即可打包选定的 TypeScript 源码依赖图并复制隔离的渲染器。`pnpm start:lah` 启动构建后的应用。`pnpm package:lah` 将 Windows Electron 运行时和构建后的应用复制到 `release/LAH-win32-x64`；运行 `LAH.exe` 时必须保留该目录的其他文件。这是未签名的便携式开发构建，不包含更新器或安装程序。[根目录说明](../../README-LAH.md) 介绍构建依赖的安装方法。

构建过程在打包后的 attribution 辅助模块中使用应用自身的公开身份。软件包许可证和上游声明随应用分发。渲染器无法访问 Node；所有文件和模型操作都通过固定的 preload API 执行，并检查调用者是否为主 frame。网络连接发生在主进程中，只访问配置的 loopback 服务器。Chromium 硬件加速已禁用，以便将 GPU 资源留给模型服务器。

渲染器使用此 fork 的[主题样式和 Montserrat 资源](../../packages/client/ui-theme/src/styles/)以及[现有图标](../../packages/client/ui-primitives/src/icons/)。构建过程原样复制主题文件，并提取固定的一组静态 SVG 图标；不支持的图标定义会使构建失败。深色和浅色主题共用这些资源。空聊天中的输入框居中；有消息时，聊天内容在输入框上方滚动。设置对话框的标题和操作按钮保持可见，字段区域可滚动。Windows 原生窗口按钮位于应用可拖动的标题栏上方。

## 状态与执行

应用将带版本的 JSON 文档保存到 `%APPDATA%/LocalAgentHarness/lah-state.json`，并在设置变更及轮次完成后以原子替换方式写入。文档同时保留显示消息和原始上游会话事件；重新打开聊天时，真实循环以这些事件作为初始历史。存储最多支持 100 个聊天及 64 MiB 的序列化数据。应用会报告损坏或不兼容的存储，并保留原文件。应用不自动迁移或导入官方 Harness 数据。

同一时间只能发送一个请求。停止操作取消应用持有的 agent 并等待空闲；退出前会等待运行时结束。此本地配置将每个轮次限制为 16 步。修改设置后，应用在空闲时替换运行时。属于其他工作区的聊天必须新建聊天，不会静默读取另一目录。模型 ID 和上下文大小均为显式设置；`/models` 发现功能是可选且有界的。模型输出和工具结果均作为文本呈现。

## 验证与限制

`pnpm test:lah` 验证真实的有界工作区读取、本地 SSE（Server-Sent Events）解析、schema 拒绝、取消，以及构建后 kernel 的双工具 agent loop 和原始日志续接。[记录的 transcript（文本记录）](tests/expected/read-only-transcript.json) 固定无需密钥的会话驱动结果。真实模型仅由 mock loopback HTTP 服务器替代。隔离的 UI 测试验证配置、安全呈现和请求状态。Electron 的 `--lah-smoke` 模式在隐藏窗口中启动实际隔离页面，将初始状态和截图写入显式选择的 `--lah-data` 目录，然后退出。添加 `--lah-design-review` 会短暂显示测试窗口但不抢占焦点，并在禁用过渡效果的情况下截取两种主题、设置对话框和最小窗口尺寸。

预览版不包含模型、不执行训练、不测量模型质量，也不连接 SubLLM。每个实际服务器、模型和模板的原生 tool calling 兼容性仍需现场验证。应用不提供自动上下文压缩、准确 tokenizer、流式 token 显示或完整上下文成本面板。可展开的工具面板显示当前窗口生命周期内观察到的调用；原始持久化调用仍保留在会话日志中。文件访问在进程内受限，不能替代防御并发文件系统替换的操作系统沙箱。这些限制定义第一阶段的范围，并非从上游产品推断出的保证。
