# ucloudsync

基于 Cloudflare Workers 的 BUPT UCloud 课程作业同步工具。将 UCloud 中的待办作业自动同步至 Dida365 (TickTick) 指定清单。

## 核心架构

- **Runtime**: Cloudflare Workers (Node.js compatibility mode)
- **Framework**: Hono (Web & Routing)
- **Database**: Cloudflare D1 (SQLite for state & user persistence)
- **UI**: Hono JSX (Server-side rendering)
- **Sync Logic**: 
    - 触发器：Cloudflare Triggers (每分钟执行一次)
    - 并发控制：使用 `Promise.allSettled` 处理多用户同步，防止单点故障阻塞
    - 认证流：BUPT Auth + Dida365 OAuth 2.0

## 安全实现

- **密码加密**：用户 UCloud 密码不以明文存储。采用 **AES-GCM (Web Crypto API)** 对密码进行对称加密，加密密钥由环境变量 `UCLOUD_SECRET` 注入。
- **Cookie 安全**：Session Cookie 强制开启 `HttpOnly`, `Secure`, `SameSite=Lax`。
- **认证鲁棒性**：采用 EAFP 风格的 Token 刷新机制，最小化认证重试开销。

## 环境变量配置 (`wrangler.jsonc`)

| 变量名 | 说明 |
| :--- | :--- |
| `TICKTICK_CLIENT_ID` | Dida365 开放平台 Client ID |
| `TICKTICK_CLIENT_SECRET` | Dida365 开放平台 Client Secret |
| `TICKTICK_REDIRECT_URI` | OAuth 回调地址 (例如 `https://your-worker.workers.dev/oauth/ticktick/callback`) |
| `UCLOUD_SECRET` | **[必填]** 用于 AES 加密的 32 位随机字符串 |

可在 Shell 中运行以下命令生成：
```bash
openssl rand -hex 16
```

## 本地开发

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **初始化 D1 数据库**:
   ```bash
   npx wrangler d1 migrations apply ucloudsync_db --local
   ```

3. **启动开发服务器**:
   ```bash
   npm run dev
   ```

## 部署

1. **创建 D1 数据库**:
   ```bash
   npx wrangler d1 create ucloudsync_db
   ```

2. **执行远程迁移**:
   ```bash
   npx wrangler d1 migrations apply ucloudsync_db --remote
   ```

3. **部署至 Cloudflare**:
   ```bash
   npm run deploy
   ```

## 开发规范

- **Lint/Format**: 使用 [Biome](https://biomejs.dev/)。执行 `npm run check` 进行代码检查。
- **Type Safety**: 修改 `wrangler.jsonc` 后需执行 `npm run cf-typegen` 更新 Bindings 类型。
- **Tests**: 使用 Vitest 进行单元测试 (`npm test`)。

## License

MIT
