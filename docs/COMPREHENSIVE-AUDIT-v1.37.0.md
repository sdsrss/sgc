# SGC 全面审核报告 — 基线 v1.37.0

> 审核日期：2026-07-16 · 审核版本：v1.37.0（head `d0e0c2e`，package.json/plugin.json 均 1.37.0）
> 审核范围：架构 · 模块 · 编排流程 · 算法 · 代码质量与安全 · 测试与工程化 · 四化 · 生产级就绪
> 方法：主会话新鲜验证（typecheck / 全量测试 / doctor 双通道）+ 5 个并行深度审计代理（架构 / 编排 / 算法 / 质量安全 / 测试与生产就绪），全部发现带 `file:line` 证据；两个 HIGH 级发现由主会话**独立复现**后才收录。
> 前序审核：`PRODUCTION-READINESS-AUDIT.md`（v1.21.0）→ `COMPREHENSIVE-AUDIT-v1.29.1.md` → `COMPREHENSIVE-AUDIT-v1.31.8.md` + 整改路线图（27 修 + 1 误报，100% 收口）。本轮**不重复报告已修项**；对声称已修项做了 5/5 抽查（见 §6.4）。

---

## 0. 执行摘要

**本轮实测健康基线（2026-07-16 当日新鲜证据）**：

| 指标 | 数值 | 命令 |
|---|---|---|
| 类型检查 | **EXIT 0** | `npm run typecheck`（tsc --noEmit） |
| 全量测试 | **1557 pass / 38 skip / 0 fail**（4410 断言，130 文件，139.29s） | `SGC_FORCE_INLINE=1 bun test tests/` |
| doctor（dev 源码模式） | **70 OK · 1 warn · 0 fail**（warn = 本机 bun 1.3.11 ≠ CI 锁定 1.3.5，bundle-hash 判定不可用——按设计如实报告，非缺陷） | `bun src/sgc.ts doctor` |
| doctor（npm bundle 模式） | **39 OK · 0 warn · 0 fail**（8 项 dev/CI-only 检查自跳过） | `node plugins/sgc/bin/sgc.mjs doctor` |

**总体结论**：sgc 的工程纪律——确定性测试隔离（71/99 dispatcher 测试文件用 mkdtemp 沙箱）、真多进程锁测试、构建零漂移（build-cli 单源 + doctor parity）、5 道 agent 元数据交叉校验、异常诚实的 CHANGELOG/审计自纠错文化——**继续显著高于同类个人工具**，且 v1.31.8 整改的 28 项全部核实收口。但本轮在前几轮审核未覆盖的两个盲区找到了**4 个 HIGH 级问题**：

1. **边界输入使门自毁**（代码级，主会话已独立复现 ×2）：>1MB 的 diff 静默塌缩为空串使评审集群"审空气"（Q-1）；problem 文本 tokenize 为空时 dedup 相似度=1.0，不同知识被当重复静默合并（ALG-1）。
2. **无 LLM 降级路径下，最响亮的两个门只剩仪式**（设计级）：启发式 reviewer 结构上发不出 ship 唯一拦截的 `fail` 判定（F1）；TDD 台账 `--waive-red` 任意非空串即过、RED 证据从不执行（F2）。且评审产物不带 mode 来源（F4），启发式 pass 与 LLM pass 事后不可区分。

**一句话回答用户四问**：架构分层清楚但有一处倒置和一处竞态（§2）；编排系统**骨架科学、级别缩放真实、但降级路径的实质强制力低于其宣称**（§3）；算法总体健全、dedup 有一个真实的边界失守（§4）；已达到 **solo 开发者本地 CLI 的生产级**，未达到"无人值守自动化门禁"与"多并发写入"的生产级（§8）。

---

## 1. 架构与模块（评级 B+）

### 1.1 架构图（实测）

