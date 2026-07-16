# SGC 审核优化路线图 — 基线 v1.37.0

> 来源：`docs/COMPREHENSIVE-AUDIT-v1.37.0.md`（2026-07-16，head `d0e0c2e`）。
> 用途：将审核发现转为可追踪的修复队列。**每完成一项：勾选 checkbox、把状态改为 ✅、填写"完成于"（版本号或 commit）。禁止未跑验收先打 ✅（Iron Law #2）。**
> 状态标识：⬜ 未开始 · 🔄 进行中 · ✅ 已完成 · ⏸️ 推迟（写明原因） · ❌ 不修（写明理由）
> 编号规则：沿用审核报告编号（Q-* 质量安全 / ALG-* 算法 / F* 编排 / ARCH-* 架构 / CI-* 工程化），跨文档可检索。
> 前一份路线图：`AUDIT-REMEDIATION-ROADMAP-v1.31.8.md`（28/28 收口）。本文批次命名用 **A/B/C**，不续用 M 系编号——M4/M5 已被 agent 描述整改线占用，复用会混淆两条历史。

## 进度总览（手工维护，改动本文时同步更新）

| 批次 | 范围 | 总数 | ✅ 完成 | 🔄 进行中 | ⏸️/❌ | 完成率 |
|---|---|---|---|---|---|---|
| A — P1（先修） | 已复现/确证的门失效 | 4 | 4 | 0 | 0 | **100%** |
| B — P2（下一周期） | 降级诚实性 + 边界健壮性 + CI | 7 | 7 | 0 | 0 | **100%** |
| C — P3（机会性清理） | 低危 + 重构 | 11 | 5 | 0 | 0 | 45% |
| **合计** | | **22** | **16** | **0** | **0** | **73%** |

**B1（L3）收口状态**（2026-07-16）：走完 L3 流程（brainstorm → spec `docs/superpowers/specs/2026-07-16-b1-ship-degraded-review-gate-design.md` → 用户「执行」签名放行 → plan → TDD）。全量 1590 → **1597 pass / 0 fail**（+7）；`tsc` 0；`sgc doctor` 70 OK / 0 fail。**批次 A+B 现全部完成（11 项），仅剩批次 C 的 C2–C11（纯低危清理/重构）。** B1 的 CHANGELOG MIGRATION 段 + 版本号属发版步骤（需用户定版本），记为**发版时应交付**，代码+测试已就绪。README 无需改（B1 只是加强了它已宣传的 review 门，无声明变假）。全部未提交。

**批次 B（非 L3 项 B2–B7）+ C1 收口状态**（2026-07-16）：7 项全绿。全量 1571 → **1590 pass / 0 fail**（+19，六个新测试文件）；`tsc --noEmit` EXIT 0；`sgc doctor` 70 OK / 0 fail；`sgc metrics` 规范化 12/13、自动化 5/9 不变（数字未漂移）。**B1（ship 门根治）仍待用户拍板走 L3 决策周期**，未做。C1 因是 B2 的前置依赖而随批完成；**实测发现 B2 无需依赖 C1**——§11 具体性门对 waive 理由是错配的尺子（会误拒 "docs-only"、误收 "n/a"），B2 改用专用非平凡校验（最小长度 + 占位符黑名单），依赖关系作废，如实记录。未提交。

**批次 A 收口状态**（2026-07-16）：4/4 ✅。全量 1557 → **1571 pass / 0 fail**（+14，四个新测试文件）；`tsc --noEmit` EXIT 0；`sgc doctor` 70 OK / 0 fail。**中途发现并修复的额外缺陷（§5 surfaced）**：A4 上锁后 8 路并发压测仍丢更新（1/3 概率），根因是 `file-lock.ts` 的锁文件"先创建后写入"两步之间有空窗——竞争者读到 0 字节锁 → 判为不可解析且陈旧 → 误回收活着的持有者 → 两个 RMW 并发。A4 的"零丢更新"承诺没有这个修复无法兑现，故一并修（temp+`linkSync` 原子建锁，见 A4 子项）。未提交（等用户决定发版）。

