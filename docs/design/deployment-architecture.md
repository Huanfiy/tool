# 发布产物与外部部署边界

> 对应实现：`run.sh`、`.gitattributes`

## 1. 架构原则

本仓库是公开的纯静态博客项目，管理站点源文件、文章索引、发布产物规则和通用预览/部署入口，不提供应用后端，也不保存生产服务器的实际配置或秘密。Robot 仅保留「研究中」占位；通用 Server 计划已移出工作区（git 历史 `2d9c4e7` 可查），不属于当前部署流程。

实际服务器与托管平台的实例配置必须位于仓库之外，包括但不限于：

- Nginx、Apache、Caddy 或其他 Web Server 配置；
- 域名解析、TLS 证书路径与续期策略；
- 服务器账号、主机地址、部署目录与 SSH 配置；
- 反向代理、访问认证、重定向、缓存头和 MIME 映射；
- CDN、对象存储、Release 目录、软链接与回滚策略；
- 密码文件、Token、Cookie 规则和受保护下载目录。

上述内容应由私有基础设施仓库、托管平台控制台或运行环境管理。`/deploy/nginx/` 已加入 `.gitignore`，防止本机配置重新进入版本控制。

## 2. 覆盖范围与非覆盖范围

### 2.1 仓库覆盖范围

- `./run.sh gen`：从 `posts/*.md` 生成 `posts/posts.json`；
- `git archive`：从指定 Git 提交生成临时发布产物；
- `.gitattributes`：排除开发、文档与运维文件；
- `deploy-version.json`：记录产物对应的完整 Git SHA；
- Artifact 校验：检查必需文件、JSON 和 JavaScript 语法；
- 可选 rsync 传输：目标地址由环境变量注入；
- 通用线上 Smoke Test：检查版本标记、核心页面与静态资源可访问性。

### 2.2 仓库不覆盖范围

- Web Server、容器、虚拟机或托管平台配置；
- 生产环境的缓存、压缩、MIME、TLS、认证与代理策略；
- 实际 SSH 密钥、服务器身份、主站目录规划与人工运维数据；
- 自动扩缩容、流量切换、原子发布和自动回滚；
- GitHub Actions、GitHub Pages、Cloudflare Pages、Netlify、Vercel 等平台专属工作流。

平台专属部署可以绕过 `./run.sh deploy`，使用平台自身的静态发布流程。静态站点运行不依赖 rsync 或特定 Web Server，不需要启动 Robot 或其他应用服务。实际 Web Server、TLS、密码和主机配置仍由运行环境管理。

## 3. 数据流

```text
Git 提交
   ↓
git archive <git-ref>
   ↓
临时 Artifact
   ├─ 可选：重建 posts/posts.json
   ├─ 写入 deploy-version.json
   └─ 校验文件、JSON 与 JavaScript
   ↓
外部注入 DEPLOY_TARGET
   ↓
rsync 传输，或由外部平台采用其他发布方式
   ↓
外部注入 PUBLIC_BASE_URL
   ↓
版本与核心资源 Smoke Test
```

部署链路不读取仓库内的服务器配置文件，也不推断主机、账号、目录或域名。

## 4. 发布产物

### 4.1 产物来源

`./run.sh deploy [git-ref]` 将目标引用解析为完整 Git SHA，再执行：

```bash
git archive --format=tar <commit-sha>
```

Artifact 只包含目标提交中的跟踪文件。工作区修改、未跟踪文件和 `.git/` 不会进入产物。部署前仍要求工作区保持干净，避免将本地状态误认为目标提交状态。

### 4.2 导出边界

`.gitattributes` 使用 `export-ignore` 排除以下内容：

- `.gitattributes`、`.gitignore`；
- `.cursor/`、`.claude/`、`AGENTS.md`、`docs-rules.md`；
- `README.md`、`*.log`、`.DS_Store`、`*.test.js`；
- `run.sh`、`deploy/`、`server/`、`agents/`、`tests/`、`tmp/`、`build/` 和 `.venv/`；
- `.env*`、`*.sqlite3*`、`testkey.txt` 等运行时敏感文件。

