# SGC 审核修复路线图 — 基线 v1.31.8

> 来源：`docs/COMPREHENSIVE-AUDIT-v1.31.8.md`（审核基线 `main @ 726daf4`，2026-07-15）
> 用途：将审核发现转为可追踪的修复队列。**每完成一项：勾选 checkbox、把状态改为 ✅、填写"完成于"（版本号或 commit）**。
> 状态标识：⬜ 未开始 · 🔄 进行中 · ✅ 已完成 · ⏸️ 推迟（写明原因） · ❌ 不修（写明理由，等同旧报告 accepted）
> 编号规则：沿用审核报告编号（P1-1…P1-4 / P2-1…P2-12 / P3-*），跨文档可检索。

---

## 进度总览（手工维护，改动本文时同步更新）

| 批次 | 总数 | ✅ 完成 | 🔄 进行中 | ⏸️/❌ | 完成率 |
|---|---|---|---|---|---|
| M1 — P1 安全与诚实性 | 4 | 4 | 0 | 0 | **100%** |
| M2 — P2 高杠杆组 | 12 | 12 | 0 | 0 | **100%** |
| M3 — P3 清理组 | 12 | 1 | 0 | 0 | 8%（P3-1 随 P2-3 顺带闭合） |
| **合计** | **28** | **17** | **0** | **0** | **61%** |

**M1+M2 验收记录（2026-07-15，未提交，待发版）**：
- `tsc --noEmit` exit 0
- `SGC_FORCE_INLINE=1 bun test tests/` → **1339 pass / 38 skip / 0 fail**（基线 1269 → **+70 新测试**）
- `bun src/sgc.ts doctor`（CI 锁定的 bun 1.3.5）→ **65 OK · 0 warn · 0 fail**
- `npm audit` → **0 vulnerabilities**（基线 1 moderate）
- 发布产物 CVE 实证：`grep -c maxTotalMergeKeys plugins/sgc/bin/sgc.mjs` → **3**（HEAD 的 bundle 为 0）
- 真实 Node 18.20.8 跑发布产物 → doctor **33 OK · 0 fail**（"node ≥ 18"声明首次获实证）

**M2 的共同主题**（值得记住，与 M1 的"LLM 模式下护栏退化"并列）：**绿色信号不等于证据**——测试因宿主树恰好脏得合适而通过、doctor 因 bun 版本而误报、`npm audit` 报干净而产物仍带 CVE、§3 校验 stamp 的形状却不问它是否被挣得、复用指标数的是 LLM 复读自己的输入。

> 全局验收（每个里程碑收口时跑一遍）：
> `tsc --noEmit` exit 0 · `SGC_FORCE_INLINE=1 bun test tests/` 0 fail · `bun src/sgc.ts doctor` 0 fail · `npm audit` 0 vuln

---

## M1 — P1 批次（本周期，全部为小改动，单独成一个 release）

### - [x] P1-1 · `review.ts:74` 命令注入 argv 化　✅
- **改动**：新增 `spawnCaptureSync`（`src/dispatcher/subprocess.ts`，argv 形式、soft-null 契约），`captureDiff()` 改走它；`review.ts` 不再 import `execSync`。
- **验收**：`tests/dispatcher/review-diff-injection.test.ts` 5 tests——RED 时 `;`/`&&`/`$()`/反引号 四种载荷**全部真实执行**（marker 文件被创建、`echo hi` 的输出还进了返回值）；修复后 5/5 过，marker 均未创建。既有 `sgc-review.test.ts` + `subprocess.test.ts` 无回归（合计 34 pass / 0 fail）。
- **涉及**：`src/commands/review.ts:72-78` · `src/dispatcher/subprocess.ts`
- **完成于**：_未提交（工作树）_