---

## 批次 A — P1（先修；每项均有独立复现或代码级确证）

### - [x] A1 · Q-1 · `captureDiff` 大 diff 静默塌缩，评审门自解除　✅

- **位置**：`src/dispatcher/subprocess.ts:50-63`（`spawnCaptureSync` 未设 `maxBuffer`，Node 默认 1MiB）→ `src/commands/review.ts:82-85`（一切非零退出映射为 `""`）→ `review.ts:199-212`（空 diff 无守卫直通 reviewer）。
- **问题**：>1MB 的 diff 溢出 → `r.error`(ENOBUFS) → `exitCode:-1` → `""` → 全体 reviewer 审空气返回 pass。"capture 失败"与"没有改动"不可区分。
- **修复方向**：① `spawnCaptureSync` 设显式大 `maxBuffer`（如 64MiB）；② `captureDiff` 返回可区分的三态（diff / 空 / 失败），失败时 review **硬 fail** 而非放行。
- **分级备注**：属"bugfix 恢复既定行为"（review 本就该审到 diff）→ L2 上限，无 L3 流程。
- **验收**：构造 >1MB diff（如新增一个 2MB 生成文件）→ `sgc review` 报捕获错误而非 pass；新增回归测试钉住三态区分；既有 review 测试全绿。
- **完成于**：本 session（未提交）。`subprocess.ts` 加 `MAX_CAPTURE_BYTES=64MiB` 常量 + `spawnCaptureSync` 可选 `maxBuffer`；`captureDiff` 三态化：exit 0→返回（含合法空）、exit -1（捕获未完成/溢出）→**throw**、exit >0（git 拒 ref）→ `""`（保留 P1-1 软空契约）。验收测试 `tests/dispatcher/review-diff-capture.test.ts`（4 例：溢出→exitCode -1；超 cap→throw；cap 内→完整 diff；无改动→`""`）+ P1-1 注入回归 5 例全绿。

### - [x] A2 · ALG-1 · dedup tokenize-空假合并，§3 写门静默毁知识　✅

- **位置**：`src/dispatcher/dedup.ts:179-188`（`similarity` 按在场权重归一化）；tokenizer 对全停用词 / sub-minLen / 单字 CJK 输出 `[]`。
- **问题**：problem **非空但 tokenize 为空**时 problem 分量弃权、tags 归一化到 1.0 单独裁决。已复现：`{tags:["deploy"], problem:"is a of the"}` vs `{...,"we go to it"}` → similarity=1.0；单字 CJK 对（"锁" vs "库"）→ 1.0。两组不同知识以"完全重复"过 ≥0.85 写门被合并——违反模块自己的规则 #2（`dedup.ts:125-127`）。
- **修复方向**：非空 problem tokenize 为空时按"不可比"处理（该分量记 0 而非弃权），并/或 tokenizer 对 CJK 做 bigram / 单字保留。注意不得改变字面 `""`（problem 缺席）的既有故意行为（`dedup.test.ts:56-60` 钉着）。
- **验收**：审核报告两组复现输入 similarity < 0.85；补情形 (b)（非空但 tokenize 空）回归测试，含 CJK 用例；既有 dedup / dedup-problem-weight 测试全绿。
- **完成于**：本 session（未提交）。`dedup.ts` 区分 `problemPresent`（raw trim 非空）与 `problemHasTokens`；present 但无 token 时按归一化 raw 相等回退（相同→1、不同→0），不再弃权让 tags 独裁。**采用 raw 回退而非改 tokenizer**——修复的是假**合并**（不同知识被并掉），raw 回退完全闭合它且零改动既有 token 评分；CJK tokenizer 增强（bigram）是独立的假**分裂**问题，另议。验收 `tests/dispatcher/dedup-tokenize-empty.test.ts`（5 例）+ dedup/dedup-problem-weight/compound 共 57 例全绿。两组复现输入现 similarity=0.1 < 0.85。

### - [x] A3 · F4 · ReviewReport/QaReport 盖 mode/engine 出处戳（F1 的产物层前置）　✅