发布产物不包含项目协作说明、研究计划、测试文件或运维目录。对 `server/` 等路径的防误发规则不表示当前存在后端实现。

### 4.3 版本标记

部署时在临时 Artifact 根目录生成 `deploy-version.json`：

```json
{
  "schema": 1,
  "commit": "完整 Git SHA",
  "ref": "请求部署的引用",
  "generated_at": "UTC 时间"
}
```

该文件用于部署后核对线上版本，不属于业务配置，也不写回工作区。

## 5. 外部配置接口

`./run.sh deploy` 使用以下环境变量：

| 变量 | 必填 | 作用 |
|---|---|---|
| `DEPLOY_TARGET` | 是 | rsync 目标；支持远程地址或本地目录 |
| `PUBLIC_BASE_URL` | 是 | 部署完成后的公开访问地址，用于 Smoke Test |
| `DEPLOY_REQUIRED_REF` | 否 | 设置后要求目标提交位于该 Git 引用历史中 |

示例：

```bash
DEPLOY_TARGET='user@example.com:/srv/www/blog/' \
PUBLIC_BASE_URL='https://blog.example.com' \
DEPLOY_REQUIRED_REF='origin/main' \
./run.sh deploy HEAD
```

示例值仅说明变量格式。真实服务器账号、SSH 主机和部署目录不得以部署配置形式写入受跟踪文件；站点 Canonical URL、Sitemap 等公开内容不受此限制。脚本不会自动执行 `git fetch`；使用 `DEPLOY_REQUIRED_REF` 前，应由调用环境更新对应引用。

## 6. 文章索引模式

常规部署使用目标提交中已有的 `posts/posts.json`。文章发布前执行：

```bash
./run.sh gen
```

`--gen` 只在临时 Artifact 内重建索引：

```bash
./run.sh deploy --gen <git-ref>
```

该选项不会修改工作区，不替代发布前审查并提交索引的常规流程。文章字段与生成规则见 [blog-auto-publish.md](blog-auto-publish.md)。

## 7. 通用部署行为

rsync 传输使用以下稳定参数：

- `--delay-updates`：文件传输完成后再切换临时文件；
- `--delete-delay`：传输完成后删除目标端多余文件；
- `--chmod=D755,F644`：Artifact 目录设为 `0755`，文件设为 `0644`。

该传输方式不具备原子发布语义。若托管环境要求零混合版本窗口或秒级回退，应在仓库之外采用 Release 目录、软链接切换或平台原子部署能力。

## 8. Smoke Test 边界

部署完成后，脚本验证：

- `/deploy-version.json` 的 `commit` 等于目标 Git SHA；
- 首页、博客页、工具页和关于页可访问；
- 共享 CSS、共享 JavaScript、动态数据与 Web App Manifest 可访问。

脚本不验证以下服务器策略：

- `Cache-Control`、ETag 或 Last-Modified；
- Content-Type 与 MIME 映射；
- HTTPS、证书链、域名重定向；
- 压缩、CDN、认证或反向代理行为。

这些策略由外部托管环境负责。项目页面应避免依赖某一种 Web Server 的私有行为。

## 9. 回退

通用 rsync 部署可重新发布上一稳定提交：

```bash
DEPLOY_TARGET='user@example.com:/srv/www/blog/' \
PUBLIC_BASE_URL='https://blog.example.com' \
./run.sh deploy <previous-stable-sha>
```

该方式会重新传输文件，不等同于原子回滚。使用 GitHub Pages、Cloudflare Pages 或其他托管平台时，应使用对应平台的版本回退能力。

## 10. 验收清单

- [ ] 仓库内不存在 Nginx 或其他生产 Web Server 配置；
- [ ] 仓库内不存在服务器账号、部署目录、证书路径或认证文件；
- [ ] `DEPLOY_TARGET` 与 `PUBLIC_BASE_URL` 由运行环境注入；
- [ ] Artifact 仅来自指定 Git 提交；
- [ ] `deploy-version.json` 与目标提交一致；
- [ ] 核心页面与静态资源可访问；
- [ ] 平台专属缓存、TLS、MIME 和回退策略在仓库外验证。
