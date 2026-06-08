# SGC 全面审核报告 — 架构 · 功能 · 流程 · 模块 · 代码 · 提示词 · 四化 · 生产就绪

> 审核对象：`@sdsrs/sgc` **v1.29.1**（npm 包 + Claude Code marketplace 插件）
> 审核基线：`main @ e492a20`（HEAD），审核日期 **2026-06-08**
> 审核问题：是否实现 AI 编程的 **规范化 / 自动化 / 智能化 / 高效化**？是否达到**生产级使用水平**？
> 审核方法：4 个独立子代理并行深查（架构/流程、提示词/智能化、生产就绪、四化验证）+ 主审独立核验。**以代码 / 实测命令输出 / contracts 为权威**（canonical artifact 优先于 README / POSITIONING 等 intent 叙述）。每条结论标注证据强度：`[实测]`=命令执行验证 · `[读证]`=读源码验证 · `[推断]`=未完全读到、作为假设。
> 与既有审核的关系：本报告是 `CAPABILITY-ABSORPTION-AUDIT.md`（基线 v1.18.0）与 `PRODUCTION-READINESS-AUDIT.md`（基线 v1.22.0 前）的**当前版独立复核 + 新维度补充**，不重复其已闭合项。

---

## 0. 结论速览

| 审核问题 | 结论 | 一句话依据 |
|---|---|---|
| 规范化 | **达成，最强一化（A）** | 13 不变量中 12 条机器强制、设计有认识论论证、强制点分散且真实可查 |
| 自动化 | **达成，度量偏弱（B）** | capture 全自动、promote/reuse 有意人工门控；`4/6` 是 6 元数组近常量、未反映真实人工步数 |
| 智能化 | **容量达成、默认退化（B−）** | 提示词工程优异（均分 9.68/10），但**默认无 API key 环境下 11 个 LLM agent 全部回退启发式**；真正 LLM 驱动 ≈5 个 |
| 高效化 | **装机达成、关键指标未度量（C+）** | 单步安装真实、运行时零依赖；但 `install_steps:1` 是硬编码断言，TTHW（唯一有意义的效率信号）**自认未度量** |
| **生产级使用水平** | **在其声明范围内达到生产级**（CLI 工程工具 + 知识引擎），**但有 1 个 P0 会绊到真实贡献者** | 测试 1195 pass/0 fail、tsc 干净、0 依赖漏洞、无密钥泄漏、robustness 原语有真实 I/O 测试；P0=`SGC_FORCE_INLINE` 失效见 §6.1 |

**整体判定**：sgc 是一个**工程纪律扎实、知识闭环真实、契约护栏严谨**的已发布插件，其**规范化（process discipline）维度达到甚至超出同类工具的生产级水准**。但"四化"中**智能化的产品体感**与**高效化的可度量性**是真实短板，且存在若干**诚实性/文档漂移**问题需要修补。它**不是**它有时自我宣称的那种"语义融汇贯通的智能体"——更准确的描述是"**契约驱动的确定性工程脊柱 + 可选 LLM 增强 + 复利知识引擎**"。这一更朴素的定位反而是它真正的护城河。

### 四化评分卡（本审核独立评定）

| 化 | 评分 | 实测指标（v1.29.1） | 诚实度判定 |
|---|---|---|---|
| 规范化 | **A** | 12/13 机器强制 invariant `[实测]` | 诚实，甚至**偏保守**（排除的 §12 是最弱的一条） |
| 自动化 | **B** | 端到端 2 个有意人工门（work/ship）`[读证]` | 诚实但**近常量**，不反映 capture→promote→reuse 真实人工步数 |
| 智能化 | **B−** | 11/23 LLM-capable，**~5/23 真正 LLM 驱动** `[读证]` | metrics 自标 "(capacity, not quality)" 已诚实；但 README/manifest 仍有"implemented"误导 |
| 高效化 | **C+** | 1 步安装 + node≥18 + ~900KB bundle `[实测]` | install 真实；**TTHW 未度量**，称其为"metric"偏宽 |

---

## 1. 硬指标实测（本次执行，可复现）

> 全部来自真实命令执行 `[实测]`，基线 `e492a20`。

