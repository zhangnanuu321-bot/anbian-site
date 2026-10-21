import { analyzePhoto, buildAdvice } from "./vision-engine.js";
import { SHANGLUO_REGION } from "./region-data.js";
import {
  buildDailyBrief,
  formatBestWindow,
  recommendBait,
  windLevel
} from "./weather-advisor.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const TAU = Math.PI * 2;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const elements = {
  intro: $("#introSection"),
  processing: $("#processingSection"),
  results: $("#resultsSection"),
  processingImage: $("#processingImage"),
  resultImage: $("#resultImage"),
  overlay: $("#overlayCanvas"),
  photoStage: $("#photoStage"),
  progressBar: $("#progressBar"),
  photoInput: $("#photoInput"),
  albumInput: $("#albumInput"),
  weatherTemp: $("#weatherTemp"),
  weatherCondition: $("#weatherCondition"),
  weatherUpdated: $("#weatherUpdated"),
  weatherSymbol: $("#weatherSymbol"),
  weatherWind: $("#weatherWind"),
  weatherHumidity: $("#weatherHumidity"),
  weatherPressure: $("#weatherPressure"),
  weatherRain: $("#weatherRain"),
  weatherSource: $("#weatherSource"),
  weatherLiveDot: $("#weatherLiveDot"),
  weatherRefreshButton: $("#weatherRefreshButton"),
  dailyScore: $("#dailyScore"),
  dailyScoreRing: $("#dailyScoreRing"),
  dailyHeadline: $("#dailyHeadline"),
  dailyAdvice: $("#dailyAdvice"),
  dailyLevel: $("#dailyLevel"),
  bestWindow: $("#bestWindow"),
  briefFishList: $("#briefFishList"),
  leadStructure: $("#leadStructure"),
  sceneDescription: $("#sceneDescription"),
  confidenceValue: $("#confidenceValue"),
  bestSpotTitle: $("#bestSpotTitle"),
  bestSpotType: $("#bestSpotType"),
  bestScore: $("#bestScore"),
  bestReasons: $("#bestReasons"),
  bestApproach: $("#bestApproach"),
  spotSwitcher: $("#spotSwitcher"),
  sceneTitle: $("#sceneTitle"),
  sceneChips: $("#sceneChips"),
  sceneWeatherAdvice: $("#sceneWeatherAdvice"),
  structureLegend: $("#structureLegend"),
  fishList: $("#fishList"),
  seasonTag: $("#seasonTag"),
  adjustSummary: $("#adjustSummary"),
  seasonSelect: $("#seasonSelect"),
  timeSelect: $("#timeSelect"),
  waterSelect: $("#waterSelect"),
  flowSelect: $("#flowSelect"),
  toast: $("#toast"),
  aboutDialog: $("#aboutDialog"),
  liveDialog: $("#liveDialog"),
  liveVideo: $("#liveVideo"),
  liveOverlay: $("#liveOverlay"),
  liveStatus: $("#liveStatus"),
  liveStructureLegend: $("#liveStructureLegend")
};

const state = {
  weather: null,
  brief: null,
  photoUrl: "",
  analysis: null,
  selectedSpot: 0,
  busy: false,
  liveStream: null,
  liveTimer: null,
  facingMode: "environment",
  lastLiveAnalysis: null
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("visible"), 2800);
}

function setView(view) {
  elements.intro.classList.toggle("hidden", view !== "intro");
  elements.processing.classList.toggle("hidden", view !== "processing");
  elements.results.classList.toggle("hidden", view !== "results");
}

function getConditions() {
  return {
    season: elements.seasonSelect.value,
    time: elements.timeSelect.value,
    water: elements.waterSelect.value,
    flow: elements.flowSelect.value,
    temperature: state.brief?.context.temperature
  };
}

function weatherTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function weatherFallbackContext() {
  return {
    temperature: null,
    temperatureBand: "cool",
    time: "evening",
    nextRain: 0,
    pressureTrend: 0,
    cloud: 50,
    wind: 0
  };
}

