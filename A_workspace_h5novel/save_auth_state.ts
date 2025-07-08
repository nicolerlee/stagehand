import { Stagehand } from "../dist";
import StagehandConfig from "../stagehand.config";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const url =
  "https://novetest.fun.tv/tt/xingchen/pages/readerPage/readerPage?cartoon_id=697000&num=5&coopCode=ad&popularizeId=funtv&microapp_id=aw7xho2to223zyp5&source=fix&__funweblogin__=1";
// const url = 'https://novetest.fun.tv/ks/xingchen/pages/readerPage/readerPage?cartoon_id=621768&num=10&coopCode=ad&microapp_id=aw7xho2to223zyp5&popularizeId=funtv&si=13023645&promotion_code=jlgg&promotion_ad_id=220457735';

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

/**
 * 辅助函数：延迟
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * 保存浏览器状态到storage_state.json文件
 *
 * 重要提示：
 * 1. 运行此脚本前，请先完全关闭所有 Chrome 浏览器实例
 * 2. 如果报错 "Cannot create a new context in a running browser"，说明 Chrome 正在运行
 * 3. 如果仍有问题，可以尝试使用备用方案：修改 userDataDir 为一个临时目录
 */
async function saveBrowserState(): Promise<void> {
  console.log("开始创建 Stagehand 实例...");
  console.log("⚠️  请确保所有 Chrome 浏览器实例已关闭！");

  // 创建专门的用户数据目录用于保存认证状态
  const customUserDataDir = path.join(
    process.cwd(),
    "A_workspace_h5novel",
    "chrome_user_data",
  );

  // 🔥 先删除已存在的 chrome_user_data 目录，确保干净的开始
  if (fs.existsSync(customUserDataDir)) {
    console.log("正在删除旧的 chrome_user_data 目录...", customUserDataDir);
    try {
      fs.rmSync(customUserDataDir, { recursive: true, force: true });
      console.log("✅ 旧的 chrome_user_data 目录已删除");
      await sleep(2000);
    } catch (error) {
      console.log("⚠️  删除 chrome_user_data 目录失败:", error);
      console.log("请手动删除该目录或确保没有进程在使用它");
    }
  }

  // 创建 Stagehand 实例，配置适合手动登录
  const stagehand = new Stagehand({
    ...StagehandConfig,
    env: "LOCAL", // 明确指定本地环境
    localBrowserLaunchOptions: {
      ...StagehandConfig.localBrowserLaunchOptions,
      headless: false, // 显示浏览器以便手动登录
      viewport: { width: 375, height: 500 },
      deviceScaleFactor: 2, // 设备像素比

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
  console.log("Stagehand 已初始化");

  // 获取页面和上下文
  const page = stagehand.page;
  const context = stagehand.context;

  // 设置用户代理和其他配置
  await context.setExtraHTTPHeaders({
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  });

  // 添加脚本绕过检测
  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  `);

  console.log("正在加载目标网站，请稍等...");

  // 访问目标URL
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await page.waitForTimeout(10000);

  // 等待用户操作
  console.log("页面已加载，请在浏览器中完成登录操作");
  await waitForInput("登录完成操作后按回车键继续...");

  // 创建保存目录
  const authDir = path.join(process.cwd(), "A_workspace_h5novel");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // // 直接保存完整的浏览器状态
  // const storagePath = path.join(authDir, "storage_state.json");
  // await context.storageState({ path: storagePath });

  // console.log("浏览器状态已保存到 A_workspace_h5novel/storage_state.json");

  console.log("认证数据已保存完成");
  console.log("等待5秒后关闭浏览器...");
  await sleep(5000);

  // 关闭 Stagehand 实例
  await stagehand.close();
}

/**
 * 使用保存的storage_state访问网站
 */
async function loadWithStorageState(targetUrl?: string): Promise<void> {
  console.log("使用保存的认证状态访问网站...");

  // 如果未提供目标URL，使用默认URL
  if (!targetUrl) {
    targetUrl = url;
  }

  // 检查状态文件是否存在
  const storagePath = path.join(
    process.cwd(),
    "A_workspace_h5novel",
    "chrome_user_data",
  );
  if (!fs.existsSync(storagePath)) {
    console.log(`错误: 认证状态文件不存在: ${storagePath}`);
    console.log("请先运行保存认证状态功能");
    return;
  }

  // 🔥 关键：使用与保存时相同的用户数据目录
  const customUserDataDir = path.join(
    process.cwd(),
    "A_workspace_h5novel",
    "chrome_user_data",
  );

  // 创建 Stagehand 实例，在初始化时加载 cookies
  const stagehand = new Stagehand({
    ...StagehandConfig,
    env: "LOCAL", // 明确指定本地环境
    localBrowserLaunchOptions: {
      ...StagehandConfig.localBrowserLaunchOptions,
      headless: false, // 显示浏览器界面
      viewport: {
        width: 375,
        height: 500,
      },
      deviceScaleFactor: 2, // 设备像素比

      // 🔥 关键修改：使用自定义用户数据目录
      userDataDir: customUserDataDir,
      preserveUserDataDir: true, // 保留用户数据目录

      // Chrome浏览器配置
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

      // Chrome启动参数优化
      args: [
        "--disable-blink-features=AutomationControlled", // 隐藏自动化痕迹
        "--disable-web-security", // 禁用web安全策略
        "--disable-features=VizDisplayCompositor", // 提高性能
        "--no-first-run", // 跳过首次运行向导
        "--no-sandbox",
      ],

      // 权限设置
      permissions: ["midi"], // 保持原有的midi权限
    },
  });

  await stagehand.init();
  console.log("Stagehand 已初始化，cookies 已在初始化时加载");

  // 获取页面
  const page = stagehand.page;
  await page.goto(targetUrl, {
    timeout: 30000,
    waitUntil: "networkidle",
  });
}

/**
 * 备用解决方案：使用 Playwright 的 storage_state 功能
 */
/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("选择操作:");
  console.log("1. 保存浏览器认证状态 (⚠️ 请先关闭所有Chrome实例!)");
  console.log("2. 使用保存的认证状态访问网站 (Stagehand初始化时加载)");

  const choice = await waitForInput("请输入选项 (1/2): ");

  if (choice === "1") {
    await saveBrowserState();
  } else if (choice === "2") {
    await loadWithStorageState();
  } else {
    console.log("无效的选项");
  }
}

// 如果这个文件是直接运行的，则执行主函数
if (require.main === module) {
  main().catch(console.error);
}

export { saveBrowserState, loadWithStorageState };