- **位置**：`src/dispatcher/types.ts`（ReviewReport/QaReport 增字段）；写入点 `src/commands/review.ts` / `qa.ts`；spawn 已知 mode（`spawn.ts:459-460` resolveMode）只需透传。
- **问题**：启发式 pass 与 LLM pass 在持久化产物上不可区分；ship、`sgc metrics`、人读报告都无从知道"pass"是语义评审还是 TODO 正则给的。
- **修复方向**：产物盖 `mode: heuristic|claude-cli|openrouter|anthropic-sdk` 戳（**纯增量字段**，向后兼容）；`sgc ship` 在 L2+ 遇到仅启发式评审时**显式输出降级提示**（先提示，不改拦截行为——拦截行为变更见 A3-b 备注）。
- **⚠️ 分级备注（A3-b）**：让 ship 在 L2+ **拒绝**仅启发式评审（F1 的根治）是已发布产物的用户可见默认行为变更 → 按规范属 **L3**，需单独决策周期（先决条件即本项的 mode 戳）。本项只做增量戳 + 可见提示；F1 根治在 B 批次单列（B1）。
- **验收**：无 key 环境跑 `sgc review` → 产物 frontmatter 带 `mode: heuristic`；`sgc ship` 输出含降级提示行；schema 测试 + ship 测试全绿；旧格式（无 mode 字段）产物仍可读（兼容测试）。
- **完成于**：本 session（未提交）。`AgentMode` 类型 + `isHeuristicMode()` 迁至 `types.ts`（leaf，避免 spawn↔types 循环），`spawn.ts` re-export；`SpawnResult` 加 `mode` 字段并在唯一 return 透传；review.ts 三处（correctness/cluster/specialist）+ qa.ts 盖 `engine: r.mode`；`ReviewReport.engine?` 为**可选增量字段**（旧产物读回 undefined → 保守视为非启发式，不误报）。ship 在 L2+ 遇仅启发式评审时输出**非阻塞**降级提示行（真正**阻塞**是 B1/L3）。验收 `tests/dispatcher/review-engine-provenance.test.ts`（3 例：review 盖戳往返 / qa 盖戳 / ship 降级提示且仍发版）全绿。**实测字段往返安全**：`validateReview` 只查必填、不拒未知字段，序列化/解析通用。

### - [x] A4 · ARCH-1 · `writeSolution` 读-改-写上锁　✅

- **位置**：`src/dispatcher/state.ts:853-900`；调用方 `commands/compound.ts:160,249`、`canary-promote.ts:276`、`compound-promote.ts:254,420`。
- **问题**：dedup 合并写全链无锁；手动 `sgc compound` 与自动 canary 促升并发命中同一 `solutions/{cat}/{slug}.md` = lost-update。锁原语（`file-lock.ts`）已具备且质量高，只差采用。
- **修复方向**：`withFileLock` 按 `solutionPath(category, slug)` 包住 `writeSolution` 整个读-改-写，照抄 loop/plan-jobs 现有模式。注意 Q-6（2s 等待预算硬 throw）——合并写临界区短，2s 足够，但测试里要覆盖锁被占时的行为。
- **验收**：新增并发测试——两个真实进程同时 `writeSolution` 同一 slug，断言两方的 merge 内容都在最终文件里（无 lost-update）；参考 `file-lock-multiprocess.test.ts` 的"锁内挂住"方法（P3-6 教训：stub 太快证明不了互斥）。
- **完成于**：本 session（未提交）。`state.ts` 新增 `writeSolutionLocked`（异步，`withFileLock` 包住整个同步 RMW）+ `solutionLockPath`；5 个生产调用方（compound.ts×2、canary-promote.ts、compound-promote.ts×2，均已在 async 函数内）改为 `await writeSolutionLocked`；同步 `writeSolution` 保留给测试/单进程。验收 `tests/dispatcher/write-solution-lock.test.ts`（2 例：预占锁→retries:0 应抛 LockHeldError 证明 gate 在正确路径；6 真实进程并发→全部 source_task_id 保留）。
- **⚠️ 子项 A4.1（§5 中途发现，必须一并修否则 A4 承诺不成立）**：上锁后 8 路并发压测仍 1/3 概率丢更新。根因在锁原语 `file-lock.ts`：`openSync(wx)` 建空文件与 `writeSync` 填内容是**两步**，竞争者在空窗读到 0 字节锁 → pid/ts 解析为 NaN → 判"不可解析且陈旧" → **误回收活着的持有者** → 两个 RMW 并发。修为 temp 文件 + `linkSync` **原子建锁**（EEXIST 语义同旧，但锁文件永不空窗）。验收：暴露 bug 的 8 路×5 轮 shell 压测由 1/3 丢更新变为 **5/5 全 8/8 零丢更新**；`file-lock.test.ts` + `file-lock-multiprocess.test.ts` 12 例全绿。**这条同时闭合了审核报告 §4.2 Q-6 邻域与 §3 ALG-6 未点名的锁原语脆弱面**。