```
src/sgc.ts (1019 LOC, citty CLI)
  → src/commands/* (18 文件, 5175 LOC, 薄命令层)
    → src/dispatcher/* (30 文件, 11161 LOC, 核心编排: state I/O · spawn · loop · canary · dedup · lock)
      → src/dispatcher/agents/* (15 文件, 3333 LOC, 每 agent 启发式 + LLM prompt 双路)
持久状态: .sgc/{decisions,progress,solutions,reviews}/ (markdown+YAML frontmatter)
  全部经 src/dispatcher/state.ts (1065 LOC, 24/48 源文件依赖 — 全仓最高扇入)
构建: scripts/build-cli.mjs (单源) → plugins/sgc/bin/sgc.mjs (1.0MB bundle)
  嵌入: embedded-data.ts (build-time text import, env→embedded→disk 三级读梯)
自检: src/commands/doctor.ts (1012 LOC, 14 组编号检查 A–O)
```

### 1.2 优点（实证）

- `file-lock.ts` 工程质量高：O_EXCL 独占创建、per-acquisition nonce 安全释放、`/proc/.../boot_id` 防跨重启 pid 复用误回收（`file-lock.ts:56-62`）。
- 构建零漂移**按构造成立**：`build-cli.mjs` 同时被 `npm run build:cli` 与 doctor parity 检查调用，不存在 flag 漂移空间。
- agent 元数据五道交叉校验（doctor A/B/C/N/O）使 v1.36.0 那类"接错 def"事故结构性难以复发（`agent-facts.ts:30-39` 有事故记录）。
- `writeAtomic`（`state.ts:198-217`）：唯一 tmp 名（pid.time.seq.random）+ rename + 失败清理。

### 1.3 发现

| 编号 | 级别 | 发现 | 证据 | 建议 |
|---|---|---|---|---|
| ARCH-1 | **P1（并发场景）/ P2（solo）** · CONFIRMED | `writeSolution()` 是读-改-写合并（读旧文件 → merge source_task_ids/what_didnt_work → 写回），**全链无锁**；三个可并发调用方：`commands/compound.ts:160,249`、`canary-promote.ts:276`、`compound-promote.ts:254,420`。手动 `sgc compound` 与自动 canary 促升同时命中同一 `solutions/{cat}/{slug}.md` = 经典 lost-update，后写者静默丢弃前写者的合并 | `state.ts:853-900`；grep 证实仅 logger/loop/plan-jobs 用锁 | 用 `withFileLock` 按 `solutionPath(category,slug)` 包住 `writeSolution`（照抄 loop/plan-jobs 现有模式） |
| ARCH-2 | P3 · CONFIRMED | 分层倒置：`dispatcher/loop.ts:247-251` 动态 import `../commands/{plan,review,qa,compound}` 做生产 step runner——核心层向上够 CLI 层。注入缝（`opts.steps`）已存在但生产装配没走它 | 非硬循环（反向无 import），懒加载不炸加载序 | 把 `getDefaultRunners` 装配挪到 `commands/loop.ts`，经 `opts.steps` 传入 |
| ARCH-3 | P3 · 设计关切 | `state.ts` 事实 god-module：1065 LOC、24/48 扇入、四种互斥性规则不同的状态层（immutable/overwrite/dedup-merge/append-only）同居一文件 | `state.ts:12-19` 自文档 | 按层拆 `state/{decisions,progress,solutions,reviews}.ts` + 共享 `atomic.ts`（机会性重构，非紧迫） |
| ARCH-4 | P3 · 设计关切 | `runDoctor` 1012 行单函数串 14 组检查；各检查逻辑已是独立纯函数，只剩编排臃肿 | `doctor.ts:516-1012` | 每组拆成返回 `CheckRow[]` 的函数 |
| ARCH-5 | 信息 | 新增一个 agent 触碰 4-5 个文件，成本不低但**安全**——五道 doctor 校验拦住所有跨文件错配。判定为深思熟虑的取舍，非缺陷 | doctor A/B/C/N/O | 无 |

---

## 2. 编排系统科学性（核心问题：科学不科学？）

### 2.1 流程图（实测代码路径）

