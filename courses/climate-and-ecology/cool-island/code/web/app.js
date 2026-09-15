const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const menuButton = document.querySelector("#menuButton");
const mobileMenu = document.querySelector("#mobileMenu");

function setMenu(open) {
  mobileMenu.dataset.open = String(open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.textContent = open ? "收起" : "目录";
}

menuButton?.addEventListener("click", () => {
  setMenu(mobileMenu.dataset.open !== "true");
});

mobileMenu?.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

const scene = document.querySelector("#coolIslandScene");
document.querySelectorAll(".scene-switch").forEach((button) => {
  button.addEventListener("click", () => {
    const nextScene = button.dataset.scene;
    scene.dataset.scene = nextScene;
    document.querySelectorAll(".scene-switch").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
  });
});

const scaleData = {
  body: {
    title: "身体先告诉我们",
    copy: "手背感到椅面烫，脸侧感到风，影子告诉我们太阳来自哪里。学生用身体语言建立第一张热感地图。",
    evidence: "证据：热感词、姿态、停留时间、现场照片",
    visual: `
      <svg viewBox="0 0 720 320" role="img" aria-label="身体感受热与风">
        <rect class="svg-dark" width="720" height="320"/>
        <circle class="svg-warning" cx="590" cy="72" r="42"/>
        <path class="svg-paper" d="M128 244h280v34H128z"/>
        <path class="svg-light-stroke" stroke-width="8" d="M155 278v34M380 278v34"/>
        <circle class="svg-heat" cx="280" cy="141" r="32"/>
        <path class="svg-heat-stroke" stroke-width="12" stroke-linecap="round" d="M280 177v72M280 196l-54 41M280 196l55 40"/>
        <path class="svg-cool-stroke" stroke-width="7" stroke-linecap="round" d="M28 80c92-34 145 28 222-3M38 124c78-26 124 20 185 0"/>
        <text fill="currentColor" x="32" y="294" font-family="var(--font-mono)" font-size="17">热感 · 影子 · 风 · 停留</text>
      </svg>`
  },
  weather: {
    title: "天气给行动一个提前量",
    copy: "逐时温度、云、风、降雨和预警帮助团队安排户外测量、补水、实验与收纳。每条预测同时显示更新时间。",
    evidence: "证据：官方观测、逐时预报、校园节点、行动记录",
    visual: `
      <svg viewBox="0 0 720 320" role="img" aria-label="一天内天气变化">
        <rect class="svg-dark" width="720" height="320"/>
        <path class="svg-rule-stroke" stroke-width="2" d="M62 256H666M62 64V256"/>
        <path class="svg-heat-stroke" stroke-width="8" stroke-linecap="round" d="M80 220C160 210 188 135 270 145S390 72 470 102s98 65 176 48"/>
        <path class="svg-cool-stroke svg-dash" stroke-width="6" d="M80 235C172 222 213 184 294 200s117-55 190-25 102 21 162 6"/>
        <g class="svg-warning"><circle cx="80" cy="220" r="8"/><circle cx="270" cy="145" r="8"/><circle cx="470" cy="102" r="8"/><circle cx="646" cy="150" r="8"/></g>
        <text fill="currentColor" x="72" y="286" font-family="var(--font-mono)" font-size="16">08:00</text><text fill="currentColor" x="270" y="286" font-family="var(--font-mono)" font-size="16">12:00</text><text fill="currentColor" x="468" y="286" font-family="var(--font-mono)" font-size="16">16:00</text>
      </svg>`
  },
  enso: {
    title: "暖水改变一季的概率",
    copy: "学生把赤道太平洋海温异常、风和云雨放在地图上，再与本地温度和降雨按月份对齐，寻找区域差异与时间滞后。",
    evidence: "证据：Niño 3.4、WMO 更新、本地逐月记录、来源日期",
    visual: `
      <svg viewBox="0 0 720 320" role="img" aria-label="太平洋暖水与大气环流示意">
        <rect class="svg-dark" width="720" height="320"/>
        <path class="svg-cool" d="M0 205c118-33 198 19 309-10s200-15 411 0v125H0z"/>
        <path class="svg-heat" d="M155 214c102-56 262-70 422-15-84 38-330 44-422 15Z"/>
        <path class="svg-light-stroke" stroke-width="6" stroke-linecap="round" d="M576 122C456 78 288 84 163 132"/>
        <path class="svg-warning" d="M148 132l35-19-7 34z"/>
        <path class="svg-paper" opacity=".88" d="M75 48c41-42 83-24 99 8 43-21 86 13 73 51H76c-31-14-28-40-1-59ZM470 57c41-42 83-24 99 8 43-21 86 13 73 51H471c-31-14-28-40-1-59Z"/>
        <text fill="currentColor" x="244" y="276" font-family="var(--font-mono)" font-size="17">海温异常 · 风 · 云雨 · 季节概率</text>
      </svg>`
  },
  climate: {
    title: "长期记录改变设计基线",
    copy: "多年高温日、强降雨和夜间温度记录帮助城市更新材料、树荫、公共空间与学校响应。学生把一次事件放回长期背景。",
    evidence: "证据：长期序列、同一口径、区域范围、可信度说明",
    visual: `
      <svg viewBox="0 0 720 320" role="img" aria-label="长期气候序列与城市变化">
        <rect class="svg-dark" width="720" height="320"/>
        <path class="svg-rule-stroke" stroke-width="2" d="M56 252H676M56 52V252"/>
        <path class="svg-heat-stroke" stroke-width="8" stroke-linecap="round" d="M74 228l52-18 52 8 52-36 52 18 52-54 52 19 52-61 52 20 52-58 52 14"/>
        <path class="svg-cool-stroke svg-dash" stroke-width="5" d="M74 238l104-12 104-30 104-12 104-39 104-18"/>
        <g class="svg-paper"><rect x="92" y="185" width="38" height="67"/><rect x="174" y="202" width="44" height="50"/><rect x="272" y="170" width="39" height="82"/><rect x="382" y="145" width="48" height="107"/><rect x="505" y="120" width="56" height="132"/></g>
        <text fill="currentColor" x="192" y="288" font-family="var(--font-mono)" font-size="17">多年统计 · 设计基线 · 公共行动</text>
      </svg>`
  }
};

const scaleTabs = [...document.querySelectorAll(".scale-tab")];
const scaleVisual = document.querySelector("#scaleVisual");
const scaleTitle = document.querySelector("#scaleTitle");
const scaleCopy = document.querySelector("#scaleCopy");
const scaleEvidence = document.querySelector("#scaleEvidence");

function renderScale(key, focusPanel = false) {
  const item = scaleData[key];
  scaleTabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.scale === key)));
  scaleVisual.innerHTML = item.visual;
  scaleTitle.textContent = item.title;
  scaleCopy.textContent = item.copy;
  scaleEvidence.textContent = item.evidence;
  if (focusPanel) document.querySelector("#scaleStage")?.focus({ preventScroll: true });
}

scaleTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => renderScale(tab.dataset.scale));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = scaleTabs[(index + delta + scaleTabs.length) % scaleTabs.length];
    next.focus({ preventScroll: true });
    renderScale(next.dataset.scale);
  });
});
renderScale("body");

document.querySelectorAll(".lesson").forEach((lesson) => {
  const marker = lesson.querySelector(".lesson__toggle");
  const updateMarker = () => { marker.textContent = lesson.open ? "－" : "＋"; };
  lesson.addEventListener("toggle", updateMarker);
  updateMarker();
});

const railLinks = [...document.querySelectorAll(".rail__link")];
const lessonSections = [...document.querySelectorAll(".lesson")];
const railNav = document.querySelector(".rail__nav");
const railCurrentTitle = document.querySelector("#railCurrentTitle");
const railCurrentMeta = document.querySelector("#railCurrentMeta");
let railScrollTarget = "";
let railScrollSettleTimer = 0;
function setActiveRailLink(activeLink) {
  railLinks.forEach((link) => {
    link.setAttribute("aria-current", String(link === activeLink));
  });
  railNav?.style.setProperty("--active-index", activeLink.dataset.index || "0");
  if (railCurrentTitle) railCurrentTitle.textContent = activeLink.dataset.title || "";
  if (railCurrentMeta) railCurrentMeta.textContent = activeLink.dataset.meta || "";
}
railLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const target = document.querySelector(`#${link.dataset.section}`);
    if (!target) return;

    const keyboardActivated = event.detail === 0;
    railScrollTarget = link.dataset.section;
    window.clearTimeout(railScrollSettleTimer);
    if (keyboardActivated) railNav?.setAttribute("data-instant", "true");
    setActiveRailLink(link);
    target.open = true;
    target.scrollIntoView({
      behavior: reduceMotion || keyboardActivated ? "auto" : "smooth",
      block: "start"
    });
    window.history.replaceState(null, "", `#${link.dataset.section}`);
    railScrollSettleTimer = window.setTimeout(() => {
      railScrollTarget = "";
    }, 1200);
    window.requestAnimationFrame(() => railNav?.removeAttribute("data-instant"));
  });
});
if ("IntersectionObserver" in window) {
  const lessonObserver = new IntersectionObserver((entries) => {
    if (railScrollTarget) return;
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const activeLink = railLinks.find((link) => link.dataset.section === visible.target.id);
    if (activeLink) setActiveRailLink(activeLink);
  }, { rootMargin: "-20% 0px -55%", threshold: [0.05, 0.3, 0.65] });
  lessonSections.forEach((section) => lessonObserver.observe(section));
}

