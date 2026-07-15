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
| M3 — P3 清理组 | 12 | 11 | 0 | 1 ❌ | **100%**（11 修 + 1 判定为审核误报） |
| **合计** | **28** | **27** | **0** | **1 ❌** | **100%** |

**M1+M2 验收记录（SHIPPED v1.32.0 @ `e27681f`，2026-07-15）**：
- `tsc --noEmit` exit 0
- `SGC_FORCE_INLINE=1 bun test tests/` → **1339 pass / 38 skip / 0 fail**（基线 1269 → **+70 新测试**）
- `bun src/sgc.ts doctor`（CI 锁定的 bun 1.3.5）→ **65 OK · 0 warn · 0 fail**
- `npm audit` → **0 vulnerabilities**（基线 1 moderate）
- 发布产物 CVE 实证：`grep -c maxTotalMergeKeys plugins/sgc/bin/sgc.mjs` → **3**（HEAD 的 bundle 为 0）
- 真实 Node 18.20.8 跑发布产物 → doctor **33 OK · 0 fail**（"node ≥ 18"声明首次获实证）

**M3 验收记录（SHIPPED v1.33.0，2026-07-15）**：
- `tsc --noEmit` exit 0 · `SGC_FORCE_INLINE=1 bun test tests/` → **1372 pass / 38 skip / 0 fail**（基线 1269 → **+103 新测试**）
  > **⚠️ 数字更正（M4，2026-07-15）**：本行原写 "1410 pass … +141"。**1410 是 bun 的 `Ran N tests`（跑了多少），不是 pass 数**；1269 是 pass 数。拿 run 数减 pass 数，量纲不对。已在 `726daf4` / `e27681f` / `0150910` 三个 commit 上用干净 worktree 逐一实测：审核基线 1269 pass（跑 1307）· v1.32.0 1339 pass（跑 1377）· v1.33.0 1372 pass（跑 1410）。**v1.32.0 那条 "1269 → 1339 (+70)" 经复核是对的**——同一个命令、同一种输出，只有 v1.33.0 这次读错了。
- `bun src/sgc.ts doctor`（CI 锁定的 bun 1.3.5）→ **66 OK · 0 warn · 0 fail**（新增检查 N）
- npm 包 **529KB → 296KB（-44%）**、文件数 90 → 5，经真实消费者 e2e 验证（34 OK / 0 fail）

**三批的共同主题**（三条彼此独立，都是关于"什么才算证据"）：
1. **M1 — 确定性护栏在 LLM 模式下退化为建议**：分级器的 HARD 规则活在生产从不调用的函数里；§8 的"越权即终止"背后无实现。
2. **M2 — 绿色信号不等于证据**：测试因宿主树恰好脏得合适而通过、doctor 因 bun 版本而误报、`npm audit` 报干净而产物仍带 CVE、§3 校验 stamp 的形状却不问它是否被挣得、复用指标数的是 LLM 复读自己的输入。
3. **M3 — 元数据是运行时行为**：`agents/**/*.md` 的 description 是 Claude Code 读来决策路由的，它宣称有"OWASP 级安全评审"而运行时是个正则；两个 reviewer 自称"Dispatched by /review"而 manifest 标着 slot-only（从不派发）。doctor 已守着 prompts↔manifest 与 slash↔CLI 两个注册表，唯独这个没守——所以它烂了。

**审核自身被推翻/修正的六处**（如实记录，因为无人纠正的审核会变成传说）：P2-2（推断→实证，且改变了修复方向）· P2-8（`ui→build` 例子不成立）· P2-12（playwright 收益被夸大）· **P3-11（整条误报——doctor 检查 G 早已在校验，实测证明）** · **P3-12（"超大文件跳过升为 finding"的建议有害——本仓库自己的 950KB bundle 会让 cso 永远失败）** · P3-2/P3-4/P3-5/P3-6（审核低估了范围：实际漂移 10 个而非 6 个；loop 无锁不只在 resume；等等）。

> 全局验收（每个里程碑收口时跑一遍）：
> `tsc --noEmit` exit 0 · `SGC_FORCE_INLINE=1 bun test tests/` 0 fail · `bun src/sgc.ts doctor` 0 fail · `npm audit` 0 vuln

