#!/usr/bin/env python3
"""把 dist/ 起成本地静态站点：下载即跑，不需要 Node/npm。

为什么需要它：构建产物是 ES 模块 + Service Worker，直接双击 index.html 走 file://
会被浏览器按跨源拦掉，SW 也压根不在安全上下文里注册。所以本机最省事的跑法
就是任意一个 http 静态服务器 —— 这枚脚本保证「手上只有 zip 包」的人也能一步打开。

    python3 tools/serve-dist.py            # 默认 127.0.0.1:4173
    python3 tools/serve-dist.py 8080       # 换端口

只监听回环地址，不对外提供服务。
"""
import functools
import http.server
import os
import socketserver
import sys

here = os.path.dirname(os.path.abspath(__file__))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173

# 两种落点：仓库里（tools/，产物在 ../dist）与发布包里（和 dist/ 同级）。
# 只算一种会在另一种布局下指着不存在的目录 —— 实测过：从解压出来的包里跑，
# 它去找 <包父目录>/dist，直接报「找不到 index.html」。
cands = [os.path.join(here, "dist"), os.path.join(os.path.dirname(here), "dist")]
root = next((c for c in cands if os.path.isfile(os.path.join(c, "index.html"))), None)
if root is None:
    sys.exit(f"找不到 dist/index.html（试过的路径：{', '.join(cands)}）—— 先跑 npm run build")

# directory= 必须显式给。早先只算出 root 没传进去，handler 实际服务的是当前工作目录，
# 于是仓库根那份 dev 版 index.html 被当成产物端出来（/ 返回 200，但 /sw.js 404）。
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", port), handler) as srv:
    print(f"OpenReboot → http://127.0.0.1:{port}/  (Ctrl-C 停)", flush=True)
    srv.serve_forever()