function buildDirectWeatherUrl(latitude, longitude, elevation) {
  const upstream = new URL("https://api.open-meteo.com/v1/forecast");
  upstream.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    elevation: String(elevation),
    timezone: "Asia/Shanghai",
    forecast_days: "3",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "pressure_msl",
      "surface_pressure",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "visibility"
    ].join(","),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "pressure_msl",
      "surface_pressure",
      "wind_speed_10m",
      "wind_direction_10m",
      "visibility"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "sunrise",
      "sunset"
    ].join(",")
  }).toString();
  return upstream;
}

async function requestWeather(latitude, longitude, elevation) {
  const isLocalProxy =
    (location.hostname === "localhost" || location.hostname === "127.0.0.1") &&
    !new URLSearchParams(location.search).has("static");
  if (isLocalProxy) {
    try {
      const response = await fetch(
        `/api/weather?lat=${latitude}&lon=${longitude}&elevation=${elevation}`,
        { headers: { Accept: "application/json" } }
      );
      if (response.ok) return response.json();
    } catch {
      // Static and offline hosts fall back to Open-Meteo's CORS-enabled endpoint.
    }
  }

  const response = await fetch(buildDirectWeatherUrl(latitude, longitude, elevation), {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
  const weather = await response.json();
  return {
    location: {
      name: "陕西 · 商洛",
      latitude,
      longitude,
      elevation,
      timezone: weather.timezone
    },
    source: {
      name: "Open-Meteo",
      url: "https://open-meteo.com/",
      modelNote: "数值预报，非现场气象站实测；山地区域请留意局地变化"
    },
    fetchedAt: new Date().toISOString(),
    current: weather.current,
    hourly: weather.hourly,
    daily: weather.daily,
    cache: "direct"
  };
}

async function loadWeather({ quiet = false } = {}) {
  elements.weatherRefreshButton.disabled = true;
  elements.weatherLiveDot.className = "pending";
  if (!quiet) elements.weatherSource.textContent = "Open-Meteo · 连接中";

  const { latitude, longitude, elevation } = SHANGLUO_REGION.center;
  try {
    const weather = await requestWeather(latitude, longitude, elevation);
    state.weather = weather;
    state.brief = buildDailyBrief(weather, new Date());
    renderWeather();
    if (state.analysis) refreshAdvice();
  } catch (error) {
    elements.weatherLiveDot.className = "offline";
    elements.weatherCondition.textContent = "天气暂不可用";
    elements.weatherUpdated.textContent = "使用本地鱼种逻辑继续识别";
    elements.weatherSource.textContent = "Open-Meteo · 离线";
    elements.dailyLevel.textContent = "等待天气";
    elements.dailyHeadline.textContent = "先看水岸，再看天气";
    elements.dailyAdvice.textContent = "天气恢复后会自动替换为商洛实时判断。";
    elements.bestWindow.textContent = "--";
    elements.briefFishList.replaceChildren();
    if (!quiet) showToast(error.message || "天气加载失败");
  } finally {
    elements.weatherRefreshButton.disabled = false;
  }
}

function renderWeather() {
  const { weather, brief } = state;
  if (!weather || !brief) return;
  const current = weather.current;
  const context = brief.context;
  elements.weatherLiveDot.className = "online";
  elements.weatherTemp.textContent = `${Math.round(current.temperature_2m)}°`;
  elements.weatherCondition.textContent = context.condition;
  elements.weatherUpdated.textContent = `商洛市中心 · ${weatherTime(weather.fetchedAt)} 更新`;
  elements.weatherWind.textContent = `${context.windLevel} 级`;
  elements.weatherHumidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  elements.weatherPressure.textContent = `${Math.round(current.pressure_msl)}`;
  elements.weatherRain.textContent = `${Math.round(context.nextRain)}%`;
  elements.weatherSource.textContent = `${weather.source.name}${weather.cache === "stale" ? " · 缓存" : ""}`;
  elements.weatherSymbol.dataset.code = String(current.weather_code);

  elements.dailyScore.textContent = String(context.score);
  elements.dailyScoreRing.style.background =
    `conic-gradient(#e5c88e ${context.score * 3.6}deg, rgba(255,255,255,.12) ${context.score * 3.6}deg)`;
  elements.dailyHeadline.textContent = `${context.level} · 优先${brief.fish[0]?.name || "观察岸边"}`;
  elements.dailyAdvice.textContent = `${context.recommendation}。${context.pressureLabel}，未来 3 小时降水 ${Math.round(context.nextRain)}%。`;
  elements.dailyLevel.textContent = `综合 ${context.score}`;
  elements.bestWindow.textContent = formatBestWindow(context, current.time);

  const fishCards = brief.fish.map((fish, index) => {
    const priority = index === 0 ? "首选" : index === 1 ? "次选" : "备选";
    const card = document.createElement("div");
    card.className = "brief-fish-item";
    card.innerHTML = `
      <span>0${index + 1}</span>
      <div><strong>${fish.name}</strong><small>${fish.baitPlan.mix}</small></div>
      <b>${priority}</b>
    `;
    return card;
  });
  elements.briefFishList.replaceChildren(...fishCards);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("这张图片无法读取"));
    image.src = source;
  });
}

