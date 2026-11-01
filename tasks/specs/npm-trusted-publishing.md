# npm 发布改用 trusted publishing（GitHub Actions OIDC）
状态：已完成（发布已验证；删除 NPM_TOKEN secret 等用户决定）

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
- [x] AC4（发版时）：`npm view @sdsrs/sgc@<版本> _npmUser` 显示 `GitHub Actions <npm-oidc-no-reply@github.com>`，不是用户的账号名。job 变绿不算数。

## 方案
- 发布入口只有一个：publish.yml 的 `Publish to npm` step（直接 `npm publish`，不是 workflow_call 可复用 workflow，没有 pnpm/yarn/changesets/semantic-release/第三方 publish action）。所以 npmjs.com 上的 workflow filename 填 `publish.yml`。
- 第一轮：已经是 Node 24、`registry-url` 保留；`id-token: write` 在 workflow 级（当时只有一个 job）。第二轮拆成两个 job，见「决策与进展」。
- 原 workflow 没有 token 判空、provenance 回退重发或 "版本已在 npm 上就跳过" 的逻辑，所以只需删 step 级 `env: NODE_AUTH_TOKEN`。
- 第二轮（2026-11-01，用户批准）拆成两个 job：`build`（checkout、npm ci、typecheck、bundle 一致性、版本锁、测试、`npm pack`、上传 artifact）不给 `id-token`；`publish`（`needs: build`，job 级 `id-token: write`）只下载 tarball、setup-node、`npm publish "./dist/$TARBALL"`。原因：同一 job 里任何代码都能请求 OIDC token，npmjs.com 信任本 workflow 之后，这个 token 能换成发布凭据。所有 action 钉到 commit SHA（checkout v5.1.0、setup-node v5.0.0、setup-bun v2.2.0、upload-artifact v7.0.2、download-artifact v8.0.2，后两个与 code-graph-mcp 的钉法相同）。路径必须带 `./`：本地 dry-run 显示 npm 会把 `dist/x.tgz` 当成 GitHub `user/repo` 简写去 `git ls-remote`。
- 仓库里没有检查 workflow 内容的测试（`tests/dispatcher/doctor-bundle-toolchain.test.ts` 用的是内联字符串，不读真实文件），按要求不新建。

## 计划
- [x] S1：改 publish.yml（去 token、改注释） — 覆盖 AC1 AC2 — 执行：主会话
- [x] S2：校验 + 本地提交 — 覆盖 AC3 — 执行：主会话
- [x] S3（除最后一步"问用户是否删 secret"外）：用户说发版时：bump 版本 + CHANGELOG → push → tag → 等 publish 跑完 → AC4 → 问用户是否 `gh secret delete NPM_TOKEN`

## 决策与进展
- CHANGELOG 不加 Unreleased 段（本项目没有这个惯例），本次改动的说明在发版时写进那个版本的条目。CHANGELOG v1.3.0 附近那条 "Requires `NPM_TOKEN` secret" 是历史记录，不改。
- 发版时若 publish 报 401 / 403 / 404：先核对 npmjs.com 上填的值（Organization or user `sdsrss`、Repository `sgc`、Workflow filename `publish.yml`、Environment name 留空、Allowed actions 勾选 `npm publish`）和 `id-token: write`，不要把 token 加回来。
- 更正（2026-11-01）：第一轮只列了 5 个字段，漏了 "Allowed actions"。npm 文档写明 2026-09-03 之后新建的配置默认只允许 `npm stage publish`，本 workflow 直接 `npm publish`，必须勾选。
- 进展（2026-11-01 18:02 UTC）：用户说"已配置"后，tag `v1.38.5`（指向 267ebdb）已 push。publish-npm run 41334205586：build job 全绿，publish job 的 `npm publish` 返回 E404（`PUT https://registry.npmjs.org/@sdsrs%2fsgc - Not found`）。provenance 已签名并写入 sigstore（logIndex 3634942331），说明 `id-token: write` 生效；OIDC 换发布凭据失败，npm 退回占位 token，于是 404。1.38.5 没有发布，latest 仍是 1.38.4。下一步：用户核对 npmjs.com 配置（`npm trust list @sdsrs/sgc` 需要浏览器 OTP，只能用户跑），重点看 Allowed actions 是否含 `npm publish`（CLI 里对应 `--allow-publish`，默认 false）。修好后执行 `gh run rerun 41334205586 --failed`（只重跑 publish job）；若它取不到上次的 artifact 或 outputs，就改为 `gh run rerun 41334205586` 整体重跑。不加回 token。
- `_npmUser` 验证通过之前，不删 `NPM_TOKEN` secret；验证通过后问用户，用户同意了再执行 `gh secret delete NPM_TOKEN`。

