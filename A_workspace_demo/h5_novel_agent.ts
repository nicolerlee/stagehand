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
    - 定位所有 \`data-e2e\` 属性以 \`payment-pop-item\` 开头的元素（例如：\`payment-pop-item-会员\`, \`payment-pop-item-预扣费\`）;
    - 获取匹配元素的总数，记为 \`套餐总数\`（可能是1-6个）;
    - 输入：
    \`\`\`
    DOM: [0-2] RootWebArea: 怀孕时，全家设计摘我的肾给继妹 data-e2e: \n  [0-18] scrollable data-e2e: \n    [0-53] uni-view data-e2e: \n      [0-55] StaticText: 测试环境0.0.0 data-e2e: \n      [0-4] uni-view data-e2e: \n        [0-59] uni-view data-e2e: \n          [0-61] StaticText: 10 data-e2e: \n          [0-65] StaticText: “妈妈！”清脆的童声从身后传来，“你又在发呆啦？” data-e2e: \n          [0-69] StaticText: 我转过身，看见小家伙抱着一本画册站在门口。他的眼睛像极了我，但笑起来的样子，让我想起了那个不愿再想起的人。 data-e2e: \n          [0-73] StaticText: “过来，”我张开双臂，“让妈妈看看你画了什么？” data-e2e: \n        [0-103] uni-view data-e2e: \n          [0-104] uni-view data-e2e: \n            [0-108] image data-e2e: \n            [0-111] StaticText: 仅需 ¥0.10 开通会员，阅读全文 data-e2e: \n            [0-115] image data-e2e: \n          [0-117] uni-view data-e2e: \n            [0-118] uni-view data-e2e: \n              [0-121] image data-e2e: \n              [0-122] uni-view data-e2e: \n                [0-125] StaticText: 怀孕时，全家设计摘我的肾给继妹 data-e2e: \n                [0-128] StaticText: 完结 · 现言故事 · 1万热度 data-e2e: \n                [0-129] uni-view data-e2e: \n                  [0-132] StaticText: 9.1 data-e2e: \n                  [0-133] uni-view data-e2e: \n                    [0-137] image data-e2e: \n                    [0-141] image data-e2e: \n                    [0-145] image data-e2e: \n                    [0-149] image data-e2e: \n                    [0-153] image data-e2e: \n            [0-159] StaticText: 开通会员，阅读全文 data-e2e: \n            [0-162] StaticText: 点击查看更多套餐 data-e2e: \n        [0-5] uni-view data-e2e: \n          [0-167] StaticText: 星辰文鉴 data-e2e: \n          [0-170] StaticText: 更多好内容尽在星辰文鉴 data-e2e: \n          [0-171] uni-view data-e2e: \n            [0-172] link: 《连续订阅服务协议》 data-e2e: protocol-pay\n            [0-174] StaticText: 及 data-e2e: \n            [0-175] link: 《用户服务协议》 data-e2e: protocol-user\n      [0-185] uni-view data-e2e: \n        [0-188] uni-view data-e2e: \n          [0-191] StaticText: 《怀孕时，全家设计摘我的肾...》 data-e2e: \n          [0-194] StaticText: 后续是付费内容，开通会员阅读全站内容 data-e2e: \n          [0-195] uni-view data-e2e: \n            [0-198] StaticText: 解锁书籍 data-e2e: \n            [0-201] StaticText: 也可充值书币，本书仅需990阅读币 data-e2e: \n          [0-202] uni-view data-e2e: \n            [0-203] uni-view data-e2e: payment-pop-item-预扣关\n              [0-211] StaticText: 预扣关 data-e2e: \n              [0-212] uni-view data-e2e: \n                [0-215] StaticText: ￥ data-e2e: \n                [0-218] StaticText: 0.10 data-e2e: \n              [0-221] StaticText: 预扣关 data-e2e: \n            [0-222] uni-view data-e2e: payment-pop-item-预扣费\n              [0-229] StaticText: 预扣费 data-e2e: \n              [0-230] uni-view data-e2e: \n                [0-233] StaticText: ￥ data-e2e: \n                [0-236] StaticText: 0.10 data-e2e: \n              [0-239] StaticText: 预扣费 data-e2e: \n            [0-240] uni-view data-e2e: payment-pop-item-连包内测\n              [0-248] StaticText: 连包内测 data-e2e: \n              [0-249] uni-view data-e2e: \n                [0-252] StaticText: ￥ data-e2e: \n                [0-255] StaticText: 0.10 data-e2e: \n              [0-258] StaticText: 连包内测 data-e2e: \n            [0-259] uni-view data-e2e: payment-pop-item-优惠期名称\n              [0-265] StaticText: 优惠期名称 data-e2e: \n              [0-266] uni-view data-e2e: \n                [0-269] StaticText: ￥ data-e2e: \n                [0-272] StaticText: 0.10 data-e2e: \n              [0-275] StaticText: 优惠服务详情 data-e2e: \n            [0-276] uni-view data-e2e: payment-pop-item-3日会员\n              [0-282] StaticText: 3日会员 data-e2e: \n              [0-283] uni-view data-e2e: \n                [0-286] StaticText: ￥ data-e2e: \n                [0-289] StaticText: 0.10 data-e2e: \n              [0-292] StaticText: 首次特惠包周会员 data-e2e: \n            [0-293] uni-view data-e2e: payment-pop-item-h5内测连包\n              [0-299] StaticText: h5内测连包 data-e2e: \n              [0-300] uni-view data-e2e: \n                [0-303] StaticText: ￥ data-e2e: \n                [0-306] StaticText: 0.10 data-e2e: \n              [0-309] StaticText: h5内测连包 data-e2e: \n        [0-310] uni-view data-e2e: \n          [0-314] StaticText: 连包周1元续费，预扣关 data-e2e: \n          [0-317] uni-view data-e2e: \n            [0-318] StaticText: 不允许未成年购买，购买后不支持退款，购买后如果您遇到无法解决，订单超时等问题，请 data-e2e: \n            [0-319] link: 联系客服 data-e2e: payment-pop-kefu\n        [0-321] uni-view data-e2e: \n          [0-16] uni-view data-e2e: payment-pop-buy\n            [0-323] StaticText: 立即支付 ¥ data-e2e: \n            [0-325] StaticText: 0.10 data-e2e: \n          [0-326] uni-view data-e2e: \n            [0-330] image data-e2e: \n            [0-331] link: 同意《星辰文鉴付费服务协议》（含自动续费条款） data-e2e: payment-pop-service
    \`\`\`
    - 输出：\`发现 [套餐总数] 个套餐\`和\`套餐信息（包括名称、价格和对应的elementId）\`，输出格式大致为：
    \`\`\`json
    {
      "total_packages": 6,
      "packages": [
        {
          "name": "预扣关",
          "price": "0.10",
          "elementId": "0-203"
        },
        {
          "name": "预扣费",
          "price": "0.10",
          "elementId": "0-222"
        },
        // ... 其他套餐
      ]
    }
    \`\`\`
    #### **阶段二：套餐测试 (Testing)**
    - 按packages列表中的顺序处理每个套餐元素（从 1 到 \`total_packages\`）。
      - **选择元素**：选中当前套餐所在元素；
      - **点击**：点击当前套餐所在元素；
      - **等待**：暂停 \`1.5秒\` 观察页面变化（确保加载完成）；
      - **记录**：
        - packages.name
        - packages.price
        - 支付按钮的更新后价格（对比点击前后的变化）。
    ### **技术要求**
    - **定位方式**：  
      根据套餐的elementId，获取对应的xpath路径，再通过xpath定位元素。
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
    ### **注意事项**
    - 测试过程中不要跳转到其他页面，测试过程均发生在本页面上。
    - 测试过程中不要刷新页面，测试过程均发生在本页面上。
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
