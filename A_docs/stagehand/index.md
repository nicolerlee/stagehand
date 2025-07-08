# Stagehand getBrowser 函数分析

## 函数概述

`getBrowser` 函数是 Stagehand 的核心函数，负责根据不同的环境配置（LOCAL 或 BROWSERBASE）创建和管理浏览器实例。

## 函数签名

```typescript
async function getBrowser(
  apiKey: string | undefined,
  projectId: string | undefined,
  env: "LOCAL" | "BROWSERBASE" = "LOCAL",
  headless: boolean = false,
  logger: (message: LogLine) => void,
  browserbaseSessionCreateParams?: Browserbase.Sessions.SessionCreateParams,
  browserbaseSessionID?: string,
  localBrowserLaunchOptions?: LocalBrowserLaunchOptions,
): Promise<BrowserResult>;
```

## 主要流程图

```mermaid
flowchart TD
    A[开始: getBrowser] --> B{env 环境检查}

    B -->|BROWSERBASE| C[验证 apiKey 和 projectId]
    B -->|LOCAL| D[检查 CDP 连接]

    C --> E{是否有 browserbaseSessionID?}
    E -->|有| F[恢复现有会话]
    E -->|无| G[创建新会话]

    F --> H[验证会话状态]
    H -->|状态正常| I[获取 connectUrl]
    H -->|状态异常| J[抛出错误]

    G --> K[调用 browserbase.sessions.create]
    K --> L[获取 sessionId 和 connectUrl]

    I --> M[chromium.connectOverCDP]
    L --> M
    M --> N[获取 debugUrl 和 sessionUrl]
    N --> O[返回 BrowserResult - Browserbase]

    D -->|有 cdpUrl| P[连接到现有浏览器]
    D -->|无 cdpUrl| Q[设置 userDataDir]

    P --> R[chromium.connectOverCDP - Local]
    R --> S[返回 BrowserResult - Local CDP]

    Q --> T{userDataDir 是否存在?}
    T -->|存在| U[使用提供的目录]
    T -->|不存在| V[创建临时目录]

    V --> W[创建临时目录结构]
    W --> X[设置默认配置文件]

    U --> Y[设置 downloadsPath]
    X --> Y

    Y --> Z[chromium.launchPersistentContext]
    Z --> AA[应用各种配置选项]
    AA --> BB{是否有 cookies?}
    BB -->|有| CC[添加 cookies]
    BB -->|无| DD[应用反检测脚本]
    CC --> DD
    DD --> EE[返回 BrowserResult - Local]

    style A fill:#e1f5fe
    style O fill:#c8e6c9
    style S fill:#c8e6c9
    style EE fill:#c8e6c9
    style J fill:#ffcdd2
```

## 架构关系图

```mermaid
graph TB
    subgraph "输入参数"
        A1[apiKey]
        A2[projectId]
        A3[env]
        A4[headless]
        A5[logger]
        A6[browserbaseSessionCreateParams]
        A7[browserbaseSessionID]
        A8[localBrowserLaunchOptions]
    end

    subgraph "核心决策"
        B1[环境选择]
        B2[会话管理]
        B3[连接方式]
        B4[配置应用]
    end

    subgraph "Browserbase 路径"
        C1[Browserbase SDK]
        C2[会话创建/恢复]
        C3[CDP 连接]
        C4[调试信息]
    end

    subgraph "Local 路径"
        D1[CDP 连接检查]
        D2[用户数据目录]
        D3[持久化上下文]
        D4[反检测脚本]
    end

    subgraph "输出结果"
        E1[Browser 实例]
        E2[BrowserContext]
        E3[调试 URL]
        E4[会话信息]
        E5[上下文路径]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B4
    A5 --> B4
    A6 --> B2
    A7 --> B2
    A8 --> B3

    B1 -->|BROWSERBASE| C1
    B1 -->|LOCAL| D1

    C1 --> C2
    C2 --> C3
    C3 --> E1
    C3 --> E2
    C3 --> E3
    C3 --> E4

    D1 -->|有 cdpUrl| E1
    D1 -->|无 cdpUrl| D2
    D2 --> D3
    D3 --> D4
    D4 --> E1
    D4 --> E2
    D4 --> E5

    style C1 fill:#e8f5e8
    style D1 fill:#fff3e0
    style E1 fill:#f3e5f5
    style E2 fill:#f3e5f5
```