### - [x] P1-2 · 不变量 §8 名实对齐（采用方案 A）　✅
- **为何 A 是正确解而非省事解**（修复中确认的新论据）：LLM 子代理的工具调用发生在 **sgc 进程之外**——`claude-cli` 模式下在独立的 `claude -p` 进程里，API 模式下在服务商侧。sgc 在架构上**无法**拦截其文件访问，故方案 B 对 LLM 模式不可能实现；把承诺改成实情是唯一诚实解。方案 B 就此关闭（非推迟）。
- **改动**：`sgc-invariants.md §8` 重写——保留"spawn 时计算 + pin + 无运行时提权通道"（这些是真的），新增 "What pinned enforces, precisely"（三条机器强制：spawn 时禁止 token 拒绝 / dispatcher 掌握的输入门 / §9 shape + §1 泄漏扫描）与 "What it does NOT enforce, and why"（明示非沙箱、越进程边界不可拦截、改写复述可穿透）；点明 §3 stamp 与 §11 分级器地板锚定确定性代码正因 §8 承载不了它们。`invariant-enforcement.yaml` §8 `mechanism` 同步扩写，两份契约不再互相矛盾。
- **验收**：`bun src/sgc.ts doctor` 双源 §1–§13 对齐 ✓、§8 覆盖 ✓、machine-enforced 仍 12/13（无虚增）；README:153 既有 caveat 与新措辞一致，无需改。零行为变更。
- **涉及**：`contracts/sgc-invariants.md` · `contracts/invariant-enforcement.yaml`
- **完成于**：_未提交（工作树）_

### - [x] P1-3 · 分级器确定性下限（LLM 模式）　✅
- **改动**：`classifier-level.ts` 新增纯函数 `applyHeuristicFloor(llm, input)` = `max(heuristic, llm)`（LLM 可升不可降，对启发式输出幂等，故 inline 路径零影响）+ 导出 `LEVEL_RANK`（消除 plan.ts 的重复定义）；`plan.ts` 分类步接线该地板，升级时打印一行说明。
- **修复中发现的附加缺陷**：`plan.ts:808` 把 **raw LLM rationale** 写进 intent.md，而 frontmatter 的 level 已是 floored 值——LLM 模式下会产生"level: L3 + 论证这是 L0 的理由"的自相矛盾**不可变记录**（§2）。已改为写 floored rationale（其内嵌两个裁决，保留可审计性）。
- **验收**：`classifier-heuristic-floor.test.ts` 8 tests（含 steering-text 诱导降级、over-classify 不被降、幂等、rationale 引用双来源）+ `plan-classifier-floor-integration.test.ts` 5 tests（证明**生产路径**接线，非仅 helper 可用：LLM 说 L0 的 migration 任务实际按 L3 计划、落到不可变 intent.md、L3 门禁随之武装）。既有 `classifier-level.test.ts` / `sgc-plan.test.ts` / `heuristic-llm-schema-parity.test.ts` 无回归（合计 43 pass / 0 fail）。
- **旁证**：写集成测试时，被地板顶到 L3 的任务立刻触发 §4 人工签名门与确认门——地板确实武装了下游门禁，而非只改了个数字。
- **涉及**：`src/dispatcher/agents/classifier-level.ts` · `src/commands/plan.ts:369-380,808`
- **完成于**：_未提交（工作树）_

### - [x] P1-4 · README/ROADMAP 自动化数字 4/6 → 5/9 + 防复发　✅
- **改动**：README:120 与 ROADMAP:21 改 5/9（ROADMAP 补注为何会过期：CE 弧于 v1.29+ 进入分母）；`doctor.ts` 新增纯函数 `readmeScorecardDrift(readme, live)` + 检查 (M)，解析 README 评分卡的三个可计数化并与 `computeMetricsLive` 逐项比对（高效化是散文形态、由既有检查 K 的 baseline 覆盖，故不解析）。
- **验收**：`doctor-readme-scorecard.test.ts` 6 tests——含一个"拿真 README 比真 live metrics"的测试，RED 时精确报出 `自动化: README says 4/6, live metrics say 5/9`（与审核发现逐字吻合），修复后 6/6 过；`sgc doctor` 显示 `✓ README scorecard matches live metrics`。`sgc-doctor.test.ts` 中 bundle 模式的跳过行计数 8→9 已同步。
- **涉及**：`README.md:120` · `docs/ROADMAP.md:21` · `src/commands/doctor.ts`
- **完成于**：_未提交（工作树）_

