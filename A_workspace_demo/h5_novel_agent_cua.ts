import { Stagehand } from "../dist";
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
    // const agent = stagehand.agent();

    // // openai: For Computer Use Agent (CUA) models
    // const agent = stagehand.agent({
    //   provider: "openai",
    //   model: "computer-use-preview",
    //   instructions: "You are a helpful assistant that can use a web browser.",
    //   options: {
    //     apiKey: process.env.AIHUBMIX_API_KEY,
    //     baseURL: "https://aihubmix.com/v1",
    //   },
    // });

    // anthropic: For Computer Use Agent (CUA) models
    const agent = stagehand.agent({
      provider: "anthropic",
      model: "claude-3-7-sonnet-latest",
      instructions: "You are a helpful assistant that can use a web browser.",
      options: {
        apiKey: process.env.AIHUBMIX_API_KEY,
        baseURL: "https://aihubmix.com",
      },
    });

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
    我需要你帮我测试这个付费弹框上的所有支付套餐选项。请按照以下步骤操作：

    1. 首先仔细观察当前页面上的付费弹框，识别出所有看起来像套餐选项的可点击区域/格子
    
    2. 对于每个识别到的套餐格子：
       - 先描述这个格子上显示的内容（比如套餐名称、价格、描述文字等）
       - 然后点击这个格子
       - 观察点击后界面的变化（比如是否有选中效果、价格是否更新等）
       
    3. 依次处理所有找到的套餐格子，不管它们的具体内容是什么
    
    4. 重复这个过程直到弹框中所有可点击的套餐选项都被测试过一次
    
    注意：
    - 不要假设套餐的具体名称或价格，请根据实际看到的内容来识别
    - 只点击套餐选择格子，不要点击"立即支付"、"确认支付"、"支付"等按钮
    - 如果遇到任何支付确认弹框，请点击取消或关闭
    - 目标是测试每个套餐格子的选择功能，而不是实际完成支付
    - 请详细描述每个套餐格子的内容和点击后的反应
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