## 详细配置选项

### LocalBrowserLaunchOptions 配置

```mermaid
mindmap
  root((LocalBrowserLaunchOptions))
    连接配置
      cdpUrl
      userDataDir
      executablePath
    视窗配置
      headless
      viewport
        width
        height
      deviceScaleFactor
    网络配置
      proxy
      extraHTTPHeaders
      ignoreHTTPSErrors
    功能配置
      cookies
      permissions
      geolocation
      hasTouch
    调试配置
      devtools
      recordVideo
      recordHar
      tracesDir
    安全配置
      bypassCSP
      chromiumSandbox
      args
```

## 用户数据目录处理流程

```mermaid
sequenceDiagram
    participant F as getBrowser 函数
    participant FS as 文件系统
    participant T as 临时目录
    participant C as Chrome 配置

    F->>F: 检查 userDataDir

    alt userDataDir 存在
        F->>F: 使用提供的目录
    else userDataDir 不存在
        F->>T: 创建临时目录路径
        T->>FS: 创建 stagehand 目录
        FS->>T: 生成唯一临时目录
        T->>FS: 创建 userdir/Default 结构
        F->>C: 写入默认配置文件
        C->>FS: 保存 Preferences 文件
        F->>F: 设置 userDataDir 路径
    end

    F->>F: 继续浏览器启动流程
```

## 反检测脚本应用

```mermaid
flowchart LR
    A[applyStealthScripts] --> B[覆盖 navigator.webdriver]
    B --> C[模拟 languages 属性]
    C --> D[模拟 plugins 属性]
    D --> E[删除 Playwright 标识]
    E --> F[重定义 headless 属性]
    F --> G[覆盖 permissions API]

    style A fill:#fff3cd
    style G fill:#d4edda
```

## 错误处理机制

```mermaid
graph TD
    A[错误检测] --> B{错误类型}

    B -->|环境变量缺失| C[MissingEnvironmentVariableError]
    B -->|会话状态异常| D[StagehandError]
    B -->|连接失败| E[网络错误]
    B -->|文件系统错误| F[文件操作错误]

    C --> G[抛出错误并终止]
    D --> G
    E --> G
    F --> G

    style C fill:#ffcdd2
    style D fill:#ffcdd2
    style E fill:#ffcdd2
    style F fill:#ffcdd2
    style G fill:#ff5252,color:#fff
```

## 返回值结构

```typescript
interface BrowserResult {
  browser: Browser | undefined;
  context: BrowserContext | undefined;
  debugUrl?: string; // Browserbase 专用
  sessionUrl?: string; // Browserbase 专用
  sessionId?: string; // Browserbase 专用
  contextPath?: string; // Local 专用
  env: "LOCAL" | "BROWSERBASE";
}
```

## 关键决策点

1. **环境选择**：根据 `env` 参数决定使用本地浏览器还是 Browserbase
2. **连接方式**：本地环境可选择 CDP 连接或新建浏览器
3. **会话管理**：Browserbase 支持会话恢复和新建
4. **配置应用**：大量可选配置项的默认值处理
5. **错误处理**：不同场景的错误类型和处理方式

## 性能优化建议

1. **本地开发**：使用 CDP 连接减少启动时间
2. **生产环境**：使用 Browserbase 提供的云端浏览器
3. **用户数据**：合理配置 userDataDir 避免冲突
4. **资源管理**：确保正确的清理和关闭流程