**M1 收口状态**：CHANGELOG `## Unreleased` 段已写（四项 + 共同根因说明）。**未做**：发版（§5 hard-AUTH，待指令）；审核报告 back-annotate 横幅（按既有惯例在发版后回注，故与发版一并做）。

---

## M2 — P2 批次（下一周期，按依赖分三组）

### 组 A：发布工程（可合并为一个 release）

#### - [x] P2-3 · js-yaml CVE 出净　✅
- **实际**：`npm audit fix` → js-yaml 4.3.0，`npm audit` 现 0 vulnerabilities；锁文件根元数据同步刷新（顺带闭合 P3-1）；用 CI 锁定的 bun 1.3.5 重建 bundle。
- **过程中踩到并记录的陷阱**：`npm audit fix` 只更新了锁文件，node_modules 磁盘上仍是 4.1.1，于是 `npm audit`/`npm ls` 双双报绿而重建出的 bundle 内联的仍是**带洞代码**。`npm install` 也不修复，须 `rm -rf node_modules/js-yaml` 后重装。已存记忆 #10314。
- **验收（以产物为准，不信元数据）**：`grep -c maxTotalMergeKeys plugins/sgc/bin/sgc.mjs` → **3**（该计数器是 4.3.0 修复引入的），HEAD 的 bundle → **0**。`npm audit` → 0 vulnerabilities。
- **完成于**：_未提交（工作树）_

#### - [x] P2-2 · doctor bundle-parity 工具链敏感性　✅（**已实证，优先级上调**）
- **实际改动**：新增纯函数 `ciPinnedBunVersion(workflowYaml)`（读 `.github/workflows/test.yml` 的 `bun-version`）与 `bundleStaleSeverity(localBun, ciBun)`；hash 不符时先比对工具链——版本相同→仍 fail；版本不同→warn 并指明"用 bun X.Y.Z 才能判定、**别照旧重建提交**"。任一侧版本未知→保守回退 fail（读不到不等于清白）。
- **验收**：`doctor-bundle-toolchain.test.ts` 8 tests；实测本机 bun 1.3.11 下故意改源码，doctor 给出 warn 而非误导性 STALE（`64 OK · 1 warn · 0 fail`）；用 1.3.5 跑则 `65 OK · 0 fail`。
- **完成于**：_未提交（工作树）_

#### - [x] P2-12 · 可安装性声明补 CI 背书　✅
- **实际改动**：`playwright` → `optionalDependencies`；CI 新增 `npm-install-node18` job（Node 18 + 打真 tarball + 装进干净树 + 跑发布产物），把既存却未接线的 `tests/e2e/npm-isolated-install.test.sh` 接入该 job。
- **验收**：本机装真实 **Node 18.20.8** 实测发布产物——`--version` → 1.31.8、`doctor` → **33 OK · 0 fail**、`metrics` 正常。engines 的 `node >= 18` 声明**首次获得实证**（此前只在 Node 24 上跑过）。e2e 脚本本机跑通（NPM-ISOLATED OK）。
- **诚实说明（不夸大收益）**：optionalDependencies 的真实收益是"playwright 拉取失败（如 CDN 被墙）不再让整个 `npm i -g @sdsrs/sgc` 失败"+ 支持 `--omit=optional` 跳过；它**不改变默认安装体积**——npm 默认仍会安装 optional 依赖。路线图原文"不再强制拉 chromium"的表述不准确，已按实修正。
- **完成于**：_未提交（工作树）_

### 组 B：编排与状态层

#### - [x] P2-1 · 测试隔离：janitor 决策读宿主 diff　✅
- **实际改动**：`janitor-compound.test.ts`（2 处）、`compound-happy.test.ts`、`L3-migration.test.ts` 注入 `diffLineCount: () => 150`。**未改生产代码**——`gitDiffLineCount` 用 `process.cwd()` 在生产上是对的，且不能改用 `dirname(stateRoot)`，否则会重演 v1.31.8 刚修的 `SGC_STATE_ROOT` 旁路缺陷。
- **验收**：故意把宿主工作树弄脏到只有 **1 行** diff（修复前必然翻红的条件）后重跑三个文件 → **30 pass / 0 fail**。
- **完成于**：_未提交（工作树）_

