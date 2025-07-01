# Stagehand.agent() 调用关系分析

## 🔍 概述

当调用 `stagehand.agent()` 时，根据是否传入参数，会走**完全不同**的两条路径：

- **参数为空**：使用 Open Operator 模式，**不涉及** `/lib/agent` 文件夹中的任何组件
- **有参数**：使用 Computer Use Agent 模式，**完全依赖** `/lib/agent` 文件夹中的组件

## 📊 调用路径对比

### 1. 核心分支逻辑

```typescript
// lib/index.ts - agent方法
agent(options?: AgentConfig) {
  if (!options || !options.provider) {
    // 路径A：Open Operator模式（不使用/lib/agent文件夹的组件）
    return {
      execute: async (instructionOrOptions: string | AgentExecuteOptions) => {
        return new StagehandOperatorHandler(
          this.stagehandPage,
          this.logger,
          this.llmClient,
        ).execute(instructionOrOptions);
      },
    };
  }

  // 路径B：Computer Use Agent模式（使用/lib/agent文件夹的组件）
  const agentHandler = new StagehandAgentHandler(/*...*/);
  return { execute: agentHandler.execute };
}
```

### 2. 两种模式架构图

```mermaid
graph TD
    A["用户调用<br/>stagehand.agent()"] --> B{检查参数}
    B -->|无参数| C["创建StagehandOperatorHandler"]
    B -->|有参数| D["创建StagehandAgentHandler"]

    C --> E["StagehandOperatorHandler.execute()"]
    E --> F["循环执行步骤"]
    F --> G["截图 + 发送给LLM"]
    G --> H["LLM返回下一步动作"]
    H --> I["执行动作<br/>(act/extract/goto等)"]
    I --> J["page.observe() + page.act()"]
    J --> K{任务完成?}
    K -->|否| F
    K -->|是| L["返回AgentResult"]

    D --> M["AgentProvider.getClient()"]
    M --> N["创建OpenAI/AnthropicCUAClient"]
    N --> O["StagehandAgent.execute()"]
    O --> P["Computer Use Agent执行"]

    style C fill:#e1f5fe
    style D fill:#fff3e0
    style J fill:#f3e5f5
```

## 🔄 Open Operator 模式详细调用序列

### 参数为空时的完整调用链

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant SH as Stagehand
    participant OH as StagehandOperatorHandler
    participant SP as StagehandPage
    participant LLM as LLMClient
    participant Page as page.observe/act

    User->>SH: stagehand.agent()
    Note over SH: 检查options为空
    SH->>SH: 创建execute函数
    SH-->>User: 返回{execute: function}

    User->>SH: agent.execute("指令")
    SH->>OH: new StagehandOperatorHandler(stagehandPage, logger, llmClient)
    OH->>OH: 初始化messages数组

    loop 最多maxSteps次
        OH->>SP: page.screenshot()
        SP-->>OH: base64Image

        OH->>OH: 构建消息(截图+历史动作)
        OH->>LLM: createChatCompletion(operatorResponseSchema)
        LLM-->>OH: OperatorResponse{method, parameters, reasoning}

        alt method == "act"
            OH->>Page: page.observe(parameters)
            Page-->>OH: ObserveResult
            OH->>Page: page.act(ObserveResult)
        else method == "extract"
            OH->>Page: page.extract(parameters)
            Page-->>OH: extractionResult
        else method == "goto"
            OH->>SP: page.goto(parameters)
        else method == "close"
            Note over OH: 任务完成，退出循环
        end

        OH->>OH: 记录动作到actions数组
    end

    OH->>LLM: getSummary(goal)
    LLM-->>OH: 任务总结
    OH-->>SH: AgentResult
    SH-->>User: 最终结果
```

## 🆚 Computer Use Agent 模式调用序列

### 有参数时的完整调用链

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant SH as Stagehand
    participant AH as StagehandAgentHandler
    participant AP as AgentProvider
    participant AC as AgentClient
    participant SA as StagehandAgent

    User->>SH: stagehand.agent({provider: "openai"})

    SH->>AH: new StagehandAgentHandler(options)
    AH->>AP: new AgentProvider(logger)
    AH->>AP: getClient(modelName, options)
    AP->>AC: new OpenAICUAClient() / AnthropicCUAClient()
    AC-->>AP: AgentClient实例
    AP-->>AH: 返回client

    AH->>AH: setupAgentClient()
    Note over AH: 设置截图提供者和动作处理器

    AH->>SA: new StagehandAgent(client, logger)
    SA-->>AH: StagehandAgent实例
    AH-->>SH: 配置完成
    SH-->>User: 返回{execute: function}

    User->>SH: agent.execute("指令")
    SH->>AH: execute(options)
    AH->>SA: execute(options)
    SA->>AC: execute(executionOptions)

    loop Computer Use Agent循环
        AC->>AC: 截图 + LLM推理
        AC->>AH: executeAction(action)
        AH->>AH: 执行具体动作(click/type等)
        AH->>AC: 动作完成 + 新截图
    end

    AC-->>SA: AgentResult
    SA-->>AH: AgentResult
    AH-->>SH: AgentResult
    SH-->>User: 最终结果
```

