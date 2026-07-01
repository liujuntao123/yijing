import { expect, test } from "@playwright/test";

test("supports bagua line toggles, detail anchor and hexagram search", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".summary-panel").getByRole("heading", { name: /乾为天/ })).toBeVisible();
  await expect(page.locator(".summary-panel")).toContainText("乾：元，亨，利，贞。");
  await page.locator(".bagua-circle").getByRole("button", { name: "坤" }).click();
  await expect(page.locator(".summary-panel")).toContainText("坤：元亨，利牝马之贞");
  await page.locator(".bagua-circle").getByRole("button", { name: "乾" }).click();

  await page.getByLabel("初九，点击切换").click();
  await expect(page.locator(".summary-panel").getByRole("heading", { name: /姤卦/ })).toBeVisible();
  await expect(page.getByText(/当前六爻：6 \/ 9 \/ 9 \/ 9 \/ 9 \/ 9/)).toBeVisible();
  await page.getByRole("button", { name: "复位" }).click();
  await expect(page.locator(".summary-panel").getByRole("heading", { name: /乾为天/ })).toBeVisible();

  await page.locator(".summary-panel").getByRole("link", { name: "查看详细介绍" }).click();
  await expect(page.locator(".hex-view article.reading-panel").getByRole("heading", { name: "1. 乾卦" })).toBeVisible();

  await page.getByLabel("初九，点击查看爻辞").click();
  await expect(page.locator(".change-box")).toContainText("姤卦");
  await page.getByRole("button", { name: /跳转到 姤卦/ }).click();
  await expect(page.locator(".hex-view article.reading-panel").getByRole("heading", { name: "44. 姤卦" })).toBeVisible();

  await page.getByRole("button", { name: "展开卦辞检索" }).click();
  await page.getByPlaceholder("搜索卦名、卦象、简义").fill("坤为地");
  await expect(page.locator(".hex-list")).toContainText("坤卦");

  await page.getByLabel("选择六十四卦").selectOption("11");
  await page.getByRole("button", { name: "卦辞总览" }).click();
  await expect(page.locator(".content-block .markdown")).toContainText("泰卦原文");
  await expect(page.locator(".content-block .markdown")).not.toContainText("豫卦原文");
  await expect(page.locator(".summary-panel")).toContainText("泰：小往大来");
});
