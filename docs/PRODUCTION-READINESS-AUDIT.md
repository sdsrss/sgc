# SGC 生产级就绪全面审核 (Production-Readiness Audit)

> 审核日期：2026-06-01 · 审核版本：v1.21.0 (head `3028079`, npm `latest=1.21.0`)
> 审核范围：架构 · 功能 · 流程 · 算法 · 稳定性 · 用户体验
> 方法：直接阅读 ~15.2K LOC TypeScript 源码 + 969 测试盘面 + 3 个并行深度代理（算法 / 稳定性·并发 / CE 知识闭环）交叉验证。所有发现均带 `file:line` 证据。

---

> ## ✅ 回填：§8 全部已闭合（back-annotated 2026-06-08）
>
> 本文是 **v1.21.0 时点快照**，§8 的 P0/P1/P2 当时为 open；现已**全部 ship 修复**，下文 §8 表格保留原样作历史记录。当前状态：
>
> - **P0（6 项）→ SHIPPED v1.22.0**：ALG-1 (`dedup.ts` featureOverlap 空集=0) · CE-1 (`times_referenced` relabel) · CE-4 (`SURFACED_RELEVANCE_FLOOR=0.5`) · CE-2 (`preventions.ts` sanitizePreventionText) · STAB-1 (`file-lock.ts` O_EXCL) · CE-3 (e2e 闭环契约测试)。
> - **P1（多项）→ SHIPPED v1.23.0**：ALG-2/4/5 · STAB-2/3/4/5/6（信号 drain 收割子进程、writeAtomic 随机后缀、共享 retryWithBackoff）· CE-5/6。
> - **P2 → SHIPPED v1.23.1**：ARCH-1/2 · UX-3 · ALG-3（文档化接受范围）。
>
> 独立复核（`docs/COMPREHENSIVE-AUDIT-v1.29.1.md` 四化验证）已 spot-check **6/6 P0 在 v1.29.x 现码确为已修**（`dedup.ts:99` · `file-lock.ts:67` · `preventions.ts:106` · `state.ts:649` 等）。最新审核见 `docs/COMPREHENSIVE-AUDIT-v1.29.1.md`。

---

## 0. 执行摘要 (Executive Summary)

**当前健康基线（实测）**：

| 指标 | 数值 | 命令 |
|---|---|---|
| dispatcher 测试 | **969 pass / 0 fail** (2532 断言, 58 文件) | `SGC_FORCE_INLINE=1 bun test tests/dispatcher` |
| 类型检查 | **EXIT 0** (strict baseline) | `tsc --noEmit` |
| `sgc doctor` | **61 OK · 0 warn · 0 fail** | `bun src/sgc.ts doctor` |
| CI 门控 | test.yml (typecheck + dispatcher + eval) + publish.yml (dispatcher) | `.github/workflows/` |
| 命令面 | 19 CLI / 16 slash / 3 CLI-only — slash↔CLI parity 机器守护 | doctor (H) |
| 不变量 | §1–§13 双源对齐 | doctor (I) |

**总体结论**：sgc 在**工程纪律层面达到了远超同类个人工具的水准**——确定性测试隔离、不变量机器强制、命令面 parity check、dogfood-as-test 的回归积累（DOG-1~7）、append-only signed 知识库写门——这些是真实的、可验证的生产级特征。

但**"全面审核"暴露出 5 个 HIGH 级问题**，它们不在"测试是否绿"的可见面上，而恰好落在三个盲区：(a) **算法的空输入边界**（Jaccard 空集=1 的误合并，且被 dedup 与 fuse-plan 两处复用）；(b) **并发原子性**（无任何文件锁，`--async`/`loop` 的"单活跃"守护是 TOCTOU 竞态，detached 子进程可产生孤儿 planner）；(c) **知识闭环的"度量诚实性"**（`times_referenced` 已失效、`surfaced_in` 过计数、`applied_in` 静默漏计——三个计数器在构造上互相矛盾，使工具的核心价值主张"复用是否在变现"无法被可信观测）。此外存在一条**未净化的 LLM→语料→prompt 自反馈通道**（compound 产物不做内容校验/泄漏扫描却回喂 planner.adversarial）。