## 验证记录
- 改前：`grep -v '^\s*#' .github/workflows/publish.yml | grep -nE 'NPM_TOKEN|NODE_AUTH_TOKEN'` → 命中 1 行（`NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`），确认会失败
- 改后：同一条命令 → 无输出（grep exit 1），通过
- 第一轮（单 job 版本，已被第二轮取代）：js-yaml 解析 publish.yml → 通过：10 个 step（与改前相同），workflow 级 `permissions: {contents: read, id-token: write}`，job 无 `environment:`，setup-node `node-version: "24"` + `registry-url` 保留，publish step 只剩 `run: npm publish --access public --provenance`，没有 `continue-on-error`，解析后的整个结构里没有 NPM_TOKEN / NODE_AUTH_TOKEN
- `npm run typecheck` → 通过（exit 0）
- `npm run test:all`（`SGC_FORCE_INLINE=1 bun test tests/`）→ 通过：1618 pass / 38 skip / 0 fail，147 个文件
- 项目没有 lint 脚本 → lint 无法运行
- 第二轮 job 拆分：临时结构检查（workflow 级无 id-token、只有一个 OIDC job 且只跑 download/setup-node/npm publish、action 全部钉 SHA、非注释行无 token）→ 改前失败 5 项，改后通过；actionlint 1.7.12 → 通过（exit 0）；本地 `npm publish ./dist/<tarball> --dry-run` → 读到 @sdsrs/sgc、5 个文件。
- test.yml 在 59bdc4c、3118830 上 → 失败（bundle 一致性）：提交的 bundle 是本机 bun 1.4.2 构建（e2e 脚本里的 `npm run build:cli` 用了 PATH 上的 bun）。be09510 提交 bun 1.3.5 构建（blob c1f2084）后 → 通过（run 41331375589：1618 pass / 38 skip / 0 fail；LLM smoke 0 pass / 8 skip）。
- 发版前审查（全新子代理，范围 7e309e4..3118830）：Critical 1 项（上面的 bundle，be09510 已修）；Medium：CHANGELOG 数字错（bundle 原大小应为 1694486，doctor 数字只在 bun 1.3.5 下成立）、`NPM_TOKEN` secret 仍在（按计划核对 `_npmUser` 后问用户）；Low：CHANGELOG / 注释夸大 publish job 的精简程度、setup-node 导出占位 `NODE_AUTH_TOKEN`、applied-tracker 第 57 行空格、本 spec 过时。前三类 Low 与 Medium 的数字已修，复审另起新子代理。
- AC4 → 通过：用户改好配置后 `gh run rerun 41334205586 --failed`（只重跑 publish job，复用第一次的 build 结果和 artifact）→ `+ @sdsrs/sgc@1.38.5`；`npm view @sdsrs/sgc@1.38.5 _npmUser` → `GitHub Actions <npm-oidc-no-reply@github.com>`（1.38.4 是 `sdsrs`）；`dist.shasum` d5c68b08… 与 CI tarball 一致；`dist-tags.latest` 1.38.5；provenance 为 SLSA v1；npm 上 tarball 里的 bundle blob c1f2084 与 tag 上的提交一致。这次 OIDC 发布没出现 E403 假阴性（只有一次样本）。GitHub Release v1.38.5 已建。
