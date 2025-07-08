# CDP (Chrome DevTools Protocol) 使用指南

## 什么是 CDP？

CDP (Chrome DevTools Protocol) 是 Chrome 浏览器提供的调试协议，允许外部工具通过 WebSocket 连接来控制浏览器。

## 本地 CDP 设置步骤

### 1. 启动带有调试端口的 Chrome

```bash
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --disable-extensions \
  --disable-default-apps

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --disable-extensions \
  --disable-default-apps

# Linux
google-chrome \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --disable-extensions \
  --disable-default-apps
```

### 2. 验证 CDP 连接

访问 `http://localhost:9222` 可以看到可用的页面列表：

```json
[
  {
    "description": "",
    "devtoolsFrontendUrl": "/devtools/inspector.html?ws=localhost:9222/devtools/page/...",
    "id": "A1B2C3D4E5F6",
    "title": "New Tab",
    "type": "page",
    "url": "chrome://newtab/",
    "webSocketDebuggerUrl": "ws://localhost:9222/devtools/page/A1B2C3D4E5F6"
  }
]
```

### 3. 在 Stagehand 中使用 CDP

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    cdpUrl: "http://localhost:9222", // 连接到已运行的 Chrome
    // 其他配置...
  },
});

await stagehand.init();
```

## CDP 使用的优势

### ✅ 优点

1. **快速启动**：无需重新启动浏览器
2. **保持状态**：浏览器的登录状态、书签等都保持不变
3. **调试方便**：可以同时使用开发者工具
4. **资源共享**：多个脚本可以连接同一个浏览器实例

### ❌ 缺点

1. **手动管理**：需要手动启动和管理 Chrome 实例
2. **端口冲突**：可能与其他应用冲突
3. **不够隔离**：多个脚本共享同一个浏览器环境

## 实际使用示例

### 基本连接示例

```typescript
// save_auth_state.ts 中的 CDP 使用
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    cdpUrl: "http://localhost:9222",
    // 注意：使用 CDP 时，userDataDir 会被忽略
    // 因为连接的是现有的浏览器实例
  },
});

await stagehand.init();
const page = stagehand.page;
```

### 高级 CDP 配置

```typescript
// 启动 Chrome 的脚本
const startChrome = async () => {
  const { exec } = require("child_process");

  const chromeCommand = `
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --remote-debugging-port=9222 \
    --user-data-dir="/tmp/chrome-debug" \
    --no-first-run \
    --disable-extensions \
    --disable-default-apps \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding
  `;

  exec(chromeCommand, (error, stdout, stderr) => {
    if (error) {
      console.error("Chrome 启动失败:", error);
      return;
    }
    console.log("Chrome 已启动，调试端口: 9222");
  });
};

// 等待 Chrome 启动后再连接
await new Promise((resolve) => setTimeout(resolve, 3000));

const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    cdpUrl: "http://localhost:9222",
  },
});
```

## 常见问题解决

### 1. 连接失败

```bash
# 检查端口是否被占用
lsof -i :9222

# 或者使用 netstat
netstat -an | grep 9222
```

### 2. 权限问题

```bash
# 确保 Chrome 有写入权限
chmod 755 /tmp/chrome-debug
```

### 3. 多实例冲突

```typescript
// 使用不同的端口
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    cdpUrl: "http://localhost:9223", // 不同端口
  },
});
```

## 自动化脚本

### 启动脚本 (start-chrome.sh)

```bash
#!/bin/bash
# 检查 Chrome 是否已运行
if pgrep -f "remote-debugging-port=9222" > /dev/null; then
    echo "Chrome 调试实例已在运行"
else
    echo "启动 Chrome 调试实例..."
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
        --remote-debugging-port=9222 \
        --user-data-dir="/tmp/chrome-debug" \
        --no-first-run \
        --disable-extensions \
        --disable-default-apps &

    # 等待 Chrome 启动
    sleep 3
    echo "Chrome 已启动，调试端口: 9222"
fi
```

### 停止脚本 (stop-chrome.sh)

```bash
#!/bin/bash
# 停止 Chrome 调试实例
pkill -f "remote-debugging-port=9222"
echo "Chrome 调试实例已停止"
```

## 与 userDataDir 的区别

| 配置方式    | 优点                   | 缺点                 | 适用场景           |
| ----------- | ---------------------- | -------------------- | ------------------ |
| cdpUrl      | 快速、保持状态、可调试 | 需手动管理、不够隔离 | 开发调试、快速测试 |
| userDataDir | 完全控制、隔离性好     | 启动慢、状态丢失     | 自动化、生产环境   |

## 推荐用法

### 开发阶段

```typescript
// 使用 CDP 连接，方便调试
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    cdpUrl: "http://localhost:9222",
  },
});
```

### 生产环境

```typescript
// 使用 userDataDir，确保隔离
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    userDataDir: "/path/to/isolated/profile",
    executablePath: "/path/to/chrome",
  },
});
```

### 混合使用

```typescript
// 根据环境变量选择
const isDevelopment = process.env.NODE_ENV === "development";

const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: isDevelopment
    ? {
        cdpUrl: "http://localhost:9222",
      }
    : {
        userDataDir: "/path/to/profile",
        executablePath: "/path/to/chrome",
      },
});
```