**生产级就绪裁定**：
- **作为单操作者本地 CLI（当前实际使用形态，solo-dev + bypassPermissions）**：✅ **可发布**。绿测试 + 干净 doctor + CI 门控支撑日常使用；下列 HIGH 多为"低概率但真实"的潜在缺陷，不构成日常阻断。
- **作为"知识引擎"价值主张的兑现**：⚠️ **有保留**。度量三计数器矛盾（C1/C2-metric）直接削弱"复用变现"的可观测性——这是最该优先修的，因为它影响的不是稳定性而是产品是否"名实相符"。
- **作为多并发 / 团队共享场景**：⚠️ **未就绪**。无文件锁（B1）在并发 `sgc plan --async` / `sgc loop` 下会真实地产生竞态与孤儿进程。

详见 §8 优先级清单与 §9 评分卡。

---

## 1. 架构 (Architecture)

### 1.1 分层

```
┌─ src/sgc.ts (878 LOC) ── citty 命令路由，19 subCommands，懒加载 import()
│
├─ src/commands/*.ts (18) ──── 命令编排层（plan/work/review/qa/ship/compound/
│                              reflect/loop/debug/cso/canary/land/handoff/…）
│
├─ src/dispatcher/*.ts (30+) ── 核心引擎：
│    spawn.ts(750) ───── 子代理执行引擎 + 信号 drain + 事件配对(§13)
│    state.ts(743) ───── .sgc/ 状态持久化 + writeAtomic + 写门
│    plan-jobs.ts(419) ─ CE-4 detached 异步计划任务
│    fuse-plan.ts ────── GS-3 确定性多视角融合
│    dedup.ts ───────── Jaccard 去重写门
│    {openrouter,anthropic-sdk,claude-cli}-agent.ts ── 3 个 LLM 后端
│    applied-tracker / preventions / reflect / compound-promote / canary ── CE 闭环
│
├─ src/dispatcher/agents/*.ts (11) ── 子代理（classifier/planner.{ceo,eng,adversarial}/
│                                     reviewer/researcher.history/compound/janitor/qa）
│
├─ contracts/ ──── 单一事实源：sgc-capabilities.yaml(18K) + sgc-invariants.md +
│                  sgc-state.schema.yaml + invariant-enforcement.yaml + vendored-components.yaml
│
└─ prompts/*.md ── LLM 提示模板（cache_control split，doctor 校验 prompt_path 对齐）
```

### 1.2 架构优点

- **契约驱动**：`contracts/sgc-capabilities.yaml` 是子代理 manifest 的唯一事实源，`schema.ts` 缓存加载并注入 `name`，`doctor` 机器校验 capabilities↔prompts↔slot 对齐。规范化"操作化"到 12/13 机器强制（memory: `machine-enforced-12-13`）。
- **三后端可插拔**：`resolveMode` 按 `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` / 本地 `claude` 二进制优先级自动选择；`SGC_FORCE_INLINE=1` 给出确定性无 LLM 测试通道。这是测试 969 全绿且不依赖网络的关键设计。
- **coexist 而非 replace**：POSITIONING.md 清晰界定 sgc=规范层+知识引擎，sp=思考/实现，gs=ship/监控；每个 GS-N 命令保留 inline 回退，delegate 仅为推荐而非硬依赖。
- **懒加载路由**：`sgc.ts` 所有 subcommand 用 `await import()` 动态加载，CLI 启动只付出命中命令的代价。

### 1.3 架构问题

| ID | 级别 | 位置 | 问题 |
|---|---|---|---|
| ARCH-1 | LOW | `src/sgc.ts:1-27` | **死代码 + 严重过时文档**：文件头注释声称"8 subcommands per c-phase MVP，仅 status 实现，其余打印 NotImplementedYet"，而实际 19 命令全部实现。`NotImplementedYet` 类（18-27 行）仅被自身定义引用，是死代码。误导任何新读者对架构现状的理解。 |
| ARCH-2 | LOW | `README.md:5` | **版本漂移**：README "Status: v1.20.0"，但 `package.json` 已 `1.21.0`。讽刺的是 v1.21.0 正是 "command-surface parity + doc sync" 发版——doc-sync 版本自身漏了 README status 行。 |
| ARCH-3 | LOW | `schema.ts` 缓存 | 契约缓存除 `_resetCachesForTest` 外永不失效；当前单进程 CLI 模型下正确，但 `loop`/`watch` 长驻进程编辑契约不会重载（当前无此用法，记录备查）。 |

---

## 2. 功能与命令面 (Features & Command Surface)

19 CLI 命令覆盖完整 L0→L3 流水线 + CE 知识闭环 + GS-N 吸收弧（7/7 完成）。命令面经 `doctor (H)` slash↔CLI parity 机器守护，三层真相清晰：README=CLI 全集 / CLAUDE.md=slash 子集 / SLASH_EXEMPT=桥接（`canary`/`watch-ci-failure`/`land` 为 CLI-only）。

