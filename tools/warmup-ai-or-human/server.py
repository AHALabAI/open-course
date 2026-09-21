#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《你分得出吗？》暖场游戏 · 本地局域网服务（限时同步赛 + 管理后台）
- 题库/成绩/作答存 SQLite（data.db），管理员凭据存 .env
- 主讲人后台：设答题时长 → 开始本轮 → 全场倒计时 → 时间到统一出排名；实时看每题作答与完成情况
- /        观众答题页    /host    管理后台（需登录）
用法：python3 server.py   （只依赖 Python 标准库；Python 3.7+）
"""
import http.server, socketserver, sqlite3, json, os, re, socket, threading, time, secrets, hmac
from urllib.parse import urlparse, unquote, parse_qs
from http.cookies import SimpleCookie

DEFAULT_PORT = 8000
PORT = DEFAULT_PORT          # 实际监听端口（main 里按 .env 的 PORT 覆盖）
PUBLIC_BASE = ""             # 对外访问基地址（main 里按 .env 计算；二维码与提示都用它）
HERE = os.path.dirname(os.path.abspath(__file__))
DB   = os.path.join(HERE, "data.db")
ENV  = os.path.join(HERE, ".env")
MEDIA = os.path.join(HERE, "media")
MAX_UPLOAD = 300 * 1024 * 1024
DEFAULT_DURATION = 180          # 默认答题时长（秒）
LOCK = threading.Lock()
SESSIONS = {}
SESSION_TTL = 12 * 3600

# ---------------- .env 管理员凭据 ----------------
def load_env():
    env = {}
    if os.path.exists(ENV):
        with open(ENV, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def ensure_env():
    env = load_env(); changed = False
    if not env.get("ADMIN_USER"):
        env["ADMIN_USER"] = "admin"; changed = True
    if not env.get("ADMIN_PASS"):
        env["ADMIN_PASS"] = secrets.token_urlsafe(6); changed = True
    if changed:
        with open(ENV, "w", encoding="utf-8") as f:
            f.write("# 管理员登录凭据（改完保存并重启 server.py 生效）\n")
            f.write("ADMIN_USER=%s\n" % env["ADMIN_USER"])
            f.write("ADMIN_PASS=%s\n" % env["ADMIN_PASS"])
            f.write("\n# —— 对外访问地址（可选）——\n")
            f.write("# 下面任一项填了就优先用它来生成访问地址和二维码；都留空 = 自动探测本机局域网 IP。\n")
            f.write("# 监听端口（默认 8000）：\n")
            f.write(("PORT=%s\n" % env["PORT"]) if env.get("PORT") else "# PORT=8000\n")
            f.write("# 只固定对外 IP（端口用上面的 PORT）：\n")
            f.write(("HOST_IP=%s\n" % env["HOST_IP"]) if env.get("HOST_IP") else "# HOST_IP=192.168.1.50\n")
            f.write("# 或直接给完整地址（优先级最高，可用域名/https，给反向代理用）：\n")
            f.write(("PUBLIC_URL=%s\n" % env["PUBLIC_URL"]) if env.get("PUBLIC_URL") else "# PUBLIC_URL=http://192.168.1.50:8000\n")
    return env

# ---------------- 默认题库 ----------------
NOTE = "（管理员待补：请在后台为本题填入媒体——上传本地文件或填一个地址。）"
SEED = [
    {"kind":"text","round":"文字 · 真伪","prompt":"这首小诗，是谁写的？",
     "body":"我把整座湖叠进一张纸\n折出一只不会飞的鸟\n风来的时候\n它比真的还想走","answer":"b",
     "reveal":"AI 一口气写了二十版，一个人挑出这版、又改了最后一句。那么这首诗，该署谁的名？"},
    {"kind":"text","round":"文字 · 真伪","prompt":"这句“名人名言”，可信吗？",
     "body":"「想象力会枯竭，唯有好奇心能自己续命。」","src":"—— 阿尔伯特 · 爱因斯坦","answer":"a",
     "reveal":"查无此言。AI 仿出腔调、配个煞有介事的出处，就能把没人说过的话安到真人头上。遇到引用，先查证。"},
    {"kind":"text","round":"文字 · 真伪","prompt":"这条新闻短讯，是谁写的？",
     "body":"本周末，洱海周边观测到今年首批越冬红嘴鸥，较去年提前九天到达。","src":"— 某地方媒体","answer":"b",
     "reveal":"人记者跑的现场、写的初稿，AI 帮着润色、起了标题。今天你刷到的多数稿子，都是这样“合写”出来的。"},
    {"kind":"text","round":"文字 · 真伪","prompt":"这段科普，靠谱吗？",
     "body":"章鱼有九个大脑：中央一个，八条腕各一个，所以它能边逃跑边开锁。","answer":"a",
     "reveal":"读着真顺，但“九个大脑”是流行误传——章鱼是一个中枢脑加八条腕上分布的神经节。AI 常用最自信的语气，说最像样的错话。"},
    {"kind":"code","round":"程序 · 代码","prompt":"这段代码，是谁写的？",
     "body":"function 数鸟(frames){\n  let count = 0;\n  for (const f of frames){\n    count += detect(f)\n      .filter(o => o.label === \"bird\").length;\n  }\n  return count;\n}","answer":"b",
     "reveal":"函数骨架是人搭的，里面那段循环是 Copilot 补全的。现在很多代码，就是人和 AI 一行一行接力写出来的。"},
    {"kind":"code","round":"程序 · 代码","prompt":"这个判断回文的函数，没问题吗？",
     "body":"def is_palindrome(s):\n    return s == s[::-1]","answer":"a",
     "reveal":"AI 一秒就能写出来，看着也没毛病——可它没处理大小写和空格。AI 写得快，却常漏掉你没说出口的边界。"},
    {"kind":"image","round":"图像 · 影像","prompt":"这张“获奖摄影作品”，是拍的还是生成的？",
     "body":NOTE,"media":"","answer":"a",
     "reveal":"近年真有 AIGC 作品“混进”并赢过摄影奖，事后才被发现。当眼睛已经不够用，你只能回到更老的问题：它从哪来、是谁、为什么给你看。"},
    {"kind":"image","round":"图像 · 影像","prompt":"这张插画，是谁画的？",
     "body":NOTE,"media":"","answer":"b",
     "reveal":"画师起的线稿与构图，AI 上色、扩展、出变体。今天大量插画，是人定方向、AI 来填——合作的产物。"},
    {"kind":"image","round":"图像 · 影像","prompt":"这张“实拍”产品图，可信吗？",
     "body":NOTE,"media":"","answer":"a",
     "reveal":"电商主图里越来越多是 AI 生成的“伪实拍”：模特、场景、光影全是算出来的。你看到的“真实”，可能从没存在过。"},
    {"kind":"audio","round":"声音 · 音乐","prompt":"这段歌声，是谁唱的？",
     "body":"示例：王悦做的音乐数字人 Ailee。"+NOTE,"media":"","answer":"b",
     "reveal":"音乐数字人，是人作词作曲、调校情感，AI 来演唱合成——一首歌的署名，正在变得不那么简单。"},
    {"kind":"audio","round":"声音 · 音乐","prompt":"这段旁白，是真人录的吗？",
     "body":NOTE,"media":"","answer":"a",
     "reveal":"AI 语音（像 ElevenLabs、Suno 这类）已能克隆音色、以假乱真。下次听到“真人”声音，也许该多想一秒。"},
    {"kind":"video","round":"影视 · 短片","prompt":"画面里这个人 Yuri，是真人还是做出来的？",
     "body":"示例：汗青工作室做的数字人 Yuri。"+NOTE,"media":"","answer":"b",
     "reveal":"数字人，是人设计形象、写脚本、做精修，AI 与 CG 负责生成和驱动——一个“人”，由一群人和一堆模型共同造出来。"},
    {"kind":"embed","round":"影视 · 短片","prompt":"这部影片《霉》，有没有 AI 参与？",
     "body":"示例：孟柯的电影《霉》。"+NOTE+"（嵌入：填 B 站/YouTube 等可嵌入的播放地址）","media":"","link":"","answer":"b",
     "reveal":"从剧本、分镜到调色、特效，今天的影视常有 AI 介入的环节。纯人工或纯 AI，都越来越少。（本题答案与媒体请按实际情况在后台核定。）"},
    {"kind":"video","round":"影视 · 短片","prompt":"这段短视频，是拍的还是生成的？",
     "body":NOTE,"media":"","answer":"a",
     "reveal":"AI 生成视频（像 Sora 这类）已能做出几秒以假乱真的镜头。你刷到的“随手一拍”，可能一帧都没真的发生过。"},
    {"kind":"product","round":"产品 · 应用","prompt":"Boundless-Flow 这个工具，是谁做的？",
     "body":"一个本地语音转写桌面应用。","link":"https://boundless-flow.zimablueai.com/","answer":"b",
     "reveal":"这是我们自己做的：人定方向、做架构，AI 写了大量代码。它就是“人和 AI 一起做产品”最实在的样子。"},
    {"kind":"product","round":"产品 · 应用","prompt":"Bitchat 这款蓝牙聊天 app，是谁做的？",
     "body":"无需网络、靠蓝牙点对点传消息的聊天工具。","answer":"b",
     "reveal":"它被称作最有名的“氛围编程（vibe coding）”应用之一，由 Twitter 联合创始人 Jack Dorsey 借 AI 助手做出——但他本人是技术大牛，AI 是助手，不是替身。"},
    {"kind":"product","round":"产品 · 应用","prompt":"MenuGen 这个小工具，是谁做的？",
     "body":"把菜单文字变成菜品图片的小应用。","answer":"b",
     "reveal":"AI 研究者 Karpathy 用 AI“氛围编程”做的——“vibe coding”这个词都是他造的。再 AI 的应用，背后也站着一个很懂行的人。"},
    {"kind":"product","round":"产品 · 应用","prompt":"GitHub 上一个很火的开源项目，代码是谁写的？",
     "body":"（可在后台换成你想用的具体项目，并填上它的链接）","link":"","answer":"b",
     "reveal":"今天大量开源项目的代码，是人和 Copilot / Claude 一行行接力写的。纯靠人手敲的，越来越少。"},
    {"kind":"product","round":"产品 · 应用","prompt":"一个号称“全部由 AI 开发”的爆款应用——真是纯 AI 吗？",
     "body":"网上常有“某 app 完全由 AI 写成”的说法。","answer":"b",
     "reveal":"几乎找不到真正“完全由 AI 独立开发”的知名应用。就连那些“90% 代码由 AI 生成”的，也有人在定方向、清 bug、做决定。纯 AI，更多是个传说。"},
    {"kind":"text","round":"最后一题","prompt":"你正在玩的这个小游戏，是谁做的？",
     "body":"题目、配色、那条“正在消失的界线”，还有这套程序本身。","answer":"b",
     "reveal":"也是人和 AI 一起：一个人定了主意和题目，AI 写了代码和大半文案。你刚玩过的，正是它想说的——分清谁做的越来越难，重要的是那支笔还在不在你手里。"},
]

def conn():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

def init_db():
    with LOCK:
        c = conn()
        try:
            c.execute("PRAGMA journal_mode=WAL")
            c.execute("""CREATE TABLE IF NOT EXISTS questions(
                id INTEGER PRIMARY KEY AUTOINCREMENT, ord INTEGER DEFAULT 0,
                kind TEXT, round TEXT, prompt TEXT, body TEXT, src TEXT,
                media TEXT, link TEXT, answer TEXT, reveal TEXT)""")
            c.execute("""CREATE TABLE IF NOT EXISTS players(
                id TEXT PRIMARY KEY, nick TEXT, joined REAL, finished REAL)""")
            c.execute("""CREATE TABLE IF NOT EXISTS answers(
                pid TEXT, qid INTEGER, choice TEXT, correct INTEGER, t REAL,
                PRIMARY KEY(pid, qid))""")
            c.execute("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)")
            seeded = c.execute("SELECT v FROM meta WHERE k='seeded'").fetchone()
            if not seeded:
                if c.execute("SELECT COUNT(*) AS n FROM questions").fetchone()["n"] == 0:
                    for i, q in enumerate(SEED):
                        c.execute("INSERT INTO questions(ord,kind,round,prompt,body,src,media,link,answer,reveal) VALUES(?,?,?,?,?,?,?,?,?,?)",
                                  (i, q["kind"], q["round"], q["prompt"], q.get("body",""), q.get("src",""),
                                   q.get("media",""), q.get("link",""), q["answer"], q["reveal"]))
                c.execute("INSERT OR REPLACE INTO meta(k,v) VALUES('seeded','1')")
            # 初始化轮次设置
            for k, v in (("duration", str(DEFAULT_DURATION)), ("round_start", "0"), ("round_status", "idle")):
                if not c.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone():
                    c.execute("INSERT INTO meta(k,v) VALUES(?,?)", (k, v))
            c.commit()
        finally:
            c.close()

# ---------- meta / 轮次 ----------
def get_meta(k, default=None):
    c = conn()
    try:
        r = c.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
        return r["v"] if r else default
    finally:
        c.close()

def set_meta(k, v):
    with LOCK:
        c = conn()
        try:
            c.execute("INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)", (k, str(v))); c.commit()
        finally:
            c.close()

def qcount():
    c = conn()
    try:
        return c.execute("SELECT COUNT(*) AS n FROM questions").fetchone()["n"]
    finally:
        c.close()

def round_state():
    status = get_meta("round_status", "idle")
    start  = float(get_meta("round_start", "0") or 0)
    dur    = int(float(get_meta("duration", str(DEFAULT_DURATION)) or DEFAULT_DURATION))
    now    = time.time()
    remaining = 0
    if status == "running":
        remaining = int(round(start + dur - now))
        if remaining <= 0:
            remaining = 0
            status = "ended"
            set_meta("round_status", "ended")     # 时间到，自动结束
    return {"status": status, "start": start, "duration": dur, "remaining": remaining,
            "now": now, "qcount": qcount()}

def round_clear():
    with LOCK:
        c = conn()
        try:
            c.execute("DELETE FROM players"); c.execute("DELETE FROM answers"); c.commit()
        finally:
            c.close()

# ---------- 玩家 / 作答 ----------
def player_upsert(pid, nick):
    with LOCK:
        c = conn()
        try:
            ex = c.execute("SELECT id FROM players WHERE id=?", (pid,)).fetchone()
            if ex:
                if nick:
                    c.execute("UPDATE players SET nick=? WHERE id=?", (nick, pid))
            else:
                c.execute("INSERT INTO players(id,nick,joined,finished) VALUES(?,?,?,NULL)", (pid, nick or "无名旅人", time.time()))
            c.commit()
        finally:
            c.close()

def answer_put(pid, nick, qid, choice):
    c = conn()
    try:
        row = c.execute("SELECT answer FROM questions WHERE id=?", (qid,)).fetchone()
    finally:
        c.close()
    correct = 1 if (row and row["answer"] == choice) else 0
    with LOCK:
        c = conn()
        try:
            ex = c.execute("SELECT id FROM players WHERE id=?", (pid,)).fetchone()
            if not ex:
                c.execute("INSERT INTO players(id,nick,joined,finished) VALUES(?,?,?,NULL)", (pid, nick or "无名旅人", time.time()))
            elif nick:
                c.execute("UPDATE players SET nick=? WHERE id=?", (nick, pid))
            c.execute("INSERT OR REPLACE INTO answers(pid,qid,choice,correct,t) VALUES(?,?,?,?,?)", (pid, qid, choice, correct, time.time()))
            c.commit()
        finally:
            c.close()
    return correct

def player_finish(pid):
    with LOCK:
        c = conn()
        try:
            c.execute("UPDATE players SET finished=? WHERE id=? AND finished IS NULL", (time.time(), pid)); c.commit()
        finally:
            c.close()

def ranking():
    c = conn()
    try:
        rows = c.execute("""
            SELECT p.id, p.nick, p.joined, p.finished,
                   COALESCE(SUM(a.correct),0) AS score, COUNT(a.qid) AS answered
            FROM players p LEFT JOIN answers a ON a.pid = p.id
            GROUP BY p.id, p.nick, p.joined, p.finished
        """).fetchall()
    finally:
        c.close()
    lst = [{"id": r["id"], "nick": r["nick"], "score": r["score"], "answered": r["answered"],
            "finished": r["finished"], "joined": r["joined"]} for r in rows]
    BIG = 9e18
    lst.sort(key=lambda x: (-x["score"], (x["finished"] if x["finished"] else BIG), x["joined"] or BIG))
    for i, x in enumerate(lst):
        x["rank"] = i + 1
    return lst

def counts():
    c = conn()
    try:
        joined = c.execute("SELECT COUNT(*) AS n FROM players").fetchone()["n"]
        finished = c.execute("SELECT COUNT(*) AS n FROM players WHERE finished IS NOT NULL").fetchone()["n"]
        notf = [r["nick"] for r in c.execute("SELECT nick FROM players WHERE finished IS NULL ORDER BY joined").fetchall()]
    finally:
        c.close()
    return joined, finished, notf

def per_question_stats():
    c = conn()
    try:
        qs = c.execute("SELECT id,ord,prompt,answer,round FROM questions ORDER BY ord,id").fetchall()
        out = []
        for q in qs:
            dist = {"h": 0, "a": 0, "b": 0}; answered = 0; correct = 0
            for d in c.execute("SELECT choice, COUNT(*) AS n, SUM(correct) AS cc FROM answers WHERE qid=? GROUP BY choice", (q["id"],)).fetchall():
                ch = d["choice"]
                if ch in dist:
                    dist[ch] = d["n"]
                answered += d["n"]; correct += (d["cc"] or 0)
            out.append({"qid": q["id"], "ord": q["ord"], "prompt": q["prompt"], "round": q["round"],
                        "right": q["answer"], "answered": answered, "dist": dist, "correct": correct})
    finally:
        c.close()
    return out

# ---------- 题库 CRUD ----------
def q_all():
    c = conn()
    try:
        return [dict(r) for r in c.execute("SELECT * FROM questions ORDER BY ord, id")]
    finally:
        c.close()

def _qfields(d):
    return (int(d.get("ord", 0) or 0), d.get("kind","text"), d.get("round",""), d.get("prompt",""),
            d.get("body",""), d.get("src",""), d.get("media",""), d.get("link",""),
            d.get("answer","h"), d.get("reveal",""))

def q_create(d):
    with LOCK:
        c = conn()
        try:
            cur = c.execute("INSERT INTO questions(ord,kind,round,prompt,body,src,media,link,answer,reveal) VALUES(?,?,?,?,?,?,?,?,?,?)", _qfields(d))
            c.commit(); return cur.lastrowid
        finally:
            c.close()

def q_update(qid, d):
    f = _qfields(d)
    with LOCK:
        c = conn()
        try:
            c.execute("UPDATE questions SET ord=?,kind=?,round=?,prompt=?,body=?,src=?,media=?,link=?,answer=?,reveal=? WHERE id=?", f + (qid,)); c.commit()
        finally:
            c.close()

def q_delete(qid):
    with LOCK:
        c = conn()
        try:
            c.execute("DELETE FROM questions WHERE id=?", (qid,)); c.commit()
        finally:
            c.close()

def seed_defaults():
    with LOCK:
        c = conn()
        try:
            c.execute("DELETE FROM questions")
            for i, q in enumerate(SEED):
                c.execute("INSERT INTO questions(ord,kind,round,prompt,body,src,media,link,answer,reveal) VALUES(?,?,?,?,?,?,?,?,?,?)",
                          (i, q["kind"], q["round"], q["prompt"], q.get("body",""), q.get("src",""),
                           q.get("media",""), q.get("link",""), q["answer"], q["reveal"]))
            c.commit()
        finally:
            c.close()

def import_questions(items):
    with LOCK:
        c = conn()
        try:
            c.execute("DELETE FROM questions")
            for i, q in enumerate(items):
                if not isinstance(q, dict):
                    continue
                d = dict(q); d.setdefault("ord", i)
                c.execute("INSERT INTO questions(ord,kind,round,prompt,body,src,media,link,answer,reveal) VALUES(?,?,?,?,?,?,?,?,?,?)", _qfields(d))
            c.commit()
        finally:
            c.close()

ENVCONF = {}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def _send(self, code, ctype, body, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra:
            for k, v in extra:
                self.send_header(k, v)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _json(self, obj, code=200, extra=None):
        self._send(code, "application/json; charset=utf-8", json.dumps(obj, ensure_ascii=False).encode("utf-8"), extra)

    def _read(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _sid(self):
        ck = SimpleCookie(self.headers.get("Cookie", ""))
        return ck["sid"].value if "sid" in ck else ""

    def _authed(self):
        t = self._sid(); ts = SESSIONS.get(t)
        if ts and (time.time() - ts) < SESSION_TTL:
            return True
        if t in SESSIONS:
            SESSIONS.pop(t, None)
        return False

    # ---------- GET ----------
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/me":
            return self._json({"authed": self._authed(), "user": ENVCONF.get("ADMIN_USER", "admin")})
        if path == "/api/questions":
            return self._json({"questions": q_all()})
        if path == "/api/state":
            return self._json(round_state())
        if path == "/api/config":
            return self._json({"base": PUBLIC_BASE, "join": PUBLIC_BASE + "/", "host": PUBLIC_BASE + "/host"})
        if path == "/api/results":
            return self._json({"rows": ranking(), "qcount": qcount(), "state": round_state()})
        if path == "/api/settings":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            return self._json({"duration": int(float(get_meta("duration", str(DEFAULT_DURATION))))})
        if path == "/api/host/monitor":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            joined, finished, notf = counts()
            return self._json({
                "state": round_state(), "joined": joined, "finished": finished,
                "inprogress": joined - finished, "notFinished": notf,
                "perQuestion": per_question_stats(), "ranking": ranking()})
        if path.endswith((".env", ".db", ".db-wal", ".db-shm", ".tmp")) or path.startswith("/."):
            return self._json({"error": "forbidden"}, 403)
        if path in ("/", ""):
            self.path = "/index.html"
        elif path == "/host":
            self.path = "/host.html"
        return super().do_GET()

    # ---------- POST ----------
    def do_POST(self):
        path = urlparse(self.path).path
        # ---- 公开（观众）----
        if path == "/api/login":
            d = self._read()
            u = str(d.get("user", "")); p = str(d.get("pass", ""))
            ok = hmac.compare_digest(u, ENVCONF.get("ADMIN_USER", "")) and hmac.compare_digest(p, ENVCONF.get("ADMIN_PASS", ""))
            if not ok:
                return self._json({"ok": False, "error": "用户名或密码不正确"}, 401)
            tok = secrets.token_urlsafe(24); SESSIONS[tok] = time.time()
            return self._json({"ok": True}, extra=[("Set-Cookie", "sid=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d" % (tok, SESSION_TTL))])
        if path == "/api/logout":
            SESSIONS.pop(self._sid(), None)
            return self._json({"ok": True}, extra=[("Set-Cookie", "sid=; Path=/; Max-Age=0")])
        if path == "/api/join":
            d = self._read()
            pid = str(d.get("id", ""))[:48]; nick = (str(d.get("nick", "")).strip()[:16]) or "无名旅人"
            if not pid:
                return self._json({"error": "缺少 id"}, 400)
            player_upsert(pid, nick)
            return self._json({"ok": True, "state": round_state()})
        if path == "/api/answer":
            d = self._read()
            pid = str(d.get("id", ""))[:48]; nick = str(d.get("nick", "")).strip()[:16]
            try: qid = int(d.get("qid"))
            except Exception: return self._json({"error": "qid 不对"}, 400)
            choice = str(d.get("choice", ""))[:2]
            st = round_state()
            if st["status"] != "running":
                return self._json({"ok": False, "error": "本轮未在进行", "state": st}, 409)
            correct = answer_put(pid, nick, qid, choice)
            return self._json({"ok": True, "correct": bool(correct)})
        if path == "/api/finish":
            d = self._read(); pid = str(d.get("id", ""))[:48]
            if pid:
                player_finish(pid)
            return self._json({"ok": True})
        # ---- 上传（管理员）----
        if path == "/api/upload":
            if not self._authed():
                return self._json({"error": "未登录"}, 401)
            n = int(self.headers.get("Content-Length", 0) or 0)
            if n <= 0:
                return self._json({"error": "空文件"}, 400)
            if n > MAX_UPLOAD:
                return self._json({"error": "文件过大（上限 300MB）"}, 413)
            raw = unquote(self.headers.get("X-Filename", "file"))
            base = os.path.basename(raw.replace("\\", "/"))
            root, ext = os.path.splitext(base)
            root = (re.sub(r"[^A-Za-z0-9_-]", "_", root)[:40]) or "file"
            ext  = re.sub(r"[^A-Za-z0-9.]", "", ext)[:10]
            name = time.strftime("%H%M%S") + "_" + secrets.token_hex(2) + "_" + root + ext
            os.makedirs(MEDIA, exist_ok=True)
            dest = os.path.join(MEDIA, name)
            remaining = n
            try:
                with open(dest, "wb") as fp:
                    while remaining > 0:
                        chunk = self.rfile.read(min(65536, remaining))
                        if not chunk:
                            break
                        fp.write(chunk); remaining -= len(chunk)
            except Exception:
                try: os.remove(dest)
                except Exception: pass
                return self._json({"error": "写入失败"}, 500)
            return self._json({"ok": True, "url": "/media/" + name, "name": base})
        # ---- 轮次控制（管理员）----
        if path == "/api/settings":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            d = self._read()
            try: dur = int(float(d.get("duration", DEFAULT_DURATION)))
            except Exception: dur = DEFAULT_DURATION
            dur = max(10, min(7200, dur))
            set_meta("duration", dur)
            return self._json({"ok": True, "duration": dur})
        if path == "/api/round/start":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            d = self._read()
            dur = None
            if "duration" in d:
                try: dur = max(10, min(7200, int(float(d.get("duration")))))
                except Exception: dur = None
            if dur is not None:
                set_meta("duration", dur)
            round_clear()
            set_meta("round_start", time.time())
            set_meta("round_status", "running")
            return self._json({"ok": True, "state": round_state()})
        if path == "/api/round/end":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            set_meta("round_status", "ended")
            return self._json({"ok": True, "state": round_state()})
        if path == "/api/round/reset":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            round_clear()
            set_meta("round_start", "0"); set_meta("round_status", "idle")
            return self._json({"ok": True, "state": round_state()})
        # ---- 题库（管理员）----
        if path == "/api/questions/import":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            d = self._read(); items = d.get("questions")
            if not isinstance(items, list):
                return self._json({"error": "格式不对：需要 questions 数组"}, 400)
            import_questions(items)
            return self._json({"ok": True, "count": len(items)})
        if path == "/api/questions/seed":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            seed_defaults()
            return self._json({"ok": True})
        if path == "/api/questions":
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            qid = q_create(self._read())
            return self._json({"ok": True, "id": qid})
        return self._json({"error": "not found"}, 404)

    def do_PUT(self):
        path = urlparse(self.path).path
        if path.startswith("/api/questions/"):
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            try: qid = int(path.rsplit("/", 1)[1])
            except Exception: return self._json({"error": "bad id"}, 400)
            q_update(qid, self._read()); return self._json({"ok": True})
        return self._json({"error": "not found"}, 404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path.startswith("/api/questions/"):
            if not self._authed(): return self._json({"error": "未登录"}, 401)
            try: qid = int(path.rsplit("/", 1)[1])
            except Exception: return self._json({"error": "bad id"}, 400)
            q_delete(qid); return self._json({"ok": True})
        return self._json({"error": "not found"}, 404)

    def log_message(self, *a):
        pass

def lan_ip():
    # 优先使用真实局域网网卡地址，避开 Docker/WSL/代理等虚拟网卡。
    try:
        candidates = []
        for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = item[4][0]
            if ip.startswith(('192.168.', '10.')) or (ip.startswith('172.') and 16 <= int(ip.split('.')[1]) <= 31):
                candidates.append(ip)
        if candidates:
            # 同一台机器可能同时有有线与 Wi-Fi；首个真实私网地址比虚拟路由更适合课堂扫码。
            return candidates[0]
    except Exception:
        pass
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def compute_public_base(env, port):
    """对外访问基地址：PUBLIC_URL > HOST_IP+PORT > 自动探测的局域网 IP+PORT。"""
    url = (os.environ.get("WARMUP_PUBLIC_URL") or env.get("PUBLIC_URL") or "").strip()
    if url:
        return url.rstrip("/")
    ip = (os.environ.get("WARMUP_HOST_IP") or env.get("HOST_IP") or "").strip() or lan_ip()
    return "http://%s:%d" % (ip, port)

def main():
    global ENVCONF, PORT, PUBLIC_BASE
    ENVCONF = ensure_env()
    init_db()
    os.makedirs(MEDIA, exist_ok=True)
    try:
        PORT = int(str(ENVCONF.get("PORT") or DEFAULT_PORT).strip())
    except Exception:
        PORT = DEFAULT_PORT
    PUBLIC_BASE = compute_public_base(ENVCONF, PORT)
    src = "PUBLIC_URL（.env）" if (ENVCONF.get("PUBLIC_URL") or "").strip() else \
          ("HOST_IP（.env）" if (ENVCONF.get("HOST_IP") or "").strip() else "自动探测局域网IP")
    bar = "=" * 52
    print("\n" + bar)
    print("  《你分得出吗？》本地服务已启动")
    print(bar)
    print("  观众手机访问 ： %s/" % PUBLIC_BASE)
    print("  管理员后台   ： %s/host" % PUBLIC_BASE)
    print("  地址来源     ： %s   （监听端口 %d）" % (src, PORT))
    print("  ----")
    print("  管理员账号   ： %s" % ENVCONF.get("ADMIN_USER"))
    print("  管理员密码   ： %s   （可在 .env 文件里修改）" % ENVCONF.get("ADMIN_PASS"))
    print("  ----")
    print("  手机需与本机连同一 Wi-Fi。停止：Ctrl + C")
    print(bar + "\n")
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    try:
        with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  已停止。题库与数据保存在 data.db。\n")
    except OSError as e:
        print("\n  启动失败：%s\n  可能是 %d 端口被占用，改 .env 里的 PORT 换一个。\n" % (e, PORT))

if __name__ == "__main__":
    main()