#### - [x] P2-4 · §13 Tier-2 事件信号配对　✅
- **实际改动**：`LlmAgentContext` 新增 `registerLlmClose`（对称于既有 `registerAbort`）；drain 在 abort 之后、`spawn.end` 之前调用它合成 `llm.response(outcome="interrupted")`（顺序即事件嵌套顺序）；三个 LLM agent 各加 `responded` 一次性守卫保证幂等；`LlmResponsePayload.outcome` 扩展 `interrupted`（事件流无 schema 约束，安全）。
- **验收**：`spawn-interrupt-tier2.test.ts` 3 tests。RED 证据精确：drain 那一刻有 **1 条 llm.request、0 条 llm.response**。5 个 spawn 相关测试文件 40 pass / 0 fail。
- **过程教训**：跑测试必须带 `SGC_FORCE_INLINE=1`（npm test 的做法）——我一度省略它，导致依赖 inline 的测试去连真实 LLM 并超时，误以为是自己改坏了。
- **完成于**：_未提交（工作树）_

#### - [x] P2-5 · file-lock 陈锁回收竞态　✅
- **实际改动**：回收前 re-read 并比对字节（确认仍是判定过的那把陈锁，变了就 continue 重新评估）；`release()` 改为按 per-acquisition nonce 校验所有权后才 unlink（防级联：被夺锁者不再反过来夺走继任者的锁）。
- **未采用二级 reclaim 锁（设计决策）**：它虽能证明性地封死窗口，却引入"回收者崩溃即永久阻塞"的新故障模式，需再加一层陈旧度启发式兜底——复杂度自身就是风险。残留窗口（两条相邻系统调用，原窗口横跨一次 `process.kill`）已在代码注释中如实说明，未粉饰为"已消除"。
- **验收**：`file-lock-reclaim-race.test.ts` 4 tests（用 `isAlive` 注入点精确复现竞争窗口）；file-lock/plan-jobs/loop 共 43 pass / 0 fail。
- **完成于**：_未提交（工作树）_

#### - [x] P2-6 · DedupStamp 引用存在性校验　✅
- **实际改动**：`validateDedupStamp(stamp, stateRoot)` 三重 provenance 校验——id 可解析 → agent 名必须是 `compound.related` → 该 spawn 在同一 state root 留有磁盘结果。
- **校验顺序经设计**：provenance 置于 threshold/reason 之后。结构非法的 stamp 不必付 I/O 代价；且当两者皆错时，"compound.related 否决了这次写入"比"磁盘无证据"更具体可操作。
- **验收**：`dedup-stamp-provenance.test.ts` 4 tests（含审核点名的 `"x"` 伪造、以及"引用了真实存在但属于别的 agent 的 spawn"）。**真实 e2e 路径（runCompound）未受影响**——`compound-happy`/`L3-migration` 全程未失败，证明门禁只挡伪造。
- **连带**：夹具真实化，新增共享 `tests/fixtures/related-spawn.ts`；过程中发现 `plan-deep.test.ts` 的夹具 spawn id（`01DECOMPOSE-PRIOR-ART-SEED000-...`）本就违反"ULID 段无短横"的约定，已修正。
- **完成于**：_未提交（工作树）_

### 组 C：算法与度量诚实性

#### - [x] P2-7 · `applied` 指标去自证循环　✅
- **实际改动**：`reflect` 图例由 "applied=L3-validated reuse" 改为 "applied=cited by an L3 pre-mortem"，删去"strongest reuse signal"，并在数字旁**打印一行循环性告警**（"counts refs the pre-mortem echoed from its own input — salience, not proof of prevention"）；`applied-tracker.ts` 补完整文档说明循环成因与正确的独立信号应长什么样。
- **未做假的独立信号**：锚定 shipped diff 需要改数据流（diff 在此处不可得），如实留白并写明，而非伪造一个看起来更硬的指标。
- **验收**：`reflect-applied-honesty.test.ts` 5 tests（断言不再出现 validated/strongest、必须说明所数为何、必须披露循环性、且仍照常打印数字——诚实 ≠ 藏起指标）。
- **完成于**：_未提交（工作树）_