| 命令 | 结果 |
|---|---|
| `bun src/sgc.ts doctor`（源码模式） | **63 OK · 0 warn · 0 fail** |
| `node plugins/sgc/bin/sgc.mjs doctor`（bundle 模式） | 31 OK · 0 fail（8 项自跳过 "no source checkout — dev/CI-only"，按设计） |
| `node … metrics` | 规范化 **12/13** · 智能化 **11/23** · 自动化 **4/6** · 高效化 1 步 / node≥18 / ~900KB |
| `tsc --noEmit`（pinned local binary） | **exit 0，干净** |
| `bun test tests/dispatcher` | **1126 pass / 0 fail**，2894 expects，71 文件，131.7s |
| `bun test tests/dispatcher tests/eval`（无 key，CI 等价） | **1195 pass / 38 skip / 0 fail**，3143 expects，98 文件，131.8s |
| `npm audit` | **0 漏洞**（critical/high/mod/low 全 0） |

**解读**：典型生产级绿信号——类型干净、零测试失败（CI 路径）、零依赖漏洞、3143 个真实断言。38 skip 是 key-gated 的 live-LLM eval 测试，正确跳过。**但这组绿数字有一个隐藏前提**：CI 通过**不给 API key** 让 LLM 测试 skip 来保证确定性（见 §6.1 P0）。

---

## 2. 架构与流程评估

**连贯性 / 可维护性 / 生产级：7/10** ｜ **真正"融汇贯通" vs 并列堆叠：5/10**（子代理评分，主审核认同）

### 2.1 流程脊柱（真实闭环，强项）

```
discover → plan(L0-L3 分级 + fused_verdict) → work → review → qa → ship → land → compound → planner.adversarial
 (GS-6)      (classifier + 多视角融合 GS-3)    (TDD     (L2+ cluster) (Playwright (8-gate) (GS-7)  (CE-3/GS-1.1)  (CE-1 回灌)
                                              ledger)               opt-in)
                          └────────── applied_in/surfaced_in 分数反馈(CE-6) ──┴── solutions/ (append-only, dedup≥0.85) ──┘
```

三个真实的"融合粘合点"`[读证]`：
1. **统一写入门**（Invariant §3）：无论捕获来自 ship-failure 还是 canary，晋升 `solutions/` 都走同一条 `compound.related → DedupStamp → writeSolution`（`contracts/sgc-invariants.md:20-30`）。
2. **13 不变量护栏**覆盖所有能力，spawn 时由 scope token 强制（§8）。
3. **CE-1 回灌**：沉淀的 prevention 在下次 L3 plan 注入 `planner.adversarial`，形成 compounding（`src/dispatcher/preventions.ts:134-200`、`plan.ts`）。

### 2.2 关键架构发现

**强项 `[读证]`：**
- **状态层原子写**（`state.ts:128-147`）：tmp = pid+时间戳+单调序号+4 随机字节 → `renameSync` → 失败 `try/unlink` 防残留。collision-proof，正确。
- **不变量强制真实分散**：§2 不可变（`state.ts:58` `IntentImmutable`）、§6 append-only（`state.ts:59` `AppendOnly`）、§3 dedup stamp（`state.ts:599-631`）、§13 双层事件审计 try/finally（`spawn.ts:142-245` + 三个 agent 文件）。
- **信号 drain 注册表**（`spawn.ts:142-245`）：module 级 `openSpawns` Map + 懒装 SIGINT/SIGTERM，drain 合成 `spawn.end(outcome=interrupted)` 并 kill 子进程再 `exit(128+N)`。修复了 Ctrl-C 跳过 finally 的真实缺口。
- **声明式 mode 路由**（`spawn.ts:405-487`）：10 行优先级表胜过 if-else 链，易审计。

