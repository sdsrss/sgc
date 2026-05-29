# SGC 能力吸取与融合审核报告

> 审核对象：`@sdsrs/sgc` v1.18.0（npm 包 + Claude Code marketplace 插件）
> 审核范围：对 **Superpowers (sp)**、**gstack (gs)**、**Compound Engineering (CE)** 三者优秀能力的吸取、融合，以及"做成独立插件"的达成情况
> 审核日期：2026-05-29 ｜ 审核基线：main @ `5eb0821`
> 审核方法：以代码 / CHANGELOG / contracts 为权威（canonical artifact 优先于 POSITIONING / README 等 intent 叙述），逐条核验吸收声明

---

## 0. 结论速览（直接回答四个问题）

| 你的问题 | 结论 | 一句话依据 |
|---|---|---|
| 有没有吸取三者优秀能力？ | **有，但不对称** | CE 全量内化（6/6），gs 选择性吸收（GS-N 弧 7/7），sp 以**委派为主 + 1 项概念吸收**（`sgc debug`） |
| 有没有融合？ | **有，且有统一脊柱** | 三者被同一条 `capture → promote → CE-1` 闭环 + 13 invariants 串接，不是松散并列 |
| 有没有做成新的独立插件？ | **已经做成并发布** | `@sdsrs/sgc` v1.18.0 已上 npm + marketplace，不是计划而是 shipped |
| 是否实现规范化/自动化/智能化/高效化？ | **规范化最强、自动化与智能化达成、高效化部分** | 见 §5 四化评分；高效化受"两件套安装"摩擦拖累 |

**两个最重要的审核发现：**

1. **设计哲学**：sgc 的实际模型是 **coexist（共存）+ 选择性吸收 + 委派其余**，而**不是**"把三者精华熔成一个替代性超级插件"。若你的预期是后者，这里存在**心智模型差异**——sgc 明确将"深度思考/实现"留给 sp、"完整 CI/部署/浏览器"留给 gs（`docs/POSITIONING.md:66-69` Non-goals）。这是有意为之。

2. **声明张力（R0，✅ 已修复 2026-05-29）**：POSITIONING 曾称吸收"no gstack source copied"，但仓库内 `plugins/sgc/browse/` 实为 **vendored gstack browse 源码**（`build:browse` 编译），其 **64 个测试在裸 `bun test` 下全红**。该声明仅在 GS-N 吸收弧（dispatcher 命令）范围内成立。**修复**：`bunfig.toml` `[test] root="tests"` 让裸 `bun test` 对齐 CI 门禁排除 browse、POSITIONING 新增 "Vendored components" 节并限定吸收弧声明、README 加注记。注：browse **不在** npm `files` 清单（`package.json` 只发 `src/contracts/prompts/`），只随 marketplace 插件分发、不污染 npm CLI 包。详见 §6 R0。

---

## 1. 三插件能力吸取矩阵

吸收有三种形态，需区分清楚（这是审核的核心区分）：

- **NATIVE（内化）**：sgc 自己重新实现了该能力，成为 dispatcher 命令，零外部依赖。
- **ABSORB（吸收）**：参照 gs 风格能力做 sgc-native 启发式实现，**不复制源码、不调 gs 二进制、不引入 gs 依赖**（`docs/POSITIONING.md:46-48`）；gs 在场时仍推荐委派。
- **DELEGATE（委派）**：sgc 不实现，仅在命令输出里 surface 一行 `(hint)` 推荐去用对应插件，**从不强制**（`src/dispatcher/delegation.ts:5-6`）。

### 1.1 Compound Engineering (CE) —— 全量 NATIVE，是架构核心

CE 不是"被吸收的外部插件"，而是 sgc 的**内生骨架**。6 个能力点全部落地（`README.md` + CHANGELOG 交叉验证）：

