---
status: approved
revision: 1
---

# M5 — 描述反转 + 专家 LLM 化(v1.35.0)

来源:对 M4(`21fc61a..196359e`)的双视角复核 —— `meta-accuracy`(6 项,3 Important)
+ `meta-steering`(10 项,3 Critical)。**两份的每一条主审均已独立复现**;两次复现中主审自己
编坏了测试输入(手编 trigger 正则、用例含 `getSecret()`),均因结果过于整齐而回查发现。

## 这批为什么存在(一句话)

M4 的每一条事实都经得起查,**但整批瞄准了一个不存在的读者**:`sgc review` 的用户
**永远看不到 agent 描述**(实证:全仓库读 agent frontmatter 的只有 `doctor.ts`;
`review.ts:231/325` 打印的是 Finding 的 description,不是 agent 的)。而他们需要的诚实交代
**本来就已经在他们真会看的两个地方**:`contracts/sgc-capabilities.yaml:368-374`
和 `plugins/sgc/CLAUDE.md:169`。

所以 M4 的免责声明:**保护的人已被保护,劝退的却是唯一真正读它的读者**——Claude Code 的
派发器。每个文件 86–102 行能跑的真 prompt,被自己的描述关掉。

> M3 写了假话。M4 写了**真话,但瞄错了读者**。这是更深的一层,不是同一个错。

## goal

1. **反转全部 9 条描述**(7 现有 + 2 新建):能力在前、CLI 注意事项在后且**显式限定读者**
2. 修掉描述背后的**代码缺陷**(它们是真 bug,不是措辞问题)
3. **选 B**:`reviewer.security` + `reviewer.tests` 上真 LLM(启发式降为 fallback)

## non-goals

- **不做「描述从代码生成」** —— 这是第二层,单开 spec(见 `## 移交第二层`)。这批已经够大,
  M4 的教训之一就是「顺手多做一点」把新问题带了进来
- **不给其余 6 个专家上 LLM** —— 选 B 就是要先拿 2 个量真实成本和 prompt 质量再决定推广
- 不改 `correctness.md` 的描述(基准形态,234 字符,能力在前)

## constraints

- **§2 L3**:LLM 可见元数据(无论 LOC)+ 改已发布包的路由与默认行为 → **v1.35.0,非补丁**
- **§2-EXT 已发布产物清单**:minor bump + CHANGELOG 迁移说明置顶 + **显式 opt-out** + 可发现信号
- Iron Law #1:每项先 RED
- `SGC_FORCE_INLINE=1 bun test tests/` 是唯一正确调用形态
- 基准:**1433 pass / 38 skip / 0 fail**(本会话实测 @ `71dc900`;`Ran 1471`,1433+38=1471 自洽)

## 决策记录

**D1(用户批准)**:整批反转,不是逐条订正措辞。理由见「这批为什么存在」。

**D2(用户批准)**:选 B —— 只做 security + tests。
- **额外理由(实现前发现,记录)**:选 B 不只是抬指标。security/tests 一旦 LLM 化,就和
  `correctness` 同类了 —— **双执行器的复杂度对这两个塌缩掉**,描述可以退回 234 字符的
  基准形态。这是 A/B/C 里唯一同时**减少**描述复杂度的选项。
- **反向代价(必须写进描述)**:填了 `prompt_path`,「this body is NOT what runs」对这两个
  **仍为真但理由变了** —— CLI 跑的是 `prompts/reviewer-security.md`,不是 agent 正文。
  每个能力将有**三份手工表述**(agent 正文 / prompts/ / 匹配器 fallback)。**这正是第二层要治的病**。

**D3(主审)**:撤销 M4 的 `REGISTRY_EXEMPT_IDS` 里 `reviewer.migration` / `reviewer.infra` 豁免。
M4 发现它们没有 agent 文件,处理是**豁免**;而它们 `status: implemented`、L2+ 会 spawn、
severity `high`(全集群最高)。补文件,不豁免。

**D4(主审)**:opt-out 用新增 `SGC_REVIEW_SPECIALIST_LLM=0`。
`SGC_FORCE_INLINE=1` 已存在但是钝器(强制**所有** agent 走 inline,含 correctness)。
`tests` 在 L2+ 每次都跑 → 有 key 的用户**每次 L2 review 至少多 1 次 LLM 调用**,这是默认行为
改变,§2-EXT 要求显式 opt-out。

## 工作项

### A 组 — 描述反转(9 条)

| # | 项 | 来源 |
|---|---|---|
| A1 | **删掉 security.md 的 cso 重定向**(全集最锋利一刀:终句、祈使、点名目的地,把读者从本文件 96 行真 prompt 推向零 LLM 的三个启发式,还叫它「语义分析」) | steer F3 / acc #2 |
| A2 | archive.md 反转:**领句写 MOVES FILES ON DISK**;删掉那 108 字符的维护八卦(「which is how this escaped the relabelling」) | steer F2 / F7 |
| A3 | adversarial.md / spec.md:去掉领头的 `NOT IMPLEMENTED`(它在一个**专门用来决定 Claude 派发**的字段里,开头就阻止 Claude 派发,而文件自己承认那是唯一活路) | steer F1 |
| A4 | 四个匹配器(security/maintainability/performance/tests)反转:能力在前,CLI 注意事项后置并用 `Separate fact for sgc CLI users:` 限定 | steer F4 |
| A5 | spec.md 披露 `intent.md` 依赖(无 `.sgc/` 时唯一可能输出是 `concern` —— 描述推荐的那条路是死的) | steer F5 |
| A6 | **新建 `migration.md` + `infra.md`** + 撤销 D3 的豁免 | steer F9 / D3 |
| A7 | 统一体例:每种状态一个公式;**severity 与 trigger 缺口披露改为无条件**(现 1/4) | steer F6 |
| A8 | 修正 security.md 词表遗漏(实含 `signature|encrypt|decrypt`)、tests.md 机制名(实为 `+++ b/<path>` **文件路径正则**,非关键词匹配) | acc #5 / #6 |