function makeAnalysisImage(image) {
  const maxEdge = 900;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function setProgress(step) {
  const percentages = [16, 43, 70, 94];
  elements.progressBar.style.width = `${percentages[step]}%`;
  $$(".processing-steps span").forEach((item, index) => {
    item.classList.toggle("active", index === step);
  });
}

async function runAnalysis(image, photoUrl) {
  if (state.busy) return;
  state.busy = true;
  stopLiveCamera(false);
  state.photoUrl = photoUrl;
  state.selectedSpot = 0;
  elements.processingImage.src = photoUrl;
  setView("processing");
  setProgress(0);
  window.scrollTo({ top: 0, behavior: "smooth" });

  try {
    await sleep(220);
    setProgress(1);
    await sleep(200);
    const analysis = analyzePhoto(makeAnalysisImage(image), getConditions(), new Date());
    await sleep(320);
    setProgress(2);
    await sleep(190);
    setProgress(3);
    await sleep(220);

    state.analysis = analysis;
    elements.resultImage.src = photoUrl;
    renderResults();
    setView("results");
    requestAnimationFrame(() => {
      drawPhotoOverlay();
      setTimeout(drawPhotoOverlay, 120);
      elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (analysis.fallback) showToast("画面结构偏弱，已给出保守候选");
  } catch (error) {
    console.error(error);
    showToast(error.message || "照片分析失败");
    resetToIntro();
  } finally {
    state.busy = false;
  }
}

async function analyzeFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("请选择一张图片");
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (state.photoUrl.startsWith("blob:")) URL.revokeObjectURL(state.photoUrl);
    await runAnalysis(image, url);
  } catch (error) {
    URL.revokeObjectURL(url);
    showToast(error.message);
  }
}

function drawTree(context, x, y, height, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y - height);
  context.lineTo(x - height * 0.38, y);
  context.lineTo(x + height * 0.38, y);
  context.closePath();
  context.fill();
}