```
sgc plan → classifier.level（启发式 XOR LLM，applyHeuristicFloor = max(两者)，classifier-level.ts:170）
        → researcher.history 把 Prior-art 注入 intent.md（CE 复用回灌点，plan.ts:33）
        → planner.{ceo,eng,decompose,adversarial}（≥L1）→ intent.md + feature-list.md
        → L3 写入强制 user_signature（state.ts:353，throw）
sgc work --done → 关门闸：verify_command AND（prior_red+red_output XOR waive_red）（work.ts:142-197）
sgc review → L0 拒绝；L1 仅 correctness；L2+ 全集群 + diff 触发的 specialists（review.ts:186,274）
sgc qa → L2+；stub 恒 concern 永不盖章通过（qa-browser.ts:55）
sgc ship → 真 throw 关卡：features 全 done · intent 存在 · ≥1 review · 无未覆写 fail ·
           L2+ qa 存在且非 fail · L3 拒绝 --auto（ship.ts:164-221）
        → 收尾 janitor.compound → compound 集群 → writeSolution（dedup ≥0.85 写门）
loop 编排器串全链；步骤 throw = run 失败停机（loop.ts:541-554）；评审判定不 throw——唯一硬门是 ship
```

### 2.2 机器强制 vs 咨询性（逐项核对）

| 机制 | 状态 | 位置/但书 |
|---|---|---|
| L3 计划需 user_signature | ✅ 强制（throw） | `state.ts:353` |
| L3 拒绝 `--auto` | ✅ 强制 | `ship.ts:160` |
| ship：features done / intent / review 存在 / qa 存在（L2+） | ✅ 强制（throw） | `ship.ts:164-210` |
| ship 拦截 verdict=fail（无覆写时） | ✅ 强制 **但启发式模式下形同虚设** | `ship.ts:187` → F1 |
| 分级下限 max(heuristic,llm) | ✅ 强制 | `classifier-level.ts:175` |
| 级别→门缩放（评审集群/qa/签名） | ✅ 强制 | `review.ts:240`, `ship.ts:204` |
| 关门闸 `--verify-command` | ⚠️ 仅记录，**从不执行** | `work.ts:142` |
| TDD 台账 prior-RED / --waive-red | ⚠️ 荣誉制（自由文本，不校验不执行） | `work.ts:152-197` → F2 |
| §5 覆写"人类签名" | ⚠️ 只查 reason≥40 字符，`by` 字段不校验 | `ship.ts:190` → F3 |
| §1 solutions 失忆 + 输出泄漏扫描 | ✅ 强制 | `review.ts:143`, `spawn.ts:331,829` |
| §8 scope tokens（LLM 子代理） | ⚠️ 咨询性（P1-2 后已如实声明） | `invariant-enforcement.yaml:66` |
| §12 评估框架 | 流程性（12/13 的声明正确） | `invariant-enforcement.yaml:97` |
| spawn 超时/信号收割/子进程清理 | ✅ 强制且健壮 | `spawn.ts:150-252`（本轮 F7 专项核查无僵尸/无静默降级） |

### 2.3 发现