| 编号 | 能力 | sgc 实现 | 形态 |
|---|---|---|---|
| CE-1 | prevention 注入 | 把已沉淀的 prevention 喂给 `planner.adversarial`（下一次 L3 plan） | NATIVE |
| CE-2 | decisions↔solutions 审计 | `sgc reflect` | NATIVE |
| CE-3 | ship-failure 捕获/晋升 | `sgc watch-ci-failure` + `sgc compound --from-ship-failure` | NATIVE |
| CE-4 | 异步规划 | `sgc plan --async`（detached planner） | NATIVE |
| CE-5 | 编排器 | `sgc loop` | NATIVE |
| CE-6 | 分数反馈 | `applied_in` 回写源 solution（`src/dispatcher/applied-tracker.ts`） | NATIVE |

> 起源佐证：`tasks/2026-05-26-...vendor-ce-...paused.md` 是当初 "vendor CE into sgc" 的 L3 任务存档，现已闭合（6/6）。

### 1.2 gstack (gs) —— GS-N 吸收弧 7/7（ABSORB）+ 多项 DELEGATE

**ABSORB（已全部 ship，见 `docs/POSITIONING.md:40-64` 与 CHANGELOG v1.11.0→v1.18.0）：**

| 编号 | 能力 | sgc 命令 | 版本 |
|---|---|---|---|
| GS-1 | post-publish 健康检查 | `sgc canary` | v1.11.0（+v1.11.1 PATH-shadow 修复） |
| GS-1.1 | canary → solutions 晋升 | `sgc compound --from-canary` | v1.12.0 |
| GS-1.2 | 畸形语料 dedup 健壮性 | dispatcher 防御 | v1.12.1 |
| GS-2 | 会话 handoff 恢复 | `sgc handoff --auto` | v1.13.0 |
| GS-7 | 零依赖发布后链 | `sgc land`（chains watch-ci-failure + canary） | v1.14.0 |
| GS-4 | 系统化调试相位走查 | `sgc debug`（4 相位 walker） | v1.15.0 |
| GS-6 | 意图框定选择器 | `sgc discover --template` | v1.16.0 |
| GS-5 | 基础设施优先安全审查 | `sgc cso`（daily/comprehensive） | v1.17.0 |
| GS-3 | 多视角规划决策融合 | `sgc plan` fused decision | v1.18.0 |

**DELEGATE（gs 在场时推荐，见 `docs/POSITIONING.md:17-34` 委派表）：**
`gs:/review`（pre-ship 综合评审）、`gs:/ship` + `gs:/land-and-deploy`（git/PR/deploy）、`gs:/browse`（浏览器 QA）、`gs:/design-review`（设计打磨）。这些 sgc **有意不实现**——属 Non-goals。

> 关键质量信号：GS-N 弧多次出现 **dogfood-as-test**——新命令首次对真实 `.sgc/` 状态运行即抓到真 bug（CE-3.1 → GS-1.1 → GS-1.2 → GS-2 → GS-7 DOG-3 等，CHANGELOG:469）。这是吸收质量的强证据，而非纸面声明。

### 1.3 Superpowers (sp) —— 以 DELEGATE 为主，仅 1 项概念吸收

这是三者中**吸收最薄**的，且经核验是**有意为之**：

- **DELEGATE（代码层证实，`src/dispatcher/delegation.ts:122-153`）**：sgc 在并行任务点 hint `/superpowers:dispatching-parallel-agents`，在评审点 hint `/superpowers:requesting-code-review`。POSITIONING 委派表还列出 `sp:writing-plans` / `sp:test-driven-development` / `sp:systematic-debugging`。
- **ABSORB（仅 1 项）**：`sgc debug`（GS-4）把 systematic-debugging 的"investigate→analyze→hypothesize→implement 四相位 + Iron Law #3"作为 sgc-native walker 内化。
- **设计立场**：`docs/POSITIONING.md:76` 用户心智模型——"sp 负责思考与实现"。sgc 刻意不抢 sp 的深度规划/TDD 纪律领域。

> 审核判断：sp 吸收薄 = **设计选择，不是缺口**。但若你希望 sgc 在 sp 缺席时也能提供 TDD/深度规划的 fallback，目前是空白（见 §6 风险 R3）。