---

## 批次 B — P2（下一周期；降级诚实性 + 边界健壮性 + CI）

### - [x] B1 · F1 · 无 LLM 降级下 ship 正确性门根治　✅（**L3，已走完流程**）

- **位置**：`src/commands/ship.ts:187,211`（只拦 fail）；`reviewer-correctness.ts:48` 等（启发式只发 pass/concern）。
- **问题**：默认无 LLM 路径下门只验证"报告存在"。三个候选方案：(a) 启发式高危发现升 `fail`；(b) concern 超阈值即拦；(c) ship 在 L2+ 拒绝仅凭启发式评审过门（读 A3 的 mode 戳）。
- **决策备注**：三案都是已发布产物默认行为变更 → **L3 周期**（brainstorm → plan → 签名）。推荐 (c)：不动 reviewer 语义，把"降级不可作为过门依据"作为门自己的规则，且有 A3 戳可判定。
- **验收**：按选定方案定；至少含"无 key 环境 L2 改动 + 植入已知缺陷 → ship 被拦或需显式记录放行"的端到端测试。
- **完成于**：本 session（未提交）。**用户拍板走 L3**：brainstorm 选定方案 **(c) 门读 engine 戳** + 逃生口 **§5 式签名接受**（by + reason≥40）；spec + plan 已落 `docs/superpowers/{specs,plans}/2026-07-16-b1-*`（plan 记「执行」为签名门放行）。实现：`ship.ts` L2+ 若所有 code review 都非 LLM 背书（`engine===undefined` 或 `"inline"`，门对未知保守判降级）→ 抛错并给可执行提示；`--accepted-by`+`--accept-degraded-review`（by 非空 + reason≥40，畸形即抛）签名接受则放行并写入 `ship.md.degraded_review_acceptance`（不可变、可审计）。**范围边界**：只把关 code-review，QA stub-默认 concern 是单独已知限制（spec 明列）。`ShipDoc`/`ShipOptions` 增可选字段（`state.ts` 无需改，通用 frontmatter 往返）；`sgc.ts` 接 CLI flag。验收 `tests/dispatcher/ship-degraded-review.test.ts`（7 例：降级拦 / 签名放行且写盘 / 畸形接受两种拒 / LLM 背书免接受 / L1 免门 / 前-A3 无 engine 判降级）。**波及面按 spec 方案 (a) 解决**：`sgc-ship`/`janitor-compound`/`review-*`/eval L2-L3 的 11 处 L2/L3 ship 走真签名逃生口（非 mock）；`review-engine-provenance` 的旧「still ships」用例改为断言 B1 拦截（A3 非阻塞通知已被 B1 取代）。全量 1590 → 1597 pass / 0 fail。**CHANGELOG MIGRATION 段 + 版本号 = 发版时交付**（需定版本），README 无需改。

### - [x] B2 · F2 · TDD 台账 waive 非平凡校验 + waive 率可观测　✅