function makeDemoPhoto() {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 820;
  const context = canvas.getContext("2d");
  const sky = context.createLinearGradient(0, 0, 0, 370);
  sky.addColorStop(0, "#d8d0b0");
  sky.addColorStop(1, "#93b19b");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, 430);

  const sun = context.createRadialGradient(880, 110, 5, 880, 110, 155);
  sun.addColorStop(0, "rgba(255, 227, 163, .85)");
  sun.addColorStop(1, "rgba(255, 227, 163, 0)");
  context.fillStyle = sun;
  context.fillRect(700, 0, 400, 350);

  context.fillStyle = "#2d5844";
  context.beginPath();
  context.moveTo(0, 285);
  context.bezierCurveTo(220, 220, 310, 270, 470, 236);
  context.bezierCurveTo(650, 200, 740, 265, 960, 220);
  context.bezierCurveTo(1080, 198, 1140, 226, 1200, 205);
  context.lineTo(1200, 420);
  context.lineTo(0, 430);
  context.closePath();
  context.fill();

  [
    [90, 292, 80],
    [150, 290, 110],
    [245, 280, 67],
    [447, 265, 92],
    [490, 270, 70],
    [800, 260, 87],
    [1000, 252, 98],
    [1060, 250, 70],
    [1135, 242, 92]
  ].forEach(([x, y, height]) => drawTree(context, x, y, height, "#3f6b50"));

  const water = context.createLinearGradient(0, 350, 0, 820);
  water.addColorStop(0, "#5c8078");
  water.addColorStop(0.5, "#385f59");
  water.addColorStop(1, "#193f3b");
  context.fillStyle = water;
  context.beginPath();
  context.moveTo(0, 385);
  context.bezierCurveTo(300, 350, 680, 395, 1200, 342);
  context.lineTo(1200, 820);
  context.lineTo(0, 820);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(229, 232, 203, .3)";
  context.lineWidth = 4;
  for (let index = 0; index < 25; index += 1) {
    const y = 410 + index * 16;
    const start = 80 + ((index * 127) % 460);
    context.beginPath();
    context.moveTo(start, y);
    context.lineTo(start + 120 + (index % 4) * 45, y);
    context.stroke();
  }

  const bank = context.createLinearGradient(0, 540, 520, 820);
  bank.addColorStop(0, "#8e7448");
  bank.addColorStop(1, "#4c4028");
  context.fillStyle = bank;
  context.beginPath();
  context.moveTo(0, 820);
  context.lineTo(0, 602);
  context.bezierCurveTo(235, 575, 380, 645, 550, 711);
  context.bezierCurveTo(700, 770, 830, 805, 980, 820);
  context.closePath();
  context.fill();

  context.strokeStyle = "#233f30";
  context.lineWidth = 13;
  context.lineCap = "round";
  [
    [86, 640, 45, 350],
    [125, 627, 15, 385],
    [167, 645, -25, 365],
    [256, 675, 40, 330],
    [299, 684, -20, 300]
  ].forEach(([x, y, dx, height]) => {
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + dx * 0.2, y - height * 0.55, x + dx, y - height);
    context.stroke();
  });
  return canvas.toDataURL("image/jpeg", 0.9);
}

async function runDemo() {
  try {
    const source = makeDemoPhoto();
    await runAnalysis(await loadImage(source), source);
  } catch (error) {
    console.error(error);
    showToast("示例载入失败，请直接拍照");
  }
}

function structureTone(number) {
  return {
    1: { fill: "#da8147", ink: "#fff9eb" },
    2: { fill: "#5f9991", ink: "#fff9eb" },
    3: { fill: "#ddc487", ink: "#173f35" },
    4: { fill: "#93ad76", ink: "#173f35" }
  }[number] || { fill: "#e2c98f", ink: "#173f35" };
}