---

## 2. 融合架构：三者如何被串成一条闭环

吸收不是并列堆叠，而是被一条统一脊柱串接——这是"融合"的实质：

```
意图框定         规划                     执行            发布后            知识沉淀                回灌
sgc discover → sgc plan (L0-L3 分级) → sgc work → sgc land → sgc compound → planner.adversarial
(GS-6)         + fused_verdict(GS-3)    + debug    (GS-7)     (CE-3/GS-1.1)   (CE-1 prevention)
                 ↑                       (GS-4)     watch-ci   ↓dedup≥0.85
                 └──────────────── applied_in 分数反馈(CE-6) ──┴── solutions/ (append-only, signed)
```

**融合的三个粘合点：**

1. **统一写入门（Invariant §3 write-gate）**：无论捕获来自 ship-failure（CE-3）还是 canary（GS-1.1），晋升进 `solutions/` 都走**同一条** `compound.related → DedupStamp → writeSolution` 路径（`docs/POSITIONING.md:14`、`contracts/sgc-invariants.md §3`）。新能力接入不另开后门。
2. **13 条 runtime invariants** 作为护栏覆盖所有吸收能力（`contracts/sgc-invariants.md`，§1 生成器-评估器分离、§2 决策不可变、§3 dedup、§13 双层事件审计等），由 `sgc-capabilities.yaml` scope token 在 spawn 时强制。
3. **CE-1 回灌闭环**：所有沉淀的 prevention 在下一次 L3 plan 自动注入 `planner.adversarial`——这让 gs/CE 吸收来的能力产出的教训能反哺规划，形成 compounding。

> 融合质量证据：GS-3 决策融合上线时，最激进的方案（multi-reviewer + cross-evaluator back-channel，原定 v2.0.0/L3）被**主动降级**为 model-A（无 LLM、无评估器间串扰），以**保住 Invariant §1**（`CHANGELOG.md:167-170`、POSITIONING:60-64）。这说明融合受不变量约束、不为吸收而破契约——是成熟信号。

---

## 3. "做成独立插件"达成情况

**已达成且已发布。** 这不是规划，是 shipped 状态：

- **npm 包**：`@sdsrs/sgc` v1.18.0（`package.json:2`），`provenance: true` 签名发布。
- **Claude Code 插件**：`/plugin marketplace add sdsrss/sgc` → `/plugin install sgc`（`README.md` Install 节）。
- **两件套结构**：插件分两部分——CLI dispatcher（`src/sgc.ts`，18 个命令）+ markdown prompt 层（`plugins/sgc/`：11 slash commands、9 skills、SessionStart hook）。

⚠️ **审核发现的摩擦点**：`/plugin install sgc` 只装 markdown prompt 层，**CLI 仍需另行 `npm i -g` 或 `git clone`**（`README.md` Install 节明示，记忆 `project_sgc_plugin_packaging.md` 亦记录）。即"独立插件"在分发上是**两步安装**，不是单命令即用。详见 §6 风险 R1。

---

## 4. 能力清单总览（验证后的数字）

| 维度 | 数量 | 来源 |
|---|---|---|
| dispatcher CLI 命令 | 18（`src/commands/*.ts`） | 实测 `ls` |
| LLM 后端 agents | 10（`prompt_path` 模板 + cache_control 切分） | README |
| 刻意保持启发式的 agent | 1（`compound.related`，其 dedup_stamp 授权 §3 写入，必须确定性） | README + 记忆 |
| runtime invariants | 13（§1–§13） | `contracts/sgc-invariants.md` |
| CE 能力点 | 6/6 NATIVE | CHANGELOG |
| GS-N 吸收弧 | 7/7 ABSORB | POSITIONING:64 |
| `npm test`（确定性门禁，Rec 2 后 = `tests/dispatcher`） | **946 pass / 0 fail**（58 文件，~125s，EXIT=0） | 实测 `SGC_FORCE_INLINE=1 bun test tests/dispatcher` |
| `npm run test:eval`（LLM-eval，opt-in、非确定性） | 2 / ~105 flake（有 key 时跑，无 key skipIf） | 实测 `bun test tests/eval` |
| `plugins/sgc/browse/test/`（vendored 上游套件） | 64 fail，**已隔离**出默认 `bun test`（bunfig root=tests，R0） | 见 §6 R0 |