const progressBar = document.querySelector(".rail__progress i");
let progressQueued = false;
function updateProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const value = max > 0 ? Math.min(1, window.scrollY / max) : 0;
  if (progressBar) progressBar.style.transform = `translateX(${(value - 1) * 100}%)`;
  progressQueued = false;
}
window.addEventListener("scroll", () => {
  if (railScrollTarget) {
    window.clearTimeout(railScrollSettleTimer);
    railScrollSettleTimer = window.setTimeout(() => {
      railScrollTarget = "";
    }, 180);
  }
  if (progressQueued) return;
  progressQueued = true;
  window.requestAnimationFrame(updateProgress);
}, { passive: true });
updateProgress();

const trackButton = document.querySelector("#runTrack");
const trackPaths = [...document.querySelectorAll(".track-progress")];
trackButton?.addEventListener("click", () => {
  trackButton.dataset.state = "loading";
  trackButton.textContent = "路径推演中";
  trackPaths.forEach((path, index) => {
    path.style.transitionDelay = reduceMotion ? "0ms" : `${index * 140}ms`;
    path.style.strokeDashoffset = "1";
  });
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => trackPaths.forEach((path) => { path.style.strokeDashoffset = "0"; }));
  });
  window.setTimeout(() => {
    trackButton.dataset.state = "success";
    trackButton.textContent = "再次推演";
  }, reduceMotion ? 180 : 1900);
});

const markovMatrix = {
  "晴热": { "晴热": 0.50, "多云": 0.30, "雷雨": 0.15, "强风": 0.05 },
  "多云": { "晴热": 0.25, "多云": 0.40, "雷雨": 0.25, "强风": 0.10 },
  "雷雨": { "晴热": 0.20, "多云": 0.35, "雷雨": 0.35, "强风": 0.10 },
  "强风": { "晴热": 0.25, "多云": 0.25, "雷雨": 0.20, "强风": 0.30 }
};
const weatherStates = Object.keys(markovMatrix);
const markovCurrent = document.querySelector("#markovCurrent");
const markovObserved = document.querySelector("#markovObserved");
const markovBars = document.querySelector("#markovBars");
const markovRoute = document.querySelector("#markovRoute");
const brierOutput = document.querySelector("#brierOutput");
let markovForecast = markovMatrix[markovCurrent?.value || "多云"];
let simulationSeed = 20260718;

function seededRandom() {
  simulationSeed = (simulationSeed * 1664525 + 1013904223) >>> 0;
  return simulationSeed / 4294967296;
}

function sampleWeather(distribution) {
  const draw = seededRandom();
  let cumulative = 0;
  for (const state of weatherStates) {
    cumulative += distribution[state];
    if (draw <= cumulative) return state;
  }
  return weatherStates[weatherStates.length - 1];
}

