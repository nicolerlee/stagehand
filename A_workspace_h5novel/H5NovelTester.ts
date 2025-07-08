import { Stagehand } from "../dist";
import { Request } from "playwright";
import * as fs from "fs";
import * as path from "path";
import winston from "winston";
import StagehandConfig from "../stagehand.config";

// 类型定义
export interface TestCase {
  name: string;
  path: string;
  query: string;
  expectResult: {
    shareParams: Record<string, unknown>;
    entranceParams: Record<string, unknown>;
    promotionParams: Record<string, unknown>;
  };
}

export interface RequestData {
  url: string;
  data: Record<string, unknown>[];
  event_type?: string;
}

export interface RequestsData {
  report: RequestData[];
  order: RequestData[];
  token: RequestData[];
  pay_entrance: RequestData[];
}

export type LogMode = "both" | "file" | "console";

export interface TesterConfig {
  workspace: string;
  PREFIX: string;
  TEST_CASE_FILE: string;
  REPORT_URL: string;
  PAY_URL: string;
  CREATEORDER_URL: string;
  TOKENCHARGE_URL: string;
  viewport: {
    width: number;
    height: number;
  };
  deviceScaleFactor: number;
}

export class H5NovelTester {
  private workspace: string;
  private PREFIX: string;
  private TEST_CASE_FILE: string;
  private REPORT_URL: string;
  private PAY_URL: string;
  private CREATEORDER_URL: string;
  private TOKENCHARGE_URL: string;

  // 存储请求数据 - 列表存储多个请求
  private requestsData: RequestsData = {
    report: [],
    order: [],
    token: [],
    pay_entrance: [],
  };

  // 添加请求计数器
  private requestCounter = 0;

  // 支付请求计数器
  private renewCount = 0;
  private normalCount = 0;

  // 视口大小和设备像素比 - 从配置中读取
  private viewportSize: {
    width: number;
    height: number;
  };
  private deviceScaleFactor: number;

  private testCases: TestCase[] = [];
  private logMode: LogMode;
  public logger: winston.Logger;
  public fileOnlyLogger: winston.Logger;
  private logPrefix: string;
  private screenshotPrefix: string;

  constructor(config: TesterConfig, logMode: LogMode = "both") {
    // 设置配置
    this.workspace = config.workspace;
    this.PREFIX = config.PREFIX;
    this.TEST_CASE_FILE = config.TEST_CASE_FILE;
    this.REPORT_URL = config.REPORT_URL;
    this.PAY_URL = config.PAY_URL;
    this.CREATEORDER_URL = config.CREATEORDER_URL;
    this.TOKENCHARGE_URL = config.TOKENCHARGE_URL;
    this.viewportSize = config.viewport;
    this.deviceScaleFactor = config.deviceScaleFactor;

    this.logMode = logMode;
    this.setupLogging(logMode);
    this.testCases = this.loadTestCases();
  }

  // 初始化日志系统
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
    const logsDir = path.join(process.cwd(), this.workspace, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 创建screenshots目录（如果不存在）
    const screenshotsDir = path.join(
      process.cwd(),
      this.workspace,
      "screenshots",
    );
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // 生成日志文件名（包含时间戳）
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .split(".")[0];
    const logFile = path.join(logsDir, `test_h5novel_${timestamp}.log`);
    this.logPrefix = path.join(logsDir, `test_h5novel_${timestamp}`);
    this.screenshotPrefix = path.join(
      screenshotsDir,
      `test_h5novel_${timestamp}`,
    );

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

  // 初始化测试用例
  private loadTestCases(): TestCase[] {
    /**加载测试用例*/
    try {
      const testCaseFile = path.join(
        process.cwd(),
        this.workspace,
        this.TEST_CASE_FILE,
      );
      const data = fs.readFileSync(testCaseFile, "utf8");
      const cases: TestCase[] = JSON.parse(data);
      this.logger.info(`成功加载 ${cases.length} 个测试用例`);
      return cases;
    } catch (error) {
      this.logger.error(`加载测试用例失败: ${error}`);
      return [];
    }
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

  public buildUrl(path: string, query: string): string {
    /**构建完整URL*/
    const fullUrl = `${this.PREFIX}/${path}?${query}&__funweblogin__=1`;
    this.logger.debug(`构建URL: ${fullUrl}`);
    return fullUrl;
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

      // 监测is_renew参数并更新计数器
      const parsedUrl = new URL(requestUrl);
      const isRenew = parsedUrl.searchParams.get("is_renew");

      if (isRenew === "1") {
        this.renewCount++;
        this.fileOnlyLogger.info(
          `捕获到连包支付请求: ${requestUrl} (连包计数: ${this.renewCount})`,
        );
      } else {
        this.normalCount++;
        this.fileOnlyLogger.info(
          `捕获到普通支付请求: ${requestUrl} (普通计数: ${this.normalCount})`,
        );
      }
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

  public checkTestResults(testCase: TestCase): void {
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

  public getTestCases(): TestCase[] {
    return this.testCases;
  }

  public getLogPrefix(): string {
    return this.logPrefix;
  }

  public getScreenshotPrefix(): string {
    return this.screenshotPrefix;
  }

  public clearRequestsData(): void {
    this.requestsData = {
      report: [],
      order: [],
      token: [],
      pay_entrance: [],
    };
  }

  public clearPaymentCounts(): void {
    this.renewCount = 0;
    this.normalCount = 0;
  }

  public getPaymentCounts(): { renewCount: number; normalCount: number } {
    return {
      renewCount: this.renewCount,
      normalCount: this.normalCount,
    };
  }

  public async createStagehand() {
    // 创建专门的用户数据目录用于保存认证状态
    const customUserDataDir = path.join(
      process.cwd(),
      this.workspace,
      "chrome_user_data",
    );

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

    // 设置请求监听
    stagehand.page.context().on("request", this.handleRequest);

    return stagehand;
  }
}