> ✅ 测试现状（Rec 2 后）：默认 `npm test` 现为 **确定性 946/0**；LLM-eval 的 2 个 flake（`clarifier.discover s2`、`compound.prevention s4`，对真实模型输出 `toMatch`）已拆到独立 `test:eval` lane，不再污染默认信号；browse 64 fail 经 bunfig 隔离不再被裸 `bun test` 扫到。

---

## 5. 四化达成度评估（已操作化为可度量指标 — Rec 1, 2026-05-29）

> 原报告此节为主观形容词（强/达成/部分），不可证伪。现替换为可复现的计数/比率 + 数据源，并由 `sgc doctor` 守护其中两项的底层不变量。

| 化 | 可度量指标 | 实测值 | 数据源 |
|---|---|---|---|
| 规范化 | 机器强制 invariant 数 / 13 | **12 / 13**（§12 唯一 procedural） | `contracts/invariant-enforcement.yaml` + `sgc doctor` check G（实测 OK） |
| 自动化 | 端到端流程的手动 gate 数 | **2**（`sgc loop`：work、ship） | `src/dispatcher/loop.ts`（`terminal_reason: paused_work\|paused_ship`） |
| 智能化 | LLM 后端 agent 数 ｜ eval flake 率 | 10 agents ｜ 2 / 1051（已隔离出默认门禁，见 Rec 2） | README ｜ 实测 |
| 高效化 | 安装步数 ｜ 运行时依赖 | 2 步（plugin + CLI 分装）｜ `bun ≥1.3` | README Install / 记忆 `project_sgc_plugin_packaging` |

### 5.1 规范化 —— 12/13 机器强制（**修正**先前"13 条在 dispatch 时统一硬强制"的高估）

- **修正**：经 `tests/eval/invariants.test.ts`（实测仅覆盖 §13）+ `sgc-invariants.md:119` 核实，强制是**分散于多个时点**的，不存在"dispatch 时统一硬门"：§1/§8 在 **spawn 时**（scope token）、§2/§3/§5/§7/§9/§11 在 **write 时**（schema/dispatcher）、§4 在 **command-parser 时**（`plan.ts:544`）、§6 在 **append 时**（`state.ts` write-once）、§10/§13 在 **runtime**（transaction / try-finally）。
- **§12 是唯一 procedural**（"enforced by code review discipline"，非机器强制），故机器强制数 = **12/13**，由 `contracts/invariant-enforcement.yaml` 记录、`sgc doctor` check G 校验（每条 machine_enforced 的引用测试文件须存在；实测 12/13 全绿）。
- L0-L3 分级（`classifier.level` + §11 必给 rationale）、`solutions/` append-only + 签名 + dedup（Jaccard ≥0.85）仍是规范化主干。

### 5.2 自动化 —— 手动 gate = 2

- 自动链路：`sgc loop`（CE-5）、`sgc plan --async`（CE-4）、`sgc watch-ci-failure`（CE-3）、`sgc canary`（GS-1）、`sgc land`（GS-7）；捕获→晋升全自动走统一写入门。
- 度量：`sgc loop` 端到端含 **2 个有意保留的手动 gate**（work 由操作者实现、ship 受 §4 L3 人签）。降低此数=提高自动化，但 §4 的人签 gate 是规范要求、不应消除。

### 5.3 智能化 —— 10 LLM agents，融合刻意设上限

- 10 个 LLM 后端 agents（多 provider 自动检测）；`planner.{ceo,eng,adversarial}` 多视角 + GS-3 **确定性**融合成 `fused_verdict`。
- 度量补充：eval flake 率 2/1051——已由 Rec 2 隔离出默认 `npm test` 信号（见 §6 测试诚实声明）。
- GS-3 出于契约安全**刻意不做** LLM 仲裁（model-A，保 §1），故"智能融合"有意设上限——审慎而非不足。

