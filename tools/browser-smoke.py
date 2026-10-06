"""真浏览器冒烟：跑的是 npm run build 出来的 dist，不是 jsdom。

存在理由：jsdom 能证明 React 逻辑对，证不了「构建产物在真实浏览器里能不能点、
数据能不能落进真实 IndexedDB、刷新后还在不在」。这三条是 v0.1 对外的硬承诺
（local-first / 离线可用），必须拿真浏览器验。

跑法（手动，不进 CI —— 它要有真浏览器，门禁不该依赖这个）：
    npm run build && npx vite preview --port 4173 &
    python3 tools/browser-smoke.py            # 需要 pip 里的 playwright
逐步打点，任一步失败即 exit 1；成功行必须由当轮实测产生，不预写。
"""
import sys
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:4173/"
SHOT = "/tmp/or-smoke"
fails = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("  | " + detail if detail else ""))
    if not ok:
        fails.append(name)


def launch(p):
    """本机 playwright 的 python 版本与缓存浏览器版本不匹配（要 1208，缓存是 1243）。
    直接指向缓存里那枚 Chromium 可执行件，不下载新浏览器、不改本机环境。"""
    import glob, os
    cands = glob.glob(os.path.expanduser(
        "~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"))
    if cands:
        return p.chromium.launch(executable_path=cands[-1])
    return p.chromium.launch(channel="chrome")


console_errors = []
with sync_playwright() as p:
    b = launch(p)
    ctx = b.new_context(viewport={"width": 420, "height": 880})  # 手机视口：PWA 主战场
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append("pageerror: " + str(e)))

    page.goto(BASE)
    page.wait_for_selector("h1")
    check("首屏标题唯一", page.locator("h1", has_text="你可能不需要").count() == 1,
          f"h1 命中 {page.locator('h1', has_text='你可能不需要').count()} 个")
    check("首屏没有目标输入框", page.locator("input[type=text]").count() == 0)
    page.screenshot(path=f"{SHOT}/01-welcome.png")

    page.get_by_role("button", name="开始检查").click()
    for i in range(7):
        page.locator(".choices").get_by_text("经常", exact=True).first.click()
    page.wait_for_selector("text=主要摩擦领域")
    check("七题答完进入领域选择", True)

    # 第 4 个点不进去（§7 上限），且选项仍在原地
    for name in ["学习", "时间使用", "数字生活", "关系"]:
        page.locator(".choices").nth(0).get_by_text(name, exact=True).first.click()
    check("领域上限 3 个", page.locator(".choices label.on").count() == 3,
          f"选中 {page.locator('.choices label.on').count()} 个")
    check("第 4 个选项仍在界面且未选中",
          page.locator(".choices").nth(0).get_by_text("关系", exact=True).count() == 1
          and "on" not in (page.locator(".choices").nth(0).get_by_text("关系", exact=True)
                           .evaluate("e => e.closest('label').className") or ""))
    page.screenshot(path=f"{SHOT}/02-areas.png")

    nxt = page.get_by_role("button", name="继续")
    check("没定主领域时继续不可点", nxt.is_disabled())
    page.locator(".choices").nth(1).get_by_text("学习", exact=True).first.click()
    expect(nxt).to_be_enabled(timeout=3000)
    check("定了主领域后继续可点", nxt.is_enabled())
    nxt.click()
    page.wait_for_selector("text=表面目标")
    check("检查通过才进入建 Change", True)

    page.locator("input[type=text]").first.fill("我想开始稳定写作")
    page.locator("button.primary").click()
    page.wait_for_selector("text=UNDERSTAND")
    hdr = page.locator("header .stages").inner_text()
    check("建好 Change 落到 01 UNDERSTAND", "第 2 / 8 阶段" in hdr, hdr.strip())
    page.screenshot(path=f"{SHOT}/03-understand.png")

    # 真 IndexedDB：刷新后数据必须还在，这才叫 local-first
    had_db = page.evaluate("() => new Promise(r => indexedDB.databases().then(d => r(d.length)))")
    page.reload()
    page.wait_for_selector("text=UNDERSTAND")
    hdr2 = page.locator("header .stages").inner_text()
    check("刷新后仍在同一阶段（真 IndexedDB 落库）", "第 2 / 8 阶段" in hdr2, hdr2.strip())
    check("浏览器里确实建了库", had_db >= 1, f"indexedDB.databases() = {had_db}")

    sw = page.evaluate("""async () => {
      const r = await navigator.serviceWorker.getRegistrations();
      return {n: r.length, active: r.map(x => !!x.active)};
    }""")
    check("Service Worker 已注册", sw["n"] >= 1 and any(sw["active"]), str(sw))

    offline = True
    try:
        ctx.set_offline(True)
        page.reload()
        page.wait_for_selector("header .stages", timeout=6000)
        page.screenshot(path=f"{SHOT}/04-offline.png")
    except Exception as e:
        offline = False
        print("  离线复开异常：" + str(e).splitlines()[0])
    ctx.set_offline(False)
    check("断网后仍可打开（离线可用）", offline)

    # 越界请求：本地优先＝除了同源资源不该有任何外部网络
    reqs = []
    page.on("request", lambda r: reqs.append(r.url))
    page.reload()
    page.wait_for_load_state("networkidle")
    ext = [u for u in reqs if not u.startswith(BASE) and not u.startswith("data:")]
    check("零外部域名请求", len(ext) == 0, "; ".join(ext[:3]) or f"共 {len(reqs)} 请求全同源")

    check("控制台零报错", len(console_errors) == 0, "; ".join(console_errors[:3]))
    b.close()

print("=" * 40)
if fails:
    print("红：", " / ".join(fails))
    sys.exit(1)
print("真浏览器冒烟全绿")