**功能完整度**：✅ 高。CE-1~6 全部落地，GS-1~7 全部吸收，Tier-1 sp 吸收（`work --done` close-gate）已合入。无 stub/未实现命令（ARCH-1 的过时注释是唯一"看起来未实现"的误导）。

**功能层面唯一结构性顾虑**见 §6 知识闭环——功能"存在"但其**度量子系统**自相矛盾。

---

## 3. 流程 (Flow)

主流水线（`sgc loop` 编排，CE-5）：

```
plan (classify L0-L3 → planner cluster → fuse → intent.md)
  → [pause: work --add/--done close-gate]
  → review (独立静态 diff 审查，reviewer.* 子代理)
  → qa (vendored browse 真浏览器 E2E)
  → [pause: ship gate — 校验 reviews/qa/feature-list 证据]
  → compound (janitor 决策 → 写门 → solutions/)
```

捕获→提升回路：
```
watch-ci-failure (CE-3) ┐
canary (GS-1) ───────────┼→ compound --from-{ship-failure,canary} ──→ [§3 写门] ──→ solutions/
                         ┘                                                              │
                         preventions ←── researcher.history ←── walkSolutionsCorpus ←──┘
                              │
                              └→ planner.adversarial (CE-1 注入)
```

**流程优点**：每个 pause 点都有显式 close-gate（`work --done` 要求 `--verify-command`，对齐 debug 的 Iron Law #3）；捕获→提升走**同一个 §3 写门**（真实 `compound.related` spawn → DedupStamp → writeSolution），无后门。

**流程问题**：见 §5 稳定性（detached 异步任务的孤儿风险、信号 drain 不收割子进程）与 §6（回路的"度量"环节是最弱关节）。

---

## 4. 算法 (Algorithms)

来源：算法深度审核代理，逐文件 + 对应测试交叉验证，部分发现经经验性复现。

### 4.1 HIGH

- **ALG-1 [HIGH] Jaccard 空集=1 → 误合并（且双处复用）** · `dedup.ts:78,110-111` + `fuse-plan.ts:88-105`
  `jaccard(a,b)` 在 `a.size===0 && b.size===0` 时返回 `1`（对"恒等"正确，对"独立特征向量的平均相似度分量"错误）。经验性复现：`similarity({tags:[],problem:""},{tags:[],problem:""})` 返回 **1.0** → 在 0.85 阈值下被判重复。后果：(a) dedup 写门——一个空/畸形候选可能压制真实新条目的写入，或两个稀疏条目误合并；(b) fuse-plan——两个 tokenize 后为空的 concern（全停用词/全标点 `_key`）会以 1.0 合并。**同一根因约定，两个消费者，都无空输入碰撞测试**。dedup.test.ts:151-161 仅断言"不抛异常"并明确回避了得分。

### 4.2 MED

- **ALG-2 [MED] `validateValueAgainstDecl` / `validateOutputShape` 零测试覆盖** · `validation.ts`
  这是 Invariant §9 在真实 agent 输出上的**主要强制门**，validation.test.ts 却只覆盖 `composeArrayObjectValidator`。具体缺陷：`integer` decl 仅查 `typeof==="number"`，`3.7`/`NaN`/`Infinity` 全部通过（212 行的 finite-number-range FieldSpec 路径正确拒绝，两条数值路径严格度不一致）；`enum[]` 空声明 → `.+` 不匹配 → 落入"未知声明不拒绝"分支，**接受任意值**。**本审核中单一最大覆盖缺口**。
- **ALG-3 [MED] CJK 单字内容词被静默丢弃** · `dedup.ts:69-70`
  非 ASCII 最小长度=2，`tokenize("修复空指针崩溃")` → `["修复","指针","崩溃"]`，`空` 丢失。注释称单字 CJK"多为语法助词"，但 空/锁/读/写 是内容词素，降低 CJK 去重召回。dedup-unicode.test.ts 只查 `size>0`，从不断言具体 token 成员。
- **ALG-4 [MED] `worstPlanVerdict` 对非法 verdict 字符串无防御** · `fuse-plan.ts:53-55,125`
  `PLAN_VERDICT_RANK[非法]` 返回 `undefined`，`undefined>=undefined` 为 `false`，静默返回 `b` 而非抛错。inline/test 模式类型成立，但 LLM 模式输出经此流；若 validation 放过畸形 verdict，融合产出静默错误结果。
