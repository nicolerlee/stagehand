# how to run
项目根目录下，运行
pnpm exec tsx A_workspace_h5novel/test_h5novel.ts
pnpm exec tsx A_workspace_h5novel/save_auth_state.ts

# H5 Novel 认证状态管理

本项目提供两种方式来管理浏览器认证状态：

## 方式一：userDataDir 方式（传统方式）

### 文件：`auth_data/save_auth_state.ts`

**使用步骤：**
1. **完全关闭所有 Chrome 浏览器实例**
2. 运行脚本：
   ```bash
   cd A_workspace_h5novel
   npx ts-node auth_data/save_auth_state.ts
   ```
3. 选择选项 1 进行认证状态保存
4. 在打开的浏览器中完成登录
5. 登录完成后按回车键保存状态

**优点：**
- 完全控制浏览器环境
- 适合自动化和生产环境
- 状态隔离性好

**缺点：**
- 需要关闭现有 Chrome 实例
- 启动较慢
- 可能遇到 userDataDir 冲突

## 方式二：CDP 连接方式（推荐）

### 文件：`auth_data/save_auth_state_cdp.ts`

**使用步骤：**
1. 运行脚本（无需关闭 Chrome）：
   ```bash
   cd A_workspace_h5novel
   npx ts-node auth_data/save_auth_state_cdp.ts
   ```
2. 脚本会自动启动 Chrome 调试实例（端口 9222）
3. 选择选项 1 进行认证状态保存
4. 在浏览器中完成登录
5. 登录完成后按回车键保存状态

**优点：**
- 快速启动，无需关闭现有 Chrome
- 可以同时使用开发者工具调试
- 支持多脚本连接同一浏览器
- 保持原有登录状态

**缺点：**
- 需要手动管理 Chrome 调试实例
- 可能有端口冲突

## CDP 方式详细功能

### 可用选项：
1. **保存认证状态** - 启动调试 Chrome 并保存登录状态
2. **加载认证状态** - 使用已保存的状态访问网站
3. **停止 Chrome 调试实例** - 清理资源
4. **检查 CDP 连接状态** - 验证连接是否正常

### 手动启动 Chrome 调试实例：
```bash
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  --no-first-run \
  --disable-extensions

# 验证连接
open http://localhost:9222
```

### 停止调试实例：
```bash
pkill -f "remote-debugging-port=9222"
```

## 配置说明

### StagehandConfig 配置
两种方式都使用相同的基础配置，区别在于连接方式：

```typescript
// userDataDir 方式
localBrowserLaunchOptions: {
  userDataDir: "/Users/username/Library/Application Support/Google/Chrome",
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  // ... 其他配置
}

// CDP 方式
localBrowserLaunchOptions: {
  cdpUrl: "http://localhost:9222",
  // userDataDir 和 executablePath 会被忽略
  // ... 其他配置仍然有效
}
```

## 故障排除

### userDataDir 方式常见问题：
- **错误**：`Error: Cannot create a new context in a running browser`
  - **解决**：确保所有 Chrome 实例已关闭
  - **备用方案**：使用 CDP 方式

### CDP 方式常见问题：
- **错误**：`CDP 连接失败`
  - **检查端口**：`lsof -i :9222`
  - **重启 Chrome**：停止并重新启动调试实例

## 推荐使用场景

| 场景 | 推荐方式 | 原因 |
|------|----------|------|
| 开发调试 | CDP | 快速、方便、可调试 |
| 自动化脚本 | userDataDir | 完全控制、隔离性好 |
| 快速测试 | CDP | 无需关闭现有浏览器 |
| 生产环境 | userDataDir | 稳定性更好 |

## 文件说明

- `save_auth_state.ts` - userDataDir 方式的认证管理
- `save_auth_state_cdp.ts` - CDP 方式的认证管理  
- `storage_state.json` - userDataDir 方式保存的状态文件
- `storage_state_cdp.json` - CDP 方式保存的状态文件
- `test_h5novel.ts` - 使用认证状态的测试脚本
