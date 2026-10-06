// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import { App } from "../src/ui/App";
import { memoryStore } from "../src/storage/db";

/**
 * 端到端冒烟：真渲染、真点击、真落库。
 * 它存在的理由是 §5 那条承诺必须被证明「在界面上成立」——
 * 判据单测只能证明函数对，证明不了界面有没有绕过判据。
 */

let store: ReturnType<typeof memoryStore>;

beforeEach(() => {
  cleanup();
  store = memoryStore();
  render(<App store={store} />);
});

const ready = async () => {
  await waitFor(() => expect(screen.queryByText(/载入本机数据/)).toBeNull());
};

const answerAll = async () => {
  for (let i = 0; i < 7; i++) {
    const opt = await screen.findByText("经常");
    fireEvent.click(opt);
  }
};

describe("首屏是 AWARE，不给直接建目标", () => {
  it("只有欢迎文案与开始检查，没有输入目标的地方", async () => {
    await ready();
    expect(screen.getByText(/你可能不需要/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "开始检查" })).toBeTruthy();
    expect(screen.queryByText("表面目标")).toBeNull();
  });
});

describe("§5→§7 走完检查才允许创建 Change", () => {
  it("七题答完出现摩擦领域", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "开始检查" }));
    await answerAll();
    expect(await screen.findByText("主要摩擦领域")).toBeTruthy();
  });

  it("选了领域但没定主领域时，继续不可点；定了之后才出现建 Change 屏", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "开始检查" }));
    await answerAll();
    await screen.findByText("主要摩擦领域");

    fireEvent.click(screen.getByText("学习"));
    const next = screen.getByRole("button", { name: "继续" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    // 主领域那一组里同名选项排在后面，取最后一个
    const all = screen.getAllByText("学习");
    fireEvent.click(all[all.length - 1]!);
    await waitFor(() => expect((screen.getByRole("button", { name: "继续" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "继续" }));

    expect(await screen.findByText("表面目标")).toBeTruthy();
    // §5 的落库证据：检查结论已写进本机库
    await waitFor(() => expect(store.peek()).toBeTruthy());
    const saved = store.peek() as { profile: { readiness: unknown } };
    expect(saved.profile.readiness).toBeTruthy();
  });

  it("最多选 3 个领域（§7）", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "开始检查" }));
    await answerAll();
    await screen.findByText("主要摩擦领域");

    // 领域组与「主领域」组同名选项会重复出现，一律限定在第一组里点
    const group = () => within(document.querySelectorAll<HTMLElement>(".choices")[0]!);
    for (const name of ["学习", "时间使用", "数字生活", "关系"]) {
      fireEvent.click(group().getByText(name));
    }
    // 判据是「被选中的只有 3 个」，不是「第 4 个消失了」——选项必须留在原地，
    // 只是点不进去。按消失来断言会把「选项被隐藏」当成「上限生效」。
    expect(document.querySelectorAll(".choices label.on").length).toBe(3);
    expect(group().getByText("关系").closest("label")?.className).toBe("");
    expect(await screen.findByText("最多选 3 个，先选最挡路的。")).toBeTruthy();
    // 去掉一个才点得进第 4 个
    fireEvent.click(group().getByText("学习"));
    fireEvent.click(group().getByText("关系"));
    expect(document.querySelectorAll(".choices label.on").length).toBe(3);
    expect(group().getByText("关系").closest("label")?.className).toBe("on");
  });
});