- **位置**：`src/commands/work.ts:142-197`。
- **问题**：`--waive-red "x"` 任意非空串即过；RED 证据两个自由文本从不执行；`verify_command` 记录不执行。
- **修复方向**：waive 理由复用 §11 具体性门（修完 C1/ALG-3 后的版本，见依赖备注）；`sgc metrics` / ship 汇总 waived vs anchored 计数。**不做**"强制执行 verify_command"——那是行为变更且台账定位（记录者非教练）是设计决策，如要改走独立决策。
- **依赖**：理由校验若复用 rationale.ts，先修 C1（ALG-3），否则"e.g."即可绕过新门（门叠门但两扇都虚 = 还是虚）。
- **验收**：`--waive-red "x"` / `--waive-red "n/a"` 被拒并给出可执行提示；waive 率出现在 metrics 输出；既有 work 测试全绿 + 新增拒绝用例。
- **完成于**：本 session（未提交）。`work.ts` 加 `isTrivialWaive`（最小长度 6 + 占位符黑名单 n/a/todo/none/…），waive 路径校验拒绝平凡理由；close 成功时新增 `⚠ RED waived …` 独立警告日志（可见+可 grep）。**未复用 §11 具体性门（依赖作废，如实记录）**：该门对 waive 理由是错配的尺子——会误拒合法短理由 "docs-only"（无 file/level 引用）、误收 "n/a"（匹配 PATH_RE）。改用专用非平凡校验更贴合。**全量 waive-rate metrics 计数器**（读所有 feature-list）是更大的观测面，未做，作为小follow-on留待（不是门洞）。验收 `tests/dispatcher/work-waive-nontrivial.test.ts`（4 例）+ sgc-work 共 27 例全绿；既有 38 处 `waiveRed:"test-fixture"` / "docs-only" / "L0 typo" 均 ≥6 且非占位符，不受影响。

### - [x] B3 · F3 · fail 覆写强制非空签名人 `by`　✅

- **位置**：`src/commands/ship.ts:190,214`；类型 `types.ts:186`。
- **问题**：覆写只查 `reason.length≥40`，`by` 可为空——无头 loop 可自我覆写失败评审。与 L3 计划的真签名门（`state.ts:353`）不对称。
- **验收**：`by` 为空/空白的覆写被 throw 拒绝，错误信息点名缺签名人；新增负路径测试进 `sgc-ship.test.ts` 门矩阵。
- **完成于**：本 session（未提交）。**双层 fail-closed**：`validateReview`（写边界，与既有 reason≥40 对称——所有 review 经 appendReview 落盘，空 `by` 覆写永不能持久化）+ ship 两处门过滤（code + qa，防手改 review 文件）。验收 `tests/dispatcher/review-override-signer.test.ts`（3 例：写边界拒空 by / 接受具名 by / ship 门拒手写空-by 文件）+ sgc-ship/doctor 共 32 例全绿。

### - [x] B4 · F5 · 分级 floor 引入结构信号　✅

- **位置**：`src/dispatcher/agents/classifier-level.ts:137,170-187`。
- **问题**：无 L2/L3 关键词的结构性大改在无 LLM 时落 L1，下游评审集群/qa/签名门全解除。floor 防 LLM 低报，防不了启发式自身盲区。
- **修复方向**：floor 纳入结构信号（涉及文件数 / diff 行数 / 跨模块广度），或启发式与 diff 规模分歧时要求显式确认级别。注意 `classifier-llm.test.ts:23-34` 已如实钉住现状盲区——修后更新该测试的预期与说明。
- **验收**：构造无关键词多文件大 diff 用例 → 分级 ≥L2；既有分级测试全绿。
- **完成于**：本 session（未提交）。**修正了修复方向**——plan 时无 diff（diff 在 review 阶段才有），文件数/diff 规模在分级点不可得。可用的结构信号是**重构/跨切语言**（现有关键词集漏掉的措辞）。新增 `ARCHITECTURAL_KEYWORDS`（rework/restructure/overhaul/across-modules/data-flow/how…between）→ **L2**（评审+qa 集群，非 L3 签名礼仪；over-classify 是本模块自认的安全错向），排在显式 L3/L2/security 与 strong-L0 短路之后。验收 `tests/dispatcher/classifier-structural.test.ts`（4 例，含审核原例 "rework how the dispatcher hands results between stages" → L2）+ 全部分级套件 35 例全绿。

