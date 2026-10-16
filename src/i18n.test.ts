import { expect, it } from "vitest";
import { en, zh, translator, taskName } from "./i18n";
it("has complete, non-empty dictionaries for both interfaces", () => {
  expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  for (const value of Object.values(zh)) expect(value.trim()).not.toBe("");
  expect(translator("zh")("network")).toBe("全网概览");
  expect(translator("en")("network")).toBe("Network");
});
it("does not present an untranslated task name as an English label", () => {
  expect(taskName({ task_id: 34, task_name: "八位加法器" }, "en")).toBe(
    "Task #34",
  );
});
