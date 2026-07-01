import { expect, test } from "@playwright/test";

test("supports bagua line toggles, detail anchor and hexagram search", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".summary-panel").getByRole("heading", { name: /乾为天/ })).toBeVisible();
  await expect(page.locator(".summary-panel")).toContainText("乾：元，亨，利，贞。");
  await page.locator(".bagua-circle").getByRole("button", { name: "坤" }).click();
  await expect(page.locator(".summary-panel")).toContainText("坤：元亨，利牝马之贞");
  await page.locator(".bagua-circle").getByRole("button", { name: "乾" }).click();

  await expect(page.locator(".compact-line-table .line-row").first()).toContainText("上九");
  await page.locator(".compact-line-table").getByRole("button", { name: "初九，点击查看爻辞" }).click();
  await expect(page.locator(".line-focus")).toContainText("潜龙勿用");
  await expect(page.locator(".change-template")).toContainText("天风姤");
  await expect(page.locator(".compact-change-box")).toContainText("初九变卦");

  await page.locator(".summary-panel").getByRole("link", { name: "查看爻辞" }).click();
  await expect(page.locator(".hex-view article.reading-panel").getByRole("heading", { name: /乾为天/ })).toBeVisible();

  await page.locator(".compact-line-table").getByRole("button", { name: "初九，点击查看爻辞" }).click();
  await expect(page.locator(".change-template")).toContainText("天风姤");
  await page.locator(".change-template").getByRole("button", { name: /变卦为 天风姤/ }).click();
  await expect(page.locator(".hex-view article.reading-panel").getByRole("heading", { name: /天风姤/ })).toBeVisible();

  await page.getByRole("button", { name: "展开卦辞检索" }).click();
  await page.getByPlaceholder("搜索卦名、卦象、简义").fill("坤为地");
  await expect(page.locator(".hex-list")).toContainText("坤卦");

  await page.getByLabel("选择六十四卦").selectOption("11");
  await expect(page.locator(".source-block")).toContainText("泰。小往大来，吉亨。");
  await expect(page.locator(".source-block")).not.toContainText("豫卦原文");
  await expect(page.locator(".summary-panel")).toContainText("泰：小往大来");

  await page.getByLabel("选择六十四卦").selectOption("2");
  await expect(page.locator(".bagua-circle").getByRole("button", { name: "乾" })).not.toHaveClass(/active/);
  await expect(page.locator(".bagua-circle").getByRole("button", { name: "坤" })).toHaveClass(/active/);

  await page.mouse.click(760, 120);
  await expect(page.getByRole("button", { name: "展开卦辞检索" })).toBeVisible();
  await expect(page.getByLabel("选择六十四卦")).toBeHidden();
});