- **F1 [HIGH · 设计级]** 无 LLM 时正确性/QA 门**惰性化**：全部启发式 reviewer 只能发 pass/concern（`reviewer-correctness.ts:48`、`reviewer-specialists.ts:59`、`reviewer-quality.ts:78,120`），qa stub 恒 concern（`qa-browser.ts:55,70`），而 ship 只拦 `fail`（`ship.ts:187,211`）。**失败场景**：L2 改动带真实空指针，无 API key 评审 → 至多 concern → ship 放行。系统宣称"独立正确性评审 + QA 门"，降级模式下门只验证"报告存在"。**建议**（三选一）：启发式高危发现升 `fail`；或 concern 超阈值即拦；或 ReviewReport 记 mode，L2+ 拒绝仅凭启发式评审过门。
- **F2 [HIGH · 设计级]** TDD 台账可平凡绕过：`--waive-red "x"` 任意非空串即过（`work.ts:152-171`）；`--prior-red "a" --red-output "b"` 两个自由文本即过且从不执行；`verify_command` 记录不执行（`work.ts:142`）。代码注释对此诚实，顶层"enforced TDD gate"话术超卖。**建议**：waive 理由非平凡校验 + waive 率进 metrics + ship 统计 waived vs anchored。
- **F3 [MEDIUM]** fail 覆写只查 `reason.length≥40`，签名人 `by` 可为空（`ship.ts:190,214`，类型 `types.ts:186`）——无头 loop 可自我覆写失败评审。对比 L3 计划有真签名门（`state.ts:353`），不对称。**建议**：强制非空 `by` 并与 §4 签名机制对齐。
- **F4 [MEDIUM]** ReviewReport/QaReport **无 mode/engine 出处字段**：spawn 把 mode 写进 §13 事件流但产物和 ship 门都不读。启发式 pass 与 LLM pass 在盘面上不可区分——这正是 M3/P3-2 在描述层反复整治的"名实"问题在**运行时产物层**的再现。**建议**：产物盖 mode 戳 + 降级判定可视弱化。
- **F5 [MEDIUM]** 启发式分级器对**无关键词的复杂任务**盲：结构性大改若不含 L2/L3 触发词则落 L1（`classifier-level.ts:137`），下游评审集群/qa/签名门全部解除。floor 防的是 LLM 低报，防不了启发式自身盲区。**建议**：floor 引入结构信号（文件数/diff 规模）或分歧时要求人工确认级别。
- **F6 [已修复确认]** 历史 1..19 行 diff 死区（mem #10346）已消除：阈值变为注入参数 + fail-safe（`janitor-compound.ts:89-93`），且只影响知识捕获（可恢复），不再影响测试绿红。无需行动。
- **F8 [LOW · 如实记录]** CE 闭环**确实闭合**（capture→promote→reuse 回灌 plan），但 `applied` 指标度量的是"显著性"（pre-mortem 回声自己输入里的引用）而非"防止了复发"——代码已如实披露（P2-7），闭环**有效性**仍无度量。

### 2.4 编排科学性裁定

**骨架是科学的**：分级下限确定性成立、级别真实缩放评审/QA/签名要求、ship 是真正会 throw 的收口关卡、spawn/§1/§13 机械健壮且自我文档异常坦诚。M1–M5 五轮整改把承重不变量都加固到位。**但项目喊得最响的两个门——正确性评审门与 RED→GREEN 台账——恰是实践中最弱的两个**：默认无 LLM 路径下前者结构性发不出唯一会被拦的判定（F1），后者接受任意非空豁免串（F2），且产物无出处可暴露这种降级（F4）。结论：编排在**仪式层**（对的步骤、对的顺序、对的级别缩放）是机器强制的；在**实质层**（代码是否真的被看过、测试是否真的先红后绿），当 LLM 缺席时依赖操作者诚实。它是科学形状的脚手架，最强的正确性主张目前坐在"LLM 可用 + 操作者自律"上，而非机器检查本身。

---

## 3. 算法正确性

### 3.1 发现