---

## M1 — P1 批次（本周期，全部为小改动，单独成一个 release）

### - [x] P1-1 · `review.ts:74` 命令注入 argv 化　✅
- **改动**：新增 `spawnCaptureSync`（`src/dispatcher/subprocess.ts`，argv 形式、soft-null 契约），`captureDiff()` 改走它；`review.ts` 不再 import `execSync`。
- **验收**：`tests/dispatcher/review-diff-injection.test.ts` 5 tests——RED 时 `;`/`&&`/`$()`/反引号 四种载荷**全部真实执行**（marker 文件被创建、`echo hi` 的输出还进了返回值）；修复后 5/5 过，marker 均未创建。既有 `sgc-review.test.ts` + `subprocess.test.ts` 无回归（合计 34 pass / 0 fail）。
- **涉及**：`src/commands/review.ts:72-78` · `src/dispatcher/subprocess.ts`
- **完成于**：v1.32.0 (`e27681f`)

### - [x] P1-2 · 不变量 §8 名实对齐（采用方案 A）　✅
- **为何 A 是正确解而非省事解**（修复中确认的新论据）：LLM 子代理的工具调用发生在 **sgc 进程之外**——`claude-cli` 模式下在独立的 `claude -p` 进程里，API 模式下在服务商侧。sgc 在架构上**无法**拦截其文件访问，故方案 B 对 LLM 模式不可能实现；把承诺改成实情是唯一诚实解。方案 B 就此关闭（非推迟）。
- **改动**：`sgc-invariants.md §8` 重写——保留"spawn 时计算 + pin + 无运行时提权通道"（这些是真的），新增 "What pinned enforces, precisely"（三条机器强制：spawn 时禁止 token 拒绝 / dispatcher 掌握的输入门 / §9 shape + §1 泄漏扫描）与 "What it does NOT enforce, and why"（明示非沙箱、越进程边界不可拦截、改写复述可穿透）；点明 §3 stamp 与 §11 分级器地板锚定确定性代码正因 §8 承载不了它们。`invariant-enforcement.yaml` §8 `mechanism` 同步扩写，两份契约不再互相矛盾。
- **验收**：`bun src/sgc.ts doctor` 双源 §1–§13 对齐 ✓、§8 覆盖 ✓、machine-enforced 仍 12/13（无虚增）；README:153 既有 caveat 与新措辞一致，无需改。零行为变更。
- **涉及**：`contracts/sgc-invariants.md` · `contracts/invariant-enforcement.yaml`
- **完成于**：v1.32.0 (`e27681f`)

### - [x] P1-3 · 分级器确定性下限（LLM 模式）　✅
- **改动**：`classifier-level.ts` 新增纯函数 `applyHeuristicFloor(llm, input)` = `max(heuristic, llm)`（LLM 可升不可降，对启发式输出幂等，故 inline 路径零影响）+ 导出 `LEVEL_RANK`（消除 plan.ts 的重复定义）；`plan.ts` 分类步接线该地板，升级时打印一行说明。
- **修复中发现的附加缺陷**：`plan.ts:808` 把 **raw LLM rationale** 写进 intent.md，而 frontmatter 的 level 已是 floored 值——LLM 模式下会产生"level: L3 + 论证这是 L0 的理由"的自相矛盾**不可变记录**（§2）。已改为写 floored rationale（其内嵌两个裁决，保留可审计性）。
- **验收**：`classifier-heuristic-floor.test.ts` 8 tests（含 steering-text 诱导降级、over-classify 不被降、幂等、rationale 引用双来源）+ `plan-classifier-floor-integration.test.ts` 5 tests（证明**生产路径**接线，非仅 helper 可用：LLM 说 L0 的 migration 任务实际按 L3 计划、落到不可变 intent.md、L3 门禁随之武装）。既有 `classifier-level.test.ts` / `sgc-plan.test.ts` / `heuristic-llm-schema-parity.test.ts` 无回归（合计 43 pass / 0 fail）。
- **旁证**：写集成测试时，被地板顶到 L3 的任务立刻触发 §4 人工签名门与确认门——地板确实武装了下游门禁，而非只改了个数字。
- **涉及**：`src/dispatcher/agents/classifier-level.ts` · `src/commands/plan.ts:369-380,808`
- **完成于**：v1.32.0 (`e27681f`)

