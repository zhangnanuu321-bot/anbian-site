import { SHANGLUO_FISH } from "./region-data.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const WEATHER_LABELS = {
  0: "晴",
  1: "大部晴朗",
  2: "多云",
  3: "阴",
  45: "有雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "强毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "中等阵雨",
  82: "强阵雨",
  95: "雷阵雨",
  96: "雷雨伴冰雹",
  99: "强雷雨伴冰雹"
};

export function weatherLabel(code) {
  return WEATHER_LABELS[code] || "天气变化";
}

export function windLevel(speedKmh) {
  const limits = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  const level = limits.findIndex((limit) => speedKmh < limit);
  return level === -1 ? 12 : level;
}

function seasonAt(date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function timeAt(hour) {
  if (hour >= 5 && hour < 8) return "morning";
  if (hour >= 8 && hour < 16) return "noon";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

function temperatureBand(temperature) {
  if (temperature < 10) return "cold";
  if (temperature < 17) return "cool";
  if (temperature < 25) return "mild";
  return "warm";
}

function parseLocalHour(time) {
  return Number(String(time || "").slice(11, 13)) || 0;
}

function nearestHourIndex(times, currentTime) {
  if (!times?.length) return 0;
  const currentHour = String(currentTime || "").slice(0, 13);
  const found = times.findIndex((time) => String(time).slice(0, 13) === currentHour);
  return found >= 0 ? found : Math.max(0, times.length - 24);
}

function hourlyWindow(hourly, currentTime) {
  if (!hourly?.time?.length) return null;
  const start = nearestHourIndex(hourly.time, currentTime);
  let best = null;

  for (let index = start; index < Math.min(start + 21, hourly.time.length - 2); index += 1) {
    const points = [index, index + 1, index + 2];
    const avgTemperature =
      points.reduce((sum, point) => sum + (hourly.temperature_2m?.[point] ?? 15), 0) / 3;
    const rainChance =
      points.reduce((sum, point) => sum + (hourly.precipitation_probability?.[point] ?? 0), 0) / 3;
    const rain =
      points.reduce((sum, point) => sum + (hourly.precipitation?.[point] ?? 0), 0) / 3;
    const wind =
      points.reduce((sum, point) => sum + (hourly.wind_speed_10m?.[point] ?? 0), 0) / 3;
    const hour = parseLocalHour(hourly.time[index]);
    const lightWindow = (hour >= 5 && hour <= 10) || (hour >= 15 && hour <= 19);
    let score = 55;
    score += 10 - Math.abs(avgTemperature - 17) * 0.9;
    score += rainChance < 35 ? 7 : rainChance < 60 ? 1 : -8;
    score += rain > 0.2 && rain < 2.5 ? 4 : rain >= 5 ? -10 : 0;
    score += wind <= 14 ? 6 : wind <= 24 ? 0 : -9;
    score += lightWindow ? 7 : -3;
    if (!best || score > best.score) {
      best = {
        score: Math.round(clamp(score, 30, 92)),
        start: hourly.time[index],
        end: hourly.time[index + 2],
        temperature: Math.round(avgTemperature),
        rainChance: Math.round(rainChance),
        wind: Math.round(wind)
      };
    }
  }
  return best;
}

function formatWindow(time) {
  const day = Number(time.slice(8, 10));
  const hour = time.slice(11, 16);
  return { day, hour };
}

export function buildWeatherContext(weather, now = new Date()) {
  const current = weather?.current || {};
  const hourly = weather?.hourly || {};
  const index = nearestHourIndex(hourly.time, current.time);
  const previous = Math.max(0, index - 3);
  const pressure = current.pressure_msl ?? hourly.pressure_msl?.[index] ?? 1013;
  const pressure3hAgo = hourly.pressure_msl?.[previous] ?? pressure;
  const pressureTrend = pressure - pressure3hAgo;
  const nextRain = [0, 1, 2].reduce(
    (sum, offset) => sum + (hourly.precipitation_probability?.[index + offset] ?? 0),
    0
  ) / 3;
  const temperature = current.temperature_2m ?? 15;
  const wind = current.wind_speed_10m ?? 0;
  const cloud = current.cloud_cover ?? 50;
  const rain = current.precipitation ?? 0;
  const hour = now.getHours();
  const time = timeAt(hour);
  const season = seasonAt(now);
  const window = hourlyWindow(hourly, current.time);

  let score = 53;
  score += 9 - Math.abs(temperature - 17) * 0.8;
  score += nextRain < 30 ? 7 : nextRain < 60 ? 2 : -8;
  score += rain > 0.2 && rain < 2.5 ? 4 : rain >= 5 ? -10 : 0;
  score += wind <= 14 ? 7 : wind <= 24 ? 0 : -10;
  score += pressureTrend >= -1.2 && pressureTrend <= 1.8 ? 7 : pressureTrend < -2.8 ? -3 : 1;
  score += cloud >= 25 && cloud <= 80 ? 5 : 0;
  score += time === "morning" || time === "evening" ? 6 : time === "noon" ? 0 : -2;

  const fishingScore = Math.round(clamp(score, 32, 93));
  const level =
    fishingScore >= 80
      ? "优先出钓"
      : fishingScore >= 67
        ? "适合观察"
        : fishingScore >= 52
          ? "可短时试钓"
          : "暂缓出钓";

  const pressureLabel =
    pressureTrend < -2
      ? "气压下降"
      : pressureTrend > 2
        ? "气压回升"
        : "气压平稳";
  const recommendation =
    wind > 25
      ? "风力偏大，优先背风缓流和稳固岸线"
      : nextRain > 60
        ? "降水概率高，避开涨水口和湿滑陡岸"
        : temperature < 10
          ? "水温偏低，缩短试钓半径，优先深缓交界"
          : time === "evening"
            ? "傍晚优先观察缓坡、坎边与水草外沿"
            : "优先试探缓流交界，再沿岸线逐步搜索";

  return {
    score: fishingScore,
    level,
    recommendation,
    pressureTrend,
    pressureLabel,
    nextRain,
    temperature,
    temperatureBand: temperatureBand(temperature),
    wind,
    windLevel: windLevel(wind),
    cloud,
    season,
    time,
    hour,
    bestWindow: window,
    condition: weatherLabel(current.weather_code),
    fetchedAt: weather.fetchedAt || new Date().toISOString(),
    source: weather.source?.name || "Open-Meteo",
    modelNote: weather.source?.modelNote || "数值预报，非现场气象站实测"
  };
}

export function rankRegionalFish(context) {
  const ranked = SHANGLUO_FISH.map((fish) => {
    let score = fish.seasons[context.season] ?? 60;
    score += fish.times[context.time] ?? 0;
    score += context.nextRain > 55 ? 1 : 3;
    score += context.wind > 25 ? -6 : 2;
    const preferredMid = (fish.tempRange[0] + fish.tempRange[1]) / 2;
    score += Math.max(-8, 6 - Math.abs(context.temperature - preferredMid) * 0.45);
    return { ...fish, rawScore: score };
  }).sort((a, b) => b.rawScore - a.rawScore);
  const top = ranked[0]?.rawScore ?? 0;
  return ranked.slice(0, 3).map((fish, index) => ({
    ...fish,
    match: Math.round(clamp(94 - index * 5 - (top - fish.rawScore) * 0.8, 48, 94))
  }));
}

export function recommendBait(fish, context) {
  const options = fish.baits?.[context.temperatureBand] || ["腥香", "纯香"];
  let primary = options[0];
  let secondary = options[1] || options[0];
  let reason = context.temperatureBand === "cold" ? "低温弱口，提高动物蛋白" : "按当前水温和鱼种偏好";

  if (context.nextRain > 55 || context.pressureTrend < -2.5) {
    if (primary !== "纯腥") {
      secondary = primary;
      primary = "腥香";
    }
    reason = context.pressureTrend < -2.5 ? "气压下降，优先易感知的腥香" : "降水概率偏高，增强味型扩散";
  } else if (context.temperature >= 24 && context.cloud < 35) {
    primary = "纯香";
    secondary = "腥香";
    reason = "升温且光照较强，降低腥味、避免小杂鱼";
  }

  return {
    primary,
    secondary,
    mix: primary === secondary ? `${primary} 100%` : `${primary} 65% · ${secondary} 35%`,
    reason
  };
}

export function buildDailyBrief(weather, now = new Date()) {
  const context = buildWeatherContext(weather, now);
  const fish = rankRegionalFish(context).map((item) => ({
    ...item,
    baitPlan: recommendBait(item, context)
  }));
  return { context, fish };
}

export function formatBestWindow(context, currentTime) {
  const window = context.bestWindow;
  if (!window) return "暂无窗口";
  const currentDay = Number(String(currentTime || "").slice(8, 10));
  const start = formatWindow(window.start);
  const end = formatWindow(window.end);
  const dayLabel =
    start.day === currentDay ? "今天" : start.day === currentDay + 1 ? "明天" : `${start.day} 日`;
  return `${dayLabel} ${start.hour}—${end.hour}`;
}