**弱项与风险：**
- **「融合」名不副实（诚实性）`[读证]`**：planner cluster（ceo/eng/adversarial）是**并行独立运行 + 末端聚合**，无 cross-talk、无迭代精化。`fuse-plan.ts:136-162` 是 `worst(ceo,eng)` + "high/high 失败模式则 approve→revise" 的**硬覆盖**——是**集成投票（ensemble voting）+ 约束器**，不是 ML 意义的语义融合。这是**正确的工程选择**（避免 N 轮往返 token 成本），但"融汇贯通"宣称偏强。**建议**：对外措辞改为"多视角聚合 + 不变量约束"，别用"fusion/语义融合"。
- **command-dispatcher 样板耦合 `[读证]`**：plan.ts / review.ts / ship.ts 各有 200-400 行重复脚手架（读 task → 查门 → spawn → 写态 → append → emit）。新增一个门容易在某命令遗漏。**建议**：抽象 command orchestrator 统一门序。
- **§8 scope token 强制跨文件、定位性差 `[推断→部分读证]`**：强制逻辑在 `capabilities.ts:computeSubagentTokens`，spawn.ts 只引用。单读 spawn.ts 无法验证 §8 真被强制——是**文档定位性问题**，非已证缺陷。
- **fingerprint 缓存生产不失效 `[读证，已校准]`**：`fingerprint.ts:90` module 级 `fpCache` 按 stateRoot 键控，仅测试调 `clearFingerprintCache()`。**CLI 每命令一进程 → 非 bug**；仅 embedded/长驻进程多命令复用同一 stateRoot 时 latent。**低危**。
- **`sgc plan --async` 返回合成 `level:"L0"` `[读证]`**：detached 子进程 fork 后父返回占位 L0（`sgc.ts:~216`），实际任务可能 L3。轻微 API 诚实债——不影响正确性，但隐藏真相。

---

## 3. 提示词与智能化评估

### 3.1 提示词工程：优异（均分 9.68/10）`[读证]`

11 个 prompt 文件展现**罕见的高水准提示工程纪律**：

| 维度 | 实例 |
|---|---|
| **banned-vocab 强制** | 每个 prompt 列中英双语禁用对冲词（`显著/robust/comprehensive/could potentially`），要求具体命名 |
| **anti-pattern 对照** | 每个含 3-6 组 bad-vs-good 范例 |
| **输出 schema 清晰** | YAML 模板示精确 shape，enum 封闭，数组长度有上限 |
| **recurrence 门**（planner-adversarial） | 注入 prior_preventions 时显式问"条件是否真会重现"，防幻觉复发 |
| **诚实激励**（compound-context/solution） | 显式奖励 "(symptom not stated in input)" 而非编造 |

最高分：`compound-prevention` / `compound-solution` / `planner-adversarial` / `researcher-history`（9.8）。最低：`planner-decompose`（9.2，缺末尾 "只输出 JSON" 退出指令）。

### 3.2 智能化：容量 vs 实质（核心诚实性发现）

**`sgc metrics` 报 11/23 LLM-invokable，本身已诚实自标 "(capacity, not quality)"（`metrics.ts:173`）`[实测]`。** 但需进一步拆解：

| 类别 | 数量 | agent |
|---|---|---|
| **真正 LLM 驱动**（启发式无法等效） | **~5** | clarifier.discover · planner.ceo · planner.adversarial · researcher.history · reviewer.correctness |
| **混合**（启发式够用、LLM 可选增强） | ~6 | classifier.level · compound.{context,solution,prevention} · planner.{eng,decompose} |
| **纯启发式 / 无 LLM 路径** | 12 | 6 reviewer specialist（正则匹配）· qa.browser（stub）· compound.related（**有意确定性**保 §3）· janitor.compound（决策规则）· 3 slot-only |

**两个尖锐发现 `[读证]`：**

1. **默认环境退化为启发式**：无 `ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY` 时，11 个"LLM-backed" agent 全部回退启发式，最终 fallback 是 file-poll（人工贴 prompt）（`spawn.ts:405-487`）。"LLM-invokable" ≠ "LLM-by-default"。**且启发式与 LLM 质量差距巨大**：
   - `planner.ceo` 启发式（`planner-ceo.ts:32-56`）**永远 return approve**——零产品风险检测；LLM 路径才会 reject/revise。
   - `compound.prevention` 启发式（`compound.ts:221-225`）输出 `"Add a regression test covering the auth-category behavior…"` ——**正是 prompt 明令禁止的 boilerplate**（`compound-prevention.md:48`）。
   - `planner.adversarial` 启发式是 5 个 RISK_PATTERN 的**模板实例化**，probability/impact 硬编码；LLM 才能按 intent 推理。