### B 组 — 代码缺陷(描述背后的真 bug)

| # | 项 | 实证 |
|---|---|---|
| B1 | `O(n)` 匹配器失效:`\b` 卡在字面 `)` 后 → `O(n)` / `O(n^2)` / `// O(n) scan` 全 false,只有 `O(n)x` 为 true | 主审执行正则 |
| B2 | `debounce` / `throttle` **不可达**:在 matcher(:96)不在 trigger(:154) → 永不 spawn | 主审执行两个正则 |
| B3 | **trigger 测全 diff(含文件名行)vs matcher 只扫新增行**:动 `auth.ts` 就 spawn security,新增行无关键词则零发现。第三个同类不对称 | 主审实证 |
| B4 | archive.md 正文三处越契约:目标路径 schema 不认(`.sgc/archive/` vs `.sgc/decisions/_archive/{epoch}/`)、正文 17/45/28 行要动 `reviews/`+`progress/` 而 manifest 只给 `decisions` scope、输出字段 §9 会整个丢弃 | acc #3(行号经主审更正) |
| B5 | `reviewer_base` 未声明 `purpose` → `SGC_AGENT_MODE` 覆盖时合成 prompt literally 是 `# Purpose\n\n(no purpose declared)` | steer F8 |

**B1–B3 的共同后果**:「spawn 了的 reviewer 报零发现」在本集群**不是干净证据**,而是三条不同
路径都会到达的默认结局。`performance.md` 是唯一自曝这个缺口的,却把它当孤例写。

### C 组 — 选 B 实现

| # | 项 |
|---|---|
| C1 | 著 `prompts/reviewer-security.md`(需 `<input_yaml/>` 占位,见 spawn.ts:580) |
| C2 | 著 `prompts/reviewer-tests.md` |
| C3 | manifest 填 `prompt_path`;启发式**保留为 fallback**(spawn.ts:449/454 判据 = `prompt_path && API_KEY`,无 key 自动落回 —— 无 key 用户行为**零变化**) |
| C4 | `SGC_REVIEW_SPECIALIST_LLM=0` opt-out(D4) |
| C5 | 验证 `sgc metrics` 智能化 **11/23 → 13/23** |

## success-criteria

- steering 10 项 + accuracy 6 项**全部有处置**:修复(附 RED→GREEN)或**显式拒绝并写明理由**
- 全量套件 0 fail(基准 **1433**)· `tsc --noEmit` exit 0 · doctor 0 fail · `npm audit` 0
- `sgc metrics` 智能化 **13/23**(实跑证明,非推断)
- **无 key 路径行为零变化**(测试钉死)
- `sgc cso` 本仓库仍非 fail

## 移交第二层(单开 spec,不进这批)

**病根**:每个能力有 2–3 份手工表述(agent 正文 / `prompts/` / 匹配器),外加一句必须同时对
三者为真的 `description:`。M5 之后 security/tests 各有三份。**这是漂移的发动机,M5 只是把当前
这批漂移擦掉,没有关掉发动机。**

**已证明有效的解(本仓库自己的)**:doctor 的 check M 拿 README 数字对 `sgc metrics` 实时输出、
J/K 对 metrics baseline、bundle parity 对源码重建 —— **凡是被机器对过账的声明,一条都没漂过;
漂的全是没人对的那些。**

**方向**:描述里可机器核对的具体项(正则词表 / 匹配机制 / 有无实现 / severity)应**从代码生成
或用测试钉死**,而不是手写。

**为什么 doctor 现在的 (N) 拦不住**:`agentMetadataDrift`(doctor.ts:227-294)只检查描述**含不含**
一个坦白关键词 `/heuristic|keyword match|deterministic|not llm-backed|rule-based|not implemented/`,
从不校验具体内容。M4 把这个天花板**写进了文档**,而本次复核证明它放过了 16 个缺陷。
**最讽刺的证据**:`tests.md` 那个**错误的**机制名词「keyword match」,恰恰就是满足闸门正则的那个词
——**闸门在奖励一个不准确的词**。

## 推迟(记录而非静默丢弃)

- 承 M4:轮转持续失败每写一次一个 syscall · spawn 先写后扫的不对称 · `solutions/` 不可读时
  fingerprint 静默 fail-open · frontmatter `name:` 未校验
- 新增:`correctness.md` 描述称「Dispatched by /review」,而 /review 实际跑的是
  `prompts/reviewer-correctness.md` 不是正文 —— 同一个双执行器问题,因为读起来是正面的所以
  两个 reviewer 都没标。**记录,不在这批改**(它是基准形态,动它要连带重定义体例)

# Change log

- rev 1 — 2026-07-15 — 建档。用户四项拍板:开修(整批反转)/ 第二层立项 / 提交 docs(`71dc900` 已落)/ 选 B
