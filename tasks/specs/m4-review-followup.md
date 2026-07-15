---
status: approved
revision: 1
---

# M4 — code-review 跟进批（v1.34.0）

来源：`/superpowers:requesting-code-review` 对 M3 批次（`284bdaa..0150910`）的三份独立评审
（concurrency / security / metadata），0 Critical、11 Important。每条指控主审均已独立复现。

## goal

修掉三份评审的 11 项 Important，并补上其中暴露的两处**账实不符**（P3-2 的"全部修复"实为
"8 准 2 不准"、P3-7 的 ✅ 少了承诺的 crash-mid-write 测试）。

## non-goals

- 不重写 cso 为 gitleaks 级扫描器（它是最后一道启发式门，契约里已如此声明）
- 不给 doctor 检查 (N) 加语义理解——它查的是接线，不是准确性。**把这个天花板写进文档**，
  而不是假装它不存在
- 不动 P3-11 的判定：metadata reviewer 用两个对抗测试独立复核，"审核误报"成立

## constraints

- **§2 L3**：`plugins/sgc/agents/**/*.md` 是 LLM 可见元数据（无论 LOC 升 L3）；且改的是
  已发布包的门禁默认行为
- **§2-EXT 已发布产物清单**：minor bump + CHANGELOG 迁移说明置顶 + **显式 opt-out**
  （env flag）+ 一次性可发现信号
- Iron Law #1：每项先 RED
- `SGC_FORCE_INLINE=1 bun test tests/` 是唯一正确调用形态（不带会去打真实 LLM）

## success-criteria

- 11 项 Important 全部有对应的 RED→GREEN 证据
- 全量套件 0 fail（基线 **1372 pass**，实测于干净 worktree @ `0150910`）· `tsc --noEmit` exit 0 · doctor 0 fail · npm audit 0
- `sgc cso` 在本仓库仍为非 fail（否则门禁自我否决）
- 发布产物（bundle + README + CHANGELOG）**全部进入扫描范围**

## open-questions

无。三个决策点用户已拍板；其中 cso 文档误报的**方法**在实现中改变，见下。

## 决策记录

**D1（用户批准）**：开 M4 批，打包 v1.34.0，非补丁。

**D2（用户批准原方案，主审实现中推翻，改为分级）**：
- 原推荐：排除 `docs/` + `*.md`
- **推翻理由**：`files[]` = `[bundle, README.md, LICENSE, CHANGELOG.md]`——README/CHANGELOG
  是发布产物。排除 `*.md` 会让 4 个已发布文件里的 2 个不再被扫，与本批 S1
  （"唯一被跳过的文件正是唯一发出去的代码文件"）是同一个错误
- **改为**：per-pattern `commonInDocs` 分级。文档里天然出现的（JWT / Google key /
  Slack webhook）在 `.md`/`docs/` 降为 warning；文档里永不合法的（Stripe live / npm
  token / AWS / OpenAI）在任何文件都 fail
- 这是 `sk_test_` 原则的正确应用——上一批只在一半的地方应用了它

**D3（用户批准）**：`agents/*.md` 描述必须点名执行器。同一文件对两个执行器为真的事实不同：
`sgc review` 走 `src/dispatcher/agents/*.ts`（关键词匹配器），Claude Code 的插件注册表把
**文件正文当 LLM system prompt 跑**。旧描述对前者超卖，新描述对后者低卖。

**D4（用户批准）**：回注 roadmap P3-2 行。

## 工作项

| # | 组 | 项 | 来源 |
|---|---|---|---|
| A1 | cso | MAX_SCAN_BYTES 200KB → 2MB（发布产物进扫描范围）+ `SGC_CSO_MAX_SCAN_BYTES` opt-out | sec Imp#1 |
| A2 | cso | OpenAI `sk-proj-` / `sk-svcacct-` 漏报 + 修正注释前提 | sec Imp#2 |
| A3 | cso | `commonInDocs` 分级治文档误报 | sec Imp#3 / D2 |
| A4 | cso | 厂商缺口：`whsec_` / `xapp-` / `GOCSPX-` / `github_pat_` / Slack triggers | sec Min#5 |
| A5 | cso | no-echo 断言覆盖全部模式（现仅 Stripe） | sec Min#6 |
| B1 | agent-loop | §1 拒绝写入事件流（spawn 路径有，--submit 无） | sec Imp#4 |
| C1 | loop | 重启后 pid 复用 → run 永久无法 resume；错误信息点名锁路径 | conc Imp#1 |
| C2 | loop | `L3NeedsConfirmation` 从未逃出（handler 丢 code 只留 message） | conc Imp#3 |
| C3 | tests | `expect(reviewCalls).toBe(1)` 空断言 + 误导注释 | conc Min#4 |
| D1 | logger | 双 sink 互相摧毁要保留的那一代（实测 12 事件剩 2）| conc Imp#2 |
| D2 | logger | `SGC_EVENTS_MAX_BYTES` opt-out（兼作 §2-EXT 要求） | conc Min#7 |
| E1 | metadata | `maintainability.md` 凭空发明 long functions/large files | meta Imp#1 |
| E2 | metadata | `performance.md` 混淆 spawn trigger 与 finding | meta Imp#1 |
| E3 | metadata | `janitor/archive.md` 描述零实现的能力 | meta Imp#2 |
| E4 | metadata | 双执行器框架：点名 `sgc review` 下解析为什么 | meta Imp#3 / D3 |
| E5 | metadata | `reviewer-specialists.ts` 通篇仍写 L3（P3-3 修了邻居漏了它） | meta Imp#4 |
| E6 | doctor | (N)：manifest→file 方向（migration/infra 无 .md 且静默）、YAML 解析替正则、`readAgentMdFiles` 移入 try、slot-only 禁 `/dispatched by/`、天花板写进 docblock | meta Min#5-8 |
| F1 | tests | crash-mid-write 测试（P3-7 账实不符：✅ 少了这一半） | conc Min#6 |
| G1 | docs | roadmap P3-2 回注 + P3-9 理由修正 | meta Rec#5 / conc Min#8 |

## 推迟（记录而非静默丢弃）

- conc Min#5 轮转持续失败时每写一次一个 syscall（退化态才发生）
- sec Min#7 spawn 先写后扫的不对称（内容已在 solutions/，是卫生非漏洞）
- sec Min#8 `solutions/` 不可读时 fingerprint 静默 fail-open（先存在，与 spawn 路径共有）
- meta Min#9 frontmatter `name:` 未校验（今日一致，无物维系）

# Change log

- rev 1 — 2026-07-15 — 建档；D2 在实现中由"排除 .md"改为"按模式分级"，理由见上