- **ALG-1 [HIGH · CONFIRMED，主会话独立复现]** dedup 假合并：`similarity()`（`dedup.ts:179-188`）在某特征类两边至少一边非空时才建分量、再按在场权重归一化。但 `candProb.size===0` 有两个来源代码分不开：(a) problem 为 `""`（故意的、有测试的行为）；(b) **problem 非空但 tokenize 为空**（全停用词 / 短于 minLen / 单字 CJK——`tokenize("锁") → []`）。情形 (b) 下 problem 分量被丢弃，tags 单独裁决。**主会话复现**：`{tags:["deploy"], problem:"is a of the"}` vs `{tags:["deploy"], problem:"we go to it"}` → `similarity = 1.0`；单字 CJK 对（"锁" vs "库"）→ `similarity = 1.0`。两组**不同**知识以"完全重复"过 ≥0.85 的 §3 写门被静默合并——直接违反模块自己的规则 #2（`dedup.ts:125-127`："同 tags 决不能把两个不相关 problem 抬过门……假合并静默毁灭知识"）。现有测试全部只测字面 `""`（`dedup.test.ts:56-60`、`dedup-problem-weight.test.ts:63-73`），情形 (b) 零覆盖。**建议**：非空 problem tokenize 为空时按"不可比"处理（该分量记 0 而非弃权），或 tokenizer 对 CJK 做 bigram/单字保留；补情形 (b) 回归测试。
- **ALG-2 [MEDIUM · CONFIRMED]** 规范化指标信任自报字段：`computeStandardization`（`metrics.ts:31-38`）直接数 YAML 里 `machine_enforced === true`，不查 `tests:` 非空/文件存在——那层校验只活在 `sgc doctor` 检查 G 里，算分时不跑。"12/13" 是诚实算术套在可说谎输入上。次要：`formatScorecard` 硬编码 "4 human gates" 字符串，`MANUAL_GATES` 变更即漂移。**建议**：算分时复用检查 G 的校验（或标注"由 doctor G 背书"）；"4 human gates" 从 `MANUAL_GATES` 派生。
- **ALG-3 [MEDIUM-LOW · CONFIRMED]** §11 具体性门近乎失效：`FILE_EXT_RE = /\.[a-zA-Z0-9]{1,8}\b/` 把 `e.g.` / `U.S.` / `句号.Word` 都当"引用了具体文件"；`LINE_NUM_RE = /:\d+\b/` 接受 `12:30`（时刻）；`CONCRETE_KEYWORDS` 含 error/test/cache/null 等高频词（`rationale.ts:52-68`）。"looks simple, e.g. nothing risky" 实测通过。**建议**：文件正则要求扩展名白名单或路径分隔符；关键词表去高频词。
- **ALG-4 [LOW]** fuse-plan 关切合并丢内容：`dedupeConcerns`（`fuse-plan.ts:99-119`）升级 severity 但不更新 source/text——先到的 ceo 低危文本顶着后来 eng 结构风险的 high 帽子输出，mitigation 包装被丢。fused_verdict 不受影响，纯归因/细节 bug。
- **ALG-5 [LOW]** canary 未知 phase 静默通过：phase 循环 if/else-if 无兜底 else（`canary.ts:253-331`），联盟外字符串跳过即算过。§9 并行路径完备性的教科书反例，低危因 phase 由 CLI 解析。
- **ALG-6 [LOW · 文档已认]** applied-tracker 的 mtime "CAS" 是 TOCTOU + mtime 粒度盲（`applied-tracker.ts:213-260`），且未用仓内现成 file-lock。自文档低争用，真实但低危。
- **ALG-7 [LOW · 文档已认]** specialist 无界词 substring 误报进**报告**（不只是多派发）：`auth`→"author"、`helm`→"overwhelm"（`reviewer-specialists.ts:76-90,173-188`），`+ const cargo` 会产出 high severity infra finding。噪音级。

### 3.2 模块健全性表

| 模块 | 裁定 |
|---|---|
| dedup.ts | **边界失守**（ALG-1，唯一会静默毁数据的项） |
| fingerprint.ts / preprocessor.ts / validation.ts / schema.ts / preventions.ts | 健全（限制已文档化；无 ReDoS） |
| fuse-plan.ts / canary.ts / canary-promote.ts / applied-tracker.ts | 判定逻辑健全，各带一个 LOW |
| metrics.ts | 算术诚实、规范化输入不可验证（ALG-2） |
| rationale.ts | 门近乎失效（ALG-3） |
| reviewer-specialists.ts / terms.ts | 正则正确且结构钉死；误报文档内接受 |

---

## 4. 代码质量与安全

### 4.1 安全姿态（逐项核验，全部干净）

- **命令注入**：全部 argv 数组无 shell；`cso.ts` 仅有的两处 execSync 字符串是硬编码常量。P1-1（`--base` RCE）修复在位且带事故注释（`review.ts:75-81`）。
- **秘密**：事件日志只记计数（prompt_chars/token）不记内容；key 只进 Authorization 头/SDK env；错误路径不带头；第三方外发每进程披露一次（P2-11）。
- **TLS**：无任何弱化（grep 空）。**js-yaml**：v4 安全 load + CE-2 注入中和（`preventions.ts:94-110`）。
- **路径**：taskId 是内部 UUID；slug 白名单 `[a-z0-9-]`；category 允许表校验（`state.ts:717,237-244`）。CLI 面无操作者字符串进 path resolve。
- **prompt 不进 /proc cmdline**（P2-10 stdin 化在位）。

### 4.2 发现

