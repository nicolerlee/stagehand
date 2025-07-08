# Stagehand 使用指南

## 🎭 Playwright vs Stagehand 浏览器启动方式差异

### 📊 核心差异对比

| 方面           | Playwright 原生               | Stagehand 实现                               |
| -------------- | ----------------------------- | -------------------------------------------- |
| **API方法**    | `chromium.launch()`           | `chromium.launchPersistentContext()`         |
| **浏览器选择** | ✅ 支持 `channel: "chrome"`   | ❌ 不支持 `channel`，只支持 `executablePath` |
| **内置浏览器** | ✅ 可使用Playwright内置Chrome | ❌ 必须指定本地浏览器路径                    |

### 🎪 为什么存在这种差异？

#### Playwright 原生方式：

```typescript
// Playwright 可以这样做
const browser = await chromium.launch({
  channel: "chrome", // ✅ 使用Playwright内置的Chrome
});
const context = await browser.newContext();
```

#### Stagehand 使用的方式：

```typescript
// Stagehand内部使用 launchPersistentContext
const context = await chromium.launchPersistentContext(userDataDir, {
  // ❌ launchPersistentContext 不支持 channel 参数！
  executablePath: localBrowserLaunchOptions?.executablePath, // 只能用这个
  headless: localBrowserLaunchOptions?.headless ?? headless,
  // ... 其他配置
});
```

### 🔍 为什么 Stagehand 选择 `launchPersistentContext`？

Stagehand 优先考虑了**持久化上下文**的需求，从源码可以看出：

```typescript
// Stagehand的实现逻辑
let userDataDir = localBrowserLaunchOptions?.userDataDir;
if (!userDataDir) {
  // 自动创建临时用户数据目录
  const tmpDir = fs.mkdtempSync(path.join(tmpDirPath, "ctx_"));
  userDataDir = path.join(tmpDir, "userdir");
}

const context = await chromium.launchPersistentContext(userDataDir, {
  // 配置选项...
});
```

### 📈 设计权衡分析

#### Stagehand 的优势：

- 🍪 **自动持久化**：cookies、localStorage、sessionStorage自动保存
- 🔐 **登录状态保持**：非常适合需要登录的自动化测试
- 📁 **用户数据管理**：自动管理用户数据目录
- 🔄 **会话恢复**：可以在多次运行之间保持状态

#### 付出的代价：

- 🚫 **不支持channel参数**：无法使用Playwright内置Chrome
- 📍 **必须指定路径**：需要本地安装Chrome并指定路径

### 💡 解决方案

#### 方案1：使用默认Chromium（推荐）

```typescript
const stagehand = new Stagehand({
  ...StagehandConfig,
  env: "LOCAL",
  localBrowserLaunchOptions: {
    // 删除 executablePath，使用默认Chromium
    // executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false,
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    // ... 其他配置
  },
});
```

#### 方案2：指定本地Chrome路径

```typescript
const stagehand = new Stagehand({
  ...StagehandConfig,
  env: "LOCAL",
  localBrowserLaunchOptions: {
    headless: false,
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,

    // Chrome浏览器配置
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

    // Chrome启动参数优化
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--no-first-run",
    ],

    // 权限设置
    permissions: ["midi"],
  },
});
```

### 🎯 使用建议

1. **对于大多数测试场景**：使用方案1（默认Chromium）即可
2. **对于需要特定Chrome版本的场景**：使用方案2并指定Chrome路径
3. **对于需要登录状态的测试**：Stagehand的持久化上下文特别有用

### 📚 总结

Stagehand 选择 `launchPersistentContext` 是为了更好地支持**有状态的自动化测试**，特别是需要登录和保持会话的场景。这是一个在**便利性**和**功能性**之间的权衡，Stagehand 选择了更适合复杂自动化场景的方案。

对于H5小说测试这种需要保持登录状态的场景，这种设计选择是非常合适的。