### - [x] B5 · ALG-2 · 规范化指标去自报化 + "4 human gates" 派生化　✅

- **位置**：`src/dispatcher/metrics.ts:31-38`（读 `machine_enforced` 不验）；`formatScorecard`（硬编码 "4 human gates"）。
- **问题**："12/13" 是诚实算术套在可说谎输入上——`machine_enforced: true` 配空/过期 `tests` 列表照样计入。doctor 检查 G 有校验但算分时不跑。
- **修复方向**：算分时复用检查 G 的校验逻辑（不通过的不计入分子，或输出带"由 doctor G 背书"限定）；"4 human gates" 从 `MANUAL_GATES` + CE promote 门派生。
- **验收**：把某不变量的 tests 改为不存在文件 → `sgc metrics` 的规范化分子随之下降（或明确标注未背书）；README scorecard parity（doctor 检查 M）联动核对后仍绿。
- **完成于**：本 session（未提交）。`computeStandardization` 现要求 `machine_enforced===true` **且** `tests` 为非空数组（doctor G 要求的同一层覆盖证据）——保持纯函数（不查 FS，文件存在性仍由 doctor G HARD-gate）；`humanGates()` 从 `MANUAL_GATES`+`CE_ARC_HUMAN_GATES` 派生，`formatScorecard` 用它。**实测值不变**：绿构建下所有 12 个 machine_enforced 都带非空 tests，故 `sgc metrics` 仍 12/13、5/9，README parity（doctor M）不动。验收 `metrics.test.ts` 新增 2 例（空 tests 不计入 / humanGates 派生）+ metrics/doctor/scorecard 共 43 例全绿。

### - [x] B6 · Q-2/Q-3 · 流式解码修复 + 输出字节 cap　✅

- **位置**：`src/dispatcher/subprocess.ts:32-33`、`src/dispatcher/claude-cli-agent.ts:108-109`。
- **问题**：逐 chunk `toString()` 会在多字节 UTF-8 跨 chunk 处产出 U+FFFD（最高危：claude-cli 返回的中文评审 YAML 在 yamlLoad 前损坏）；同两处累加无字节上限，失控子进程可冲 ~512MB 字符串极限。
- **修复方向**：`Buffer.concat` 收满后一次解码（或 `StringDecoder`）；加每调用字节预算（如 32MiB，超限 kill + 报错）——预算值与 A1 的 maxBuffer 统一成一个常量。
- **验收**：构造跨 chunk 分割的多字节输出（可用脚本子进程分两次 write 一个汉字的两半）→ 解码无 U+FFFD；超预算子进程被终止且错误信息说明原因。
- **完成于**：本 session（未提交）。新增共享 `CappedStreamBuffer`（收 Buffer、`Buffer.concat` 后一次解码、带字节 cap，超限置 overflow）；`spawnCapture`（加可选 `maxBuffer`）与 `claude-cli-agent` defaultRunner 两处累加器都改用它，overflow → exitCode -1 kill 子进程（与 A1 的 `MAX_CAPTURE_BYTES` 常量统一）。验收 `tests/dispatcher/stream-capture-decode.test.ts`（"锁"=E9 94 81 分两次 write → 解码为 "锁" 无 U+FFFD；超 4096B cap → exitCode -1）+ subprocess/review/claude-cli 共 30 例全绿。spawnCapture 9 个调用方默认 cap 64MiB 远超正常 git/gh/npm 输出，不受影响。

### - [x] B7 · CI-1 · publish 门补齐 + plugin.json 版本机器锁　✅