2. **6 个 reviewer specialist 标 `status:implemented` 实为硬编码正则 `[读证]`**：security/performance/tests/maintainability/migration/infra 无 `prompts/reviewer-*.md`，只 `/(auth|jwt|token)/i` 之类匹配，输出 `"security-sensitive change in added line: …"`，**零语义理解**。"implemented" 用词误导，应作 "keyword-triggered/heuristic-only"。

**缺失的安全网 `[读证]`：**
- **banned-vocab 无 post-spawn 校验**（中危）：prompt 列了禁用词，但无任何代码扫描 LLM 输出并拒绝违规——完全依赖 LLM 自觉。
- **OpenRouter YAML 解析脆弱**（中危）：`openrouter-agent.ts` 严格匹配 ```` ```yaml\n…\n``` ````，LLM 漏 backtick/截断即抛非可重试错误，无恢复路径。
- **无启发式-vs-LLM 对齐测试**（中危）：两路径在同一输入上从未对比断言，可能静默 diverge。

---

## 4. 四化逐项独立复核

### 4.1 规范化 — A（最强，甚至偏保守）

`metrics.ts:31-38` 解析 `contracts/invariant-enforcement.yaml`，数 `machine_enforced===true` / 总数 = **12/13** `[实测]`。这是**最可辩护的指标**：非自评打分，每条 invariant 映射到 mechanism + enforced_at + tests 列表，`sgc doctor` check G 验证每个引用测试文件存在。分母 13 是真实不变量数，唯一排除的 §12 恰是最弱（无 runtime check）那条——即**诚实地偏低估，非高估**。
**唯一注脚**：`tests` 仅做文件存在性检查、非逐断言审计（`invariant-enforcement.yaml:17-18` 自陈），故"machine-enforced"=「有守卫 + 有测试文件」，非「已证正确」。

### 4.2 自动化 — B（达成但度量是近常量）

`metrics.ts:52-57`：`STEPS.filter(s=>!MANUAL_GATES.has(s))` over `STEPS`，均来自 `loop.ts` 硬编码数组 `[plan,work,review,qa,ship,compound]` + `MANUAL_GATES={work,ship}` = **4/6** `[读证]`。两个门是有意的人签检查点（§4），框架诚实。**但这只测"6 个 loop 槽位有几个非手动"，只在改字面量时变化，不反映真实自动化程度。**
**真实自动化故事 `[读证]`**：capture 全自动（ship-failure/red-green 文件副作用写入）；**promote 有意人工 + 多门**（`compound-promote.ts:147-156` 拒绝除非操作者手填 `prevention_seed`）；reuse 写回自动**但仅在操作者手跑 `sgc plan` 时**触发（`applied_in` 仅 L3、`surfaced_in` 仅 L2+）。`4/6` 未捕获任何这些 nuance。

### 4.3 智能化 — B−（见 §3.2）

metrics 自标 "(capacity, not quality)" 诚实。**严谨重构应报 `11 LLM-backed / 14 shipped-functional / 23 declared`** 而非塌缩为 11/23——分母含 2 个 slot-only + 1 个 manual-only roadmap 槽，稀释了比率。

### 4.4 高效化 — C+（最弱）

`metrics.ts:60-71`：`install_steps` 是**硬编码字面量 `1`**（非度量）；`runtime_node` 读 `package.json engines`（真）；`bundle_bytes` stat bundle（真，921,369 字节）`[实测]`。
- 单步安装**可辩护**（`/plugin install` 自带 bundle，bundle 确能独立 `node` 运行 `[实测]`），但是**常量、非指标**。
- ~~**TTHW（time-to-hello-world，唯一有意义的效率信号）明确未度量**~~ → **✅ 已度量（P2-4，2026-06-08）**：新增 `scripts/measure-tthw.sh`（npm pack → 净环境 install → 首命令计时）。实测 **TTHW ≈ 6.0s**（install 5.99s + 首命令 0.058s，playwright 浏览器下载 skip——浏览器是 `sgc qa --browse` 的 opt-in、非 hello-world 必需）。非 CI 门（净环境计时受环境影响），手动 `bash scripts/measure-tthw.sh`。原批评成立但已闭合。

---

## 5. 生产就绪逐项

### 5.1 错误处理与健壮性 — 扎实 `[读证]`