#### - [x] P2-8 · researcher.history 词集交打分　✅
- **实际改动**：语料侧改用与查询侧同一个 `tokenize`（词集），并叠加一个**闭合的**英文词尾变化表（双向：`table`↔`tables`、`rendering`↔`render`）。
- **为何不是纯精确匹配**：RED 时一个既有测试失败暴露了取舍——"add markdown table rendering" 理应召回 "markdown **tables** failed to render"。旧的子串匹配虽错误地让 `auth` 命中 `author`，却也顺带承担了词形变化。纯词集交会把一个错换成另一个错（真实召回下降），故用闭合词尾表精确切分二者：区分 `table→tables`（该匹配）与 `auth→author`（不该）的是词尾，不是任意共享前缀。
- **同时修正审核的一处不准确**：`ui → build` 的例子**并不成立**——`tokenize` 的 ASCII ≥3 长度下限已把 "ui" 滤出查询词。真实暴露面是 3 字符以上的前缀型子串（auth→author、cat→category），已实证。
- **验收**：`researcher-history-wordmatch.test.ts` 9 tests（含 CJK 召回保持、反向变形、且"变形放行不得重新打开 auth/author 的口子"）；5 个 walk 调用方（researcher/preventions/reflect/debug/plan-ce1）共 153 pass / 0 fail。
- **完成于**：_未提交（工作树）_

#### - [x] P2-9 · dedup 相似度 problem 加权　✅
- **实际改动**：problem/tag 权重 **0.9/0.1**，并按"实际存在信号的分量"再归一化（ALG-1 的空分量排除语义完整保留；单分量时该分量独断，与旧的平均行为一致）。0.85 阈值（契约）未动。
- **权重由两条规则倒推，而非拍脑袋**：①问题文本完全相同即是同一问题，标签噪声不得有否决权（0.9×1.0 = 0.9 ≥ 0.85，即便标签完全不相交）；②标签完全相同也绝不能把两个无关问题送过闸（0.9×0.05 + 0.1×1.0 = 0.145）——后者是更危险的方向，因为误合并会**静默销毁**知识。初版 0.75/0.25 被 RED 证明不足（识别不出"问题相同+标签不相交"的真重复），据此上调。
- **验收**：`dedup-problem-weight.test.ts` 7 tests；dedup/unicode/compound/fuse-plan 共 83 pass / 0 fail。
- **完成于**：_未提交（工作树）_

### 组 D：暴露面

#### - [x] P2-10 · claude-cli prompt 改 stdin　✅
- **实际改动**：`SubprocessRunner` 新增可选第 4 参 `stdin`（既有 2/3 参数的测试假件不受影响）；`defaultRunner` 在有 stdin 时把 stdio[0] 开为管道、写入后 `end()`（`claude -p` 读到 EOF 为止，不关会挂到超时）并吞掉 EPIPE；argv 只剩 flags。
- **发现并改写了一个把漏洞钉死的既有测试**：`claude-cli-agent.test.ts` 的 `passes prompt text as argv` 断言的正是缺陷本身（`argv[4] === promptText`），已改写为新契约（flags 在 argv、prompt 在 stdin）。
- **验收**：`claude-cli-prompt-stdin.test.ts` 4 tests（断言 argv 任何元素都不含 prompt 内容、stdin 收到、结果解析不变）；claude-cli 相关 24 pass / 0 fail。
- **完成于**：_未提交（工作树）_