- **Q-1 [HIGH · CONFIRMED，主会话独立复核]** >1MB diff 静默塌缩为空、评审门自解除：`spawnCaptureSync`（`subprocess.ts:50-63`）不设 `maxBuffer` → Node spawnSync 默认 1MiB → 溢出置 `r.error`（ENOBUFS）→ 适配层返回 `exitCode:-1` → `captureDiff`（`review.ts:82-85`）把**一切非零退出映射为 `""`** → 空 diff 无守卫直通 `spawn("reviewer.correctness",{diff})`（`review.ts:199-212`）→ 全体 reviewer 审空气返回 pass。**最需要评审的大改动恰好是门失明的改动**，且"capture 失败"与"没有改动"不可区分。全 src 无一处设 maxBuffer（grep 空）。**建议**：显式大 maxBuffer + captureDiff 区分失败/空 + review 对捕获失败硬 fail。
- **Q-2 [MEDIUM · PLAUSIBLE]** UTF-8 分块解码损坏：`stdout += c.toString()` 逐 chunk 解码（`subprocess.ts:32-33`、`claude-cli-agent.ts:108-109`），多字节序列跨 chunk 断开出 U+FFFD。最高危位点：claude-cli 返回的多 KB 中文评审 YAML 在 `yamlLoad` 前被损坏。**建议**：`Buffer.concat` 后一次解码或 `StringDecoder`。
- **Q-3 [MEDIUM · PLAUSIBLE]** 异步捕获无字节上限：同两处累加器无 cap，失控子进程（npm view --json / 异常 claude -p）可冲向 ~512MB 字符串上限。与 Q-1 互为镜像（同步撑爆 vs 异步无界）。
- **Q-4 [MEDIUM · PLAUSIBLE]** Node 内建 fetch 无视 HTTP(S)_PROXY：`openrouter-agent.ts:140,188`、`canary.ts:197`——代理环境下外发挂到 AbortController 超时而非走代理（@anthropic-ai/sdk 路径不受影响）。**建议**：undici ProxyAgent。
- **Q-5 [LOW]** 超时/收割只发 SIGTERM 无 SIGKILL 升级（`claude-cli-agent.ts:84-90`、`spawn.ts:191`）——无视 SIGTERM 的子进程可漏收割，影响有界（一个游离 claude 进程）。
- **Q-6 [LOW]** `withFileLock` 等待预算 2s 硬 throw（`file-lock.ts:199-224`），合法长临界区会让竞争者失败而非等待。
- **Q-7 [LOW · 主会话独立发现]** bundle 模式 doctor 的跳过理由在源码仓内运行时**与实际环境不符**：`repoRoot = resolve(moduleDir,"..","..")`（`doctor.ts:41`）在 bundle 下解析到 `plugins/sgc/` 而非仓库根，在仓库根跑 `node plugins/sgc/bin/sgc.mjs doctor` 时 8 项检查以 "no source checkout" 为由跳过——而 `src/sgc.ts` 就在两级之上。npm/plugin 渠道下该判定成立，故为设计边界瑕疵；但这与 v1.37.0 刚修的检查 (O) "跳过理由说谎"同类，只是发生在 root 解析层。影响低（CI 跑 dev 模式全量 70 项）。**建议**：跳过消息按 root 解析结果措辞（"running from bundle; source root not at ../.."）。

### 4.3 姿态裁定

无注入面、无泄密面、无 TLS 弱化，前几轮加固（P2-x/STAB-x/M4）全部在位且有效。唯一"反噬工具自身使命"的是 Q-1——大 diff 越过评审门，建议先修。

---

## 5. 测试与工程化

### 5.1 测试质量：强（实证）

