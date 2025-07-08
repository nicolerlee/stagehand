# Stagehand 常见问题与解答

## Q1: 为什么通过Stagehand启动Chrome后，手动登录的状态会丢失？

### 问题描述

使用Stagehand启动本地Chrome浏览器时，即使指定了本地Chrome的可执行文件路径，每次启动后都是未登录状态，无法保持之前手动完成的登录状态。

### 原因分析

问题的核心在于**用户数据目录（UserDataDir）的隔离**：

#### 1. 数据存储位置不同

**手动打开Chrome时**：

- 使用系统默认的用户数据目录
- macOS路径：`~/Library/Application Support/Google/Chrome/`
- 所有的登录状态、cookies、localStorage都存储在这里

**通过Stagehand启动Chrome时**：

- 创建临时的用户数据目录
- 路径类似：`/tmp/stagehand/ctx_xxxxx/userdir/`
- 这是一个全新的、空的数据目录

#### 2. 代码层面的证实

从 `lib/index.ts` 中可以看到：

```typescript
let userDataDir = localBrowserLaunchOptions?.userDataDir;
if (!userDataDir) {
  const tmpDirPath = path.join(os.tmpdir(), "stagehand");
  const tmpDir = fs.mkdtempSync(path.join(tmpDirPath, "ctx_"));
  fs.mkdirSync(path.join(tmpDir, "userdir/Default"), { recursive: true });
  userDataDir = path.join(tmpDir, "userdir"); // 👈 临时目录
}
```

这就是为什么每次启动都是"干净"状态的原因。

### 解决方案

#### 方案1：使用真实的Chrome用户数据目录

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    headless: false,
    // 🔥 关键：使用真实的Chrome用户数据目录
    userDataDir: "/Users/你的用户名/Library/Application Support/Google/Chrome/",
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    // 其他配置...
  },
});
```

#### 方案2：连接到已运行的Chrome实例（推荐）

**步骤1**：手动启动Chrome并开启调试模式

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome/"
```

**步骤2**：在代码中连接到已运行的Chrome

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    // 🔥 连接到已运行的Chrome
    cdpUrl: "http://localhost:9222",
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    // 不需要executablePath等其他启动参数
  },
});
```

#### 方案3：复制Chrome数据目录

如果不想直接使用真实的Chrome数据目录（避免冲突），可以复制一份：

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    // 🔥 使用复制的Chrome数据目录
    userDataDir: "/path/to/your/chrome-data-copy",
    preserveUserDataDir: true, // 保留数据目录，不要删除
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    // 其他配置...
  },
});
```

### 推荐方案

推荐使用**方案2（连接到已运行的Chrome）**，因为：

1. **安全性**：不会影响你的主Chrome配置
2. **实时性**：可以看到实时的登录状态
3. **灵活性**：可以随时手动操作浏览器
4. **调试友好**：可以同时进行手动操作和自动化操作

### 实际操作步骤

1. **启动Chrome调试模式**：

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome/"
```

2. **手动完成登录**（在启动的Chrome中）

3. **修改代码连接**：

```typescript
localBrowserLaunchOptions: {
  cdpUrl: "http://localhost:9222",
  viewport: this.viewportSize,
  deviceScaleFactor: this.deviceScaleFactor,
  // 移除executablePath等其他启动参数
},
```

这样你就可以在保持登录状态的Chrome中进行自动化操作了！

---

## Q2: 如何在Stagehand中正确处理认证状态？

### 问题描述

使用Stagehand时，需要保持网站的登录状态，但不知道如何正确处理cookies和localStorage等认证数据。

### 解决方案

#### 方法1：使用storageState文件

```typescript
// 保存认证状态到文件
await page.context().storageState({ path: "auth_state.json" });

// 加载认证状态
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    // 如果有storageState支持，直接使用
    storageState: "auth_state.json",
    // 或者手动加载cookies
    cookies: authState?.cookies || [],
  },
});
```

#### 方法2：手动处理cookies和localStorage

```typescript
// 加载认证状态
if (fs.existsSync(authStatePath)) {
  const authState = JSON.parse(fs.readFileSync(authStatePath, "utf8"));

  // 处理cookies
  if (authState.cookies) {
    await context.addCookies(authState.cookies);
  }

  // 处理localStorage
  if (authState.origins) {
    for (const origin of authState.origins) {
      if (origin.localStorage) {
        await page.evaluate((items) => {
          for (const item of items) {
            localStorage.setItem(item.name, item.value);
          }
        }, origin.localStorage);
      }
    }
  }
}
```

---

## userDataDir 配置问题

### 问题描述

使用 Stagehand 配置 `userDataDir` 时出现错误，尽管 `index.ts` 中的 `getBrowser()` 函数有相关配置。

### 常见错误原因

1. **Chrome 正在运行**

   - 当 Chrome 浏览器正在运行时，其用户数据目录被锁定
   - Playwright 无法访问正在使用的用户数据目录

2. **路径格式问题**

   - 路径末尾的斜杠 `/` 可能导致问题
   - 应使用 `/Users/username/Library/Application Support/Google/Chrome` 而不是 `/Users/username/Library/Application Support/Google/Chrome/`

3. **权限问题**
   - 系统 Chrome 目录可能有访问权限限制
   - 可能需要使用临时目录或副本

### 解决方案

#### 方案1：确保 Chrome 完全关闭

```bash
# 1. 完全退出 Chrome 浏览器
# 2. 确保没有后台 Chrome 进程
# 3. 然后运行 Stagehand 脚本
```

#### 方案2：使用临时目录

```typescript
// 使用临时目录代替系统 Chrome 目录
userDataDir: path.join(os.tmpdir(), "chrome-temp-profile"),
```

#### 方案3：使用 CDP 连接

```typescript
// 让 Chrome 手动启动，然后通过 CDP 连接
localBrowserLaunchOptions: {
  cdpUrl: "http://localhost:9222", // Chrome 的调试端口
}
```

#### 方案4：复制 Chrome 目录

```bash
# 复制 Chrome 用户数据目录到临时位置
cp -r "/Users/username/Library/Application Support/Google/Chrome" "/tmp/chrome-copy"
```

### 推荐做法

1. **开发阶段**：使用临时目录或 CDP 连接
2. **生产阶段**：使用专门的用户数据目录
3. **测试阶段**：使用复制的 Chrome 目录

### 代码示例

```typescript
// 安全的 userDataDir 配置
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    // 推荐：使用临时目录
    userDataDir: path.join(os.tmpdir(), "chrome-automation"),

    // 或者：使用专门的目录
    // userDataDir: path.join(os.homedir(), ".chrome-automation"),

    // 避免：直接使用系统 Chrome 目录（如果 Chrome 正在运行）
    // userDataDir: "/Users/username/Library/Application Support/Google/Chrome",

    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false,
  },
});
```
