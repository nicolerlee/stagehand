import { Stagehand } from "../lib";
import StagehandConfig from "@/stagehand.config";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

async function openH5NovelPage() {
  // 初始化 Stagehand
  const stagehand = new Stagehand(StagehandConfig);

  try {
    // 初始化浏览器
    await stagehand.init();
    console.log("Stagehand initialized successfully");

    // 初始化页面和agent
    const page = stagehand.page;
    const agent = stagehand.agent();

    // // For Computer Use Agent (CUA) models
    // const agent = stagehand.agent({
    //   provider: "openai",
    //   model: "computer-use-preview",
    //   instructions: "You are a helpful assistant that can use a web browser.",
    //   options: {
    //     apiKey: process.env.AIHUBMIX_API_KEY,
    //     baseURL: "https://aihubmix.com",
    //   },
    // });

    // 目标网页URL
    const targetUrl =
      "https://novetest.fun.tv/tt/xingchen/pages/readerPage/readerPage?cartoon_id=649371&num=10&coopCode=ad&popularizeId=funtv&microapp_id=aw7xho2to223zyp5&source=fix&clickid=testclickidwx01&promotionid=testpromotionidwx01&promotion_ad_id=2204300841111&promotion_code=jlgg&si=13022864&&promotion_pt=88752";

    console.log("Opening webpage:", targetUrl);

    // 打开网页，设置30秒超时
    await page.goto(targetUrl, {
      timeout: 30000, // 30秒超时
      waitUntil: "networkidle", // 等待网络空闲（即网络加载完成）
    });
    // 可选：等待页面完全稳定
    await page.waitForTimeout(2000);
    console.log("Page is ready for interaction");

    // 方案1：用自然语言指令让 agent 自动完成套餐点击和支付
    const INSTRUCTION = `
    你是一名专业的Web自动化测试工程师，擅长动态页面元素识别和交互测试。具备以下能力：
    - 精准定位动态DOM元素
    - 智能处理页面状态变化
    - 自动生成结构化测试报告
    - 异常情况自动恢复
    请根据用户指令完成操作：
    ### **任务目标**
    动态识别并测试支付页面套餐选项（数量1-6个），完整记录信息并截图保存。
    ### **执行流程**
    #### **阶段一：套餐识别 (Identification)**
    - 定位所有 \`data-e2e\` 属性以 \`"payment-pop-item"\` 开头的元素（例如：\`payment-pop-item-1\`, \`payment-pop-item-2\`）;
    - 获取匹配元素的总数，记为 \`套餐总数\`（可能是1-6个）;
    - 输出：\`发现 [套餐总数] 个套餐\`。
    #### **阶段二：套餐测试 (Testing)**
    - 按顺序处理每个套餐元素（从 \`1\` 到 \`[套餐总数]\`）。
    - **点击**：触发套餐选项；
    - **等待**：暂停 \`1.5秒\` 观察页面变化（确保加载完成）；
    - **记录**：
      - 套餐名称
      - 套餐价格
      - 支付按钮的更新后价格（对比点击前后的变化）。
    - 每次点击后截图，按顺序命名：\`package_1.png\`, \`package_2.png\`, ..., \`package_[n].png\`。
    ### **技术要求**
    - **定位方式**：  
      必须使用 \`data-e2e^="payment-pop-item"\` 属性选择器定位元素。
    - **动态适应**：  
      禁止硬编码套餐数量，需动态获取总数。
    - **健壮性**：  
      若某个套餐点击后无响应，记录错误并继续测试下一个。
    - **输出格式**：  
      最终输出结构化数据：
      \`\`\`json
      {
        "total_packages": 3,
        "results": [
          { "name": "套餐A", "price": "$10", "button_price": "$9" },
          { "name": "套餐B", "price": "$20", "button_price": "$18" },
          // ...
        ]
      }
      \`\`\`
    ### **完成标准**
    - ✅ 所有套餐（无论数量）均被点击测试。
    - ✅ 完整记录每个套餐的\`名称\`、\`价格\`、\`支付按钮价格\`。
    - ✅ 截图按顺序保存至本地。
    - ✅ 输出结构化报告。
    `;

    console.log("开始执行agent任务:", INSTRUCTION);
    const result = await agent.execute({
      instruction: INSTRUCTION,
      maxSteps: 10, // 足够的步数：最多6个套餐 × 4步/套餐 + 分析步骤 = 约28步
      enableScreenshots: false,
    });

    console.log("****result:", result);
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    // 注意：这里不关闭浏览器，让用户可以继续操作
    console.log(
      "Script completed. Browser remains open for further interaction.",
    );
  }

  await stagehand.close();
}

// 运行脚本
openH5NovelPage().catch(console.error);