- **行为断言非实现断言**：`sgc-ship.test.ts:60-136` 是完整负路径门矩阵（六种拒绝场景逐一 `rejects.toThrow`）；`file-lock.test.ts` 断言锁契约非内部结构。
- **v1.37.0 "洗绿"通道确认封死**：`agent-facts.test.ts:50-78` 把每条 CLI-fact 从句钉到**独立手写字面量**（非 `deriveCliFact` 自身输出）——`--write-descriptions` 再生成无法调和错映射。仓内 grep 无残余"期望值由被测代码再生成"模式。
- **隔离干净**：71/99 dispatcher 测试文件 mkdtemp 沙箱 + SGC_STATE_ROOT 重定向；无测试写真实 `~/.claude` 或项目 `.sgc/`。
- **真并发测试在位**（STAB-7 补課核实）：`file-lock-multiprocess.test.ts` fork 真实进程争锁；`state-crash-mid-write.test.ts` 随机 SIGKILL ×12 断言读者只见完整旧/新。
- **对盲区诚实**：`classifier-llm.test.ts:23-34` 断言降级启发式**会**误分类语义迁移并写明，而非粉饰。
- 未覆盖（PLAUSIBLE）：LLM 运行时错误路径（429/503/Abort 重试）偏薄；eval LLM 测试 CI 冒烟仅 2 条。**以及本轮新发现的三个未测边界：ALG-1 情形 (b)、Q-1 大 diff、F1 降级门。**

### 5.2 CI / 打包

| 级别 | 发现 |
|---|---|
| MEDIUM | 发布门弱于推送门：`publish.yml:82` 只跑 `bun test tests/dispatcher`，eval 不在 tag 时重跑（缓解：tag 落在绿 main 上） |
| MEDIUM | plugin.json↔package.json 版本步调靠注释不靠机器（`publish.yml:11,72-79` 只验 tag==package.json）；当前同为 1.37.0 |
| LOW | `sgc doctor` 本身不是 CI 门（其子检查以单测+parity 形式分别被门） |
| ✅ | bun 1.3.5 CI 锁定；Node 18 地板有真实 tarball 消费者 e2e；`npm pack` 5 文件/321kB 自足；bundle 唯一外部运行时 import 是懒加载 playwright（与 --external 一致）；干净机 `npx @sdsrs/sgc doctor` 实测可用 |

### 5.3 运维/升级

- `.sgc/` 状态**无显式 schema 版本号/迁移故事**（PARTIAL——本轮未深挖，作为条件项记录）。
- 可观测性强：doctor/status/tail/metrics/canary + §13 双层事件流 + events.ndjson 轮转（P3-9）。

### 5.4 前轮整改抽查（5/5 属实）

ALG-1 空集=0（`dedup.ts:100`）· STAB-1 O_EXCL（`file-lock.ts:94`）· CE-2 sanitize（`preventions.ts:106`）· CE-4 floor=0.5（`applied-tracker.ts:75`）· CE-1 语义澄清（`state.ts:843`）——v1.31.8 路线图 27 修 + 1 拒（有据）核实成立。

---

## 6. 四化评估（规范化 / 自动化 / 智能化 / 高质量化）

| 化 | 自报 | 本轮裁定 |
|---|---|---|
| **规范化** | 12/13 机器强制 | **大体成立、账目可靠性打折**：分子里的 `machine_enforced` 是自报字段，算分时不验（ALG-2）；且"机器强制"的强度不均——ship 六门是真 throw，而 §5 签名（F3）、§11 具体性（ALG-3）、TDD 台账（F2）是弱校验。建议把"强制强度"分级（throw / 弱校验 / 记录）后再计数 |
| **自动化** | 5/9 | 数字由编译期符号派生（结构上防漂移，v1.28 设计正确）。CE 捕获→促升链路真实自动化；发布链 CI 完整但 publish 门弱于 push 门（§5.2） |
| **智能化** | 13/23 LLM-invokable | 双路（启发式/LLM）设计本身合理且降级**不静默**（spawn 重试尽头 throw 而非偷偷降级，F7 核实）。短板是降级后**产物不留痕**（F4）+ 启发式分级盲区（F5）——智能化的诚实度好于有效度 |
| **高质量化** | 1557 测试 / 70 doctor 检查 / 五轮审计文化 | 测试与自检文化是本项目最强资产（§5.1）。缺口：本轮 4 个 HIGH 全部落在"绿测试看不见的面"——边界输入（Q-1/ALG-1）与降级路径（F1/F2），恰是历轮审计反复出现的同构盲区 |

---

## 7. 生产级就绪裁定