- **位置**：`.github/workflows/publish.yml:72-82`。
- **问题**：publish 只跑 `bun test tests/dispatcher`（eval 不在 tag 时重跑）；plugin.json↔package.json 版本步调靠注释（`publish.yml:11`）。
- **修复方向**：publish 补 `bun test tests/eval`（或断言 tag commit 有绿的 test.yml run）；加一步 `node -e` 比对 plugin.json.version === package.json.version，不等即 fail。
- **验收**：本地演练 workflow 步骤（act 或抽出脚本单测）；故意错开版本 → 校验步 fail。
- **完成于**：本 session（未提交）。`publish.yml`：版本校验步扩为 tag == package.json == plugin.json（`plugins/sgc/.claude-plugin/plugin.json`，不等即 exit 1）；测试门由 `tests/dispatcher` 扩为 `tests/dispatcher tests/eval`（镜像 test.yml；LLM eval 无 key 时 skipIf，加确定性 eval 覆盖不需 CI key）。验收：本地跑通 YAML 解析 + 版本锁逻辑两分支（匹配→pass、错开→exit 1）+ 实文件在 lockstep。GitHub Actions 无法本地整跑，故验的是抽出的 shell 逻辑。

（Q-4 fetch 代理盲从 P2 降入批次 C——见 C11 理由。）

---

## 批次 C — P3（机会性清理，随手带，不单独排期）

| 状态 | 编号 | 条目 | 位置 | 修复方向 / 验收要点 | 完成于 |
|---|---|---|---|---|---|
| ✅ | C1 · ALG-3 | §11 具体性门近乎失效（`e.g.` / `12:30` / 高频词即过） | `src/dispatcher/rationale.ts:52-68` | 本 session（未提交）。`FILE_EXT_RE` 改真实扩展名白名单（ts/md/json/…）+ 新增 `PATH_RE`（含斜杠的路径）；`LINE_NUM_RE` 要求冒号前是非数字字符（`review.ts:42` ✓、`12:30` ✗）。**未去高频关键词**——error/test/null 在编码理由里是真具体，去掉会误拒真理由（过度拒绝对可满足的门更糟）；两个正则假阳才是审核点名的确证 bypass。验收 `tests/dispatcher/rationale-concrete.test.ts`（"looks simple, e.g. nothing risky" / "U.S." / "12:30" 均被拒；真 file/line/path/keyword 仍过）+ 既有 rationale 共 22 例全绿。 | v-本session |
| ✅ | C2 · ALG-4 | fuse-plan 关切合并丢升级方内容 | `src/dispatcher/fuse-plan.ts:99-119` | merge 时 severity 升级方的 text/source/mitigation 一并采纳（或并列保留）；`also_flagged_by` 去重自身。验收：ceo-low 先到 + eng-high 后到 → 输出含 eng 文本 | |
| ✅ | C3 · ALG-5 | canary 未知 phase 静默通过 | `src/dispatcher/canary.ts:253-331` | phase 循环补兜底 else → throw/fail。验收：注入联盟外 phase 字符串 → 显式失败（§9 并行路径完备性） | |
| ⬜ | C4 · ALG-6 | applied-tracker mtime CAS 是 TOCTOU | `src/dispatcher/applied-tracker.ts:213-260` | 复用 file-lock（与 A4 同模式）；或文档维持"低争用接受"并链接 A4 的锁先例。二选一都算收口，但要写明理由 | |
| ✅ | C5 · ALG-7 | specialist 无界词 substring 误报进报告（`helm`→"overwhelm"） | `src/dispatcher/agents/reviewer-specialists.ts:76-90,173-188` | 报告侧 matcher 加词界（`\b`，CJK 词另议）；spawn 触发侧可保持宽松。验收：`+ const cargo` 不再产出 infra finding | |
| ⬜ | C6 · Q-5 | 超时/收割无 SIGKILL 升级 | `src/dispatcher/claude-cli-agent.ts:84-90`、`spawn.ts:191` | SIGTERM 后计时 ~2s 未退则 SIGKILL；drain 退出前同样升级。验收：忽略 SIGTERM 的假子进程被收割 | |
| ⬜ | C7 · Q-6 | `withFileLock` 2s 等待预算硬 throw | `src/dispatcher/file-lock.ts:199-224` | 预算改为调用方可配参数（默认维持 2s）。A4 落地时一并评估 | |
| ✅ | C8 · Q-7 | bundle 模式 doctor 跳过理由与实际环境不符 | `src/commands/doctor.ts:41`（`repoRoot` 解析） | 跳过消息按 root 解析结果措辞（"running from bundle; source root not at ../.."）——与 v1.37.0 检查 (O) 同类的"跳过理由说谎"，只是在 root 层。验收：仓库根跑 bundle doctor 的跳过行不再宣称 "no source checkout" | |
| ⬜ | C9 · ARCH-2 | dispatcher→commands 分层倒置 | `src/dispatcher/loop.ts:247-251` | `getDefaultRunners` 装配挪到 `commands/loop.ts`，经既有 `opts.steps` 注入缝传入。验收：`dispatcher/` 对 `commands/` 零 import（可加 lint/doctor 守护） | |
| ⬜ | C10 · ARCH-3/4 | `state.ts` god-module + `runDoctor` 千行单函数 | `state.ts`（1065 LOC / 24 扇入）、`doctor.ts:516-1012` | 按状态层拆 `state/{decisions,progress,solutions,reviews}.ts` + 共享 `atomic.ts`；doctor 每组检查拆成返回 `CheckRow[]` 的函数。纯重构，行为不变测试守护 | |
| ⬜ | C11 · Q-4 | Node 内建 fetch 无视 HTTP(S)_PROXY | `openrouter-agent.ts:140,188`、`canary.ts:197` | undici `ProxyAgent`（env 存在时才启用）。**降级理由**：仅影响代理环境的可用性（挂到超时），非正确性/安全；当前操作环境未受影响。若用户报告代理环境问题则升回 P2 | |