### 5.4 高效化 —— 运行期高、分发期有摩擦

- 运行期：委派避免重复造轮子（gs 在场直接复用）+ 零依赖启发式 fallback + dedup ≥0.85 压缩语料。
- 拖累项（可度量）：**安装 2 步**（`/plugin install` 只装 markdown，CLI 另装，见 R1）+ 运行时依赖 `bun ≥1.3`。降低安装步数=提高高效化。

---

## 6. 审核发现的差距与风险（honest gaps）

| 编号 | 等级 | 发现 | 依据 | 建议 |
|---|---|---|---|---|
| **R0** | **✅ RESOLVED 2026-05-29** | **`plugins/sgc/browse/` 是 vendored gstack browse 源码**（29+ 文件：`browser-manager`/`cdp-inspector`/`sidebar-agent`/`cookie-picker`…，`package.json` `build:browse` 编译它，测试名为 `gstack-update-check`/`gstack-config`/`gstack-learnings-search`），其 **64 个测试在裸 `bun test` 下全红**（`bin/gstack-learnings-search` 等 fixture 未一并 vendored）。根因：CI 门禁本就只跑 `bun test tests/dispatcher [tests/eval]`，从不含 browse；只有裸 `bun test`（无路径）误扫上游 vendored 套件。声明张力：POSITIONING:46-48 "no gstack source copied" 只在 **GS-N 吸收弧（dispatcher 命令）** 范围成立，browse 是范围外的独立 vendored 副本。 | 实测：`bun test tests/dispatcher` = 946/0 绿（EXIT=0）；裸 `bun test` 经 root 排除后不再扫 browse | **已修**：(1) 新增 `bunfig.toml` `[test] root="tests"` → 裸 `bun test` 对齐 CI 门禁、排除 browse（实测显式指定 browse 路径已发现 0 测试）；(2) `package.json` test 脚本显式化为 `bun test tests/`；(3) POSITIONING 新增 "Vendored components" 节 + 限定吸收弧声明、README browse 行加 vendored 注记，消除张力 |
| R1 | 中 | "独立插件"是两步安装：`/plugin install` 只装 markdown，CLI 需另装 npm/clone | `README.md` Install、记忆 `project_sgc_plugin_packaging.md` | 文档已说明；可考虑 bundling 或 install 后探测并自动提示装 CLI |
| R2 | 低 | `plugins/sgc/agents/<cat>/<name>.md` 是 sgc 内部 agent，**不是** Claude Code subagent，易被误读为可被 CC 直接调度 | 记忆 `project_sgc_plugin_packaging.md` | 在 plugin README 标注边界 |
| R3 | 低（设计选择） | sp 缺席时，sgc 无 TDD / 深度规划的 native fallback（只有 `sgc debug` 覆盖 systematic-debugging） | `delegation.ts`、POSITIONING 委派表 | 若要"sp-free 也完整"，可评估补 TDD-lite；当前属有意 Non-goal |
| R4 | 低 | 旧语料（pre-CE-1 minimal frontmatter）曾导致 dedup 崩溃，已修（v1.12.1 防御 coerce） | CHANGELOG:634 | 已闭合，保留为回归测试 |
| R5 | 信息 | 心智模型差异：用户可能预期"三合一替代超级插件"，实际是"coexist + 选择性吸收 + 委派" | POSITIONING Non-goals | 本报告 §0 已澄清 |

---

## 7. 总评与建议

**总评**：sgc 已是一个**已发布的、围绕 Compound Engineering 闭环为核心、选择性吸收 gstack 能力、对 Superpowers 以委派为主**的独立规范层 + 知识引擎插件。三者能力被 13 条 invariants 与统一写入门**真实融合**（非并列），并非纸面声明——多处由 dogfood-as-test 与契约降级决策佐证。规范化与自动化/智能化达成度高，高效化受安装分发摩擦拖累。