## 🔍 关键差异分析

### 1. 组件使用差异

```mermaid
graph LR
    subgraph "参数为空: Open Operator"
        A1["stagehand.agent()"] --> B1["StagehandOperatorHandler"]
        B1 --> C1["截图 + LLM推理"]
        C1 --> D1["page.observe()"]
        D1 --> E1["page.act()"]
        E1 --> F1["DOM操作"]
    end

    subgraph "有参数: Computer Use Agent"
        A2["stagehand.agent({provider})"] --> B2["StagehandAgentHandler"]
        B2 --> C2["AgentProvider"]
        C2 --> D2["AgentClient"]
        D2 --> E2["StagehandAgent"]
        E2 --> F2["像素坐标操作"]
    end

    subgraph "关键差异"
        G1["Open Operator<br/>- 不使用/lib/agent组件<br/>- 基于DOM分析<br/>- 成本更低<br/>- 序列化工具调用"]
        G2["Computer Use Agent<br/>- 使用/lib/agent组件<br/>- 基于视觉识别<br/>- 功能更强大<br/>- 并行视觉推理"]
    end

    F1 --> G1
    F2 --> G2

    style B1 fill:#e8f5e8
    style B2 fill:#fff8e1
    style G1 fill:#e8f5e8
    style G2 fill:#fff8e1
```

### 2. 具体调用路径对比

| 特性                   | Open Operator 模式                                  | Computer Use Agent 模式                           |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------- |
| **触发条件**           | `stagehand.agent()` 或 `stagehand.agent(undefined)` | `stagehand.agent({provider: "openai/anthropic"})` |
| **核心处理器**         | `StagehandOperatorHandler`                          | `StagehandAgentHandler`                           |
| **是否使用/lib/agent** | ❌ 完全不使用                                       | ✅ 完全依赖                                       |
| **依赖组件**           | 仅依赖 `StagehandOperatorHandler`                   | 依赖整个 `/lib/agent` 组件链                      |
| **执行方式**           | 序列化工具调用 + DOM操作                            | 并行视觉推理 + 像素坐标操作                       |
| **截图使用**           | 用于LLM理解页面状态                                 | 用于AI视觉识别和操作                              |
| **动作执行**           | `page.observe()` → `page.act()`                     | 直接像素坐标操作                                  |
| **成本**               | 较低 (~$0.01/动作)                                  | 较高 (~$0.05/动作)                                |

## 💡 核心发现

### 1. 架构隔离

**重要发现**：当 `stagehand.agent()` 参数为空时，`/lib/agent` 文件夹中的所有组件（`AgentProvider`、`AgentClient`、`StagehandAgent`、`OpenAICUAClient`、`AnthropicCUAClient`）都**完全不参与**调用链！

### 2. 调用路径总结

- **参数为空**：

  ```
  stagehand.agent() → StagehandOperatorHandler → 完全独立的执行路径
  ```

- **有参数**：
  ```
  stagehand.agent({provider}) → StagehandAgentHandler → AgentProvider → AgentClient → StagehandAgent
  ```

### 3. 截图需求分析

**两种模式都需要截图，但用途不同**：

- **Open Operator**：截图 → LLM理解 → 决策下一步动作 → DOM操作执行
- **Computer Use Agent**：截图 → AI视觉识别 → 直接生成像素坐标 → 直接操作

### 4. 设计哲学

这种设计体现了 Stagehand 的**双引擎架构**哲学：

1. **实用主义**：Open Operator 证明了不需要最先进的 AI 技术也能解决大多数问题
2. **技术前瞻**：Computer Use Agent 展示了 AI 视觉识别的强大能力
3. **用户友好**：统一的 API 接口，用户无需了解底层差异
4. **成本效益**：让用户根据需求选择合适的引擎

## 🎯 最佳实践建议

### 何时使用 Open Operator（无参数）

```typescript
// 适用场景：
const agent = stagehand.agent();
await agent.execute("填写表单并提交");
await agent.execute("搜索产品并添加到购物车");
await agent.execute("提取页面上的所有链接");
```

- ✅ 结构化网页操作
- ✅ 成本敏感场景
- ✅ 快速原型开发
- ✅ 大批量自动化任务

### 何时使用 Computer Use Agent（有参数）

```typescript
// 适用场景：
const agent = stagehand.agent({
  provider: "openai",
  model: "computer-use-preview",
});
await agent.execute("在复杂的图形界面中找到并点击特定按钮");
await agent.execute("处理动态加载的复杂页面");
```

- ✅ 复杂的视觉识别需求
- ✅ 动态内容处理
- ✅ 非标准界面操作
- ✅ 对精确度要求极高的场景

---

_本文档详细分析了 Stagehand 双引擎架构的调用关系，为开发者选择合适的执行模式提供了全面的参考。_