function fitContain(width, height, imageWidth, imageHeight) {
  const imageRatio = imageWidth / imageHeight;
  const stageRatio = width / height;
  if (imageRatio > stageRatio) {
    const contentHeight = width / imageRatio;
    return { width, height: contentHeight, x: 0, y: (height - contentHeight) / 2 };
  }
  const contentWidth = height * imageRatio;
  return { width: contentWidth, height, x: (width - contentWidth) / 2, y: 0 };
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawAnnotationLayer(canvas, analysis, geometry, suffix = "") {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height || !analysis) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const occupiedLabels = [];
  const radius = width < 500 ? 15 : 17;
  const markers = analysis.features.structures.map((structure) => {
    const x = geometry.x + structure.x * geometry.width;
    const y = geometry.y + structure.y * geometry.height;
    const tone = structureTone(structure.number);
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fillStyle = tone.fill;
    context.shadowColor = "rgba(11,38,31,.28)";
    context.shadowBlur = 12;
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = tone.ink;
    context.font = `700 ${width < 500 ? 14 : 15}px Georgia, serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(structure.number), x, y + 0.5);
    return { structure, x, y, tone };
  });

  markers.forEach(({ structure, x, y }) => {
    const label = `${structure.number} ${structure.label}`;
    context.font = `650 ${width < 500 ? 10 : 11}px "PingFang SC", sans-serif`;
    const boxWidth = context.measureText(label).width + 17;
    const boxHeight = width < 500 ? 24 : 27;
    const positions = [
      { left: x + radius + 7, top: y - boxHeight / 2 },
      { left: x - radius - boxWidth - 7, top: y - boxHeight / 2 },
      { left: x - boxWidth / 2, top: y - radius - boxHeight - 7 },
      { left: x - boxWidth / 2, top: y + radius + 7 }
    ];
    let placement = null;
    for (const candidate of positions) {
      const box = {
        left: clamp(
          candidate.left,
          geometry.x + 5,
          geometry.x + geometry.width - boxWidth - 5
        ),
        top: clamp(
          candidate.top,
          geometry.y + 4,
          geometry.y + geometry.height - boxHeight - 4
        ),
        width: boxWidth,
        height: boxHeight
      };
      const overlaps = occupiedLabels.some(
        (item) =>
          box.left < item.left + item.width + 3 &&
          box.left + box.width + 3 > item.left &&
          box.top < item.top + item.height + 3 &&
          box.top + box.height + 3 > item.top
      ) || markers.some(
        (marker) =>
          Math.abs(marker.x - (box.left + box.width / 2)) < box.width / 2 + radius - 2 &&
          Math.abs(marker.y - (box.top + box.height / 2)) < box.height / 2 + radius - 2
      );
      if (!overlaps) {
        placement = box;
        break;
      }
    }
    placement ||= {
      left: clamp(x + radius + 7, geometry.x + 5, geometry.x + geometry.width - boxWidth - 5),
      top: clamp(
        y + radius + 7 + structure.number * (boxHeight + 3),
        geometry.y + 4,
        geometry.y + geometry.height - boxHeight - 4
      ),
      width: boxWidth,
      height: boxHeight
    };
    occupiedLabels.push(placement);
    const { left, top } = placement;
    context.fillStyle = "rgba(14,46,39,.84)";
    roundRect(context, left, top, boxWidth, boxHeight, 8);
    context.fill();
    context.fillStyle = "#fff9e8";
    context.textAlign = "center";
    context.fillText(label, left + boxWidth / 2, top + boxHeight / 2 + 0.5);
  });

  if (suffix === "live") {
    context.fillStyle = "rgba(12,39,33,.62)";
    roundRect(context, 12, 12, 74, 25, 8);
    context.fill();
    context.fillStyle = "#e8e4bd";
    context.font = '600 10px "PingFang SC", sans-serif';
    context.textAlign = "center";
    context.fillText("结构推断", 49, 29);
  }
}

function drawPhotoOverlay() {
  const image = elements.resultImage;
  const canvas = elements.overlay;
  if (!state.analysis || !image.naturalWidth) return;
  const geometry = fitContain(
    elements.photoStage.clientWidth,
    elements.photoStage.clientHeight,
    image.naturalWidth,
    image.naturalHeight
  );
  drawAnnotationLayer(canvas, state.analysis, geometry);
}

function renderStructureLegend(target, structures) {
  const items = structures.map((structure) => {
    const item = document.createElement("div");
    item.className = "structure-item";
    const tone = structureTone(structure.number);
    item.innerHTML = `
      <i style="background:${tone.fill};color:${tone.ink}">${structure.number}</i>
      <span><b>${structure.label}</b><small>${structure.surface === "visible" ? "水面可见" : "水下推断"} · ${structure.confidence}%</small></span>
    `;
    return item;
  });
  target.replaceChildren(...items);
}

function renderResults() {
  const analysis = state.analysis;
  if (!analysis) return;
  const scene = analysis.features.scene;
  const structures = analysis.features.structures;
  const lead = [...structures].sort((a, b) => b.confidence - a.confidence)[0];
  elements.leadStructure.textContent = `${lead.number} ${lead.label}`;
  elements.sceneDescription.textContent =
    `${scene.bank} · ${scene.structure > 0.14 ? "结构可见" : "结构偏弱"} · ${scene.light}`;
  elements.confidenceValue.textContent = `${scene.confidence}%`;
  elements.sceneTitle.textContent = scene.title;
  elements.sceneDescription.title = scene.description;

  elements.sceneChips.replaceChildren(
    ...scene.chips.map((label) => {
      const chip = document.createElement("span");
      chip.textContent = label;
      return chip;
    })
  );

  const context = state.brief?.context;
  elements.sceneWeatherAdvice.textContent = context
    ? `${context.pressureLabel} · 风 ${context.windLevel} 级，${context.recommendation}`
    : "天气暂不可用，仍可按岸线结构选位";
  elements.seasonTag.textContent = context
    ? `商洛 · ${analysis.conditions.seasonLabel} ${analysis.conditions.timeLabel}`
    : `商洛 · ${analysis.conditions.seasonLabel}`;
  updateAdjustSummary(scene);

  renderStructureLegend(elements.structureLegend, structures);
  renderSelectedSpot(state.selectedSpot);
  renderFish(analysis.species);
  requestAnimationFrame(() => {
    drawPhotoOverlay();
    setTimeout(drawPhotoOverlay, 100);
  });
}

function updateAdjustSummary(scene) {
  const labels = {
    season: { spring: "春季", summer: "夏季", autumn: "秋季", winter: "冬季" },
    time: { morning: "清晨", noon: "白天", evening: "傍晚", night: "夜间" },
    water: { clear: "偏清", normal: "正常", muddy: "偏浑" },
    flow: { still: "静水", slow: "缓流", fast: "急流" }
  };
  const selected = [
    ["season", elements.seasonSelect.value],
    ["time", elements.timeSelect.value],
    ["water", elements.waterSelect.value],
    ["flow", elements.flowSelect.value]
  ].filter(([, value]) => value !== "auto");
  elements.adjustSummary.textContent = selected.length
    ? `手动：${selected.map(([type, value]) => labels[type][value]).join(" · ")}`
    : `自动：${scene.waterTone === "muddy" ? "偏浑" : scene.waterTone === "clear" ? "偏清" : "正常"} · ${scene.flow === "slow" ? "缓流" : "静水"}`;
}

function renderSelectedSpot(index) {
  const analysis = state.analysis;
  const spot = analysis?.spots[index];
  if (!spot) return;
  state.selectedSpot = index;
  elements.bestSpotTitle.textContent = spot.label;
  elements.bestSpotType.textContent = spot.type;
  elements.bestScore.textContent = String(spot.score);
  elements.bestApproach.textContent = spot.approach;
  const reasons = spot.reasons.map((reason) => {
    const item = document.createElement("span");
    item.innerHTML = `<small>${reason.label}</small><b>${reason.value}</b>`;
    return item;
  });
  elements.bestReasons.replaceChildren(...reasons);

  const alternatives = analysis.spots
    .filter((_, spotIndex) => spotIndex !== index)
    .map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<span>备选</span><strong>${option.label}</strong><b>${option.score}</b>`;
      button.addEventListener("click", () => {
        renderSelectedSpot(option.id);
        drawPhotoOverlay();
      });
      return button;
    });
  elements.spotSwitcher.replaceChildren(...alternatives);
}

