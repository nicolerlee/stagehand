import { Stagehand } from "../dist";
import { Request, Cookie } from "playwright";
import { Page } from "../types/page";
import { EnhancedContext } from "../types/context";
import * as fs from "fs";
import * as path from "path";
import winston from "winston";
import StagehandConfig from "../stagehand.config";
import * as readline from "readline";

// 类型定义
interface TestCase {
  name: string;
  path: string;
  query: string;
  expectResult: {
    shareParams: Record<string, unknown>;
    entranceParams: Record<string, unknown>;
    promotionParams: Record<string, unknown>;
  };
}

interface RequestData {
  url: string;
  data: Record<string, unknown>[];
  event_type?: string;
}

interface RequestsData {
  report: RequestData[];
  order: RequestData[];
  token: RequestData[];
  pay_entrance: RequestData[];
}

type LogMode = "both" | "file" | "console";

/**
 * 辅助函数：等待用户输入
 */
const waitForInput = (prompt: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

class H5NovelTester {
  private PREFIX = "https://novetest.fun.tv/tt/xingchen";
  // private PREFIX = "https://novetest.fun.tv/ks/xingchen";
  private TEST_CASE_FILE = "testcase-tt_h5-xingchennovel-testcase.json";
  // private TEST_CASE_FILE = "testcase-ks_h5-xingchennovel-testcase.json";

  private REPORT_URL = "https://stat.ibidian.com";
  private PAY_URL = "https://pct.funshion.com/v1/cartoon/pay?";
  private CREATEORDER_URL = "https://pvip.ibidian.com/v1/vip/createorder";
  private TOKENCHARGE_URL = "https://pvip.ibidian.com/v1/vip/tokencharge";

  // 存储请求数据 - 列表存储多个请求
  private requestsData: RequestsData = {
    report: [],
    order: [],
    token: [],
    pay_entrance: [],
  };

  // 添加请求计数器
  private requestCounter = 0;

  // 设置默认视口大小 (iPhone 6/7/8)
  private viewportSize = {
    width: 375,
    height: 500,
  };

  // 设置设备像素比
  private deviceScaleFactor = 2;

  private testCases: TestCase[] = [];
  private logMode: LogMode;
  public logger: winston.Logger;
  public fileOnlyLogger: winston.Logger;

  constructor(logMode: LogMode = "both") {
    this.logMode = logMode;
    this.setupLogging(logMode);
    this.testCases = this.loadTestCases();
  }

  public setupLogging(logMode: LogMode): void {
    /**
     * 设置日志 - 使用 Winston
     *
     * 参数:
     *   logMode: 日志输出模式
     *     - "both": 同时输出到文件和控制台（默认）
     *     - "file": 只输出到文件
     *     - "console": 只输出到控制台
     */

    // 创建logs目录（如果不存在）
    const logsDir = path.join(process.cwd(), "A_workspace_h5novel", "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 生成日志文件名（包含时间戳）
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .split(".")[0];
    const logFile = path.join(logsDir, `test_h5novel_${timestamp}.log`);

    // 验证log_mode参数
    const validModes: LogMode[] = ["both", "file", "console"];
    if (!validModes.includes(logMode)) {
      console.log(`警告: 无效的日志模式 '${logMode}'，将使用默认模式 'both'`);
      this.logMode = "both";
    }

    // 创建传输器数组
    const transports: winston.transport[] = [];

    // 根据模式添加传输器
    if (this.logMode === "both" || this.logMode === "file") {
      transports.push(
        new winston.transports.File({
          filename: logFile,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message }) => {
              return `${timestamp} - ${level.toUpperCase()} - ${message}`;
            }),
          ),
        }),
      );
    }

    if (this.logMode === "both" || this.logMode === "console") {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message }) => {
              return `${timestamp} - ${level.toUpperCase()} - ${message}`;
            }),
          ),
        }),
      );
    }

    // 创建主logger
    this.logger = winston.createLogger({
      level: "debug",
      transports,
    });

    // 创建只写文件的logger
    this.fileOnlyLogger = winston.createLogger({
      level: "debug",
      transports: [
        new winston.transports.File({
          filename: logFile,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message }) => {
              return `${timestamp} - ${level.toUpperCase()} - ${message}`;
            }),
          ),
        }),
      ],
    });

    this.logger.info(`开始测试... (日志模式: ${this.logMode})`);
  }

  private loadTestCases(): TestCase[] {
    /**加载测试用例*/
    try {
      const testCaseFile = path.join(process.cwd(), this.TEST_CASE_FILE);
      const data = fs.readFileSync(testCaseFile, "utf8");
      const cases: TestCase[] = JSON.parse(data);
      this.logger.info(`成功加载 ${cases.length} 个测试用例`);
      return cases;
    } catch (error) {
      this.logger.error(`加载测试用例失败: ${error}`);
      return [];
    }
  }

  private buildUrl(path: string, query: string): string {
    /**构建完整URL*/
    const fullUrl = `${this.PREFIX}/${path}?${query}&__funweblogin__=1`;
    this.logger.debug(`构建URL: ${fullUrl}`);
    return fullUrl;
  }

  private parseRequestData(data: unknown): Record<string, unknown> {
    /**
     * 解析请求数据，保留空值参数
     *
     * Args:
     *   data: 请求数据，可能是字符串、字典或字节
     *
     * Returns:
     *   解析后的参数字典，空值参数值为空字符串
     */
    try {
      if (typeof data === "string") {
        // 解析查询字符串，保留空值
        const params = new URLSearchParams(data);
        const result: Record<string, unknown> = {};
        for (const [key, value] of params) {
          result[key] = value || "";
        }
        return result;
      } else if (typeof data === "object" && data !== null) {
        // 如果是对象，确保所有null值转换为空字符串
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          result[key] = value === null ? "" : value;
        }
        return result;
      }
      return {};
    } catch (error) {
      this.logger.error(`解析请求数据失败: ${error}`);
      return {};
    }
  }

  private parseUrlParams(requestUrl: string): Record<string, unknown>[] {
    /**
     * 解析URL参数，返回参数数组
     *
     * 参数:
     *   requestUrl: 需要解析的URL
     *
     * 返回:
     *   参数数组
     */
    const queryParamsList: Record<string, unknown>[] = [];

    // 处理上报URL
    if (requestUrl.includes(this.REPORT_URL)) {
      const parsedUrl = new URL(requestUrl);
      const queryParams: Record<string, unknown> = {};

      for (const [key, value] of parsedUrl.searchParams) {
        queryParams[key] = value || "";
      }

      queryParamsList.push(queryParams);
      return queryParamsList;
    }

    // 处理支付URL
    else if (requestUrl.includes(this.PAY_URL)) {
      const parsedUrl = new URL(requestUrl);
      const queryParams: Record<string, unknown> = {};

      for (const [key, value] of parsedUrl.searchParams) {
        queryParams[key] = value || "";
      }

      this.logger.info(`解析支付URL参数: ${JSON.stringify(queryParams)}`);

      // 如果存在entrance参数，需要进行两次解码
      if ("entrance" in queryParams) {
        const entranceValue = queryParams["entrance"];
        if (typeof entranceValue === "string") {
          // 第一次解码
          const decodedOnce = decodeURIComponent(entranceValue);
          // 第二次解码
          const decodedTwice = decodeURIComponent(decodedOnce);

          // 将解码后的查询字符串转换为对象
          const entranceParams: Record<string, unknown> = {};
          const entranceUrlParams = new URLSearchParams(decodedTwice);
          for (const [key, value] of entranceUrlParams) {
            entranceParams[key] = value || "";
          }

          queryParamsList.push(entranceParams);
        }
      }

      if ("promotion" in queryParams) {
        const promotionValue = queryParams["promotion"];
        if (typeof promotionValue === "string") {
          // 第一次解码
          const decodedOnce = decodeURIComponent(promotionValue);
          // 第二次解码
          const decodedTwice = decodeURIComponent(decodedOnce);

          try {
            // 如果是JSON字符串，解析为对象
            const promotionDict = JSON.parse(decodedTwice);
            queryParamsList.push(promotionDict);
          } catch {
            // 如果不是JSON，当作查询字符串处理
            const promotionParams: Record<string, unknown> = {};
            const promotionUrlParams = new URLSearchParams(decodedTwice);
            for (const [key, value] of promotionUrlParams) {
              promotionParams[key] = value || "";
            }
            this.logger.info(
              `promotion_params: ${JSON.stringify(promotionParams)}`,
            );
            queryParamsList.push(promotionParams);
          }
        }
      }

      this.logger.info(`query_params_list: ${JSON.stringify(queryParamsList)}`);
      return queryParamsList;
    }

    // 其他URL类型，返回空数组
    return queryParamsList;
  }

  private parseUrlType(requestUrl: string): string {
    /**
     * 从上报URL中解析事件类型
     *
     * 规则:
     * 1. 如果URL包含 lapp/bootstrap, lapp/page, lapp/fbuffer 等特定路径，返回对应的路径名称
     * 2. 如果URL包含 lapp/event，返回URL参数中的event值
     *
     * Args:
     *   requestUrl: 上报URL
     *
     * Returns:
     *   事件类型
     */
    try {
      const parsedUrl = new URL(requestUrl);
      const pathname = parsedUrl.pathname;

      // 规则1: 检查特定路径
      const pathTypes = ["bootstrap", "page", "fbuffer"];
      for (const pathType of pathTypes) {
        if (pathname.includes(`lapp/${pathType}`)) {
          return pathType;
        }
      }

      // 规则2: 检查 lapp/event 并获取 event 参数
      if (pathname.includes("lapp/event")) {
        const eventParam = parsedUrl.searchParams.get("event");
        if (eventParam) {
          return eventParam;
        }
      }

      // 规则3: 检查 cartoon/pay接口
      if (pathname.includes("cartoon/pay")) {
        return "pay_entrance";
      }

      // 默认返回路径的最后一个部分
      const pathParts = pathname.split("/").filter((part) => part.length > 0);
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1];
      }

      return "unknown";
    } catch (error) {
      this.logger.error(`解析事件类型出错: ${error}`);
      return "unknown";
    }
  }

  private handleRequest = (request: Request): void => {
    /**处理网络请求*/

    // 只处理 XHR 和 fetch 请求
    if (!["xhr", "fetch"].includes(request.resourceType())) {
      return;
    }

    const requestUrl = request.url();

    if (requestUrl.includes(this.REPORT_URL)) {
      const queryParamsList = this.parseUrlParams(requestUrl);
      const eventType = this.parseUrlType(requestUrl);

      this.requestsData.report.push({
        url: requestUrl,
        data: queryParamsList,
        event_type: eventType,
      });

      this.fileOnlyLogger.info(
        `捕获到 Report 请求: ${requestUrl} | 事件类型: ${eventType}`,
      );
    } else if (requestUrl.includes(this.PAY_URL)) {
      const queryParamsList = this.parseUrlParams(requestUrl);
      const eventType = this.parseUrlType(requestUrl);

      this.requestsData.pay_entrance.push({
        url: requestUrl,
        data: queryParamsList,
        event_type: eventType,
      });

      this.fileOnlyLogger.info(`捕获到 Pay 请求: ${requestUrl}`);
    }
  };

  private checkParams(
    actualData: Record<string, unknown>,
    expectedParams: Record<string, unknown>,
  ): boolean {
    console.log(`**actual_data: ${JSON.stringify(actualData)}`);
    console.log(`**expected_params: ${JSON.stringify(expectedParams)}`);

    /**
     * 检查实际数据是否匹配预期参数
     *
     * Args:
     *   actualData: 实际数据
     *   expectedParams: 预期参数
     *
     * Returns:
     *   是否匹配
     */

    if (!expectedParams || Object.keys(expectedParams).length === 0) {
      return true;
    }

    if (!actualData || Object.keys(actualData).length === 0) {
      this.logger.error("匹配失败: 实际数据为空");
      return false;
    }

    let allMatched = true;

    // 遍历预期参数
    for (const [key, expectedValue] of Object.entries(expectedParams)) {
      // 检查键是否存在
      if (!(key in actualData)) {
        this.logger.error(`未匹配: 键 '${key}' 在实际数据中不存在`);
        allMatched = false;
        continue;
      }

      const actualValue = actualData[key];

      // 如果预期值是对象，递归检查
      if (
        typeof expectedValue === "object" &&
        expectedValue !== null &&
        !Array.isArray(expectedValue) &&
        typeof actualValue === "object" &&
        actualValue !== null &&
        !Array.isArray(actualValue)
      ) {
        const subResult = this.checkParams(
          actualValue as Record<string, unknown>,
          expectedValue as Record<string, unknown>,
        );
        if (!subResult) {
          this.logger.error(`未匹配: 子对象 '${key}' 的参数不匹配`);
          allMatched = false;
        }
      }
      // 如果预期值是数组，检查每个元素
      else if (Array.isArray(expectedValue) && Array.isArray(actualValue)) {
        if (expectedValue.length !== actualValue.length) {
          this.logger.error(
            `未匹配: 键 '${key}' 的数组长度不同 (预期: ${expectedValue.length}, 实际: ${actualValue.length})`,
          );
          allMatched = false;
        } else {
          for (let i = 0; i < expectedValue.length; i++) {
            const expItem = expectedValue[i];
            const actItem = actualValue[i];

            if (
              typeof expItem === "object" &&
              expItem !== null &&
              !Array.isArray(expItem) &&
              typeof actItem === "object" &&
              actItem !== null &&
              !Array.isArray(actItem)
            ) {
              const subResult = this.checkParams(
                actItem as Record<string, unknown>,
                expItem as Record<string, unknown>,
              );
              if (!subResult) {
                this.logger.error(
                  `未匹配: 键 '${key}' 的数组项 #${i} 参数不匹配`,
                );
                allMatched = false;
              }
            } else if (expItem !== actItem) {
              this.logger.error(
                `未匹配: 键 '${key}' 的数组项 #${i} 值不同 (预期: ${expItem}, 实际: ${actItem})`,
              );
              allMatched = false;
            }
          }
        }
      }
      // 简单值比较
      else if (expectedValue !== actualValue) {
        this.logger.error(
          `未匹配: 键 '${key}' 的值不同 (预期: ${expectedValue}, 实际: ${actualValue})`,
        );
        allMatched = false;
      }
    }

    return allMatched;
  }

  private checkTestResults(testCase: TestCase): void {
    /**
     * 检查测试结果并输出日志
     */

    this.logger.info(JSON.stringify(this.requestsData.pay_entrance));

    // 定义固定列宽
    const TYPE_WIDTH = 7;
    const RESULT_WIDTH = 3;
    const EVENT_WIDTH = 15; // 事件列的固定宽度

    // 格式化输出函数
    const formatLog = (
      typeStr: string,
      resultStr: string,
      eventStr?: string,
      urlStr = "无",
    ): string => {
      const typeFormatted = `类型:${typeStr.padEnd(TYPE_WIDTH)}`;
      const resultFormatted = `结果:${resultStr.padEnd(RESULT_WIDTH)}`;

      // 格式化事件列，确保固定宽度
      let eventFormatted: string;
      if (eventStr) {
        const eventValue = eventStr.padEnd(EVENT_WIDTH);
        eventFormatted = `事件:${eventValue}`;
      } else {
        eventFormatted = " ".repeat(EVENT_WIDTH + 3); // 3是"事件:"的长度
      }

      const urlFormatted = urlStr !== "无" ? `请求: ${urlStr}` : "请求: 无";

      return `${typeFormatted},${resultFormatted},${eventFormatted},${urlFormatted}`;
    };

    // 检查并输出结果 - 检查每一个捕获到的请求
    if (this.requestsData.report.length > 0) {
      for (const report of this.requestsData.report) {
        const reportUrl = report.url;
        const reportData = report.data[0];
        const reportType = report.event_type || this.parseUrlType(reportUrl);
        const result = this.checkParams(
          reportData,
          testCase.expectResult.shareParams,
        );
        const resultStr = result ? "✅成功" : "❌失败";
        this.logger.info(formatLog("Report", resultStr, reportType, reportUrl));
      }
    } else {
      this.logger.info(formatLog("Report", "未捕获", undefined, "无"));
    }

    if (this.requestsData.pay_entrance.length > 0) {
      for (const pay of this.requestsData.pay_entrance) {
        const payUrl = pay.url;
        const payData = pay.data;

        let result = this.checkParams(
          payData[0],
          testCase.expectResult.entranceParams,
        );
        let resultStr = result ? "✅成功" : "❌失败";
        this.logger.info(
          formatLog("PayEntrance", resultStr, undefined, payUrl),
        );

        result = this.checkParams(
          payData[1],
          testCase.expectResult.promotionParams,
        );
        resultStr = result ? "✅成功" : "❌失败";
        this.logger.info(
          formatLog("PayPromotion", resultStr, undefined, payUrl),
        );
      }
    } else {
      this.logger.info(formatLog("Token", "未捕获", undefined, "无"));
    }
  }

  async runTest(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _preAction?: (
      page: Page,
      context: EnhancedContext,
      tester: H5NovelTester,
    ) => Promise<void>,
  ): Promise<void> {
    // 创建专门的用户数据目录用于保存认证状态
    const customUserDataDir = path.join(process.cwd(), "chrome_user_data");

    // 创建Stagehand实例 - 在初始化时加载cookies
    const stagehand = new Stagehand({
      ...StagehandConfig,
      env: "LOCAL", // 明确指定本地环境
      localBrowserLaunchOptions: {
        ...StagehandConfig.localBrowserLaunchOptions,
        headless: false, // 显示浏览器界面
        viewport: this.viewportSize, // iPhone 6/7/8 视口大小 375x667
        deviceScaleFactor: this.deviceScaleFactor, // 设备像素比 2

        // 🔥 关键修改：使用自定义用户数据目录
        userDataDir: customUserDataDir,
        preserveUserDataDir: true, // 保留用户数据目录

        // Chrome浏览器配置
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

        // Chrome启动参数优化 - 现在应该能生效了
        args: [
          "--disable-blink-features=AutomationControlled", // 隐藏自动化痕迹
          "--disable-web-security", // 禁用web安全策略
          "--disable-features=VizDisplayCompositor", // 提高性能
          "--no-first-run", // 跳过首次运行向导
          "--no-sandbox",
          "--disable-extensions", // 禁用扩展以提高稳定性
        ],

        // 权限设置
        permissions: ["midi"], // 保持原有的midi权限
      },
    });

    await stagehand.init();

    const page = stagehand.page;
    const context = stagehand.context;

    // 设置请求监听 - 通过页面的context访问
    // page.context().on("request", this.handleRequest);

    // 执行测试用例
    for (const testCase of this.testCases) {
      this.logger.info(`\n${"=".repeat(50)}`);
      this.logger.info(`执行测试用例: ${testCase.name}`);

      // 构建URL
      const testUrl = this.buildUrl(
        testCase.path,
        testCase.query + "&__funWebLogin__=1",
      );
      this.logger.info(`访问URL: ${testUrl}`);

      // 清空请求数据
      this.requestsData = {
        report: [],
        order: [],
        token: [],
        pay_entrance: [],
      };

      try {
        // 访问页面
        await page.goto(testUrl, {
          timeout: 30000,
          waitUntil: "networkidle",
        });

        await PayTest(page, context, this);
      } catch (error) {
        this.logger.error(`测试执行出错: ${error}`);

        // 即使测试出错，也导航到空白页面
        try {
          await page.goto("about:blank");
        } catch {
          // 忽略错误
        }
      }

      this.logger.info(`测试用例执行完成: ${testCase.name}`);
    }

    await stagehand.close();
    this.logger.info("所有测试用例执行完成");
  }
}