### - [x] P1-4 · README/ROADMAP 自动化数字 4/6 → 5/9 + 防复发　✅
- **改动**：README:120 与 ROADMAP:21 改 5/9（ROADMAP 补注为何会过期：CE 弧于 v1.29+ 进入分母）；`doctor.ts` 新增纯函数 `readmeScorecardDrift(readme, live)` + 检查 (M)，解析 README 评分卡的三个可计数化并与 `computeMetricsLive` 逐项比对（高效化是散文形态、由既有检查 K 的 baseline 覆盖，故不解析）。
- **验收**：`doctor-readme-scorecard.test.ts` 6 tests——含一个"拿真 README 比真 live metrics"的测试，RED 时精确报出 `自动化: README says 4/6, live metrics say 5/9`（与审核发现逐字吻合），修复后 6/6 过；`sgc doctor` 显示 `✓ README scorecard matches live metrics`。`sgc-doctor.test.ts` 中 bundle 模式的跳过行计数 8→9 已同步。
- **涉及**：`README.md:120` · `docs/ROADMAP.md:21` · `src/commands/doctor.ts`
- **完成于**：v1.32.0 (`e27681f`)

**M1 收口状态**：✅ 已随 v1.32.0 发版（`e27681f`）。CHANGELOG 已收编为 `### Batch M1`；审核报告头部 back-annotate 横幅已回注。

---

## M2 — P2 批次（下一周期，按依赖分三组）

### 组 A：发布工程（可合并为一个 release）

#### - [x] P2-3 · js-yaml CVE 出净　✅
- **实际**：`npm audit fix` → js-yaml 4.3.0，`npm audit` 现 0 vulnerabilities；锁文件根元数据同步刷新（顺带闭合 P3-1）；用 CI 锁定的 bun 1.3.5 重建 bundle。
- **过程中踩到并记录的陷阱**：`npm audit fix` 只更新了锁文件，node_modules 磁盘上仍是 4.1.1，于是 `npm audit`/`npm ls` 双双报绿而重建出的 bundle 内联的仍是**带洞代码**。`npm install` 也不修复，须 `rm -rf node_modules/js-yaml` 后重装。已存记忆 #10314。
- **验收（以产物为准，不信元数据）**：`grep -c maxTotalMergeKeys plugins/sgc/bin/sgc.mjs` → **3**（该计数器是 4.3.0 修复引入的），HEAD 的 bundle → **0**。`npm audit` → 0 vulnerabilities。
- **完成于**：v1.32.0 (`e27681f`)

#### - [x] P2-2 · doctor bundle-parity 工具链敏感性　✅（**已实证，优先级上调**）
- **实际改动**：新增纯函数 `ciPinnedBunVersion(workflowYaml)`（读 `.github/workflows/test.yml` 的 `bun-version`）与 `bundleStaleSeverity(localBun, ciBun)`；hash 不符时先比对工具链——版本相同→仍 fail；版本不同→warn 并指明"用 bun X.Y.Z 才能判定、**别照旧重建提交**"。任一侧版本未知→保守回退 fail（读不到不等于清白）。
- **验收**：`doctor-bundle-toolchain.test.ts` 8 tests；实测本机 bun 1.3.11 下故意改源码，doctor 给出 warn 而非误导性 STALE（`64 OK · 1 warn · 0 fail`）；用 1.3.5 跑则 `65 OK · 0 fail`。
- **完成于**：v1.32.0 (`e27681f`)