function renderMarkov() {
  const current = markovCurrent.value;
  markovForecast = markovMatrix[current];
  markovBars.innerHTML = weatherStates.map((state) => {
    const probability = markovForecast[state];
    return `<div class="markov-bar"><span>${state}</span><div class="markov-bar__track"><i class="markov-bar__fill" style="--probability:${probability}"></i></div><b>${Math.round(probability * 100)}%</b></div>`;
  }).join("");

  let state = current;
  const route = [state];
  for (let step = 0; step < 12; step += 1) {
    state = sampleWeather(markovMatrix[state]);
    route.push(state);
  }
  markovRoute.textContent = route.join(" → ");
  brierOutput.textContent = "等待实况";
}

document.querySelector("#markovForecast")?.addEventListener("click", () => {
  simulationSeed += 17;
  renderMarkov();
});

document.querySelector("#scoreForecast")?.addEventListener("click", () => {
  const observed = markovObserved.value;
  const score = weatherStates.reduce((total, state) => {
    const target = state === observed ? 1 : 0;
    return total + (markovForecast[state] - target) ** 2;
  }, 0);
  const reading = score <= 0.5 ? "这次概率分配贴近实况" : "这次实况带来一轮模型修订";
  brierOutput.textContent = `${score.toFixed(3)} · ${reading}`;
});
renderMarkov();

const routeData = {
  red: {
    eyebrow: "RED TEAM · 看得见每一步",
    title: "从昨天的天气，造一把透明的预测尺",
    tools: "持续性基线、月气候态、马尔可夫链、线性回归、5 张 AI 求助券",
    role: "数据侦探、规则搭建者、误差审计员、校园行动翻译员",
    evidence: "状态转移表、训练日志、逐日预测、误差解释与一次模型修订"
  },
  blue: {
    eyebrow: "BLUE TEAM · 把 AI 的选择照亮",
    title: "只凭 AI 自学，建立一条可追踪的预测工作流",
    tools: "AI 导师、代码生成、图表解释、提示词迭代、来源核验清单",
    role: "问题导演、提示记录员、输出审计员、校园行动翻译员",
    evidence: "完整对话日志、数据版本、人工选择点、逐日预测与一次反例修订"
  },
  purple: {
    eyebrow: "PURPLE TEAM · 方法交换后再跑一次",
    title: "让透明算法与 AI 工作流互相借一件工具",
    tools: "A 队借出一个基线，B 队借出一个效率工具，共用同一盲测评分器",
    role: "方法翻译员、复现实验员、证据策展人、公共发布者",
    evidence: "交换前后分数、变化原因、30 秒费曼解释与校园部署卡"
  }
};

const routeTabs = [...document.querySelectorAll(".route-tab")];
const routePanel = document.querySelector("#routePanel");
const routeFields = {
  eyebrow: document.querySelector("#routeEyebrow"),
  title: document.querySelector("#routeTitle"),
  tools: document.querySelector("#routeTools"),
  role: document.querySelector("#routeRole"),
  evidence: document.querySelector("#routeEvidence")
};
let activeRoute = "red";

function selectRoute(route, focus = false) {
  if (!routeData[route] || !routePanel) return;
  activeRoute = route;
  const content = routeData[route];
  routePanel.dataset.route = route;
  Object.entries(routeFields).forEach(([key, element]) => {
    if (element) element.textContent = content[key];
  });
  routeTabs.forEach((tab) => {
    const selected = tab.dataset.route === route;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
}

routeTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectRoute(tab.dataset.route));
  tab.addEventListener("keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === "ArrowLeft") next = (index - 1 + routeTabs.length) % routeTabs.length;
    if (event.key === "ArrowRight") next = (index + 1) % routeTabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = routeTabs.length - 1;
    selectRoute(routeTabs[next].dataset.route, true);
  });
});
selectRoute(activeRoute);

const timeCapsule = document.querySelector("#timeCapsule");
const freezeForecast = document.querySelector("#freezeForecast");
const revealForecast = document.querySelector("#revealForecast");
const resetCapsule = document.querySelector("#resetCapsule");
const capsuleStatus = document.querySelector("#capsuleStatus");
const scoreReveal = document.querySelector("#scoreReveal");

