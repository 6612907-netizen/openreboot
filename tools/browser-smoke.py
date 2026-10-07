#!/usr/bin/env python3
"""真浏览器验收：跑构建产物（本地预览或线上 Pages），不是 jsdom。

    npm run build && npx vite preview --port 4173 &
    python3 tools/browser-smoke.py                       # 默认本机
    python3 tools/browser-smoke.py --base https://…/openreboot/   # 线上那一格

为什么要有它：`npm run gate` 跑的是 jsdom。它能证明判据函数对，
证不了「真实浏览器里点得动、数据真落进 IndexedDB、断网打得开、装得上、
线上 HTTPS 那一套路径对不对」。这几条是对外的硬承诺，只能在真浏览器里定案。

退出码：全绿 0；任何一格红或有格子量不到（读数缺失）都是 1。
量不到不等于通过 —— 这一点单独打印 UNMEASURED，不许混进 PASS。
"""
import argparse
import json
import sys
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

DEFAULT_BASE = "http://127.0.0.1:4173/"
TRACKERS = ("google-analytics", "googletagmanager", "doubleclick", "facebook", "sentry",
            "segment", "analytics", "mixpanel", "posthog", "amplitude", "hotjar", "clarity")

results = []


def check(name, ok, detail=""):
    state = "PASS      " if ok else "FAIL      "
    results.append((state.strip(), name, detail))
    print(f"{state} {name}" + (f"  | {detail}" if detail else ""))


def unmeasured(name, why):
    results.append(("UNMEASURED", name, why))
    print(f"UNMEASURED {name}  | {why}")


def launch(p, mobile=False):
    """本机 python-playwright 与缓存浏览器版本可能不匹配：直接指向缓存里那枚可执行件。"""
    import glob
    import os
    cands = glob.glob(os.path.expanduser(
        "~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/Google Chrome for Testing.app/"
        "Contents/MacOS/Google Chrome for Testing"))
    kw = {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True} if mobile \
        else {"viewport": {"width": 420, "height": 880}}
    if cands:
        return p.chromium.launch(executable_path=cands[-1]), kw
    return p.chromium.launch(channel="chrome"), kw