async function PayTest(
  page: Page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: EnhancedContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tester: H5NovelTester,
): Promise<void> {
  const observations = await page.observe(
    "Find all elements whose data-e2e attribute starts with 'payment-pop-item'",
  );

  console.log(`Found ${observations.length} payment items`);

  // 遍历所有套餐
  for (let idx = 0; idx < observations.length; idx++) {
    // 点击选中套餐
    console.log(`Clicking package ${idx + 1}/${observations.length}`);
    await page.act(observations[idx]);
    await page.waitForTimeout(1000);

    // 记录当前页面URL，用于检测是否发生跳转
    const currentUrl = page.url();
    console.log(`Current URL before payment: ${currentUrl}`);

    // 点击以"立即支付"开头的按钮
    await page.act('点击以"立即支付"开头的按钮');

    // 等待30秒，检测页面是否跳转
    console.log("等待10秒检测页面跳转...");
    await page.waitForTimeout(10000);

    // 检查页面是否发生跳转;
    // 1. 如果有跳转，则返回上一页，并点击"我已支付完成"按钮；
    // 2. 如果没有跳转，则跳出循环；
    const newUrl = page.url();

    if (newUrl !== currentUrl) {
      console.log("页面发生跳转，返回上一页...");
      await page.goBack();
      await page.waitForTimeout(2000); // 等待页面加载
      console.log(`返回后的URL: ${page.url()}`);

      await page.act('点击"我已支付完成"按钮');
      await page.waitForTimeout(30000);
    } else {
      console.log("页面没有发生跳转，跳出循环");
      continue; // 跳出循环
    }
  }
}

// 主函数运行入口
async function main(): Promise<void> {
  // 创建测试器实例，可以指定日志模式:
  // "both" - 同时输出到文件和屏幕（默认）
  // "file" - 只输出到文件
  // "console" - 只输出到屏幕

  // 启动测试
  const tester = new H5NovelTester("both"); // 可以根据需要更改为 "file" 或 "console"
  tester.logger.info("启动测试");
  await tester.runTest();
}

// 如果这个文件是直接运行的，则执行主函数
if (require.main === module) {
  main().catch(console.error);
}

export { H5NovelTester };
export default H5NovelTester;