function renderFish(species) {
  const context = state.brief?.context || weatherFallbackContext();
  const cards = species.map((fish, index) => {
    const bait = recommendBait(fish, context);
    const priority = index === 0 ? "重点" : index === 1 ? "次选" : index === 2 ? "可试" : "备选";
    const card = document.createElement("article");
    card.className = "fish-item";
    card.innerHTML = `
      <span class="fish-index">0${index + 1}</span>
      <div class="fish-body">
        <div class="fish-title"><strong>${fish.name}</strong><small>${fish.latin}</small><b>${priority}</b></div>
        <p>${fish.habit}</p>
        <div class="bait-plan">
          <span class="taste primary">${bait.primary}</span>
          <span class="taste">${bait.secondary}</span>
          <strong>${bait.mix}</strong>
          <small>${bait.reason}</small>
        </div>
      </div>
    `;
    return card;
  });
  elements.fishList.replaceChildren(...cards);
  if (state.brief?.context) elements.sceneWeatherAdvice.dataset.temperature = String(state.brief.context.temperature);
}

function refreshAdvice() {
  if (!state.analysis?.features) return;
  state.analysis = {
    ...buildAdvice(state.analysis.features, getConditions(), new Date()),
    features: state.analysis.features
  };
  state.selectedSpot = 0;
  renderResults();
}

