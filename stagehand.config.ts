import type { ConstructorParams } from "@/dist";
import dotenv from "dotenv";
import path from "path";

// Load environment variables FIRST, before importing StagehandConfig
// 指定 .env 文件的路径（在项目根目录）
dotenv.config({ path: path.join(__dirname, ".env") });

const StagehandConfig: ConstructorParams = {
  verbose: 2 /* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,

  // //   LLM configuration - Google Gemini
  // modelName: "gemini-2.5-flash-preview-04-17",
  // modelClientOptions: {
  //   apiKey: process.env.GOOGLE_API_KEY,
  // },

  //   LLM configuration -  claude
  // modelName: "claude-3-5-sonnet-latest",
  modelName: "claude-sonnet-4-20250514",
  modelClientOptions: {
    apiKey: process.env.AIHUBMIX_API_KEY,
    baseURL: "https://aihubmix.com",
  },

  // //   LLM configuration - openai - 还没跑通
  // modelName: "gpt-4o",
  // modelClientOptions: {
  //   apiKey: process.env.AIHUBMIX_API_KEY,
  //   baseURL: "https://aihubmix.com/v1",
  // },

  // Browser configuration
  env:
    process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID
      ? "BROWSERBASE"
      : "LOCAL",
  apiKey: process.env.BROWSERBASE_API_KEY /* API key for authentication */,
  projectId: process.env.BROWSERBASE_PROJECT_ID /* Project identifier */,
  browserbaseSessionID:
    undefined /* Session ID for resuming Browserbase sessions */,
  browserbaseSessionCreateParams: {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      blockAds: true,
      viewport: {
        width: 1024,
        height: 768,
      },
    },
  },
  localBrowserLaunchOptions: {
    headless: false,
    viewport: {
      width: 1024,
      height: 768,
    },
  } /* Configuration options for the local browser */,
  experimental: false, // Enable experimental features
};
export default StagehandConfig;
