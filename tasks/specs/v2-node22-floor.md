# v2.0.0：Node ≥ 22.19、undici 7、代理在任意 Node 版本可用，以及 LLM / 构建检查的修补
状态：已发布（v2.0.0，2026-11-01）

## 背景与目标
2026-11-01 用户批准了以下建议并要求执行：把 Node 下限升到上游仍在维护的最老 LTS（22），用 v2.0.0 发布；修两处既有缺口（e2e 脚本用 PATH 上的任意 bun 重建 bundle；本机 bun 与 CI 钉的版本不一致时，doctor 仍报 OK）；删掉已失效的 `anthropic/claude-sonnet-4` 校准钉；花约 $1–3 实测 LLM 模型；把 LLM eval 从 push CI 挪到定时 workflow；build job 的 checkout 关闭 `persist-credentials`。

实施前的实测改变了方案：
- sgc 把 npm 上 undici 的 `ProxyAgent` 作为 `dispatcher` 传给 Node 内置的 `globalThis.fetch`（`src/dispatcher/proxy-fetch.ts:133`）。两边 undici 版本不一致时 dispatcher 接口不兼容。经真实代理（本机出网代理 10.77.0.1:17890）实测：

  | 调用方式 | Node 22.19（内置 undici 6.21.2） | Node 24.22（内置 7.29.1） | Node 26.8.1（内置 8.10.0） |
  |---|---|---|---|
  | 内置 fetch + undici 6.29.1（v1.38.5 现状） | ✅ | ✅ | ❌ `invalid onError method` |
  | 内置 fetch + undici 7.30.1 | ✅ | ✅ | ✅ |
  | 内置 fetch + undici 8.12.3 | ❌ `invalid onRequestStart method` | ❌ | ✅ |
  | undici 自己的 fetch + ProxyAgent（6 / 7 / 8） | ✅ | ✅ | ✅ |

- 已发布的 v1.38.5 bundle 端到端复现了 Node 26 的失败：用假 CONNECT 代理把非 loopback 主机名的请求转发到本地目标，`sgc canary --phases health_url` 在 22.19 / 24.22 上通过，在 26.8.1 上失败，且代理一次 CONNECT 都没收到。
- 所以按原计划直接升 undici 8，会让 22/24 上的代理失效。正确做法是：走代理的请求改用 undici 自己的 `fetch`。

## 范围
- 做：
  - `proxy-fetch` 走代理时改用 undici 自己的 `fetch`；不走代理时仍用 `globalThis.fetch`，行为不变。
  - undici 升级（实测后选 ^7，见决策）；`engines` 改为 `>=22.19.0`。
  - 新增 Node 下的代理端到端测试，CI 在 Node 22.19.0 / 24 / 26 上都跑。
  - e2e 脚本不再重建 bundle；doctor 在本机 bun 与 CI 钉的版本不一致时报 warn。
  - test.yml 删掉从未真正跑过的 LLM smoke；新增定时 LLM eval workflow；修正失效的校准注释。
  - 默认模型是否更换，按实测结果决定。
  - 发布 job 之外的 checkout 设 `persist-credentials: false`（只改 publish.yml 的 build job）。
  - 同步各处文档说明、metrics 基线、CHANGELOG 迁移说明，发布 v2.0.0。
- 不做：其他仓库的 npm token（ubuntu-sec / agentsmd / sdscc / codeagent 仍在用 token 发布，`github` / `github2` 两个 token 2026-11-20 到期，只报告）；仓库 ruleset 和 environment 审批；Anthropic SDK 0.91 → 1.x 升级；ROADMAP 里的 E403 说明。

## 验收标准
- [x] AC1：代理端到端测试在 Node 22.19.0 / 24 / 26 上都通过（改之前 Node 26 失败）— 验证：`tests/e2e/proxy-canary.test.sh` 在 CI 矩阵中运行
- [x] AC2：本机用不同于 CI 钉的 bun 时，doctor 的 bundle 一致性检查报 warn，不报 OK — 验证：单元测试先 RED 后 GREEN
- [x] AC3：e2e 脚本跑完后，bundle blob 与运行前相同（即使 PATH 上是另一个 bun）— 验证：PATH 放 bun 1.4.2 运行前后 `git hash-object`
- [x] AC4：`engines.node` 为 `>=22.19.0`；README / 插件说明 / metrics 基线 / doctor 全部一致 — 验证：`sgc doctor` 0 fail，`sgc metrics`
- [x] AC5：`npm audit --omit=dev` 0；全量测试通过；`tsc` 0
- [x] AC6：push CI 里不再有真实 LLM 调用；定时 workflow 在缺少 key 时直接失败，不会静默跳过
- [x] AC7：v2.0.0 通过 OIDC 发布，`_npmUser` 为 GitHub Actions（这也是 "disallow tokens" 设置下的第一次发布）