#### - [x] P2-12 · 可安装性声明补 CI 背书　✅
- **实际改动**：`playwright` → `optionalDependencies`；CI 新增 `npm-install-node18` job（Node 18 + 打真 tarball + 装进干净树 + 跑发布产物），把既存却未接线的 `tests/e2e/npm-isolated-install.test.sh` 接入该 job。
- **验收**：本机装真实 **Node 18.20.8** 实测发布产物——`--version` → 1.32.0（发版后复测）、`doctor` → **33 OK · 0 fail**、`metrics` 正常。engines 的 `node >= 18` 声明**首次获得实证**（此前只在 Node 24 上跑过）。e2e 脚本本机跑通（NPM-ISOLATED OK）。
- **诚实说明（不夸大收益）**：optionalDependencies 的真实收益是"playwright 拉取失败（如 CDN 被墙）不再让整个 `npm i -g @sdsrs/sgc` 失败"+ 支持 `--omit=optional` 跳过；它**不改变默认安装体积**——npm 默认仍会安装 optional 依赖。路线图原文"不再强制拉 chromium"的表述不准确，已按实修正。
- **CI 实证（发版后补，消解此前唯一的 uncertain 项）**：新 job `npm consumer install (node 18 — the floor we advertise)` 在真实 GitHub Actions 上**首跑即绿**（16s，run `29427998658`）。此前只有本地等价验证，workflow 语法与运行环境未经证实。
- **完成于**：v1.32.0 (`e27681f`)

### 组 B：编排与状态层

#### - [x] P2-1 · 测试隔离：janitor 决策读宿主 diff　✅
- **实际改动**：`janitor-compound.test.ts`（2 处）、`compound-happy.test.ts`、`L3-migration.test.ts` 注入 `diffLineCount: () => 150`。**未改生产代码**——`gitDiffLineCount` 用 `process.cwd()` 在生产上是对的，且不能改用 `dirname(stateRoot)`，否则会重演 v1.31.8 刚修的 `SGC_STATE_ROOT` 旁路缺陷。
- **验收**：故意把宿主工作树弄脏到只有 **1 行** diff（修复前必然翻红的条件）后重跑三个文件 → **30 pass / 0 fail**。
- **完成于**：v1.32.0 (`e27681f`)

#### - [x] P2-4 · §13 Tier-2 事件信号配对　✅
- **实际改动**：`LlmAgentContext` 新增 `registerLlmClose`（对称于既有 `registerAbort`）；drain 在 abort 之后、`spawn.end` 之前调用它合成 `llm.response(outcome="interrupted")`（顺序即事件嵌套顺序）；三个 LLM agent 各加 `responded` 一次性守卫保证幂等；`LlmResponsePayload.outcome` 扩展 `interrupted`（事件流无 schema 约束，安全）。
- **验收**：`spawn-interrupt-tier2.test.ts` 3 tests。RED 证据精确：drain 那一刻有 **1 条 llm.request、0 条 llm.response**。5 个 spawn 相关测试文件 40 pass / 0 fail。
- **过程教训**：跑测试必须带 `SGC_FORCE_INLINE=1`（npm test 的做法）——我一度省略它，导致依赖 inline 的测试去连真实 LLM 并超时，误以为是自己改坏了。
- **完成于**：v1.32.0 (`e27681f`)

#### - [x] P2-5 · file-lock 陈锁回收竞态　✅
- **实际改动**：回收前 re-read 并比对字节（确认仍是判定过的那把陈锁，变了就 continue 重新评估）；`release()` 改为按 per-acquisition nonce 校验所有权后才 unlink（防级联：被夺锁者不再反过来夺走继任者的锁）。
- **未采用二级 reclaim 锁（设计决策）**：它虽能证明性地封死窗口，却引入"回收者崩溃即永久阻塞"的新故障模式，需再加一层陈旧度启发式兜底——复杂度自身就是风险。残留窗口（两条相邻系统调用，原窗口横跨一次 `process.kill`）已在代码注释中如实说明，未粉饰为"已消除"。
- **验收**：`file-lock-reclaim-race.test.ts` 4 tests（用 `isAlive` 注入点精确复现竞争窗口）；file-lock/plan-jobs/loop 共 43 pass / 0 fail。
- **完成于**：v1.32.0 (`e27681f`)