def walk_to_decide(page):
    """AWARE → UNDERSTAND → DECIDE 全用真实点击走完。"""
    page.get_by_role("button", name="开始检查").click()
    for _ in range(7):
        page.locator(".choices").get_by_text("经常", exact=True).first.click()
    page.wait_for_selector("text=主要摩擦领域")

    areas = page.locator(".choices").nth(0)
    areas.get_by_text("学习", exact=True).first.click()
    for name in ["时间使用", "数字生活", "关系"]:
        areas.get_by_text(name, exact=True).first.click()
    check("领域上限 3 个（第 4 点点不进去）", page.locator(".choices label.on").count() == 3,
          f"选中 {page.locator('.choices label.on').count()} 个")

    nxt = page.get_by_role("button", name="继续")
    check("未定主领域时「继续」不可点", nxt.is_disabled())
    page.locator(".choices").nth(1).get_by_text("学习", exact=True).first.click()
    expect(nxt).to_be_enabled(timeout=4000)
    nxt.click()
    page.wait_for_selector("text=表面目标")

    page.locator("input[type=text]").first.fill("我想稳定写作")
    page.locator("button.primary").click()
    page.wait_for_selector("text=为什么知道不等于做到")
    check("建完 Change 落在 01 UNDERSTAND（不是 DECIDE、更不是 REBOOT）",
          "UNDERSTAND" in page.locator("header .stages").inner_text())
    check("UNDERSTAND 阶段看不到 DECIDE 的三个出口",
          page.get_by_text("我决定改变").count() == 0)

    for _ in range(4):
        for _ in range(10):
            nxt = page.get_by_role("button", name="下一段")
            if nxt.count() == 0:
                break
            nxt.first.click()
        box = page.get_by_placeholder("用你自己的话写一句。")
        box.wait_for()
        box.fill("我卡在这儿")
        page.get_by_role("button", name="保存").click()
        page.wait_for_timeout(120)
    page.wait_for_selector("text=现在，你来决定")
    check("四段微型课写完进入 02 DECIDE", "DECIDE" in page.locator("header .stages").inner_text())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--shots", default="/tmp/or-smoke")
    args = ap.parse_args()
    base = args.base if args.base.endswith("/") else args.base + "/"
    origin = urlparse(base).netloc

    console_errors, requests, external = [], [], []
    download_path = None
    bip_seen = "unset"

    with sync_playwright() as p:
        browser, vp = launch(p)
        ctx = browser.new_context(**vp)
        ctx.add_init_script("window.__bip=0; addEventListener('beforeinstallprompt', e=>{e.preventDefault(); window.__bip=1;});")
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append("pageerror: " + str(e)))
        page.on("request", lambda r: requests.append(r.url))
        # 确认框要在页面创建时就挂好处理：同步 API 里用 expect_event 等 dialog 会死锁
        # —— confirm() 会阻塞 JS 线程，click 永远不返回。
        dialogs = []

        def on_dialog(d):
            dialogs.append(d.message)
            d.accept()

        page.on("dialog", on_dialog)

        page.goto(base)
        page.wait_for_selector("h1")
        check("线上/本机首屏打开", page.locator("h1").count() >= 1, base)
        check("首屏没有目标输入框，也没有 DECIDE 出口",
              page.locator("input[type=text]").count() == 0 and page.get_by_text("我决定改变").count() == 0)

        walk_to_decide(page)

        # §1 产品级判据：没存审计就推进不到 REBOOT
        page.get_by_text("我决定改变").click()
        page.wait_for_timeout(250)
        check("没存审计就进不了 REBOOT（界面上被 gate 拦下）",
              "DECIDE" in page.locator("header .stages").inner_text()
              and page.get_by_text("先把上面那几栏填完", exact=False).count() >= 1,
              page.locator(".card.err").inner_text() if page.locator(".card.err").count() else "")

        # 三个合法出口：先把审计表存下来（这是进 REBOOT 的那道真门槛），再走出口
        page.locator("input[type=text]").first.fill("先把表面目标留着")
        page.get_by_role("button", name="保存").click()
        page.wait_for_timeout(250)
        page.get_by_text("还没想清楚，继续观察").click()
        page.wait_for_selector("text=这条判断已经记在本机了")
        check("出口 OBSERVE 可选，且留在 DECIDE 不归档",
              "DECIDE" in page.locator("header .stages").inner_text())
        page.get_by_text("想清楚了，暂时不改变").click()
        page.wait_for_timeout(200)
        check("出口 KEEP 可选，仍可留在原处重选", page.get_by_text("这条判断已经记在本机了").count() == 1)

        page.get_by_text("我决定改变").click()
        page.wait_for_selector("text=设计一个实验")
        check("存过审计后出口 CHANGE 才放行进入 03 REBOOT",
              "REBOOT" in page.locator("header .stages").inner_text())
        check("有 Active Change 时不再给新建入口", page.locator("h1", has_text="表面目标").count() == 0)

        page.reload()
        page.wait_for_selector("text=设计一个实验")
        check("刷新后仍在 03 REBOOT（数据真落本机库）",
              "REBOOT" in page.locator("header .stages").inner_text())
        check("浏览器里确实建了 IndexedDB",
              page.evaluate("() => new Promise(r => indexedDB.databases().then(d => r(d.length)))") >= 1)

        sw = page.evaluate("""async () => {
          const r = await navigator.serviceWorker.getRegistrations();
          return {n: r.length, active: r.map(x => !!x.active), scope: r.map(x => x.scope)};
        }""")
        check("Service Worker 已注册并激活", sw["n"] >= 1 and any(sw["active"]), json.dumps(sw, ensure_ascii=False))

        # PWA 可安装性：CDP 的官方判据 + beforeinstallprompt 事件
        try:
            cdp = ctx.new_cdp_session(page)
            errs = cdp.send("Page.getInstallabilityErrors").get("errors", [])
            check("PWA 安装判据无错误（Page.getInstallabilityErrors）", len(errs) == 0,
                  f"errors={json.dumps(errs, ensure_ascii=False)}")
        except Exception as e:  # noqa: BLE001
            unmeasured("PWA 安装判据无错误（Page.getInstallabilityErrors）", str(e).splitlines()[0])
        # bip 通常在 SW 接管后的**下一次导航**才发；先重开一次再读。
        page.reload()
        page.wait_for_selector("text=设计一个实验")
        try:
            page.wait_for_function("() => window.__bip === 1", timeout=6000)
            check("beforeinstallprompt 触发过（可安装的直接信号）", True)
        except Exception:  # noqa: BLE001
            # 无头 Chromium 常常根本不发 bip。这一格就不算证过，
            # 安装判据以 Page.getInstallabilityErrors 的读数为准，不许混进 PASS。
            unmeasured("beforeinstallprompt 触发过（可安装的直接信号）",
                       "无头 Chromium 未触发 bip；可安装性以 getInstallabilityErrors 为准")
        mf = page.evaluate("""async () => {
          const l = document.querySelector('link[rel=manifest]');
          const r = await fetch(l.href);
          const j = await r.json();
          return {status: r.status, start_url: j.start_url, scope: j.scope, icons: (j.icons||[]).length};
        }""")
        check("manifest 在子路径下可取且字段为相对解析",
              mf["status"] == 200 and mf["icons"] >= 1, json.dumps(mf, ensure_ascii=False))

        offline_ok = True
        try:
            ctx.set_offline(True)
            page.reload()
            page.wait_for_selector("header .stages", timeout=8000)
            offline_text = page.locator("header .stages").inner_text()
        except Exception as e:  # noqa: BLE001
            offline_ok, offline_text = False, str(e).splitlines()[0]
        ctx.set_offline(False)
        check("断网重开仍可用（离线能力）", offline_ok and "REBOOT" in offline_text, offline_text.strip())
        page.wait_for_selector("text=设计一个实验")

        # 数据所有权：导出 → 导入 → 清空
        page.get_by_role("button", name="数据").click()
        page.wait_for_selector("text=清空本机全部数据")
        try:
            with page.expect_download(timeout=8000) as di:
                page.get_by_role("button", name="导出 JSON").click()
            download_path = di.value.path()
            check("导出 JSON 真的落成一个文件", download_path is not None and len(di.value.suggested_filename) > 5,
                  di.value.suggested_filename)
        except Exception as e:  # noqa: BLE001
            unmeasured("导出 JSON 真的落成一个文件", str(e).splitlines()[0])

        page.locator("input[type=file]").set_input_files(download_path) if download_path else None
        page.wait_for_selector("text=已保存")
        check("导入 JSON 成功（回到本机库并给出反馈）", page.get_by_text("已保存").count() >= 1)

        page.get_by_role("button", name="清空本机全部数据").click()
        try:
            page.wait_for_selector("text=你可能不需要", timeout=8000)
            asked = dialogs[-1] if dialogs else "（没弹确认框）"
            check("清空数据有二次确认，确认后回到首屏", asked.startswith("这会删除这台设备上所有记录"),
                  f"确认文案：{asked[:24]}…")
        except Exception:  # noqa: BLE001
            page.screenshot(path=f"{args.shots}/erase-failed.png")
            got = " ".join(page.locator("body").inner_text().split())[:90]
            check("清空数据有二次确认，确认后回到首屏", False, f"清空后 8 秒没回首屏；当时页面：{got}")

        # 「清空」是否真清了库，只能看导出的字节 —— 界面回到首屏不等于数据没了。
        page.get_by_role("button", name="数据").click()
        page.wait_for_selector("text=导出 JSON")
        with page.expect_download(timeout=8000) as di2:
            page.get_by_role("button", name="导出 JSON").click()
        body = json.load(open(di2.value.path(), encoding="utf-8"))
        prof = body["data"]["profile"]
        check("清空是真清空：导出文件里 changes 与检查结论都空",
              body["data"]["changes"] == [] and prof.get("readiness") is None,
              f"changes={len(body['data']['changes'])} readiness={prof.get('readiness')}")
        page.locator("footer").get_by_role("button", name="返回").click()

        external = [u for u in requests if urlparse(u).netloc and urlparse(u).netloc != origin]
        tracked = [u for u in requests if any(t in u.lower() for t in TRACKERS)]
        check("零第三方域名请求", len(external) == 0,
              f"{len(requests)} 个请求，跨域：{external[:3]}" if external else f"{len(requests)} 个请求全在同域")
        check("零遥测/分析端点", len(tracked) == 0, "; ".join(tracked[:3]))
        check("Console 零报错", len(console_errors) == 0, "; ".join(console_errors[:2]))
        page.screenshot(path=f"{args.shots}/https-full.png")

        # 手机视口下核心流程可操作
        b2, vp2 = launch(p, mobile=True)
        c2 = b2.new_context(**vp2)
        pg2 = c2.new_page()
        pg2.goto(base)
        pg2.wait_for_selector("h1")
        pg2.get_by_role("button", name="开始检查").click()
        for _ in range(7):
            pg2.locator(".choices").get_by_text("经常", exact=True).first.click()
        pg2.wait_for_selector("text=主要摩擦领域")
        pg2.locator(".choices").nth(0).get_by_text("学习", exact=True).first.click()
        overflow = pg2.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        check("手机尺寸（390 宽）无横向溢出且流程可点", overflow <= 1, f"溢出 {overflow}px")
        pg2.screenshot(path=f"{args.shots}/https-mobile.png")
        b2.close()

        browser.close()

    red = [r for r in results if r[0] == "FAIL"]
    blind = [r for r in results if r[0] == "UNMEASURED"]
    print("=" * 46)
    print(f"共 {len(results)} 格：PASS {len(results) - len(red) - len(blind)}　红 {len(red)}　量不到 {len(blind)}")
    for state, name, detail in red + blind:
        print(f"  {state}  {name}" + (f"  | {detail[:120]}" if detail else ""))
    # 退出码三档：红=1；没红但有格量不到=2（不许把量不到读成通过）；全绿=0
    if red:
        sys.exit(1)
    if blind:
        print("没有红格，但有格子这台仪器量不到 —— 报告里要单独列出，不当通过")
        sys.exit(2)
    print("真浏览器验收全绿")


if __name__ == "__main__":
    main()