## 方案
- proxy-fetch：`makeProxyAwareFetch(baseFetch?, env?, proxiedFetch?)`。命中代理时调用 `proxiedFetch`（默认是 undici 的 `fetch`），否则调用 `baseFetch ?? globalThis.fetch`。这个注入点保留可测性。
- 端到端测试：`tests/e2e/proxy-canary.test.sh` 起一个假 CONNECT 代理和本地目标，用 Node 运行已提交的 bundle，执行 `canary --phases health_url`，检查退出码和代理收到的 CONNECT 次数。
- 默认模型：见「决策与进展」。

## 计划
- [x] S1：spec（本文件）
- [x] S2：doctor 遇到 bun 版本不一致时报 warn（RED → GREEN）
- [x] S3：e2e 脚本不再重建 bundle（RED → GREEN）
- [x] S4：proxy-fetch 改用 undici 自己的 fetch + 代理端到端测试（RED：v1.38.5 bundle 在 Node 26 上失败）
- [x] S5：undici ^7 + engines `>=22.19.0` + CI Node 矩阵 + 文档和基线同步
- [x] S6：test.yml 删掉 LLM smoke；新增 llm-eval.yml；修正注释；`persist-credentials`
- [x] S7：按实测结果决定默认模型
- [x] S8：CHANGELOG / 版本号 / 发版

## 决策与进展
- 2026-11-01：sgc 原来的 `NPM_TOKEN` 是 token `75a719`（05-20 创建；secret 05-21 之后没再更新），已于 2026-08-04 被吊销，08-18 过期，不需要再操作。`github`（6b4487）和 `github2`（0000ef）是其他仓库在用的、可绕过 2FA 的写权限 token，2026-11-20 到期，不动。
- LLM 实测在 scratchpad 的独立克隆里跑（HEAD 50e2f89），预算上限 $2.80。

- 决策（2026-11-01）：用 undici ^7.30.1，不用 8。实测 bundle 大小：6 → 1,707,646，7 → 1,942,898，8 → 2,220,899 字节（这两个数是在较早的源码上测的；在最终源码 e3e10ab 上复测：7 → 1,944,072，8 → 2,222,073，结论不变）。7 维护到 2028-04-30，晚于下一次升下限的时间（2027-04-30 Node 22 停止维护，届时升到 24），而且配合 undici 自己的 fetch 在三个 Node 版本上都实测通过。`engines` 仍为 `>=22.19.0`，因为这是 CI 实际测试的下限。
- 决策：不换默认模型。smoke（5 轮 × 8 个测试）：opus-4.7 37/40（95% 区间 80.1–97.4%），opus-4.6 40/40（91.2–100%），opus-5.5 35/40（73.9–94.5%），sonnet-5.5 30/40（59.8–85.8%）。三个 opus 的区间重叠，没有依据更换。失败全部是评测质量门（researcher.history 的 30 词上限和引用匹配、planner.eng 的禁用词、RT-4 门），没有一次是运行时错误。（2026-11-02 更正：这句话对默认模型不成立。opus-4.7 的 4 次 researcher.history 失败全是运行时错误 `OutputShapeMismatch: missing required fields: warnings`，v2.0.1 已修复，见 `v2.0.1-plugin-load-and-agent-fixes.md`。）test.yml 注释所说的 opus-4.7 §9 未声明字段问题，在 6 轮运行里没有出现。
- 决策：定时 workflow 每周只跑 planner-eng（在默认模型上 0/6 失败），因为 researcher.history 在默认模型上 5 轮里有 2 轮失败，整套 smoke 做每周红绿会大多是误报。手动触发可选 smoke 或 full。
- 决策：旧 Node 只提示、不阻止运行（实测 18/20 上 bundle 仍能启动）。提示里同时给出插件渠道的退回路径（Claude Code 文档：marketplace add 接受 `#<ref>`），因为插件自带的 CLI 优先于全局 npm 安装，只给 npm 的退回命令对插件用户无效。
- 遗留：doctor 的 README 分数行检查故意不解析"高效化"段，所以 README 里的 Node 版本说法没有任何检查；这次是手动同步的。