| 使用形态 | 裁定 | 依据 |
|---|---|---|
| **solo 开发者本地 CLI（当前实际形态）** | ✅ **生产级，可持续发布**（带条件） | 1557/0 绿 + 70/0 doctor + CI 门控 + 5 文件自足分发 + 干净机实测。条件：修 Q-1（大 diff 门失明会在日常真实发生——大型重构就是 >1MB diff 的日子） |
| **"知识引擎"价值主张** | ⚠️ 有保留 | ALG-1 假合并会静默毁知识（触发频率取决于短/CJK problem 摘要的占比）；`applied` 度量显著性非防复发（F8，已如实披露） |
| **无人值守自动化门禁（无 LLM / CI 里跑 loop）** | ❌ 未达 | F1+F2+F3 三连：降级评审发不出 fail、waive 任意串即过、覆写无签名人——无人值守时这三个洞连成一条免检通道 |
| **多并发 / 团队共享写入** | ⚠️ 未达 | ARCH-1 writeSolution 无锁 RMW；ALG-6 applied-tracker TOCTOU。锁原语已具备，只差采用 |

---

## 8. 优先级修复清单

**P1（先修，均有独立复现或代码级确证）**
1. **Q-1** `captureDiff` 大 diff 塌缩：设 maxBuffer + 区分"失败/空" + 捕获失败硬 fail（`subprocess.ts:50` / `review.ts:82`）。验收：构造 >1MB diff → review 报错而非 pass。
2. **ALG-1** dedup tokenize-空假合并：非空 problem tokenize 为空按不可比处理 + CJK 处理 + 情形 (b) 回归测试（`dedup.ts:179`）。验收：本报告两组复现输入 similarity < 0.85。
3. **F4→F1** ReviewReport/QaReport 盖 mode 戳，ship 在 L2+ 对"仅启发式评审"给出可见降级（拦截或显式放行记录）（`types.ts` / `ship.ts:187`）。
4. **ARCH-1** `writeSolution` 上锁（`state.ts:853`，模式照抄 loop）。

**P2**
5. **F2** waive-red 非平凡校验 + waive 率可观测（`work.ts:152`）。
6. **F3** 覆写强制非空 `by`（`ship.ts:190,214`）。
7. **F5** 分级 floor 引入结构信号（`classifier-level.ts:137`）。
8. **ALG-2** 规范化算分复用 doctor G 校验；"4 human gates" 派生化（`metrics.ts:31`）。
9. **Q-2/Q-3** 流式解码 Buffer.concat + 输出字节 cap（`subprocess.ts:32`、`claude-cli-agent.ts:108`）。
10. **Q-4** fetch 走 ProxyAgent（`openrouter-agent.ts:140`、`canary.ts:197`）。
11. CI：publish 补 eval（或断言 tag 落绿 run）+ plugin.json 版本机器锁（`publish.yml`）。

**P3（机会性）**
12. **ALG-3** rationale 门收紧 · **ALG-4** fuse-plan 合并保内容 · **ALG-5** canary 兜底 else · **ALG-7** matcher 词界 · **Q-5** SIGKILL 升级 · **Q-6** 锁等待可配 · **Q-7** bundle doctor 跳过措辞 · **ARCH-2** 分层倒置归位 · **ARCH-3/4** state/doctor 拆分 · `.sgc/` schema 版本号故事。

---

## 9. 方法论与局限（如实声明）

- 5 个并行深度代理分维审计；**两个 HIGH（Q-1、ALG-1）由主会话独立复现后收录**（ALG-1 以真实模块 bun 运行复现 similarity=1.0 ×2；Q-1 以代码路径逐行核对确认）。设计级 HIGH（F1/F2）核对了全部引用行号的代码但未做端到端演练。
- MEDIUM/LOW 中标注 PLAUSIBLE 的项（Q-2/Q-3/Q-4 等）由代码路径推理支撑，未逐一动态复现。
- 本轮未覆盖：LLM 在线路径的实际质量（eval 集只在有 key 时跑）、`.sgc/` 跨版本升级实测、Windows 平台行为。
- 审计代理的发现经过与前三轮审核报告 + 整改路线图的**去重核对**，本报告不含已修项的重复报告；F6 为"前修确认仍在位"的正向记录。
