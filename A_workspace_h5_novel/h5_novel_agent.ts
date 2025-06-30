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
    请完成以下任务，套餐数量是动态的（可能1-6个不等）：
    
    **第一步：动态识别套餐**
    1. 扫描页面，找到所有data-e2e属性以"payment-pop-item"开头的元素
    2. 确定实际的套餐总数（可能是1个，也可能是6个，或者其他数量）
    3. 记录发现的套餐总数
    
    **第二步：逐个测试套餐**
    对于每个发现的套餐，执行以下操作：
    - 点击该套餐选项
    - 等待1秒钟观察变化
    - 截图一张（命名为package_序号.png，比如package_1.png）
    - 记录套餐信息（名称、价格、支付按钮价格变化）
    
    **技术要求：**
    - 使用data-e2e属性以"payment-pop-item"开头来定位套餐
    - 动态适应实际套餐数量，不要假设固定数量
    - 截图文件保存到本地，按顺序命名
    
    **完成标准：**
    - 找到并点击所有存在的套餐（无论数量多少）
    - 每个套餐都有对应的截图
    - 记录完整的套餐信息
    `;

    console.log("开始执行agent任务:", INSTRUCTION);
    const result = await agent.execute({
      instruction: INSTRUCTION,
      maxSteps: 10, // 足够的步数：最多6个套餐 × 4步/套餐 + 分析步骤 = 约28步
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