- 范围扩展（不修就无法发版）：test.yml run 41341840174 在 192a3b9 上 bundle 一致性检查失败（`index e0ea140..c2c765e`）。原因：bun 把 undici 7 的 `__filename` 写成构建机器的绝对路径（本机 `/home/ai/dev/sgc/node_modules/undici/index.js`，CI `/home/runner/work/sgc/sgc/...`）；v1.38.5 的 bundle 里这种路径为 0 处。修法：`scripts/build-cli.mjs` 去掉 checkout 根路径前缀。undici 只用它判断堆栈里是否已包含该路径，单文件 bundle 里永远不会包含，所以对运行时没有影响。（后经审查更正：只有错误信息本身含 `node_modules/undici/index.js` 时，相对路径才会让 undici 少追加堆栈帧，而 sgc 只在 `SGC_DEBUG` 下打印 err.stack。）

- 发版前审查第一轮（新的子代理，范围 50e2f89..192a3b9）：
  - C1：bundle 含构建路径，CI 一致性检查失败 → 已由 9a8e440 修复。
  - H1：旧 Node 提示给插件用户的退回路径缺 `/plugin install sgc@sgc`（删除 marketplace 会卸载其下插件，照提示做完 sgc 就没了）→ e1573d3（先 RED）。
  - M1：`plugins/sgc/CLAUDE.md:7`、`docs/POSITIONING.md:5` 仍写 Node ≥ 18 → 文档提交。
  - L1：CHANGELOG 里 undici 8 的体积是在旧源码上测的 → 复测后改为 2,222,073。
  - L2：仓库没有 `OPENROUTER_API_KEY` secret，llm-eval.yml 首次定时运行（2026-11-02 06:17 UTC）就会失败 → 这是设计如此，报告给用户。
  - L3：本文件标题和 S5 仍写 undici 8 → 已改。
- 增量审查（新的子代理，范围 9a8e440）：
  - F1 Medium：去路径用的是不限定位置的全局替换，checkout 根目录很短（如挂载到 `/sgc`）时会删坏无关字符串（22 行）→ e3e10ab，只替换 `"<根目录>/node_modules/` 开头的字符串字面量（先 RED）。
  - F4、F6：注释和 CHANGELOG 说法不准确 → e3e10ab 更正。
  - F5：同 L1。
  - F2、F3 Low，未修，记为遗留。F2：Windows 反斜杠路径、含制表符的路径、`--preserve-symlinks-main` 的情况下路径去不掉。F3：集成测试只查字面路径。CI 和发布只在 Linux 上构建；在这些情况下，最坏结果是本机 doctor 的一致性检查报 fail，不会发出错误的包。

- 修复提交审查（新的子代理，范围 9a8e440..7936292）：
  - 修复本身没有发现阻断问题。
  - 4 条 Low 中，L3 已改：POSITIONING 原写 "1.x 为 ≥ 18"，实际 v1.38.3–v1.38.5 是 ≥ 18.17。
  - 另外 3 条 Low 未修。改它们要么要重建 bundle、再开一轮审查，要么发出的包本来就不受影响：
    - 去路径漏掉 checkout 位于 `/` 的情况；
    - 去路径漏掉 bun 会转义的路径：含 `"`、制表符、换行、U+2028/2029/FEFF 的路径，以及 node_modules 是指向 checkout 外的符号链接；
    - 旧 Node 提示里命令后紧跟逗号，连逗号一起复制会失败。

    CI 只在 `/home/runner/work/sgc/sgc` 构建，一致性检查会拦下这些 bundle。
- 本次范围外的发现（遗留，待用户决定）：`plugins/sgc/hooks/hooks.json` 的 `"hooks"` 是数组，Claude Code 要求是"事件 → 列表"的对象。
  - Claude Code 2.1.316：`claude plugin validate plugins/sgc` → exit 1（HOOKS_SCHEMA_INVALID）；在隔离 HOME 里从本地仓库安装 → `Status: ✘ failed to load`。
  - 该文件自 6475f6b 起没改过，v1.38.5 也一样。只影响插件渠道（读 main），不影响 npm 包。
  - 修好后 SessionStart 注入会开始生效，属于对已发布插件默认行为的改变，需单独决定。