#### - [x] P2-6 · DedupStamp 引用存在性校验　✅
- **实际改动**：`validateDedupStamp(stamp, stateRoot)` 三重 provenance 校验——id 可解析 → agent 名必须是 `compound.related` → 该 spawn 在同一 state root 留有磁盘结果。
- **校验顺序经设计**：provenance 置于 threshold/reason 之后。结构非法的 stamp 不必付 I/O 代价；且当两者皆错时，"compound.related 否决了这次写入"比"磁盘无证据"更具体可操作。
- **验收**：`dedup-stamp-provenance.test.ts` 4 tests（含审核点名的 `"x"` 伪造、以及"引用了真实存在但属于别的 agent 的 spawn"）。**真实 e2e 路径（runCompound）未受影响**——`compound-happy`/`L3-migration` 全程未失败，证明门禁只挡伪造。
- **连带**：夹具真实化，新增共享 `tests/fixtures/related-spawn.ts`；过程中发现 `plan-deep.test.ts` 的夹具 spawn id（`01DECOMPOSE-PRIOR-ART-SEED000-...`）本就违反"ULID 段无短横"的约定，已修正。
- **完成于**：v1.32.0 (`e27681f`)

### 组 C：算法与度量诚实性

#### - [x] P2-7 · `applied` 指标去自证循环　✅
- **实际改动**：`reflect` 图例由 "applied=L3-validated reuse" 改为 "applied=cited by an L3 pre-mortem"，删去"strongest reuse signal"，并在数字旁**打印一行循环性告警**（"counts refs the pre-mortem echoed from its own input — salience, not proof of prevention"）；`applied-tracker.ts` 补完整文档说明循环成因与正确的独立信号应长什么样。
- **未做假的独立信号**：锚定 shipped diff 需要改数据流（diff 在此处不可得），如实留白并写明，而非伪造一个看起来更硬的指标。
- **验收**：`reflect-applied-honesty.test.ts` 5 tests（断言不再出现 validated/strongest、必须说明所数为何、必须披露循环性、且仍照常打印数字——诚实 ≠ 藏起指标）。
- **完成于**：v1.32.0 (`e27681f`)

#### - [x] P2-8 · researcher.history 词集交打分　✅
- **实际改动**：语料侧改用与查询侧同一个 `tokenize`（词集），并叠加一个**闭合的**英文词尾变化表（双向：`table`↔`tables`、`rendering`↔`render`）。
- **为何不是纯精确匹配**：RED 时一个既有测试失败暴露了取舍——"add markdown table rendering" 理应召回 "markdown **tables** failed to render"。旧的子串匹配虽错误地让 `auth` 命中 `author`，却也顺带承担了词形变化。纯词集交会把一个错换成另一个错（真实召回下降），故用闭合词尾表精确切分二者：区分 `table→tables`（该匹配）与 `auth→author`（不该）的是词尾，不是任意共享前缀。
- **同时修正审核的一处不准确**：`ui → build` 的例子**并不成立**——`tokenize` 的 ASCII ≥3 长度下限已把 "ui" 滤出查询词。真实暴露面是 3 字符以上的前缀型子串（auth→author、cat→category），已实证。
- **验收**：`researcher-history-wordmatch.test.ts` 9 tests（含 CJK 召回保持、反向变形、且"变形放行不得重新打开 auth/author 的口子"）；5 个 walk 调用方（researcher/preventions/reflect/debug/plan-ce1）共 153 pass / 0 fail。
- **完成于**：v1.32.0 (`e27681f`)

#### - [x] P2-9 · dedup 相似度 problem 加权　✅
- **实际改动**：problem/tag 权重 **0.9/0.1**，并按"实际存在信号的分量"再归一化（ALG-1 的空分量排除语义完整保留；单分量时该分量独断，与旧的平均行为一致）。0.85 阈值（契约）未动。
- **权重由两条规则倒推，而非拍脑袋**：①问题文本完全相同即是同一问题，标签噪声不得有否决权（0.9×1.0 = 0.9 ≥ 0.85，即便标签完全不相交）；②标签完全相同也绝不能把两个无关问题送过闸（0.9×0.05 + 0.1×1.0 = 0.145）——后者是更危险的方向，因为误合并会**静默销毁**知识。初版 0.75/0.25 被 RED 证明不足（识别不出"问题相同+标签不相交"的真重复），据此上调。
- **验收**：`dedup-problem-weight.test.ts` 7 tests；dedup/unicode/compound/fuse-plan 共 83 pass / 0 fail。
- **完成于**：v1.32.0 (`e27681f`)

### 组 D：暴露面