- **file-lock.ts**：O_EXCL `openSync(path,"wx")` 原子认领、pid-liveness 回收、age-stale fallback、幂等 release、有界 2 次重试。`file-lock.test.ts` 对真实 tmpfs 测 TOCTOU/dead-pid/stale/idempotent。缺口：无双真实进程并发测试（但 O_EXCL syscall 级原子，可接受）。
- **retryWithBackoff / isTransientLlmError**（`spawn.ts:99-140`）：指数退避 ±20% jitter，408/409/429/5xx/AbortError 可重试、400/404/parse/auth 正确 fatal、默认 2 次、`llmMaxRetries:0` opt out。健全。
- **未发现无防护的 partial-write 或 race 路径。**

### 5.2 测试质量 — 多数真实、非 theater `[读证]`

抽样 file-lock/spawn-interrupt/ce-loop-e2e/dedup 均回归驱动、对真实 I/O 有意义断言。`ce-loop-e2e.test.ts` 是真正的跨链契约测试。**但**：11 个 `tests/eval/*-llm.test.ts` **并非全 live-LLM**——`classifier-llm.test.ts` 测的是启发式 + manifest 结构，无 LLM；`-llm` 后缀**夸大了 LLM 覆盖**。

### 5.3 CI / 发布 — 健全，带 2 个已知问题 `[读证]`

- `publish.yml`：tag 触发、验 tag==version、bundle-parity（`git diff --exit-code`）、`SGC_FORCE_INLINE=1 bun test tests/dispatcher` 门、`--provenance` 发布。健全。
- **已知问题 1（test-lane 分裂）**：`npm test`/publish.yml 只跑 `tests/dispatcher`，`test.yml` 跑 dispatcher+eval。改共享 setup 可过发布门却红 push 门（记忆 `feedback_sgc_test_lane_divergence`）。仍在。
- **已知问题 2（provenance-403）**：`--provenance` 双 PUT 撞 E403，CI 红但版本已活；核对 `npm view @ver dist.shasum` 判假阴性。架构性、未修。
- **脆弱点**：CI LLM-smoke 须 pin `sonnet-4`，因默认 opus 会幻觉 manifest-未声明字段触发 §9 fail——eval 断言校准到单一模型，model drift 会红。

### 5.4 供应链 / 安全 — 干净 `[实测+读证]`

- **依赖**：4 prod（`@anthropic-ai/sdk`/`citty`/`js-yaml`/`playwright`）+ 3 dev，`npm audit` **0 漏洞**。
- **密钥**：`OPENROUTER_API_KEY` 仅用于 `Authorization: Bearer` header（`openrouter-agent.ts:131`），错误路径只 slice response body、**从不进 log/error**。已验证无泄漏。
- **子进程**（`subprocess.ts`）：`spawn`/`spawnSync` 显式 argv 数组（无 shell 字符串插值 → 无注入）、never-rejects 契约。干净。

---

## 6. 发现清单（分级 + 证据 + 建议）

### P0 — 会绊到真实贡献者，应优先修

**P0-1：`SGC_FORCE_INLINE=1` 不抵消已存在的 API key（测试 flaky + 真实计费）`[实测]`**
- 现象：dev shell 有 live `OPENROUTER_API_KEY` 时，`bun test tests/eval` → **19 fail**；`SGC_FORCE_INLINE=1 bun test tests/eval` → 仍 **3 fail** 且每测 ~18.7s。失败者 `clarifier-discover-llm.test.ts:24,69` 的 skip 门是 `test.skipIf(!HAS_KEY)`、只看 key 存在、不看 inline flag，且 `spawn()` 未传 inlineStub → 路由到 live LLM、`expect(...).toContain(hint)`（:118）因模型漂移失败。key 未设时同文件 4 skip / 0 fail / 48ms 干净。
- 影响：任何 env 里有 `OPENROUTER_API_KEY` 的贡献者/CI runner 跑普通 `bun test` 会得非确定性、慢、**真实花钱**的失败，而文档承诺的确定性开关 `SGC_FORCE_INLINE` 不保护他们。CI 靠不给 key 绕过——foot-gun 真实且未文档化。
- **建议**：让 eval skip 门同时尊重 `SGC_FORCE_INLINE`（forced inline 时 skip live 测试）**或**传 inlineStub，让确定性开关名副其实。