## 验证记录
- 发布（AC7）：publish.yml run 41346408533，两个 job 都通过。
  - `npm view @sdsrs/sgc@2.0.0 _npmUser` → `GitHub Actions <npm-oidc-no-reply@github.com>`。
  - registry 上 shasum 8b99e118… = CI 日志里的 `npm notice shasum` = CI 产物 tarball 的 sha1。
  - `dist-tags.latest` = 2.0.0；engines `>=22.19.0`。
  - SLSA provenance v1：workflow `publish.yml`，ref `refs/tags/v2.0.0`，提交 79362923，run 41346408533 第 1 次运行。
  - tarball 里的 bundle blob = 2b0d440 = tag 上提交的 blob，权限 755，不含 `/home/`。
  - 从 registry 全局安装：Node 22.19.0 → `2.0.0`，stderr 0 行；Node 20.20.2 → `2.0.0`，stderr 1 行。
  - GitHub Release v2.0.0 已创建，非草稿、非预发布。
- 审查修复（HEAD e3e10ab，bundle 2b0d440，1,944,072 字节）：
  - node-floor 测试 RED（`install` 下标 -1）→ 7 pass。
  - 去路径单元测试 RED（`sdsrssissues`、`pluginscommands`）→ 2 pass。
  - bwrap 挂载到 `/sgc` 构建：旧脚本得到 c3d8b64（22 行不同），新脚本得到 2b0d440。
  - 另一路径的克隆构建 → 2b0d440。
  - `npm run test:all` → 1633 pass / 38 skip / 0 fail；tsc → 0；doctor → 71 OK / 0 warn / 0 fail。
  - 两个端到端测试在 22.19.0 / 24.22.0 / 26.8.1 上都通过。
  - Node 20.20.2 下 stderr 恰好一行，以 `then /plugin install sgc@sgc` 结尾。
- 路径修复：`build-cli-paths.test.ts` RED（Received: true）→ 1 pass；在主仓库和 scratchpad 克隆里分别构建 → 同为 blob 4f0257f；全量测试 1632 pass / 38 skip / 0 fail；doctor 71 OK；两个端到端测试在 22.19.0 / 24.22.0 / 26.8.1 上都通过。
- 本轮最终状态（版本号已改为 2.0.0，bundle e0ea140，1,944,054 字节）：`npm run typecheck` → 通过；`npm run test:all` → 通过：1631 pass / 38 skip / 0 fail（1669 个测试，148 个文件；改动前为 1618 pass）；`/tmp` 中新增的 `sgc-*` 为 0；`sgc doctor`（bun 1.3.5）→ 通过：71 OK / 0 warn / 0 fail；`npm audit --omit=dev` → 0。
- 端到端测试：`proxy-canary` 和 `npm-isolated-install` 在 Node 22.19.0 / 24.22.0 / 26.8.1 上都通过；v1.38.5 的 bundle 在 26.8.1 上 proxy-canary 失败（exit 1，CONNECT 次数为 0）。
- Node 18.20.8 / 20.20.2：stdout 正常（2.0.0），stderr 恰好一行提示，其中含 `sdsrss/sgc#v1.38.5`。
- AC2：doctor 用 bun 1.4.2 构建并核对 → ⚠（改动前为 ✓）；用 1.3.5 构建并核对 → ✓。单元测试先 RED（未导出）后 GREEN（10 pass）。
- AC3：PATH 上放 bun 1.4.2 运行 e2e：改动前 blob 989f4ec → 1cdc0da；改动后不变。
- AC6：离线模拟：缺 key → exit 1；4 个测试被跳过 → exit 1。
- LLM 实测：共花费 $2.95（预算保护 $2.80 在每轮开始前检查，最后一轮 full 花了 $0.72，因此超出）；用的是同一把 key 的累计用量，若期间有其他使用会偏高。
- 代理兼容性矩阵（见背景）：真实代理，18 格。
- 已发布 bundle 的端到端复现：Node 22.19.0 / 24.22.0 通过，26.8.1 失败（`canary failure: phase health_url`，CONNECT 计数没有增加）。