#### - [x] P2-10 · claude-cli prompt 改 stdin　✅
- **实际改动**：`SubprocessRunner` 新增可选第 4 参 `stdin`（既有 2/3 参数的测试假件不受影响）；`defaultRunner` 在有 stdin 时把 stdio[0] 开为管道、写入后 `end()`（`claude -p` 读到 EOF 为止，不关会挂到超时）并吞掉 EPIPE；argv 只剩 flags。
- **发现并改写了一个把漏洞钉死的既有测试**：`claude-cli-agent.test.ts` 的 `passes prompt text as argv` 断言的正是缺陷本身（`argv[4] === promptText`），已改写为新契约（flags 在 argv、prompt 在 stdin）。
- **验收**：`claude-cli-prompt-stdin.test.ts` 4 tests（断言 argv 任何元素都不含 prompt 内容、stdin 收到、结果解析不变）；claude-cli 相关 24 pass / 0 fail。
- **完成于**：v1.32.0 (`e27681f`)

#### - [x] P2-11 · OpenRouter 外发运行时告知　✅
- **实际改动**：首次 openrouter spawn 时向 **stderr** 打印一次性告知（点明"你的任务文本/代码/diff 正被发往 openrouter.ai"+ 模型名 + 如何关闭）；stderr 而非 stdout，以免污染 `--json` 消费者；每进程一次而非每 spawn 一次（后者会被操作者训练成忽略）。
- **README 补全**：调度模式段此前**完全没有提到 openrouter**（一个仅凭环境变量就自动激活并外发代码的模式却未被文档化），已补入优先级链，并新增 "Where your code goes" 段逐模式说明数据流出。
- **未采用强制 `SGC_OPENROUTER_ACK`**：那会改变已发布工具的默认行为（按 CLAUDE.md §2 属"released-artifact user-visible default behavior change" → L3 破坏性变更），超出本批次授权范围；如需要请另行决策。
- **验收**：`openrouter-egress-notice.test.ts` 3 tests（内容需点名外发物与开关、每进程仅一次、绝不落 stdout）。
- **完成于**：v1.32.0 (`e27681f`)

---

## M3 — P3 批次（持续清理，随手带，不单独排期）