async function startLiveCamera() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showToast("实时相机需要 HTTPS 或 localhost，当前请使用“拍照”");
    elements.photoInput.click();
    return;
  }
  elements.liveDialog.showModal();
  await openCameraStream();
}

async function openCameraStream() {
  stopLiveTracks();
  elements.liveStatus.textContent = "正在启动相机";
  try {
    state.liveStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    elements.liveVideo.srcObject = state.liveStream;
    await elements.liveVideo.play();
    elements.liveStatus.textContent = "正在寻找岸线";
    state.liveTimer = setInterval(analyzeLiveFrame, 1100);
    await analyzeLiveFrame();
  } catch (error) {
    console.error(error);
    closeLiveCamera();
    showToast("无法打开相机，请检查权限或改用拍照");
  }
}

function analyzeLiveFrame() {
  const video = elements.liveVideo;
  if (!video.videoWidth || !video.videoHeight) return null;
  const width = 560;
  const height = Math.round((video.videoHeight / video.videoWidth) * width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0, width, height);
  const freshAnalysis = analyzePhoto(
    context.getImageData(0, 0, width, height),
    getConditions(),
    new Date()
  );
  const analysis = smoothLiveAnalysis(freshAnalysis);
  state.lastLiveAnalysis = analysis;
  const geometry = fitContain(
    elements.liveOverlay.clientWidth,
    elements.liveOverlay.clientHeight,
    video.videoWidth,
    video.videoHeight
  );
  drawAnnotationLayer(elements.liveOverlay, analysis, geometry, "live");
  elements.liveStatus.textContent = `${analysis.features.scene.title} · 实时`;
  renderStructureLegend(elements.liveStructureLegend, analysis.features.structures);
  return analysis;
}

function smoothLiveAnalysis(fresh) {
  const previous = state.lastLiveAnalysis;
  if (!previous || fresh.fallback) return fresh;
  const blend = 0.68;
  const smoothPoint = (next, last) => ({
    ...next,
    x: next.x * (1 - blend) + last.x * blend,
    y: next.y * (1 - blend) + last.y * blend,
    confidence: Math.round(next.confidence * (1 - blend) + last.confidence * blend)
  });
  return {
    ...fresh,
    features: {
      ...fresh.features,
      spots: fresh.features.spots.map((spot, index) =>
        previous.features.spots[index]
          ? smoothPoint(spot, previous.features.spots[index])
          : spot
      ),
      structures: fresh.features.structures.map((structure, index) =>
        previous.features.structures[index]
          ? smoothPoint(structure, previous.features.structures[index])
          : structure
      )
    }
  };
}

function stopLiveTracks() {
  clearInterval(state.liveTimer);
  state.liveTimer = null;
  if (state.liveStream) {
    state.liveStream.getTracks().forEach((track) => track.stop());
    state.liveStream = null;
  }
  elements.liveVideo.srcObject = null;
}

function stopLiveCamera(close = true) {
  stopLiveTracks();
  state.lastLiveAnalysis = null;
  if (close && elements.liveDialog.open) elements.liveDialog.close();
}

function closeLiveCamera() {
  stopLiveCamera(true);
}

async function captureLiveFrame() {
  const video = elements.liveVideo;
  if (!video.videoWidth) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const source = canvas.toDataURL("image/jpeg", 0.9);
  const image = await loadImage(source);
  stopLiveCamera(true);
  await runAnalysis(image, source);
}

