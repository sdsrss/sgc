# sgc 安装/分发统一 — node bundle 双渠道（Phase 0 设计）

- **日期**：2026-06-01
- **状态**：设计已批准，待 writing-plans
- **范围**：仅安装/分发（Phase 0）。POSITIONING 反转（Phase 1）、能力补完（Phase 2）不在本 spec。
- **背景**：愿景是把 sgc 做成「独立自足、一条命令装好」的插件。当前 `/plugin install sgc` 只 copy markdown 命令壳，CLI 仍需用户另装（`npm i -g @sdsrs/sgc`，且硬依赖 `bun>=1.3` 运行时）——头条承诺是「半句谎」。本 Phase 关闭这个缺口。

## 1. 目标与验收标准

1. **干净容器**（仅装 Claude Code：有 node、无 bun、无 npm-global）：`/plugin marketplace add sdsrss/sgc` + `/plugin install sgc` → 所有 sgc 命令直接可用，**零第二步**。验收 = docker `node:20-slim` 跑通。
2. **npm 一等公民**：`npx @sdsrs/sgc` / `npm i -g @sdsrs/sgc` 同样**无需 bun 运行时**即可工作。验收 = 隔离 `npm i -g` 后代表命令可用。
3. **三态干净**：install / update / uninstall 都无 `~/.claude` 全局污染，用户项目 `.sgc/` 状态保留。

## 2. 关键决策（brainstorming 锁定）

| 决策 | 选择 | 理由 |
|---|---|---|
| 环境基线 / 渠道 | **插件渠道 + npm 渠道双轨都一等公民** | 既要 `/plugin install` 自足，又保 npx/global 给老用户与 CI |
| 双渠道并存时优先级 | **插件自带 bundle 优先**（`$CLAUDE_PLUGIN_ROOT` 先于 PATH） | 版本锁定、确定性、doctor 可校验 hash |
| 数据文件（contracts/prompts） | **内联进 bundle + env 逃生口** | 真·单文件、单 hash 可审计、防装后篡改；`SGC_CONTRACTS_DIR`/`SGC_PROMPTS_DIR` 覆盖保可定制 |

**否决的方案**：`bun --compile` 各平台二进制（250–500MB 进 git，体积爆炸）；npm 全局为唯一路径（仍要第二步 + bun 运行时）；SessionStart 下载 bootstrap（网络依赖 + path-shadow 风险，非确定性）。

**决定性前提**：node 必然在场（Claude Code 本身是 node 应用）；CLI 已 ~95% node-native（`node:fs`/`node:path`/`node:child_process` 已大量使用），对 bun 运行时的全部耦合仅 15 处（`Bun.spawn`×14 + `Bun.which`×1）。

## 3. 架构

单一源码 `src/` → 一份产物 `sgc.mjs`（node ESM bundle，内联 contracts+prompts）→ 两条渠道：

1. **插件载荷**：`plugins/sgc/bin/sgc.mjs`，命令经 `$CLAUDE_PLUGIN_ROOT` 解析，`node` 执行。
2. **npm**：`bin.sgc` → 同一份 bundle（node shebang）；`engines` 去 bun 硬要求、加 `node>=18`。

```
src/ ──bun build --target=node + text-loader inline──▶ sgc.mjs (单一产物)
                                                          │
                          ┌───────────────────────────────┴───────────────────────────┐
              plugins/sgc/bin/sgc.mjs                                     npm: bin.sgc → sgc.mjs
              (resolver: $CLAUDE_PLUGIN_ROOT, node)                       (node shebang)
```

## 4. 组件与改动

1. **构建步骤 `build:cli`**：`bun build src/sgc.ts --target=node --format=esm --outfile plugins/sgc/bin/sgc.mjs`，text loader 内联 `contracts/*.yaml` + `prompts/*.md`；playwright 标 external（核心 CLI 不 import playwright，已核验）。**规范产物位置 = `plugins/sgc/bin/sgc.mjs`（单一位置，两渠道都指向它，不另建 `dist/`）。**
2. **bun→node 运行时适配器**（唯一代码逻辑改动）：新建 `src/dispatcher/subprocess.ts`，把 14×`Bun.spawn` + 1×`Bun.which` 收敛到 `node:child_process`（`spawnSync` + PATH 扫描）。锚点：已有可注入 runner（`src/dispatcher/claude-cli-agent.ts:56` "Split out so tests can inject a fake"）+ 仓内 `node:child_process` 已用于 6 处。注意保留 [[feedback_signal_handler_paired_events]] 的 SIGINT/SIGTERM drain 语义（适配器替换不得回退信号处理）。
3. **数据解析改造**：
   - `src/dispatcher/schema.ts:18-19`（contracts 解析）：env 覆盖优先（`SGC_CONTRACTS_DIR`）→ 否则读内联常量 map（替换 `resolve(moduleDir,"..","..","contracts")` 的层级算法，bundle 落 `bin/` 后该算法会算错）。
   - `src/commands/doctor.ts:29-30`（prompts 解析）：同理，新增 `SGC_PROMPTS_DIR` 覆盖 → 否则读内联集；doctor 的「prompts↔manifest」检查（A/B）改读内联集而非 `readdirSync`。