| 状态 | # | 项 | 一句话动作 | 完成于 |
|---|---|---|---|---|
| ✅ | P3-1 | package-lock 根元数据 v1.18.0 | 已随 P2-3 的 `npm audit fix` 一并刷新（version/bin/engines 现均为 1.31.8 口径） | v1.32.0 (`e27681f`) |
| ✅ | P3-2 | reviewer agent 元数据超卖（LLM 可见） | **发现比审核多**：审核点了 6 个 reviewer，实际漂移 **10 个**（另含 compound.related / janitor.archive / janitor.compound / qa.browser）。全部改为如实描述，且**每个用准确的词**——security/performance/tests/maintainability = heuristic keyword matcher；adversarial/spec = NOT IMPLEMENTED (slot-only，从不派发)；compound.related = deterministic by design（§3 纪律）；qa.browser = Playwright 真实浏览器、默认 stub。新增 doctor 检查 (N) 绑定 agents/**.md ↔ manifest 防复发。**过程修正**：初版用正则解析 manifest，把 `&anchor` 形式的条目误报为孤儿——改用库内既有的 `getSubagentManifest`。<br><br>**⚠️ 回注（M4，2026-07-15）：本行原写"10 个漂移全部修复"，实为「10 个漂移，8 个修准了，2 个换成了新的不准」。** 独立代码评审实测发现：`maintainability.md` 声称做 long functions / large files 分析——代码只查 >120 字符的长**行**和抑制标记，凭空发明两个能力还漏掉唯一真实的那个；`janitor/archive.md` 描述 `.sgc/` 归档管理——`grep -rn archive src/ --include=*.ts` 零结果。**检查 (N) 放它们过去，因为 (N) 查关键词在不在、不查描述准不准**（这是它的天花板，非 bug，已写进 docblock）。更深一层：这些 `.md` **同时是两个东西**——`sgc review` 走 TS 关键词匹配器，而 Claude Code 的插件注册表把**文件正文（90–106 行的真实 prompt）当 LLM system prompt 跑**。旧描述对前者超卖，P3-2 的新描述对后者**低卖**。M4 全部改为点名执行器。修复于 v1.34.0。 | v1.33.0（M4 修正） |
| ✅ | P3-3 | review SKILL.md 与 review.ts:11 的 L3→L2+ 过期 | SKILL.md 三处（L3 specialists → L2+、“not yet wired” 删除并改为各 reviewer 的真实身份、trigger table 标题）+ review.ts 头注释。均注明 v1.27.0 起就不再为真。 | v1.33.0 |
| ✅ | P3-4 | loop 的 L3 步 stdin 挂起 | 非 TTY 时注入拒绝器并快速失败（新错误码 `L3NeedsConfirmation`），错误信息给出可执行的下一步（`sgc plan --signed-by` → `sgc loop --resume`）；TTY 下不注入，runPlan 自己的交互读取照常。**不自动确认**——§4 的人工门就是目的本身。**修正审核的场景描述**：挂起只在传了 `--signed-by` 时发生（签名门在 stdin 门之前），即 CI 里 `sgc loop ... --signed-by X` 的形态。 | v1.33.0 |
| ✅ | P3-5 | agent-loop --submit 跳过 §1 泄漏扫描 | 写盘前接入 `scanOutputForLeak`（与 spawn 同一道门），fail-closed。**审核低估了严重度**：§9 只校验字段、不看值内容，所以引用了 solutions 内容的 reviewer 结果可直接落盘——而 `--submit` 存在的意义正是“无 live poller 的外部执行者”场景，那里事后 re-validate 根本不会发生。 | v1.33.0 |
| ✅ | P3-6 | loop --resume 无锁 | **比审核记录的更广**：不只是 resume——fresh-start 的锁只覆盖 [scan → writeRun]，run 的实际执行两条路径都裸奔。新增 per-run exec 锁覆盖整个执行期。**测试方法教训**：并发跑两个 resume 并指望交错**证明不了**互斥（stub runner 太快，第一个跑完才轮到第二个，无锁实现照样通过）——必须让第一个在锁内挂住。 | v1.33.0 |
| ✅ | P3-7 | 缺真多进程锁测试 + crash-mid-write 测试 | 新增 `file-lock-multiprocess.test.ts`：fork 真实 node 进程争锁，证明 O_EXCL 跨进程互斥（被拒方还报出真实 holder pid）+ 释放后可重取 + 崩溃持有者的锁被回收。**⚠️ 回注（M4）：本行标题承诺的 "crash-mid-write 测试" 当时并未交付**——只交了多进程锁测试 + 一段 docblock，`state.ts` 那句"并发读者要么看到完整旧文件、要么看到完整新文件"被声称却从未测过。✅ 加在一个验收未发生的行上，会让账面比工作好看，这是账本唯一不能犯的错。已于 v1.34.0 补 `state-crash-mid-write.test.ts`（fork 真实进程循环重写 400KB 文档 → 随机点 SIGKILL ×12 → 断言读者只见完整旧/新，且**同时断言写入者确有进展**，否则测试会在无 tmp+rename 的实现上照样通过）。**fsync 决策：不加，并写进代码文档**——`.sgc/` 是开发者本地工作流状态，掉电丢失的代价是重跑一次 `sgc plan`；为一个“重跑即可恢复”的故障模式给每次状态写付一次真实磁盘 flush 是坏买卖。文档写明若将来存入不可重导出的数据则须改（tmp fd fsync + 父目录 fsync）。 | v1.33.0 |
| ✅ | P3-8 | publish 门禁薄于 push | publish.yml 补 `npm run typecheck`。理由写进 workflow：bun 运行时抹类型，类型错误对 `bun test` 不可见，正常 tag-after-green 流程只是“碰巧”覆盖了它——在旧 commit 上打 tag 就没有覆盖。 | v1.33.0 |
| ✅ | P3-9 | files[] 死重 + events.ndjson 无轮转 | **files[] 裁剪经实测而非推断**：去掉 src/ + contracts/ + prompts/ 后，用真实消费者 e2e（打 tarball → 装进干净树 → 跑发布产物）验证 34 OK / 0 fail。收益：打包 **529KB → 296KB（-44%）**、文件数 90 → 5。events.ndjson 加轮转（10MB cap → `.1`，只保 1 代，上界 2×cap；进程内计数、每次写零 syscall，sink 创建时 stat 一次以量到上轮遗留的流）。**取舍写进注释**：轮转确实丢最老的审计，但无界增长同样保不住审计——它只是让审计变得读不动，还顺带拖垮 tail/cso。 | v1.33.0 |
| ✅ | P3-10 | 计数类文案错位（三处） | 三条**逐条实测后**修正：README「19 subcommands」实为 **20**（`--help` 点算）；invariants §10「five subagents」实为 **4**（runCompound 只派发 context/related/solution/prevention，janitor.compound 是决定“是否 compound”的独立门，已在文中点明）；classifier prompt 自称 scope `read:progress, read:decisions` 而 manifest 只给 `[“read:progress”]`（prompt 是 LLM 可见的，超报会让模型以为自己可读 decisions）。 | v1.33.0 |
| ❌ | P3-11 | 规范化指标信任自报 machine_enforced | **审核误报，实测推翻**。doctor 检查 G **已经**在校验：把 §8 的 test 引用改成不存在的文件 → 立刻 `✗ §8 cites missing test file(s)`；空 tests 列表同样被拦（代码 + sgc-doctor.test.ts 均覆盖）。而“测试是否真的断言了该不变量”这层，`invariant-enforcement.yaml` 头部第 15-18 行**已明确声明**不在校验范围（“file-existence is what doctor verifies; not a per-assertion audit”）——契约本就诚实。审核漏看了检查 G。不做改动。 | N/A（无需修复） |
| ✅ | P3-12 | cso 扫描盲区 | **补模式（采纳）**：Stripe live（`sk_live_`/`rk_live_`，刻意不报 `sk_test_`——安全可提交，报了会训练操作者忽略此门）、JWT（要求真签名段，避免文档里的 `header.payload.signature` 误报）、Google API key、npm token、Slack webhook。全部前缀锚定 + 有界长度类（ReDoS 安全）。**「>200KB 跳过升为 finding」拒绝采纳**：现状已是 `warn`（非 pass，审核此处描述有误）；且本仓库自己 git-track 着 950KB 的 bundle，升级后 `sgc cso` 会在 sgc 自己身上永远失败——永远失败的门等于被忽略的门，严格劣于 warn。已加测试钉住现状。<br><br>**⚠️ 回注（M4，2026-07-15）：上面那段推理成立，但由它得出的结论不成立。** "审核的修法有害"被我用来关掉了整个条目，而审核的**关切**——被跳过的文件就是没扫过的文件——完好无损地活着，且有个我没去找的第三选项：**把上限提到 2MB**（扫那个 bundle 实测 4ms）。而被跳过的正是 P3-9 裁剪后**唯一发给用户的代码文件**，且它是 bundler 生成的（`process.env.X` 构建期内联 → src/ 干净 ≠ bundle 干净）。另：OpenAI 现行 `sk-proj-` 格式**从未被匹配过**（`sk-[A-Za-z0-9]{20,}` 在 `proj` 后的 `-` 处断掉），而注释还宣称它抓 OpenAI；jwt.io/Slack/Google 的**官方文档示例会让门禁 fail**——正是我用来反驳审核的 `sk_test_` 原则，我只在一半的地方应用了它。全部修复于 v1.34.0。 | v1.33.0（M4 修正） |

---

## 维护约定

1. **单一事实源**：发现的完整证据与失败场景以审核报告为准，本文只承载**动作、状态、验收**；两文档通过编号互查。
2. **状态流转**：⬜ → 🔄（开工时改，可写 branch 名）→ ✅（合并 + 验收命令过后改，附版本号）。禁止未跑验收先打 ✅（Iron Law #2）。
3. **收口回注**：每个里程碑完成后，在审核报告头部加 back-annotate 横幅（沿用 `PRODUCTION-READINESS-AUDIT.md:9-17` 的既有惯例），并更新本文进度总览表。
4. **新发现**：修复过程中发现的新问题不塞进本表——走正常任务流，必要时下轮审核收编。