- **ALG-5 [MED] classifier-level 关键词过度分类 + 无测试** · `classifier-level.ts:26-51`
  `/\bschema\b/i`(L3) 命中"update the JSON schema comment"（文档编辑被迫 L3）；`/\bAPI\b/` 命中"the API docs typo"；L2 先于 L0 检查 → "rename the token variable" 误判 L2。是 fallback 启发式（真实路径走 LLM），但也是测试/inline 的确定性路径，且审核测试集中**无 classifier-level.test.ts**。
- **ALG-6 [MED] preprocessor 正则边界**：`quoteOptionalTokens` 排除任何含 `{`/`}` 的序列（`preprocessor.ts:85`），`[a?, {x:1}]` 混合序列中 `a?` 不被引用；block-scalar 检测正则（102 行）匹配首个 `:`，畸形值可能误判。当前契约文件受控，但是 YAML 转换的关键环节且未做模糊测试。
- **ALG-7 [MED] computeSignature 分隔符注入碰撞** · `dedup.ts:22-24`
  `problem\nerr` join 后 `normalizeText` 将所有空白折叠为单空格，`{problem:"a",err:"b"}` / `{problem:"a b",err:""}` / `{problem:"a\nb"}` 归一化后同一签名。低概率，但哈希键正确性缺陷，未测试。

### 4.3 LOW（择要）

- `fingerprint.ts:39-47` 泄漏检测对 `-`/`*` 开头的 bullet 行不指纹化，复制 bullet 内容可绕过（已文档化为接受范围，威胁模型仅防意外复制粘贴）。
- `fuse-plan.ts` concern dedup first-match-wins、`also_flagged_by` 在传递性合并下顺序依赖；`Impact`/`ConcernSeverity` 类型复用无编译期绑定。
- `DEDUP_THRESHOLD=0.85` 无 precision/recall fixture 表征边界；平均分意味着"tags 完全相同 + problem 完全不同 = 0.5 永不合并"，未测试。

**算法测试覆盖的结构性观察**：测试**重度集中在过去 dogfood bug 的防御性补丁**（tokenize-undefined、中位 `?`、dedup-truncate），却**薄覆盖主算法正确性**（相似度评分边界、`validateOutputShape`、classifier 优先级、`worstPlanVerdict` 畸形输入）。这是"回归驱动"测试积累的典型特征——防回归强，防首次正确性弱。

---

## 5. 稳定性与并发 (Stability & Concurrency)

来源：稳定性深度审核代理。`grep flock|O_EXCL|lockfile|\.lock` 全 src 无匹配。

### 5.1 HIGH

- **STAB-1 [HIGH] 无任何文件锁 → "单活跃"守护是 TOCTOU 竞态** · `plan-jobs.ts:221-276` + `loop.ts:259-287`
  并发守护全是 read-then-write 无原子性：两个并发 `sgc plan --async` 同时扫描（都尚未写 `running`）→ 都通过 `ConcurrentJobActive` 检查 → 两个活跃 planner 子进程。因 `plan-jobs.ts:121-137` 用 `detached:true`+`unref()`，此竞态产生**真实的孤儿 planner 进程**（脱离父进程，持续运行/计费）。`loop.ts` 同模式。

### 5.2 MED

- **STAB-2 [MED] SIGINT/SIGTERM drain 只刷事件，不收割子进程** · `spawn.ts:115-166`
  信号 handler 遍历 `openSpawns`（仅 metadata Map）合成 `spawn.end(interrupted)` 然后 `process.exit(128+N)`，从不向真实 `Bun.spawn`/`claude` 子进程发信号 → 子进程被 reparent 到 init，孤儿化并继续计费直至自己结束。registry 解决了**事件配对不变量(§13)**，但**没解决子进程实际清理**。
- **STAB-3 [MED] `process.exit()` 截断在途原子写** · `spawn.ts:125`
  drain 后同步 `process.exit()`，任何 await 中的 LLM 调用、`renameSync` 中途、pending NDJSON flush 被放弃。
- **STAB-4 [MED] `writeAtomic` 临时名可碰撞 + 失败泄漏** · `spawn.ts:64-69` + `state.ts:122-127`
  临时名 `${path}.tmp.${pid}.${Date.now()}`——同进程同毫秒两次写同一路径 → 同一临时名 → renameSync 前交错 writeFileSync 破坏。且**无 try/finally unlink**，writeFileSync/renameSync 抛错（ENOSPC/EXDEV）留下孤儿 `.tmp.*`。
