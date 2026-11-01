# npm 发布改用 trusted publishing（GitHub Actions OIDC）
状态：进行中

## 背景与目标
`@sdsrs/sgc` 原来由 `.github/workflows/publish.yml` 用仓库 secret `NPM_TOKEN`（经 `NODE_AUTH_TOKEN`）发布。改成 npm trusted publishing：npm CLI 用 GitHub Actions 的 OIDC token 换一个短期发布凭据，仓库里不再需要长期 token。

关键约束（docs.npmjs.com/trusted-publishers；code-graph-mcp 0.179.4 已用同样配置发布成功）：npm CLI ≥ 11.5.1、Node ≥ 22.14.0；只支持 GitHub 自带的 runner；发布 job 要有 `id-token: write`；`package.json` 的 `repository.url` 要对应本仓库。npm 11 先尝试 OIDC，失败时只在 verbose 日志里记一行，然后改用环境里的 token。所以只要 token 还在环境里，trust 配置错了也照样能发出去，job 也是绿的。

## 范围
- 做：publish.yml 去掉 `NODE_AUTH_TOKEN` / `NPM_TOKEN`，改写相关注释；改掉提到 NPM_TOKEN 的仓库文档、测试；本地提交。
- 不做：push、打 tag、发版；npmjs.com 上的配置（由用户做）；删除仓库 secret（发版验证后再问用户）；docs 里记录的 provenance E403 假阴性问题；改写 CHANGELOG 里的历史条目。

## 验收标准
- [x] AC1：publish.yml 的非注释行不出现 `NPM_TOKEN` / `NODE_AUTH_TOKEN` — 验证：`grep -v '^\s*#' .github/workflows/publish.yml | grep -nE 'NPM_TOKEN|NODE_AUTH_TOKEN'` 无输出（改之前有输出）
- [x] AC2：发布 job 用 Node 24、带 `id-token: write`，`npm publish` 失败时没有任何分支能让 job 变绿 — 验证：读 publish.yml
- [x] AC3：publish.yml 是合法 YAML，现有测试和 typecheck 通过 — 验证：js-yaml 解析；`npm run typecheck`；`SGC_FORCE_INLINE=1 bun test tests/dispatcher tests/eval`
- [ ] AC4（发版时）：`npm view @sdsrs/sgc@<版本> _npmUser` 显示 `GitHub Actions <npm-oidc-no-reply@github.com>`，不是用户的账号名。job 变绿不算数。

## 方案
- 发布入口只有一个：publish.yml 的 `Publish to npm` step（直接 `npm publish`，不是 workflow_call 可复用 workflow，没有 pnpm/yarn/changesets/semantic-release/第三方 publish action）。所以 npmjs.com 上的 workflow filename 填 `publish.yml`。
- 已经是 Node 24、`registry-url` 保留；`id-token: write` 保持 workflow 级（只有一个 job）。
- 原 workflow 没有 token 判空、provenance 回退重发或 "版本已在 npm 上就跳过" 的逻辑，所以只需删 step 级 `env: NODE_AUTH_TOKEN`。
- 仓库里没有检查 workflow 内容的测试（`tests/dispatcher/doctor-bundle-toolchain.test.ts` 用的是内联字符串，不读真实文件），按要求不新建。

## 计划
- [x] S1：改 publish.yml（去 token、改注释） — 覆盖 AC1 AC2 — 执行：主会话
- [x] S2：校验 + 本地提交 — 覆盖 AC3 — 执行：主会话
- [ ] S3：用户说发版时：bump 版本 + CHANGELOG → push → tag → 等 publish 跑完 → AC4 → 问用户是否 `gh secret delete NPM_TOKEN`

## 决策与进展
- CHANGELOG 不加 Unreleased 段（本项目没有这个惯例），本次改动的说明在发版时写进那个版本的条目。CHANGELOG v1.3.0 附近那条 "Requires `NPM_TOKEN` secret" 是历史记录，不改。
- 发版时若 publish 报 401 / 403 / 404：先核对 npmjs.com 上填的值（Organization or user `sdsrss`、Repository `sgc`、Workflow filename `publish.yml`、Environment 留空）和 `id-token: write`，不要把 token 加回来。
- `_npmUser` 验证通过之前，不删 `NPM_TOKEN` secret；验证通过后问用户，用户同意了再执行 `gh secret delete NPM_TOKEN`。

## 验证记录
- 改前：`grep -v '^\s*#' .github/workflows/publish.yml | grep -nE 'NPM_TOKEN|NODE_AUTH_TOKEN'` → 命中 1 行（`NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`），确认会失败
- 改后：同一条命令 → 无输出（grep exit 1），通过
- js-yaml 解析 publish.yml → 通过：10 个 step（与改前相同），workflow 级 `permissions: {contents: read, id-token: write}`，job 无 `environment:`，setup-node `node-version: "24"` + `registry-url` 保留，publish step 只剩 `run: npm publish --access public --provenance`，没有 `continue-on-error`，解析后的整个结构里没有 NPM_TOKEN / NODE_AUTH_TOKEN
- `npm run typecheck` → 通过（exit 0）
- `npm run test:all`（`SGC_FORCE_INLINE=1 bun test tests/`）→ 通过：1618 pass / 38 skip / 0 fail，147 个文件
- 项目没有 lint 脚本 → lint 无法运行
- AC4 → 未运行（等用户让发版）
