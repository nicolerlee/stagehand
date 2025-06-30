import { Stagehand } from "../lib";
import StagehandConfig from "@/stagehand.config";

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
    请仔细分析页面上的付费弹框，我需要你：
    1. 识别所有的套餐选项（包括连续包月、季卡会员、年卡会员、以及币充值选项）
    2. 依次点击每个套餐格子，观察每次点击后价格和支付按钮的变化
    3. 对于每个套餐选项，点击后等待1秒钟，然后记录当前选中的套餐信息
    4. 不要点击"立即支付"按钮，只点击套餐选择
    5. 完成所有套餐的点击测试后，汇总所有套餐的信息
    
    重要技术提示：
    - 每个套餐的data-e2e属性都是以"payment-pop-item"开头的，你可以通过这个属性精确定位套餐元素
    - 优先查找所有data-e2e属性以"payment-pop-item"开头的元素进行点击
    
    注意：
    - 套餐选项通常是可点击的区域，包含价格信息
    - 每次点击套餐后，支付按钮的价格会更新
    - 请确保覆盖所有可见的套餐选项
    `;

    console.log("开始执行agent任务:", INSTRUCTION);
    const result = await agent.execute({
      instruction: INSTRUCTION,
      maxSteps: 10, // 增加步数以完成所有套餐的点击
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