- **STAB-5 [MED] `plan-jobs` / `loop-runs` 写入完全非原子** · `plan-jobs.ts:164-170` + `loop.ts:153-159`
  用裸 `writeFileSync`（无 temp+rename），与 `state.ts:writeAtomic` 不一致；中途 kill 留下截断的 `.md`。
- **STAB-6 [MED] LLM API 失败永不重试** · `spawn.ts:654-707`
  指数退避重试**仅存在于 file-poll 分支且仅对 SpawnTimeout**；anthropic-sdk/openrouter/claude-cli 分支单次调用，瞬时 429/503 立即上抛。`plan-jobs.test.ts:241` 测试名甚至写"OpenRouter 429 rate-limited after 3 retries"——但代码无此重试（消息仅为示意）。
- **STAB-7 [MED] 信号/并发/LLM 错误路径测试缺口**：无真实 SIGINT/SIGTERM 测试（只直调 `__drainOpenSpawnsForSignal`）；无并发竞态测试（守护只用预置文件串行测）；spawn 层无注入 429/500/AbortError 的 LLM 后端错误路径测试。

### 5.3 稳定性优点（明确记录）

- **三 LLM 后端错误分类 + 配对事件发射极强**：每个后端在所有错误类（timeout/HTTP-status/MissingContent/YAML-parse）抛出前都发 `llm.response`，`finally` 中 `clearTimeout`。
- **目录遍历读取者一致跳过畸形文件**（listSolutions/listReviewsForStage/listJobsRaw/listRunsRaw）——garbage-in 健壮（GS-1.2 回归覆盖）。
- **测试侧 temp-dir 卫生干净**：每个测试 `mkdtempSync`+`afterEach rmSync`，无 mkdtemp 泄漏。
- happy/timeout 路径子进程收割正确（`await proc.exited`）。

### 5.4 状态损坏与资源

- 经 `writeAtomic` 的文件（intent/ship/reviews/solutions/current-task）kill 中途留旧文件或孤儿 tmp，无半写正本——**好**。但 plan-jobs/loop-runs 裸写会损坏（STAB-5）。
- 单文件读取者不一致：`readJob`(`plan-jobs.ts:158-162`) 对畸形 job 文件抛裸 `StateError`，`showJob/completePlanJob/failPlanJob` 未捕获上抛（`MalformedJobFile` 码声明于 `:48` 却从不抛出）；`loop.ts:readRun` 正确包成 `MalformedRunFile`。
- `events.ndjson` 无限增长无轮转（memory 记录曾扫出 9 条历史 unpaired）；`plan-jobs/`、`loop-runs/`、`.sgc/solutions/` 的 `applied_in`/`surfaced_in` 数组均无保留/上限策略。

---

## 6. 知识闭环 (Compound Engineering Loop)

来源：CE 深度审核代理。已验证：`times_referenced` 仅在 dedup 写合并时自增、从不在 recall/surfacing 时；`surfaced_in` 在每个 L2+ plan 只要 researcher.history 返回任意 prior_art 就触发（heuristic+LLM 双模式）。

**闭环结构上是闭合的且接入 live ship/plan 路径**（非孤儿代码）：WRITE(`ship.ts:317-364`→runCompound) → DEDUP/写门(`state.ts:537 writeSolution`→`validateDedupStamp`) → RECALL(`researcher-history.ts:106 walkSolutionsCorpus`) → REUSE(`preventions.ts:105`→planner.adversarial) → MEASURE(`recordApplied`/`recordSurfaced`→`sgc reflect`)。

### 6.1 HIGH

- **CE-1 [HIGH] `times_referenced` 是失效/误导的复用指标** · `state.ts:566`
  仅在 dedup 写合并（同一问题第二次 compound）时自增，**从不在 recall 或 surfacing 时**。一个被复用 50 次的 solution 仍显示 `times_referenced:0`。`docs/SOLUTIONS.md:5` 却将其宣传为机器变更的使用状态——名实不符。真实复用信号已迁到 `applied_in`/`surfaced_in`，此字段是令人困惑的残留。
- **CE-2 [HIGH] 持久化的 compound LLM 产物不做内容校验/泄漏扫描 → 自反馈 prompt 注入通道** · `validation.ts:73-78` + `spawn.ts:712-720`
  两层对**持久化产物**失败开放：(a) `validateOutputShape` 对 `markdown` 类字段只查 `typeof==="string"`，无长度上限、无内容扫描，LLM 为 solution/prevention 产出的任何文本逐字写入 `.sgc/solutions/`；(b) Invariant §1 泄漏扫描 `scanOutputForLeak` 仅门控 reviewer.*/qa.*，compound.* 故意豁免（它本就该读 solutions）。结果：**LLM 撰写文本进入语料，后经 `extractPreventions` 回喂 planner.adversarial prompt，零净化**。一个含对抗指令的 solution body 会被注入未来 plan 的 prompt。这是**活的自反馈注入通道**。
