# Icebook

个人书库：把书架搬进浏览器。书脊按分类立在层板上，可以记购入价、翻看次数，写观后感与喜欢的句子，最后看年度阅读与花费。

数据全部存在浏览器 IndexedDB 里，没有账号、没有云端，导出 JSON 就是完整备份。

## 技术栈

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · IndexedDB

## 本地开发

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

## 封面从哪来

豆瓣 → 当当 → Google Books → Open Library，依次尝试，命中率优先中文书。查到之后把图片下载进 IndexedDB（Blob），之后渲染的是 `blob:` 地址，不依赖外网。

豆瓣与当当都没有公开 API 且不允许跨域，所以浏览器不能直连。仓库里带了两套服务端入口，共用同一份逻辑（`server/coverSources.mjs`、`server/coverApi.mjs`）：

- `GET /api/covers?title=&author=` —— 检索并返回封面地址（附 base64 图）
- `GET /api/cover-image?url=` —— 按已记录的地址下载封面（白名单 + 防盗链 Referer），用于导入备份后回填

查不到就退回按书名生成的合成书脊，不会贴错封面。

## 部署

### Cloudflare Workers（静态资源 + 接口）

`dist/` 作为静态资源托管，`worker/index.js` 处理 `/api/*`，配置见 `wrangler.toml`。

在 Cloudflare 控制台用 Git 集成建项目时按下面填：

| 配置项 | 值 |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Path | `/` |
| 环境变量 | `NODE_VERSION` = `22`（`.nvmrc` 已声明，可不填） |

也可以在本地直接发：

```bash
npx wrangler login
npm run deploy
```

### 自建 Node 服务

```bash
npm run build
npm run serve   # 默认 4173，PORT 可改；静态托管 + 两个 API + SPA 回退
```

### 纯静态托管

上传 `dist` 即可，但没有 `/api/*`：中文封面会退回 Google Books / Open Library，命中率明显下降。

## 数据与隐私

- 每个浏览器、每个域名各存一份书柜；换域名或清站点数据前，先在「设置」里导出 JSON。
- 换设备请用导出 / 导入，当前没有账号体系与多端同步。
- 封面检索是公开接口，已按 IP 限流，请不要拿去批量抓取第三方站点。
