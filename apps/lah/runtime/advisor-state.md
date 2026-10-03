# Read/search tools and future SubLLM input

This reference pins the four tools in LAH `0.0.1-prealpha` and identifies information already observable before a model request. LAH currently sends all four schemas to its main LLM. No advisor is connected, no training is run, and the JSON state example below is a proposed derived input rather than a current application API.

## Tool definitions

[tool-menu.json](tool-menu.json) contains exact English descriptions and compiled JSON input schemas from [index.ts](index.ts). `option_id` equals the registered tool name. Generate the file from the repository root with `node apps/lah/scripts/export-tool-menu.mjs`; the exporter performs no inference and executes no tools. Source declaration locations are `list_directory` at line 34, `search_files` at line 44, `search_content` at line 57, and `read_file` at line 83. The runtime registry may sort this menu; consumers must use ids rather than positions.

The cards are pinned for the first read/search development dataset, not declared stable across future LAH versions. Names, descriptions, schemas, defaults or executor semantics changing requires a new dataset revision. `index.ts` and `config.ts` match the supplied snapshot. `filesystem.ts` has formatting and an equivalent expression split for lint; tool behavior and schemas have no public delta. Current source hashes are:

```text
index.ts       c681aa550d3d390b36356f9252e0b2c824ab5e481141ff92890c4e01f4866054
config.ts      0cd0764d79501621ecc8801e7a3e1a41518b0554d547faa0b1114ed82b02d118
filesystem.ts  786ce24022e2ea6b07944d4ba84107a45a923ca23a1c8f6ecf264303bdb5e36f
```

The schemas enforce required fields and JSON types. Their parameter roots are open objects; they do not reject every extra property. Descriptions of non-empty queries and positive bounded integers are enforced separately by [filesystem.ts](filesystem.ts). The current desktop composition in [kernel.ts](../kernel.ts) sets 256 KiB maximum file size, 100 results or lines, 20,000 visited entries, recursion depth 32, and a 120-second model-request timeout. The plugin default caps canonical JSON tool output at 24,000 characters and excludes `.git` and `node_modules` from recursive searches. Config defaults and desktop overrides are separate settings.

All operations stay within the selected canonical workspace. Traversal, paths resolving outside it, device aliases and alternate data streams are refused. Recursive search omits links. Reading accepts bounded regular UTF-8 files without NUL bytes. Search is literal; filename search ignores case and content search defaults to ignoring case. The executor validates arguments and enforces these limits independently of any router. The reader is not an OS sandbox against another process replacing files concurrently.

## Observable state

The existing `agent/pre-step` hook provides pending user messages, turn, step, agent and cancellation signal. The agent supplies `session.snapshotEvents()`. Its recorded prefix contains earlier user and assistant messages, tool ids/names/arguments, results, errors and read text. Settings supply the workspace and enabled catalog. LAH has no dedicated structured goal, known-path index, read-file cache, file watcher or verified file-change state. A future input builder can derive observed paths and successful reads from that prefix; it must label those observations as historical, with current freshness unknown.

This synthetic example uses only the information available at its decision point:

```json
{
  "version": "lah-advisor-input-draft-v1",
  "query": "Explain the retry settings in this project.",
  "workspace": ".",
  "known_paths": ["README.md"],
  "recent_observations": [
    {
      "tool_name": "list_directory",
      "arguments": {"path": "."},
      "result": {"paths": ["README.md", "src/"], "truncated": false},
      "is_error": false
    }
  ],
  "previously_read_files": [],
  "file_change_state": "unknown",
  "applicable_option_ids": ["list_directory", "search_files", "search_content", "read_file"]
}
```

Applicability describes catalog availability and permissions; argument knowledge is separate. A path not yet known does not make `read_file` forbidden. The main LLM still has to obtain or infer a valid path, choose any line window and form JSON arguments. The executor can reject the resulting call. No preferred tool, evaluator label, later result or hidden author key belongs in the advisor input.

## Advisor output and traces

The first independent SubLLM experiment may produce top-1 or `abstain`, plus scores for the other candidates in the same dynamic menu. LAH's later integration can recommend several schemas and repeat discovery. `abstain` means bypass the advisor and let the ordinary LLM/tool path continue; it is not a user-facing refusal. Scores are not calibrated success probabilities. Softmax scores from different menu chunks are not directly comparable. Two to eight options can form a small development menu; the current four-tool catalog does not establish a meaningful context-saving benefit.

[kernel.ts](../kernel.ts) already observes `session/event` records for `tool/call` and `tool/result` and returns the complete event snapshot after a turn. [main.cjs](../main.cjs) persists that snapshot in each chat's `events` array in `%APPDATA%/LocalAgentHarness/lah-state.json`; the display-only `messages` array omits most execution detail. Persistence checkpoints occur after completed turns rather than after every event. No separate trace export or advisor callback exists.

A read-only trace collector can copy completed snapshots and reconstruct each decision from the event prefix plus its pending user message. Training labels and evaluation results remain separate. Later calls/results, final answers, judge feedback and corrected user prompts must not leak into an earlier decision's input. File contents themselves are untrusted task data. The deterministic [kernel test transcript](../tests/expected/read-only-transcript.json) demonstrates execution and replay; it is not fresh model-quality evidence or a human-labelled task bank.