- **CE-3 [HIGH] 无端到端闭环测试** · 全测试套件
  尽管 MEMORY 标记 `ce-loop-end-to-end`，无测试用单一语料贯通 write→recall→reuse→measure→reflect。每个环节都用手工 fixture 孤立测试，**链与链之间的契约**（recordApplied 的 ref 是否匹配 extractPreventions 发出的、是否匹配 writeSolution 写入的）未测。CE-4 的 surfaced/applied 矛盾若有此测试会立即暴露。

### 6.2 MED

- **CE-4 [MED] 三个复用计数器在构造上互相矛盾**（综合度量诚实性问题）：
  - `applied_in`（`applied-tracker.ts:65`）靠 substring 匹配 LLM 自由文本 `early_signal` 中的 `solution_ref`/slug，**LLM 不回显则静默漏计**（score 读 0 无错）。依赖 planner.adversarial 自愿回显（prompt step 5）。
  - `surfaced_in`（`plan.ts:504`）只要 `prior_art.length>0` 就 fire，仅 0.3 关键词重叠门槛，**度量的是"与某 plan 关键词碰撞"而非"被复用"**，跨任务单调增长（per-task_id 幂等但不防跨任务膨胀）。
  - `times_referenced`（CE-1）已失效。
  - 后果：`sgc reflect` 打印 `(overlap, applied, surfaced)` 是对的面，但 applied 低估、surfaced 高估、times_referenced 坏——**用户无法区分"这条 prevention 真的预防了什么"与"它的关键词恰好重叠了某 plan"**。`detectDiscussion`(`reflect.ts:108-141`) 是更诚实的信号但只在 reflect 计算、不持久化、不与 applied_in 对账。
- **CE-5 [MED] janitor 质量门粗 + 启发式回退污染语料** · `janitor-compound.ts:70` + `agents/compound.ts:102-105`
  janitor 对**任意 L2/L3 成功**都 compound（几乎每个非平凡 ship 都写 solution，无论是否携带可复用知识）；且 inline/no-key 模式的 `compoundSolutionHeuristic` 产出正是 LLM prompt 明文禁止的 "see the diff" 样板（`prompts/compound-solution.md:49-54` 禁止 vs 启发式发射）。
- **CE-6 [MED] `.sgc/solutions/` 与 surfaced/applied 数组无界增长**：无保留/轮转/上限。`surfaced_in` 永远追加；唯一读侧保护 `MAX_SOLUTION_FILE_BYTES=256KB`（`researcher-history.ts:38`）会在数组膨胀过线时**静默把该 solution 从语料 walk 中丢弃，无告警**。

### 6.3 CE 优点（明确记录）

- **dedup 写门真实强制**（`state.ts:501`）：无 DedupStamp（携带真实 spawn_id + `threshold_met_or_forced`）拒写。
- **`compound.related` 故意保持确定性启发式、绝不 LLM-swap**（`agents/compound.ts:131-148`，与 memory `feedback_compound_related_invariant3` 一致）——这是正确的设计决策。
- **researcher.history 的 `coerceLlmOutput` 防御扎实**：6 道 guard 含 `solution_ref ∈ candidates set`，LLM 无法捏造指向不存在文件的 ref；`relevance_reason` 渲染前 markdown 转义。
- back-channel（intent.md→reviewer）heading 路径有 producer-strip + consumer-gate 双重防御（`spawn.ts:245-263`）。

---

## 7. 用户体验 (UX)

**优点**：
- citty `--help` 文本详尽，每个 flag 带 Invariant 引用（如 `--auto` "REFUSED at L3 (Invariant §4)"），自我解释性强。
- `sgc status` / `plan --jobs` / `plan --status <id>` / `tail` 提供清晰可观测面；空状态有引导（"Run 'sgc plan <task>' to start"）。
- 错误信息带可执行指引（`--limit must be a non-negative integer; got X`）。
- doctor 给出 61 项检查 + parity，自诊断体验优秀。