### P1 — 诚实性 / LLM-visible metadata 漂移，应修

**P1-1：`plugins/sgc/CLAUDE.md` 陈旧且含明确错误声明（LLM-visible metadata）`[读证]`**
- `plugins/sgc/CLAUDE.md:15` 状态头停在 **v1.20.0**（当前 v1.29.1）；`:166` 写 L2 reviewer cluster "6 manifested for forward-compat but **not yet wired**"——但 `review.ts:259-266` 证明 L2+ 确已 spawn `reviewer.tests` + `reviewer.maintainability` + specialists（Phase 2c，v1.27/1.28）。该文件是 **steers Claude Code 的 LLM-visible metadata**，含过时错误声明会误导路由。命令计数亦漂移（CLAUDE.md 19 vs sgc.ts:10 报 20）。
- **建议**：刷新状态头到 v1.29.1，删除"not yet wired"，统一命令计数；纳入 `sgc doctor` 一个 "CLAUDE.md 状态头 ≤ 当前 version" 的漂移守卫。

**P1-2：reviewer specialist 与 compound 启发式的"implemented"用词误导 `[读证]`**
- 6 个正则 reviewer 标 `status:implemented`（`sgc-capabilities.yaml:370-376`）易被读作语义评审。
- **建议**：status 改 `keyword-triggered` / `heuristic-only`，与 §3.2 的诚实拆解一致。

**P1-3：智能化"融合"对外措辞偏强 `[读证]`**
- planner cluster 是集成投票 + 约束（§2.2），非语义融合；README/ROADMAP 的"融汇贯通/fusion"宜降为"多视角聚合 + 不变量约束"。

### P2 — 增强 robustness / 可信度，建议做

| 编号 | 发现 | 证据 | 建议 |
|---|---|---|---|
| P2-1 | banned-vocab 无 post-spawn 强制 | §3.2 `[读证]` | 加强制扫描 LLM 输出、命中 raise `OutputShapeMismatch` |
| P2-2 | OpenRouter YAML 解析无恢复路径 | `openrouter-agent.ts` `[读证]` | 加 fallback：去 backtick → 取最长 YAML 子串 |
| P2-3 | 无启发式-vs-LLM 对齐测试 | §3.2 `[读证]` | 加 `assertLlmAndHeuristicAlign(X)` 关键 agent |
| P2-4 | 高效化 TTHW 未度量 | §4.4 `[实测]` | 加 CI 净环境 TTHW 计时步；`install_steps` 去硬编码 |
| P2-5 | 自动化指标是近常量 | §4.2 `[读证]` | 改为"每闭合任务的真实人工干预数"（跑真实 loop 计数） |
| P2-6 | `PRODUCTION-READINESS-AUDIT.md` 无回填标记 | §7 `[读证]` | 给已修 P0/P1 项加 `✅ RESOLVED` 内联标记 |
| P2-7 | fingerprint 缓存 embedded 场景 latent | §2.2 `[读证]` | embedded 用法加 stateRoot 切换失效钩子（CLI 不受影响） |
| P2-8 | `plan --async` 返回合成 L0 | `sgc.ts:~216` `[读证]` | 返回 `level:"pending"` 或真实占位，别谎报 L0 |

---

## 7. 与既有自评文档的差异（哪些已陈旧）

| 文档 | 新鲜度 | 判定 |
|---|---|---|
| `CAPABILITY-ABSORPTION-AUDIT.md` | 活跃回填（`✅ RESOLVED` 标记，基线 v1.18.0） | 与代码一致、可信；但版本基线落后当前 |
| `PRODUCTION-READINESS-AUDIT.md`（2026-06-01） | **静态快照，无回填标记** | P0/P1 项在代码中**已修**（v1.22/1.23），但文档读起来仍 open——**易误导**。6/6 spot-check 确认已修（ALG-1 `dedup.ts:99`、STAB-1 `file-lock.ts:67`、CE-2 `preventions.ts:106` 等）`[读证]` |
| `plugins/sgc/CLAUDE.md` | **陈旧（v1.20.0 头 + "not yet wired" 错误）** | 见 P1-1，应修 |
| `ROADMAP.md` / `POSITIONING.md` | 当前（v1.29.x） | 与代码一致 |

---