4. **命令 resolver**：所有 `plugins/sgc/commands/*.md` 的调用壳改 4 段式，抽成共享 snippet 防漂移：
   ```bash
   if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
   elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
   elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
   else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
   fi
   ```
5. **npm 打包**：`package.json` `bin.sgc` → `plugins/sgc/bin/sgc.mjs`（与载荷同一文件，含 node shebang）；`files` 加入该路径（npm tarball 内携带此 bundle）；`engines.bun` 移除/降可选，加 `engines.node: ">=18"`。
6. **CI 构建链**：发布 workflow 在 tag 时 `build:cli` → bundle 进 release commit（marketplace 走 git-clone copy，仓内必须有 bundle）→ npm publish 带同一 bundle。**版本 lockstep**：`package.json` + `plugins/sgc/.claude-plugin/plugin.json` + bundle hash 三者一致。沿用 [[feedback_npm_publish_provenance_403_false_negative]] 的 shasum 核对判定真假阴性。
7. **doctor parity check（新增）**：校验载荷 bundle 的 hash 与「当前源码重构建」一致，防陈旧 bundle 漂移（沿用 doctor 现有 parity 范式）。

## 5. install / update / uninstall 生命周期

- **install**：plugin copy → bundle 即用，无全局副本；npm 路径 bin→bundle。
- **update**：`/plugin update sgc` 重 copy 新 bundle（「插件优先」在此兑现版本锁定）；项目 `.sgc/` 状态不动。npm 路径 `npm i -g` 覆盖更新。
- **uninstall**：`/plugin uninstall sgc` 删载荷即净，**无 `~/.claude` 污染**；项目 `.sgc/` 作为用户数据保留（不删用户状态）。

## 6. 错误处理与边界

- bundle 缺失/损坏 → resolver fallback 到 global `sgc` → `bun src/sgc.ts` → 末段错误提示。
- env 覆盖指向不存在目录 → 沿用现有 `schema.ts` 的「path + SGC_CONTRACTS_DIR 提示」错误风格。
- **browse 二进制**：核心 bundle 不含（playwright 重、且 browse 是独立编译产物）；qa.browser 在 npm 渠道无 browse 时优雅降级 + 文档化（browse 的 npm 渠道完整支持超出本 Phase）。
- 最低 node 版本：target node18（Claude Code 下限）。

## 7. 测试

- **单测**：subprocess 适配器（`spawnSync` mock，覆盖 git/claude-cli/gh 各 spawn 形态）、内联数据解析（env 覆盖 vs 内联回退两路径，遵 §9 parallel-path completeness）、doctor bundle-hash parity check。
- **核心验收 e2e**：docker `node:20-slim`（无 bun、无 npm-global）→ 模拟 plugin copy（把 `plugins/sgc/` 拷进 `$CLAUDE_PLUGIN_ROOT`）→ 跑 `plan` / `work` / `doctor` 断言可用、退出码 0。
- **npm e2e**：`npm pack` → 隔离目录 `npm i -g`（`--prefix <mkdtemp>` + 直调 `.bin/sgc`，避开 [[feedback_npx_path_shadow]] 的 PATH-shadow）→ `sgc --version` + 代表命令。

## 8. 开放风险（实现期定）

- `bun build --target=node` 对 `@anthropic-ai/sdk` 的兼容性（纯 JS，预期 OK；构建期验证 + 干净容器跑一条调用 LLM 的命令证伪）。
- text loader 内联 YAML/MD 的具体语法（`import x with { type: "text" }` vs bun 编译期内联 API——构建期定）。
- built bundle 提交进 git 的仓库体积增长（每版 ~few MB；备选：仅 release commit 带 bundle / 单独 artifact 分支 / git 属性标 binary）。
