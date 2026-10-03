# LAH local runtime

English | [中文](README.zh.md)

This Cordis plugin contributes the `lah-local` model adapter and four read-only tools: `list_directory`, `search_files`, `search_content`, and `read_file`. The upstream agent loop owns argument validation, execution scheduling, request history, and continuation after tool results. LAH does not include or train a model.

The adapter sends native OpenAI chat-completions requests to an HTTP(S) loopback API root. A typical endpoint is `http://127.0.0.1:1234/v1`; the model id must exactly match the server configuration. Requests contain no authorization header, dummy key, user id, or telemetry. The server must stream chat-completions SSE with a terminal finish reason and `[DONE]`, understand its model's tool-calling template, and support `stream_options.include_usage`. A configured context window is supplied by the user; LAH does not infer it from a model name. Missing token usage remains unknown.

The mandatory plugin fields are `model` and `workspace`. `endpoint`, `contextWindow`, `maxTokens`, `requestTimeoutMs`, `maxFileBytes`, `maxOutputChars`, `maxResults`, `maxVisitedEntries`, `maxDepth`, and `excludedDirectories` have Loader-validated defaults in [config.ts](config.ts). `appVersion` controls the public LAH User-Agent. The running plugin captures one connection/workspace generation; settings changes create a new session/runtime rather than mutating an active request.

Paths are resolved against the canonical selected directory. Traversal, external symbolic links or junctions, Windows device path aliases, and alternate data streams are refused. Recursive searches do not follow links and skip the configured directory names. Text must be UTF-8, fit the file-size limit, and contain no null bytes. Search queries are literal substrings; regular expressions and shell commands are not available. Results explicitly report truncation. File identity is checked after opening, but this in-process reader is not an operating-system sandbox against another process continuously replacing filesystem entries.

Model-visible schemas remain the complete four-tool menu in this prealpha. No SubLLM routing or confidence estimate is used. Tool outputs are canonical JSON text with workspace-relative locations; presentations identify calls as read/search operations before execution. The plugin registers adapters/tools as reversible Cordis effects, so unload removes their contributions.

The pinned [tool cards](tool-menu.json) and [observable-state reference](advisor-state.md) define the first read/search dataset input without connecting an advisor to the application.

The desktop application's [kernel composition](../kernel.ts) is the actual consumer. It mounts only upstream agent services and this plugin; it includes no DeepSeek adapter, credentials, account, telemetry, terminal, or process tools.