freezeForecast?.addEventListener("click", () => {
  timeCapsule.dataset.state = "frozen";
  freezeForecast.dataset.state = "success";
  freezeForecast.textContent = "预测已冻结";
  freezeForecast.disabled = true;
  revealForecast.disabled = false;
  capsuleStatus.textContent = `${routeData[activeRoute].eyebrow} 已交卷。请用 30 秒讲出预测画面，再打开实况。`;
  timeCapsule.querySelector(".time-capsule__story").dataset.result = "success";
});

revealForecast?.addEventListener("click", () => {
  timeCapsule.dataset.state = "revealed";
  revealForecast.dataset.state = "success";
  revealForecast.textContent = "示例基线已揭晓";
  revealForecast.disabled = true;
  scoreReveal.hidden = false;
  capsuleStatus.textContent = "预设示例已揭晓。选择一个误差最大的日子，回到数据、规则或提示记录中寻找下一次修订。";
  scoreReveal.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
});

resetCapsule?.addEventListener("click", () => {
  timeCapsule.dataset.state = "ready";
  delete freezeForecast.dataset.state;
  delete revealForecast.dataset.state;
  freezeForecast.textContent = "冻结第 31 天预测";
  freezeForecast.disabled = false;
  revealForecast.textContent = "揭晓示例基线榜";
  revealForecast.disabled = true;
  scoreReveal.hidden = true;
  capsuleStatus.textContent = "时间胶囊等待团队提交预测与理由。";
  delete timeCapsule.querySelector(".time-capsule__story").dataset.result;
});

const relaySteps = [...document.querySelectorAll(".relay-step")];
const relayResult = document.querySelector("#relayResult");

function renderRelay() {
  const selected = relaySteps.map((step) => step.querySelector(".relay-option[aria-pressed='true']"));
  const completed = selected.filter(Boolean).length;
  const score = selected.filter((button) => button?.dataset.fit === "true").length;
  if (completed < relaySteps.length) {
    relayResult.innerHTML = `<span class="relay__score">${score} / 4</span><p>已经完成 ${completed} 站。继续把观测、预测、风险与行动连起来。</p>`;
    return;
  }
  const message = score === 4
    ? "14:00 前复核雷达、风速和积水点；比较多模型更新时间；收纳凉岛遮阳面；调整东门放学路线；下一次更新写在消息末尾。"
    : "这条消息已经形成骨架。再检查模型分歧、具体地点、重点人群、责任人与更新时间，让行动更贴合校园。";
  relayResult.innerHTML = `<span class="relay__score">${score} / 4</span><p>${message}</p>`;
}

relaySteps.forEach((step) => {
  step.querySelectorAll(".relay-option").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      step.querySelectorAll(".relay-option").forEach((option) => {
        option.setAttribute("aria-pressed", String(option === button));
        delete option.dataset.result;
      });
      button.dataset.result = button.dataset.fit === "true" ? "fit" : "revise";
      renderRelay();
    });
  });
});

document.querySelector("#resetRelay")?.addEventListener("click", () => {
  document.querySelectorAll(".relay-option").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    delete button.dataset.result;
  });
  renderRelay();
});
renderRelay();

const checklist = document.querySelector("#teacherChecklist");
const storageKey = "ahalab-cool-island-teacher-checklist-v1";
let savedChecks = {};
try { savedChecks = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { savedChecks = {}; }

checklist?.querySelectorAll("input[type='checkbox']").forEach((input) => {
  input.checked = Boolean(savedChecks[input.value]);
  input.addEventListener("change", () => {
    savedChecks[input.value] = input.checked;
    localStorage.setItem(storageKey, JSON.stringify(savedChecks));
  });
});

document.querySelector("#printPlan")?.addEventListener("click", () => window.print());

let printOpenState = [];
window.addEventListener("beforeprint", () => {
  printOpenState = lessonSections.map((lesson) => lesson.open);
  lessonSections.forEach((lesson) => { lesson.open = true; });
});
window.addEventListener("afterprint", () => {
  lessonSections.forEach((lesson, index) => { lesson.open = printOpenState[index]; });
});
