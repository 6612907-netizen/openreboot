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

/** 选一个领域 + 定主领域 + 继续 ⇒ 进入建 Change 屏 */
const finishAreas = async () => {
  await screen.findByText("主要摩擦领域");
  const group = () => within(document.querySelectorAll<HTMLElement>(".choices")[0]!);
  fireEvent.click(group().getByText("学习"));
  const all = screen.getAllByText("学习");
  fireEvent.click(all[all.length - 1]!);
  await waitFor(() => expect((screen.getByRole("button", { name: "继续" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  expect(await screen.findByText("表面目标")).toBeTruthy();
};

/** 建 Change ⇒ 落在 UNDERSTAND */
const createChange = async () => {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "我想稳定写作" } });
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  expect(await screen.findByText(/为什么知道不等于做到/)).toBeTruthy();
};

/**
 * 把四段微型课写完（每段翻到最后一张卡，写一句话保存），结束时已在 DECIDE。
 * 每点一次保存都要等"页码计数器"真的翻页了再走下一轮：submit 里是 await 服务层，
 * 同步 getByRole 会读到还没更新的界面 —— 这正是我第一版踩的（假失败）。
 */
/** 读"已落库的段落数"：这是要证明的事本身，比读页面上的计数器字样可靠。 */
const lessonCount = () => {
  const db = store.peek() as { changes?: { lessons?: unknown[] }[] } | null;
  return db?.changes?.[0]?.lessons?.length ?? 0;
};

const finishLessons = async () => {
  for (let i = 1; i <= 4; i++) {
    for (let c = 0; c < 8; c++) {
      const next = screen.queryByRole("button", { name: "下一段" });
      if (!next) break;
      fireEvent.click(next);
    }
    const box = await screen.findByPlaceholderText("用你自己的话写一句。");
    fireEvent.change(box, { target: { value: "我卡在这一步" } });
    fireEvent.click(await screen.findByRole("button", { name: "保存" }));
    // 等的是**落库计数**，不是页面上的 "n / 4" 字样：计数器那几个字符被拆在多个节点里，
    // 按文案正则等会假失败；而"这一段的回答确实写进本机库了"才是要证明的事。
    await waitFor(() => expect(lessonCount()).toBe(i));
  }
  await screen.findByText("现在，你来决定");
};

const auditSaved = () => {
  const db = store.peek() as { changes?: { audit?: unknown }[] } | null;
  return !!db?.changes?.[0]?.audit;
};

const walkToDecide = async () => {
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "开始检查" }));
  await answerAll();
  await finishAreas();
  await createChange();
  await finishLessons();
};

describe("Baseline §1：没走完 AWARE→UNDERSTAND→DECIDE 就不会被推进到「我要改变」", () => {
  it("首屏 / 检查屏 / 新建屏 / UNDERSTAND 都没有 DECIDE 的三个出口", async () => {
    await ready();
    expect(screen.queryByText("我决定改变")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "开始检查" }));
    await answerAll();
    await finishAreas();
    expect(screen.queryByText("我决定改变")).toBeNull();
    await createChange();
    expect(screen.queryByText("我决定改变")).toBeNull();
  });
});

describe("Baseline §3：observe / keep 是活路，不是死路", () => {
  it("选「还没想清楚，继续观察」后仍留在 DECIDE，能自己归档，名额才放开", async () => {
    await walkToDecide();

    fireEvent.click(screen.getByText("还没想清楚，继续观察"));
    expect(await screen.findByText("这条判断已经记在本机了")).toBeTruthy();
    expect(document.querySelector(".stages")?.textContent).toContain("DECIDE");
    expect(screen.queryByText(/设计一个实验/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "这次就到这里，归档它" }));
    expect(await screen.findByText(/上一条已经归档/)).toBeTruthy();
    expect(screen.queryByText("我决定改变")).toBeNull();
    const saved = store.peek() as { changes: { status: string; decision: { kind: string } | null }[] };
    expect(saved.changes[0]?.status).toBe("closed");
    expect(saved.changes[0]?.decision?.kind).toBe("observe");
  });

  it("想改主意：在 DECIDE 上直接重选「我决定改变」，不需要重建", async () => {
    await walkToDecide();
    fireEvent.click(screen.getByText("想清楚了，暂时不改变"));
    expect(await screen.findByText("这条判断已经记在本机了")).toBeTruthy();
    // 进 REBOOT 还要先把审计表存下来（gate.audit），所以这里走真实填写路径
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(auditSaved()).toBe(true));
    fireEvent.click(screen.getByText("我决定改变"));
    expect(await screen.findByText(/设计一个实验/)).toBeTruthy();
    expect(document.querySelector(".stages")?.textContent).toContain("REBOOT");
  });
});
describe("Baseline §1（续）：被阶段判据拦下时必须说清原因，不能静默", () => {
  it("没存审计就点「我决定改变」：界面上给出人话，且仍停在 DECIDE", async () => {
    await walkToDecide();
    fireEvent.click(screen.getByText("我决定改变"));
    expect(await screen.findByText(/先把上面那几栏填完/)).toBeTruthy();
    expect(screen.queryByText(/设计一个实验/)).toBeNull();
  });
});