## 7.5 修复落实状态（本次 session，2026-06-08，按 §8 推荐顺序）

> 实测基线：fix 前全套 `1195 pass / 0 fail`；fix 后 `1208 pass / 38 skip / 0 fail`（100 文件，132s）· tsc exit 0 · `sgc doctor` 源码 64 OK / bundle 32 OK / 0 fail · bundle parity 绿。

| 编号 | 状态 | 落实 | 证据 |
|---|---|---|---|
| **P0-1** | ✅ RESOLVED | eval skip 门改为尊重 `SGC_FORCE_INLINE`：新增 `eval-helpers.ts` `hasLiveLlmKey()`（key 存在但 forced-inline → 不跑 live），9 个 `*-llm.test.ts` 改用它 | 复现 `SGC_FORCE_INLINE=1` clarifier eval：fix 前 1 fail/71.8s → fix 后 4 skip/66ms；全 eval lane `69 pass/38 skip/0 fail/306ms` |
| **P1-1** | ✅ RESOLVED | `plugins/sgc/CLAUDE.md` 状态头 v1.20.0→v1.29.1、删 "not yet wired"（改为 L2+ cluster 已 wire + honest depth note）、命令计数 19→20；新增 `sgc doctor` check (L) `statusHeaderFreshness`（header 落后 package.json → warn）防复发 | `doctor-status-header.test.ts` 7/7（含 v1.20→v1.29 回归用例）；doctor 63→64 OK |
| **P1-2** | ✅ RESOLVED | manifest reviewer cluster 加诚实注释：`prompt_path:null`=启发式/keyword 匹配、`status:implemented`=functional 而非 LLM-backed（保留 status 语义、不破 6 个 capabilities 测试） | `sgc-capabilities.yaml:368-377` |
| **P1-3** | ✅ 已诚实，无需改 | 核验 README 无 fusion 过度措辞、`POSITIONING.md:62-64` 已写 GS-3 "deterministic … no LLM"；"融汇贯通"是刻意愿景（§2.1 认同产品级融合真实），不误伤 | `POSITIONING.md:62-64` |
| **P2-1** | ✅ RESOLVED | banned-vocab post-spawn 强制：纯函数 `detectBannedVocab()`（letter-boundary，"robust"≠"robustness"；CJK 子串）+ spawn.ts **非阻塞 warn 事件** `output.banned_vocab`（绝不 reject，避免假阳性破坏有效 plan/review） | `banned-vocab.test.ts` 6/6；`validation.ts` + `spawn.ts:816` |
| **P2-2** | ✅ RESOLVED | OpenRouter `extractYamlBlock` 加分层恢复：tagged yaml fence → 裸 ``` fence（丢 language tag，最常见）→ 未闭合 fence 剥离 stray 行。导出可测 | `openrouter-extract-yaml.test.ts` 5/5 |
| **P2-4** | ✅ RESOLVED | TTHW 计时脚本 `scripts/measure-tthw.sh`（本地实跑验证）；实测 TTHW ≈ **6.0s** | 见 §4.4 |
| **P2-6** | ✅ RESOLVED | `PRODUCTION-READINESS-AUDIT.md` 顶部加回填横幅：v1.21.0 的 P0/P1/P2 全部 SHIPPED（v1.22/1.23/1.23.1），保留原 §8 作历史 | 该文档顶部 |
| **P2-7** | ✅ RESOLVED | fingerprint 缓存：`writeSolution`（§3 写入门）写后调 `clearFingerprintCache()`，in-process 复用不再 leak-check 陈旧语料；+ 导出 `invalidateFingerprintCache()` 精确 hook | `fingerprint-invalidate.test.ts` 2/2 |
| **P2-8** | ✅ RESOLVED | `runPlan` 返回 `level?` 改可选，async-parent 分支省略（不再谎报 `L0`）；loop.ts 消费点加注（sync 路径必有 level） | tsc + plan/loop 套件绿 |
| **P2-3** | ⏸ DEFERRED | 启发式-vs-LLM 语义对齐：高价值形态（语义一致）天然非确定性、不适合确定性 CI 门。注：schema 兼容性已被 inline-stub 测试 + `validateOutputShape`（spawn.ts:793 所有模式）覆盖 | — |
| **P2-5** | ⏸ DEFERRED | 自动化指标重设为"每闭合任务真实人工步数"：属 **LLM-visible 四化 metric 的定义变更（L3 敏感）**，不单方面改产品自评数字；局限已在 §4.2 文档化，留作 deliberate 决策 | — |

**未 ship**：以上为实现 + 验证，未 commit / tag / publish（sgc 走 main-direct + `v*` tag → publish.yml）。改 `src/` 已 `npm run build:cli` 重建并提交 bundle 至工作树（parity 绿）。

---

## 8. 总评与路线建议

### 总评

sgc 已是一个**已发布、工程纪律扎实、知识闭环真实、契约护栏严谨**的独立工程超级插件。**在其声明范围内（CLI 工程脊柱 + 知识引擎），它达到生产级使用水平**：类型干净、CI 路径零测试失败、零依赖漏洞、无密钥泄漏、健壮性原语有真实 I/O 测试支撑。

但要诚实回答"四化"：
- **规范化是真旗舰**（A），可辩护、可度量、甚至偏保守。
- **自动化、智能化、高效化达成度递减**：自动化的人工门是有意设计但度量偏弱（B）；智能化容量足够、**但默认环境退化为启发式、且最有价值的几个 agent（planner.ceo/adversarial）启发式近乎无效**（B−）；高效化装机真实、但**核心效率指标 TTHW 自认未度量**（C+）。

最重要的产品判断：**sgc 的真实价值在"确定性的规范化脊柱 + 复利知识引擎"，而非"智能融合"。** 它最强时是一个**永不松懈的工程协议执行器**；它最被高估时是被描述成"语义融汇贯通的智能体"。把对外叙事校准到前者，是这次审核给的最高价值建议。

### 推荐落实序（recommend-first）

1. **先修 P0-1**（`SGC_FORCE_INLINE` 失效）——唯一会真正绊到贡献者、且涉及真实计费的缺陷，1 行 skip 门改动。
2. **再修 P1-1/P1-2/P1-3**（LLM-visible metadata 漂移 + "implemented"误导 + "fusion"措辞）——诚实性/E-E-A-T，低成本高信誉回报；P1-1 顺手加 doctor 漂移守卫。
3. **P2 增强按需**：P2-1（banned-vocab 强制）与 P2-3（启发式-vs-LLM 对齐测试）对"智能化可信度"杠杆最高；P2-4（TTHW 计时）让高效化声明可辩护。
4. **战略层**：接受"替代而非委派 = 永久背上游 staleness 债"这一已知成本（吸收稳定模式、别吸收会 churn 的实现）——这与 ROADMAP 既定方针一致。

---

## 附录：审核证据索引（file:line）

- 硬指标：`bun src/sgc.ts doctor`（63/0/0）· `bun test tests/dispatcher tests/eval`（1195/38/0）· `tsc --noEmit`（exit 0）· `npm audit`（0）
- 不变量强制：`contracts/sgc-invariants.md §1-§13` · `contracts/invariant-enforcement.yaml` · `metrics.ts:31-38`
- 融合语义：`fuse-plan.ts:136-162`（worst + high/high 覆盖）
- 智能化拆解：`spawn.ts:405-487`（mode 路由）· `planner-ceo.ts:32-56`（启发式永 approve）· `compound.ts:221-225`（boilerplate）· `sgc-capabilities.yaml:370-376`（reviewer status）· `metrics.ts:173`（"capacity, not quality"）
- 四化度量：`metrics.ts:31-71` · `loop.ts:40-56`（STEPS/MANUAL_GATES）· `compound-promote.ts:147-156`（promote 人工门）
- 健壮性：`file-lock.ts:67` · `state.ts:128-147,599-631` · `spawn.ts:99-245`
- P0：`tests/eval/clarifier-discover-llm.test.ts:24,69,118`
- 文档漂移：`plugins/sgc/CLAUDE.md:15,166` vs `review.ts:259-266`
- 安全：`openrouter-agent.ts:131-168` · `subprocess.ts` · `package.json` deps

> 审核原则：所有结论以代码 / 实测命令输出 / contracts 为权威；README/POSITIONING 作 intent 参照、凡声明经源文件交叉核验。证据强度已逐条标注（`[实测]`/`[读证]`/`[推断]`）。