**高价值建议落实状态（2026-05-29）**：
1. ~~**R0（高）**：browse 红测试 + 声明张力~~ — **✅ 已修**（bunfig root=tests、脚本显式化、POSITIONING "Vendored components" 节 + README 注记）。
2. ~~**Rec 1（高）**：修正 §5.1 高估 + 四化操作化~~ — **✅ 已修**（§5 改为可度量指标表；§5.1 改为"12/13 机器强制、§12 procedural、分散时点"；新增 `contracts/invariant-enforcement.yaml`）。
3. ~~**Rec 2（高）**：隔离 LLM-eval flake~~ — **✅ 已修**（`npm test`=`tests/dispatcher` 确定性 946/0；新增 `test:eval` / `test:all` lane）。
4. ~~**Rec 3（高）**：把审核固化进 `sgc doctor`~~ — **✅ 已修**（新增 check D bunfig-root / E npm-files / F vendored-provenance / G invariant→test 映射；实测 41 OK·0 fail；+5 TDD 测试，doctor 套件 10/10）。
5. ~~**Rec 4（中）**：browse vendored 根因治理~~ — **✅ 部分修**（`contracts/vendored-components.yaml` 记录 provenance + 标注 upstream_ref=unknown 为债务 + cso dependency-audit 盲区；**待办**：回填上游 gstack commit、评估改 build-time fetch/真依赖）。
6. **R1（中，未做）**：降低两步安装摩擦——CLI bundling 或 SessionStart 探测缺失 CLI 一键提示。
7. **R5（沟通，未做）**：README 顶部一句话固化"coexist 而非替代"。
8. **R3-原（可选，未做）**：sp 缺席时的 native TDD-lite fallback。

> ✅ 测试诚实声明（更新）：默认 `npm test` 现为 **确定性 946/0（EXIT=0）**；LLM-eval 2 flake 已隔离到 `test:eval`、browse 64 fail 已经 bunfig 隔离——三者均不再污染默认门禁信号。残留债务：vendored browse 上游版本未知（Rec 4 待办）、4 个**与本任务无关的** pre-existing `tsc` strict 报错（`debug/dedup/loop/spawn-interrupt.test.ts`）。

---

## 附录 A. 审核证据索引（file:line）

- 定位与 Non-goals：`docs/POSITIONING.md:5,17-34,40-64,66-69,76`
- 独立插件状态：`package.json:2`、`README.md` Install/Update 节
- CE 6/6 + GS 7/7：`README.md` 首段、`CHANGELOG.md:3,221,327,384,447,480,634` + `grep CE-[1-6] / GS-[0-9]`
- 委派机制（不强制）：`src/dispatcher/delegation.ts:5-6,24-35,122-153`
- 13 invariants：`contracts/sgc-invariants.md §1-§13` + Cross-References:110-120
- 统一写入门：`docs/POSITIONING.md:14`、`contracts/sgc-invariants.md §3` + metadata-only carve-out (CE-6)
- 能力契约（dispatch 时强制）：`contracts/sgc-capabilities.yaml`（scope_tokens / permissions / subagents）
- 命令清单：`src/commands/*.ts`（18）、`src/dispatcher/*.ts`
- 测试实测：`SGC_FORCE_INLINE=1 bun test tests/` → 1049 pass / 2 fail（LLM-eval）/ 1051；全量 `bun test` 另 +64 fail（browse）
- vendored browse：`plugins/sgc/browse/src/*.ts`（含 gstack 字样 29+ 文件）、`package.json:42` `build:browse`、测试 `gstack-update-check`/`gstack-config`/`gstack-learnings-search`、`plugins/sgc/bin/gstack-learnings-search` ENOENT
- npm 分发边界：`package.json` `files`（不含 `plugins/`）
- 起源任务存档：`tasks/2026-05-26-vendor-ce-compound-engineering-capabilit-paused.md`

> 审核原则：本报告所有结论以代码 / contracts / CHANGELOG 为权威；POSITIONING / README 等叙述性文档作为 intent 参照，凡声明均经源文件交叉核验。