#### - [x] P2-11 · OpenRouter 外发运行时告知　✅
- **实际改动**：首次 openrouter spawn 时向 **stderr** 打印一次性告知（点明"你的任务文本/代码/diff 正被发往 openrouter.ai"+ 模型名 + 如何关闭）；stderr 而非 stdout，以免污染 `--json` 消费者；每进程一次而非每 spawn 一次（后者会被操作者训练成忽略）。
- **README 补全**：调度模式段此前**完全没有提到 openrouter**（一个仅凭环境变量就自动激活并外发代码的模式却未被文档化），已补入优先级链，并新增 "Where your code goes" 段逐模式说明数据流出。
- **未采用强制 `SGC_OPENROUTER_ACK`**：那会改变已发布工具的默认行为（按 CLAUDE.md §2 属"released-artifact user-visible default behavior change" → L3 破坏性变更），超出本批次授权范围；如需要请另行决策。
- **验收**：`openrouter-egress-notice.test.ts` 3 tests（内容需点名外发物与开关、每进程仅一次、绝不落 stdout）。
- **完成于**：_未提交（工作树）_

---

## M3 — P3 批次（持续清理，随手带，不单独排期）

| 状态 | # | 项 | 一句话动作 | 完成于 |
|---|---|---|---|---|
| ✅ | P3-1 | package-lock 根元数据 v1.18.0 | 已随 P2-3 的 `npm audit fix` 一并刷新（version/bin/engines 现均为 1.31.8 口径） | _未提交（工作树）_ |
| ⬜ | P3-2 | reviewer agent 元数据超卖（LLM 可见，敏感度高于一般 P3） | 六个 `agents/reviewer/*.md` description 加 "heuristic keyword matcher / slot-only" 注记；doctor 增加 agents/**.md ↔ manifest 绑定检查 | _ |
| ⬜ | P3-3 | `skills/review/SKILL.md` 与 `review.ts:11` 头注释 L3→L2+ 过期 | 措辞更新两处 | _ |
| ⬜ | P3-4 | loop 的 L3 步 stdin 挂起 | 非 TTY 时快速失败并提示需人工 `sgc plan` 确认 | _ |
| ⬜ | P3-5 | `agent-loop --submit` 跳过 §1 泄漏扫描 | submit 路径补 `scanOutputForLeak` | _ |
| ⬜ | P3-6 | `loop --resume` 无锁 | resume 路径复用 fork-lock | _ |
| ⬜ | P3-7 | 缺真多进程锁测试 + crash-mid-write 测试 | 新增 fork 双进程 O_EXCL 竞争测试；writeAtomic 评估 fsync 取舍并文档化 | _ |
| ⬜ | P3-8 | publish 门禁薄于 push | publish.yml 补 typecheck（+可选 eval） | _ |
| ⬜ | P3-9 | files[] 死重 + events.ndjson 无轮转 | npm 包裁掉 src/（或文档说明保留理由）；logger 加尺寸上限/轮转 | _ |
| ⬜ | P3-10 | 计数类文案错位（19→20 subcommands；§10 five→4+janitor；classifier prompt scope 多报） | 三处文案修正 | _ |
| ⬜ | P3-11 | 规范化指标信任自报 `machine_enforced` | metrics 或 doctor 校验每条 machine_enforced 有对应测试引用 | _ |
| ⬜ | P3-12 | cso 扫描盲区（>200KB / 非 git 跟踪 / Stripe·JWT 模式缺失） | 补 3-5 个常见模式；>200KB 跳过从 warn 升为 finding | _ |

---

## 维护约定

1. **单一事实源**：发现的完整证据与失败场景以审核报告为准，本文只承载**动作、状态、验收**；两文档通过编号互查。
2. **状态流转**：⬜ → 🔄（开工时改，可写 branch 名）→ ✅（合并 + 验收命令过后改，附版本号）。禁止未跑验收先打 ✅（Iron Law #2）。
3. **收口回注**：每个里程碑完成后，在审核报告头部加 back-annotate 横幅（沿用 `PRODUCTION-READINESS-AUDIT.md:9-17` 的既有惯例），并更新本文进度总览表。
4. **新发现**：修复过程中发现的新问题不塞进本表——走正常任务流，必要时下轮审核收编。