**问题**：
- **UX-1 [MED] 复用度量对用户不诚实**（= CE-4 的 UX 投影）：`sgc reflect` 是工具核心价值的"仪表盘"，但三计数器矛盾使用户对"知识引擎是否在变现"得到误导性读数。这是**对 UX 影响最大的单点**，因为它关乎用户对工具价值的信任。
- **UX-2 [LOW] 文档现状漂移**（ARCH-1/ARCH-2）：`sgc.ts` 头注释、README status 行过时，新用户首次阅读会困惑。
- **UX-3 [LOW] 畸形 job 文件错误体验差**：`readJob` 抛裸 `StateError` 而非领域错误，用户见栈而非"job 文件损坏于 <path>"。`SGC_CONTRACTS_DIR` typo 同理抛裸 ENOENT（`schema.ts:30,43`）。

---

## 8. 优先级修复清单 (Prioritized Findings)

> 排序原则：先修"削弱核心价值主张"与"真实并发缺陷"，再修"潜在正确性"，最后文档。

### P0 — 发版前应处理（HIGH，影响价值主张/真实缺陷）

| ID | 问题 | 位置 | 建议 |
|---|---|---|---|
| CE-1 | `times_referenced` 失效误导 | `state.ts:566` | 二选一：(a) 让它在 recall/surfacing 时真正自增；(b) **移除该字段**并在 SOLUTIONS.md 删除其"使用状态"宣传，统一到 applied/surfaced。推荐 (b)——最小化矛盾源。 |
| CE-4 | 三计数器矛盾 / surfaced 过计数 | `plan.ts:504`, `applied-tracker.ts:65` | surfaced_in 增加相关性门槛（≥实际进入 prompt 的 prior_art，而非仅 keyword-overlap≥0.3）；reflect 输出区分 "surfaced/applied/discussed" 三态并文档化语义差异；将 `detectDiscussion` 作为对账信号。 |
| CE-2 | compound 产物未净化即回喂 prompt | `validation.ts:73-78`, `spawn.ts:712-720` | 对 compound.* 持久化产物加内容校验（长度上限）+ 在**回喂 planner.adversarial 时**（`extractPreventions`）做一次 prompt-injection sanitization（剥离指令式 heading/jailbreak 模式），而非在写入时。 |
| ALG-1 | Jaccard 空集=1 误合并 | `dedup.ts:78`, `fuse-plan.ts:88` | 在 `similarity`/`dedupeConcerns` 调用点：任一特征向量为空时该分量记 0（而非让 jaccard 返回 1）；或对空 problem/空 _key 直接跳过合并。加空输入碰撞测试。 |
| STAB-1 | 无文件锁 → TOCTOU 竞态 + 孤儿 planner | `plan-jobs.ts:221-276`, `loop.ts:259-287` | 用 `O_EXCL`/lockfile（写 `running` 文件用 `wx` flag 原子创建以 job_id 命名的 lock）关闭 TOCTOU 窗口；或在 detached fork 前先原子写 lock 再 fork。 |
| CE-3 | 无端到端闭环测试 | tests/ | 加一个 fixture-driven 测试：write(compound)→recall→reuse(adversarial)→measure(applied)→reflect 跑通一遍，断言三计数器一致性。会顺带回归 CE-1/CE-4。 |

### P1 — 应尽快处理（MED）

| ID | 问题 | 位置 | 建议 |
|---|---|---|---|
| ALG-2 | §9 主强制门零测试 + integer 接受 float/NaN | `validation.ts` | 给 `validateValueAgainstDecl`/`validateOutputShape` 补测试；`integer` 加 `Number.isInteger`，`enum[]` 空声明改为拒绝。 |
| STAB-2/3 | 信号 drain 不收割子进程 + exit 截断写 | `spawn.ts:115-166` | drain 时向注册的真实子进程发 SIGTERM（保存 child handle 到 registry，不只 metadata）；exit 前 await 关键写完成或改 `process.exitCode` + 自然退出。 |
| STAB-4/5 | writeAtomic 临时名碰撞/泄漏 + plan-jobs/loop 非原子 | `state.ts:122`, `plan-jobs.ts:164`, `loop.ts:153` | 临时名加随机后缀（`crypto.randomUUID` 片段，注意 spec 的 `Math.random` 限制走 mkdtemp 风格）；try/finally unlink；plan-jobs/loop 改用同一 `writeAtomic`。 |
| STAB-6 | LLM API 失败不重试 | `spawn.ts:654-686` | 对 429/503/AbortError 在 LLM 分支也加有界指数退避重试（复用 file-poll 已有退避逻辑），并修正 plan-jobs.test.ts:241 的误导测试名或补真实重试。 |
| ALG-4 | worstPlanVerdict 畸形输入静默错误 | `fuse-plan.ts:53` | 对 ceoV/engV 不在已知集时抛错或回退 reject（fail-safe）。 |
| ALG-5 | classifier 过度分类 + 无测试 | `classifier-level.ts` | 收紧关键词（词边界 + 上下文）；补 classifier-level.test.ts 表征优先级与碰撞用例。 |
| CE-5/6 | janitor 粗门 + 启发式样板污染 + 无界增长 | `janitor-compound.ts:70` | janitor 决策加"是否携带可复用知识"启发式门；inline heuristic 产出不写 "see the diff" 样板（与 prompt 对齐）；对 surfaced_in/solutions 加保留策略或 256KB 前告警。 |