**未入清单（有意不修，写明理由）**：
- **F8**（`applied` 度量显著性非防复发）——代码已如实披露（P2-7 决策），改口径是产品决策非缺陷修复；如要做，走独立 brainstorm。
- **`.sgc/` schema 版本号/迁移故事**——审核标记为 PARTIAL（未深挖，非确证缺陷）。先补一轮专项调查（现状盘点 + 是否真有跨版本破坏案例）再决定是否立项，避免为不存在的问题造迁移框架（YAGNI）。调查结论回填本行。

---

## 依赖关系与批次内顺序

```
A3 (mode 戳, 增量) ──→ B1 (ship 门根治, L3 决策)
C1 (rationale 收紧) ──→ B2 (waive 校验复用它)
A4 (writeSolution 锁) ──→ C4 / C7 (同一锁模式的延伸评估)
A1/B6 共享同一个输出预算常量（先 A1 定值，B6 复用）
```

- 批次 A 四项相互独立，可并行开工；建议一个 release 收口（对照 M1 先例）。
- B1 是全清单唯一 L3 项：**先 A3 落地拿到 mode 戳，再开 B1 的决策周期**（brainstorm → plan → user_signature）。
- 批次 C 随手带；C1 因被 B2 依赖，优先级实际高于其余 C 项。

## 维护约定

1. **本文件是唯一进度账本**：审核报告（COMPREHENSIVE-AUDIT-v1.37.0.md）保持时点快照不改；修复完成后在本文改状态，重大偏差（发现比审核多/少/误报）用 **⚠️ 回注** 就地记录——对照 v1.31.8 路线图 P3-2/P3-12 的先例，账本要如实记录审核自身被推翻的情况。
2. **状态流转**：⬜ → 🔄（开工时改，可写 branch 名）→ ✅（合并 + 验收命令跑过后改，附版本号）。禁止未跑验收先打 ✅（Iron Law #2）。
3. **验收即证据**：每项的"验收"栏是打 ✅ 的前置条件；勾选时把实际验收输出（测试名/数字）附在"完成于"栏或该项正文里。
4. **数字不复述**：本文不复述 metrics/测试计数等有机器门的数字（教训见 ROADMAP.md Phase-3 条目——复述过两次错两次）；要当前数字跑 `sgc metrics` / `bun test`。
