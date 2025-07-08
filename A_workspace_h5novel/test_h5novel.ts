/**
 * H5小说测试脚本
 *
 * 使用方法：
 * 1. 直接运行（使用默认参数）：
 *    node test_h5novel.ts
 *
 * 2. 指定环境：
 *    node test_h5novel.ts tt        # 使用TT环境
 *    node test_h5novel.ts ks        # 使用KS环境
 *
 * 3. 指定环境和日志模式：
 *    node test_h5novel.ts tt both   # TT环境，输出到文件和控制台
 *    node test_h5novel.ts ks file   # KS环境，只输出到文件
 *    node test_h5novel.ts tt console # TT环境，只输出到控制台
 */

import { Page } from "../types/page";
import { EnhancedContext } from "../types/context";
import { H5NovelTester, TesterConfig, LogMode } from "./H5NovelTester";

// 设备预设
const DEVICE_PRESETS = {
  iphone6: {
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
  },
  iphone12: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  ipad: {
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
  },
  desktop: {
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
  custom: {
    viewport: { width: 375, height: 500 }, // 当前使用的自定义大小
    deviceScaleFactor: 2,
  },
};

// 创建测试配置
function createTesterConfig(
  env: "tt" | "ks",
  devicePreset: keyof typeof DEVICE_PRESETS = "custom",
): TesterConfig {
  const device = DEVICE_PRESETS[devicePreset];

  const baseConfig = {
    workspace: "A_workspace_h5novel",
    REPORT_URL: "https://stat.ibidian.com",
    PAY_URL: "https://pct.funshion.com/v1/cartoon/pay?",
    CREATEORDER_URL: "https://pvip.ibidian.com/v1/vip/createorder",
    TOKENCHARGE_URL: "https://pvip.ibidian.com/v1/vip/tokencharge",
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
  };

  if (env === "tt") {
    return {
      ...baseConfig,
      PREFIX: "https://novetest.fun.tv/tt/xingchen",
      TEST_CASE_FILE: "testcase-tt_h5-xingchennovel-testcase.json",
    };
  } else {
    return {
      ...baseConfig,
      PREFIX: "https://novetest.fun.tv/ks/xingchen",
      TEST_CASE_FILE: "testcase-ks_h5-xingchennovel-testcase.json",
    };
  }
}

// 支付测试函数
async function PayTest(
  page: Page,
  _context: EnhancedContext,
  tester: H5NovelTester,
): Promise<number> {
  try {
    const observations = await page.observe(
      "Find all elements whose data-e2e attribute starts with 'payment-pop-item'",
    );

    console.log(`Found ${observations.length} payment items`);

    if (observations.length === 0) {
      console.log("没有找到套餐");
      return 1;
    }

    // 遍历所有套餐
    for (let idx = 0; idx < observations.length; idx++) {
      // 点击选中套餐
      console.log(`Clicking package ${idx + 1}/${observations.length}`);
      console.log(`observations[idx]: ${observations[idx]}`);
      await page.act(observations[idx]);
      await page.waitForTimeout(1000);

      // 记录当前页面URL，用于检测是否发生跳转
      const currentUrl = page.url();
      console.log(`Current URL before payment: ${currentUrl}`);

      // 获取点击前的计数器状态
      const beforeCounts = tester.getPaymentCounts();
      console.log(
        `点击前计数 - 连包: ${beforeCounts.renewCount}, 普通: ${beforeCounts.normalCount}`,
      );

      // 点击以"立即支付"开头的按钮
      await page.act('点击 data-e2e="payment-pop-buy" 的元素');

      // 等待1秒让网络请求完成
      console.log("等待1秒检测网络请求...");
      await page.waitForTimeout(1000);

      // 获取点击后的计数器状态
      const afterCounts = tester.getPaymentCounts();
      console.log(
        `点击后计数 - 连包: ${afterCounts.renewCount}, 普通: ${afterCounts.normalCount}`,
      );

      // 根据计数器状态判断是否继续或结束
      const currentCounts = tester.getPaymentCounts();

      // 如果连包=1且普通=1，本次case结束
      if (currentCounts.renewCount >= 1 && currentCounts.normalCount >= 1) {
        console.log("✅ 连包和普通套餐都已测试，本次case结束");
        tester.logger.info(
          `支付测试完成 - 连包: ${currentCounts.renewCount}, 普通: ${currentCounts.normalCount}`,
        );
        return 1;
      }

      // 如果连包=1且普通=0，且本次点击又是连包，跳过继续下个套餐
      if (currentCounts.renewCount >= 1 && currentCounts.normalCount === 0) {
        if (afterCounts.renewCount > beforeCounts.renewCount) {
          console.log("⚠️ 连包已测试，本次又是连包，跳过继续下个套餐");
          continue;
        }
      }

      // 如果连包=0且普通=1，且本次点击又是普通，跳过继续下个套餐
      if (currentCounts.renewCount === 0 && currentCounts.normalCount >= 1) {
        if (afterCounts.normalCount > beforeCounts.normalCount) {
          console.log("⚠️ 普通已测试，本次又是普通，跳过继续下个套餐");
          // 检查页面是否发生跳转
          console.log("等待5秒检测网络请求...");
          await page.waitForTimeout(5000);
          const newUrl = page.url();
          if (newUrl !== currentUrl) {
            console.log("页面发生跳转，返回上一页...");
            await page.goBack();
            await page.waitForTimeout(2000); // 等待页面加载
            console.log(`返回后的URL: ${page.url()}`);

            await page.act('点击"我已支付完成"按钮');
            await page.waitForTimeout(3000);
          }
          continue;
        }
      }

      console.log(`继续测试下个套餐...`);
    }

    // 遍历完所有套餐
    const finalCounts = tester.getPaymentCounts();
    console.log(
      `所有套餐测试完成 - 连包: ${finalCounts.renewCount}, 普通: ${finalCounts.normalCount}`,
    );
    tester.logger.info(
      `支付测试完成 - 连包: ${finalCounts.renewCount}, 普通: ${finalCounts.normalCount}`,
    );
    return 1;
  } catch (error) {
    console.error(`PayTest error: ${error}`);
    return 1;
  }
}

// 测试运行函数
async function runTest(tester: H5NovelTester): Promise<void> {
  const stagehand = await tester.createStagehand();
  const page = stagehand.page;
  const context = stagehand.context;

  // 执行测试用例
  const testCases = tester.getTestCases();
  const screenshotPrefix = tester.getScreenshotPrefix();

  for (const testCase of testCases) {
    tester.logger.info(`\n${"=".repeat(50)}`);
    tester.logger.info(`执行测试用例: ${testCase.name}`);
    // 构建URL
    const testUrl = tester.buildUrl(
      testCase.path,
      testCase.query + "&__funWebLogin__=1",
    );
    tester.logger.info(`访问URL: ${testUrl}`);

    // 清空请求数据和支付计数器
    tester.clearRequestsData();
    tester.clearPaymentCounts();

    // 访问页面，并执行支付测试
    let payTestResult = -2;
    try {
      await page.goto(testUrl, {
        timeout: 30000,
        waitUntil: "networkidle",
      });

      await page.screenshot({
        path: `${screenshotPrefix}_${testCase.name}.png`,
      });

      payTestResult = await PayTest(page, context, tester);
    } catch (error) {
      tester.logger.error(`测试执行出错: ${error}`);
      await page.screenshot({
        path: `${screenshotPrefix}_error_${testCase.name}.png`,
      });
      await page.waitForTimeout(10000);

      try {
        await page.goto("about:blank");
      } catch {
        // 忽略错误
      }
    }

    // 检查测试结果
    if (payTestResult === -1) {
      tester.fileOnlyLogger.error(`测试用例执行失败: payTest运行中异常`);
      break;
    } else {
      tester.fileOnlyLogger.info(`测试用例执行成功: payTest运行完毕`);
      tester.checkTestResults(testCase);
    }
  }

  await stagehand.close();
  tester.logger.info("所有测试用例执行完成");
}

// 主函数运行入口
async function main(
  env: "tt" | "ks" = "tt",
  logMode: LogMode = "both",
  devicePreset: keyof typeof DEVICE_PRESETS = "custom",
): Promise<void> {
  // 创建测试配置
  const testerConfig = createTesterConfig(env, devicePreset);

  // 创建测试器实例
  const tester = new H5NovelTester(testerConfig, logMode);
  tester.logger.info(`启动测试`);
  tester.logger.info(`环境: ${env.toUpperCase()}`);
  tester.logger.info(`URL前缀: ${testerConfig.PREFIX}`);
  tester.logger.info(`测试用例文件: ${testerConfig.TEST_CASE_FILE}`);
  tester.logger.info(`日志模式: ${logMode}`);
  tester.logger.info(`设备预设: ${devicePreset}`);
  tester.logger.info(
    `视口大小: ${testerConfig.viewport.width}x${testerConfig.viewport.height}`,
  );
  tester.logger.info(`设备像素比: ${testerConfig.deviceScaleFactor}`);
  tester.logger.info(`截图目录: ${testerConfig.workspace}/screenshots/`);
  tester.logger.info(`支付监测: 普通套餐和连包套餐各点击一次即结束测试`);
  await runTest(tester);
}

// 如果这个文件是直接运行的，则执行主函数
if (require.main === module) {
  // 从命令行参数读取环境和日志模式
  const envArg = process.argv[2];
  const logModeArg = process.argv[3];

  // 验证环境参数
  const validEnvs = ["tt", "ks"];
  const env = validEnvs.includes(envArg) ? (envArg as "tt" | "ks") : "tt";

  // 验证日志模式参数
  const validLogModes = ["both", "file", "console"];
  const logMode = validLogModes.includes(logModeArg)
    ? (logModeArg as LogMode)
    : "both";

  // 输出参数信息
  if (envArg && !validEnvs.includes(envArg)) {
    console.warn(`警告: 无效的环境参数 '${envArg}'，使用默认值 'tt'`);
  }
  if (logModeArg && !validLogModes.includes(logModeArg)) {
    console.warn(`警告: 无效的日志模式 '${logModeArg}'，使用默认值 'both'`);
  }

  main(env, logMode).catch(console.error);
}

export { PayTest, runTest, createTesterConfig };
export default main;
