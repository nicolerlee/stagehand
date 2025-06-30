import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "@/stagehand.config";
import { z } from "zod";

console.log(StagehandConfig);

/**
 * This example shows how to parameterize the API key for the LLM provider.
 *
 * In order to best demonstrate, unset the OPENAI_API_KEY environment variable and
 * set the USE_OPENAI_API_KEY environment variable to your OpenAI API key.
 *
 * export USE_OPENAI_API_KEY=$OPENAI_API_KEY
 * unset OPENAI_API_KEY
 */

async function example() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
    env: "LOCAL",
    verbose: 1,
    enableCaching: false,
  });

  await stagehand.init();
  await stagehand.page.goto("https://github.com/browserbase/stagehand");
  await stagehand.page.act({ action: "click on the contributors" });
  const contributor = await stagehand.page.extract({
    instruction: "extract the top contributor",
    schema: z.object({
      username: z.string(),
      url: z.string(),
    }),
  });
  console.log(`Our favorite contributor is ${contributor.username}`);
  await stagehand.close();
}

(async () => {
  await example();
})();
