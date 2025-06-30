import { Stagehand } from "../dist";
import StagehandConfig from "@/stagehand.config";
import fs from "fs";
import path from "path";

async function openH5NovelPage() {
  const stagehand = new Stagehand(StagehandConfig);

  try {
    await stagehand.init();
    console.log("Stagehand initialized successfully");

    const page = stagehand.page;
    const targetUrl =
      "https://novetest.fun.tv/tt/xingchen/pages/readerPage/readerPage?cartoon_id=649371&num=10&coopCode=ad&popularizeId=funtv&microapp_id=aw7xho2to223zyp5&source=fix&clickid=testclickidwx01&promotionid=testpromotionidwx01&promotion_ad_id=2204300841111&promotion_code=jlgg&si=13022864&&promotion_pt=88752";

    // 检查并创建log文件夹
    const logDir = path.join(__dirname, "log");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      console.log("Created log directory");
    }

    //打开页面
    console.log("Opening webpage:", targetUrl);
    await page.goto(targetUrl, {
      timeout: 30000,
      waitUntil: "networkidle",
    });

    await page.waitForTimeout(2000);
    console.log("Page ready for interaction");

    // 截图并识别套餐
    await page.screenshot({ path: path.join(logDir, "debug_popup.png") });

    const observations = await page.observe(
      "Find all elements whose data-e2e attribute starts with 'payment-pop-item'",
    );

    console.log(`Found ${observations.length} payment items`);

    // 依次点击每个套餐
    for (let idx = 0; idx < observations.length; idx++) {
      console.log(`Clicking package ${idx + 1}/${observations.length}`);

      await page.act(observations[idx]);
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(logDir, `package_${idx + 1}.png`),
      });
    }

    console.log("All packages clicked successfully!");
    console.log(`Screenshots saved to: ${logDir}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await stagehand.close();
  }
}

openH5NovelPage().catch(console.error);