### P2 — 可排期（LOW，择要）

- ARCH-1：删除 `NotImplementedYet` 死代码，重写 `sgc.ts:1-27` 头注释反映 19 命令现状。
- ARCH-2：bump README `Status: v1.21.0`（或改为引用 package.json 避免再漂移）。
- UX-3：`readJob` 包成领域错误；`schema.ts` 文件读失败给"contract not found at <path>"。
- ALG-3：CJK minLen 重新评估（内容字 vs 助词）；ALG-6/7、fingerprint bullet 绕过按文档化接受范围记录。

---

## 9. 生产级就绪评分卡 (Scorecard)

| 维度 | 评分 | 依据 |
|---|---|---|
| 架构 | **9/10** | 契约驱动、三后端可插拔、coexist 设计清晰、懒加载；扣分仅死代码/文档漂移。 |
| 功能完整度 | **9/10** | CE-1~6 + GS-1~7 + Tier-1 全落地，命令面 parity 守护；扣分在度量子系统名实不符。 |
| 流程 | **8/10** | 流水线 + 捕获→提升回路完整且走同一写门；扣分在异步/信号路径的进程治理。 |
| 算法 | **7/10** | 主路径正确，防御性补丁充分；扣分在空输入边界(ALG-1)、§9 主门未测(ALG-2)、过度分类(ALG-5)。 |
| 稳定性/并发 | **6/10** | LLM 错误分类 + 配对事件 + 目录读跳过畸形=强；但无文件锁(STAB-1)、信号不收割子进程(STAB-2)、部分写非原子(STAB-5)、LLM 不重试(STAB-6)是真实并发缺陷。 |
| 用户体验 | **8/10** | help/可观测面/doctor 优秀；扣分在 reflect 度量诚实性(UX-1) + 文档漂移。 |
| 测试与 CI | **8/10** | 969/0 + 2532 断言 + 双 workflow 门控 + dogfood-as-test；扣分在覆盖偏"防回归"轻"主正确性"、无端到端闭环测试、无并发/信号真实路径测试。 |

**综合裁定**：
- ✅ **单操作者本地 CLI：生产级可发布**（已是 npm `latest`，绿测试 + 干净 doctor + CI 门控）。
- ⚠️ **"知识引擎"价值兑现：先修 CE-1/CE-4/CE-2/CE-3**——这组是"名实相符"的关键，影响用户对工具核心价值的信任，应作为下一个版本的主题。
- ⚠️ **多并发/团队场景：先修 STAB-1**——文件锁缺失在并发 `--async`/`loop` 下会产生真实孤儿进程与竞态。

> 一句话：**sgc 的"纪律"已是生产级，"度量的诚实"和"并发的原子性"是最后两块短板**——前者削弱价值主张的可观测性，后者限制使用规模。两者都不阻断当前单用户日常使用，但都是"全面审核"应当点名、且应进入下一版主题的真实问题。

---

## 附录：审核方法与可复现命令

```bash
# 健康基线
SGC_FORCE_INLINE=1 bun test tests/dispatcher   # 969 pass / 0 fail
tsc --noEmit                                    # EXIT 0
bun src/sgc.ts doctor                           # 61 OK · 0 warn · 0 fail

# 关键证据复现
grep -rn "flock\|O_EXCL\|lockfile\|\.lock" src/ # 无匹配 → STAB-1
grep -rn "NotImplementedYet" src/               # 仅死代码自引用 → ARCH-1
```

审核由 3 个并行深度代理（算法 / 稳定性·并发 / CE 知识闭环）+ 主审核交叉验证生成，所有 HIGH/MED 发现均带 `file:line` 锚点。本文档为**只读分析产物，未改动任何源码**。