function resetToIntro() {
  state.analysis = null;
  state.selectedSpot = 0;
  elements.photoStage.classList.remove("expanded");
  document.body.style.overflow = "";
  setView("intro");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleOverlayClick(event) {
  if (!state.analysis) return;
  const canvas = elements.overlay;
  const rect = canvas.getBoundingClientRect();
  const image = elements.resultImage;
  const geometry = fitContain(rect.width, rect.height, image.naturalWidth, image.naturalHeight);
  const x = (event.clientX - rect.left - geometry.x) / geometry.width;
  const y = (event.clientY - rect.top - geometry.y) / geometry.height;
  let closest = null;
  let distance = Infinity;
  state.analysis.spots.forEach((spot) => {
    const current = Math.hypot(spot.x - x, spot.y - y);
    if (current < distance) {
      closest = spot;
      distance = current;
    }
  });
  if (closest && distance < 0.1) {
    renderSelectedSpot(closest.id);
    drawPhotoOverlay();
  }
}

function setupEvents() {
  $("#cameraButton").addEventListener("click", () => elements.photoInput.click());
  $("#albumButton").addEventListener("click", () => elements.albumInput.click());
  $("#retakeButton").addEventListener("click", () => elements.photoInput.click());
  $("#anotherButton").addEventListener("click", resetToIntro);
  $("#demoButton").addEventListener("click", runDemo);
  $("#startLiveButton").addEventListener("click", startLiveCamera);
  $("#closeLiveButton").addEventListener("click", closeLiveCamera);
  $("#liveCaptureButton").addEventListener("click", captureLiveFrame);
  $("#flipCameraButton").addEventListener("click", async () => {
    state.facingMode = state.facingMode === "environment" ? "user" : "environment";
    await openCameraStream();
  });

  elements.photoInput.addEventListener("change", async () => {
    await analyzeFile(elements.photoInput.files?.[0]);
    elements.photoInput.value = "";
  });
  elements.albumInput.addEventListener("change", async () => {
    await analyzeFile(elements.albumInput.files?.[0]);
    elements.albumInput.value = "";
  });

  elements.resultImage.addEventListener("load", () => {
    const ratio = elements.resultImage.naturalWidth / elements.resultImage.naturalHeight;
    elements.photoStage.style.aspectRatio = String(ratio || 1.33);
    requestAnimationFrame(() => {
      drawPhotoOverlay();
      setTimeout(drawPhotoOverlay, 100);
    });
  });
  elements.overlay.addEventListener("click", handleOverlayClick);

  $("#expandPhotoButton").addEventListener("click", () => {
    const expanded = elements.photoStage.classList.toggle("expanded");
    document.body.style.overflow = expanded ? "hidden" : "";
    requestAnimationFrame(drawPhotoOverlay);
  });
  elements.photoStage.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.photoStage.classList.contains("expanded")) {
      elements.photoStage.classList.remove("expanded");
      document.body.style.overflow = "";
      drawPhotoOverlay();
    }
  });

  [elements.seasonSelect, elements.timeSelect, elements.waterSelect, elements.flowSelect].forEach(
    (select) => select.addEventListener("change", refreshAdvice)
  );

  elements.liveDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeLiveCamera();
  });
  elements.liveDialog.addEventListener("close", stopLiveTracks);
  elements.weatherRefreshButton.addEventListener("click", () => loadWeather());

  const openAbout = () => elements.aboutDialog.showModal();
  $("#aboutButton").addEventListener("click", openAbout);
  $("#footerAboutButton").addEventListener("click", openAbout);
  $("#closeAboutButton").addEventListener("click", () => elements.aboutDialog.close());
  elements.aboutDialog.addEventListener("click", (event) => {
    if (event.target === elements.aboutDialog) elements.aboutDialog.close();
  });

  window.addEventListener("resize", () => {
    drawPhotoOverlay();
    if (elements.liveDialog.open) analyzeLiveFrame();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadWeather({ quiet: true });
  });
  setInterval(() => loadWeather({ quiet: true }), 10 * 60 * 1000);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

setupEvents();
loadWeather();
registerServiceWorker();
