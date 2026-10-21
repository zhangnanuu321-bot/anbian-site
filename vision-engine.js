import { SHANGLUO_FISH } from "./region-data.js";

const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;

  if (delta > 0.0001) {
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue = ((hue / 6) * 360 + 360) % 360;
  }

  return {
    hue,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
    luma: 0.2126 * rn + 0.7152 * gn + 0.0722 * bn
  };
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(clamp(ratio) * (sorted.length - 1))];
}

function localWaterScore(stats, rowRatio) {
  if (stats.count === 0) return 0;
  const { r, g, b, luma, saturation, edge } = stats;
  const blueLead = (b - r) / 255;
  const greenLead = (g - r) / 255;
  let colorScore = 0.43 + blueLead * 1.8 + greenLead * 0.62;

  if (luma > 0.78 && saturation < 0.3) colorScore -= 0.35;
  if (luma < 0.07) colorScore += 0.08;
  if (r > g + 14 && r > b + 8) colorScore -= 0.2;

  const smoothness = 1 - clamp(edge / 0.34);
  const lowerFramePrior = clamp((rowRatio - 0.06) / 0.55);
  return clamp(
    clamp(colorScore) * 0.68 +
      smoothness * 0.19 +
      lowerFramePrior * 0.13
  );
}

function buildGrid(data, width, height) {
  const cols = 18;
  const rows = 14;
  const step = Math.max(2, Math.floor(Math.min(width, height) / 180));
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor((col / cols) * width);
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) / cols) * width));
      const y0 = Math.floor((row / rows) * height);
      const y1 = Math.max(y0 + 1, Math.floor(((row + 1) / rows) * height));
      let count = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let luma = 0;
      let saturation = 0;
      let hueSin = 0;
      let hueCos = 0;
      let edge = 0;
      let edgeCount = 0;

      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const index = (y * width + x) * 4;
          const pr = data[index];
          const pg = data[index + 1];
          const pb = data[index + 2];
          const hsv = rgbToHsv(pr, pg, pb);
          r += pr;
          g += pg;
          b += pb;
          luma += hsv.luma;
          saturation += hsv.saturation;
          const angle = (hsv.hue / 360) * TAU;
          hueSin += Math.sin(angle);
          hueCos += Math.cos(angle);
          count += 1;

          if (x + step < width) {
            const nextIndex = (y * width + x + step) * 4;
            const nextLuma = rgbToHsv(data[nextIndex], data[nextIndex + 1], data[nextIndex + 2]).luma;
            edge += Math.abs(hsv.luma - nextLuma);
            edgeCount += 1;
          }
          if (y + step < height) {
            const nextIndex = ((y + step) * width + x) * 4;
            const nextLuma = rgbToHsv(data[nextIndex], data[nextIndex + 1], data[nextIndex + 2]).luma;
            edge += Math.abs(hsv.luma - nextLuma);
            edgeCount += 1;
          }
        }
      }

      const stats = {
        row,
        col,
        count,
        r: count ? r / count : 0,
        g: count ? g / count : 0,
        b: count ? b / count : 0,
        luma: count ? luma / count : 0,
        saturation: count ? saturation / count : 0,
        hue: count ? ((Math.atan2(hueSin, hueCos) / TAU) * 360 + 360) % 360 : 0,
        edge: edgeCount ? edge / edgeCount : 0
      };
      stats.water = localWaterScore(stats, (row + 0.5) / rows);
      stats.green = clamp(((stats.g - stats.r) / 125) * 0.8 + ((stats.g - stats.b) / 180) * 0.2);
      cells.push(stats);
    }
  }

  return { cells, cols, rows };
}

function findConnectedWater(cells, cols, rows) {
  const values = cells.map((cell) => cell.water);
  const highThreshold = Math.max(0.5, percentile(values, 0.58));
  const mask = new Uint8Array(cells.length);
  const queue = [];

  for (let row = Math.floor(rows * 0.56); row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      if (cells[index].water >= highThreshold - 0.05 && !mask[index]) {
        mask[index] = 1;
        queue.push(index);
      }
    }
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const index = queue[cursor++];
    const row = Math.floor(index / cols);
    const col = index % cols;
    const neighbours = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1]
    ];

    for (const [nr, nc] of neighbours) {
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const nextIndex = nr * cols + nc;
      if (!mask[nextIndex] && cells[nextIndex].water >= 0.49) {
        mask[nextIndex] = 1;
        queue.push(nextIndex);
      }
    }
  }

  const count = mask.reduce((sum, item) => sum + item, 0);
  return { mask, count, ratio: count / cells.length, threshold: highThreshold };
}

function cellAt(cells, cols, rows, row, col) {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  return cells[row * cols + col];
}

function neighbourhood(cells, cols, rows, row, col) {
  const water = [];
  const land = [];
  const structure = [];
  const green = [];

  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const neighbour = cellAt(cells, cols, rows, row + dr, col + dc);
      if (!neighbour) continue;
      water.push(neighbour.water);
      if (neighbour.water < 0.47) {
        land.push(neighbour);
        structure.push(neighbour.edge);
        green.push(neighbour.green);
      }
    }
  }

  const waterRatio = water.length ? water.reduce((sum, item) => sum + item, 0) / water.length : 0;
  return {
    waterRatio,
    landCount: land.length,
    structure: structure.length ? structure.reduce((sum, item) => sum + item, 0) / structure.length : 0,
    greenery: green.length ? green.reduce((sum, item) => sum + item, 0) / green.length : 0
  };
}

function candidateScore(cell, neighbourhoodData) {
  const centreX = 0.5 - Math.abs(cell.col / 18 + 0.5 / 18 - 0.5);
  const centreBonus = clamp(centreX / 0.5);
  const verticalBonus = clamp((cell.row / 14 - 0.2) / 0.55);
  const shoreIdeal = clamp(1 - Math.abs(neighbourhoodData.waterRatio - 0.62) / 0.5);
  const openWater = clamp((neighbourhoodData.waterRatio - 0.28) / 0.55);
  const structure = clamp(neighbourhoodData.structure / 0.3);
  const edgePresence = neighbourhoodData.landCount === 0 ? 0.2 : 1;
  const greenBonus = clamp(neighbourhoodData.greenery * 1.5);

  return clamp(
    shoreIdeal * 0.31 +
      openWater * 0.22 +
      structure * 0.19 +
      greenBonus * 0.08 +
      centreBonus * 0.08 +
      verticalBonus * 0.07 +
      edgePresence * 0.05
  );
}

function spotType(cell, area) {
  if (area.greenery > 0.2) return "近岸植被边";
  if (area.structure > 0.18) return "岸线结构边";
  if (area.waterRatio > 0.72) return "明水过渡带";
  if (cell.row > 9) return "近岸缓坡前沿";
  return "水陆交界带";
}

function positionName(x, y) {
  const horizontal = x < 0.36 ? "左侧岸线" : x > 0.64 ? "右侧岸线" : "前方岸线";
  const vertical = y < 0.38 ? "远端" : y > 0.74 ? "近端" : "中段";
  return `${horizontal}${vertical}`;
}

function fallbackSpots() {
  const positions = [
    [0.3, 0.61],
    [0.54, 0.53],
    [0.74, 0.68]
  ];
  return positions.map(([x, y], index) => ({
    id: index,
    letter: String.fromCharCode(65 + index),
    x,
    y,
    score: 67 - index * 2,
    label: positionName(x, y),
    type: ["近岸交界", "明水过渡", "缓坡前沿"][index],
    approach: "先观察水深与岸边稳固情况，再从近岸外侧试探",
    reasons: [
      { label: "画面", value: "存在可见水陆变化" },
      { label: "位置", value: "留出向明水调整空间" },
      { label: "提醒", value: "建议现场观察鱼星与水色" }
    ]
  }));
}

function extractCandidates(cells, cols, rows, water) {
  if (water.ratio < 0.08) return { spots: fallbackSpots(), fallback: true };
  const raw = [];

  for (let row = 2; row < rows - 3; row += 1) {
    for (let col = 1; col < cols - 1; col += 1) {
      const index = row * cols + col;
      if (!water.mask[index]) continue;
      const area = neighbourhood(cells, cols, rows, row, col);
      if (area.landCount === 0) continue;
      raw.push({ cell: cells[index], area, score: candidateScore(cells[index], area) });
    }
  }

  raw.sort((a, b) => b.score - a.score);
  const selected = [];
  for (const candidate of raw) {
    const tooClose = selected.some((item) => {
      const dx = (item.cell.col - candidate.cell.col) / cols;
      const dy = (item.cell.row - candidate.cell.row) / rows;
      return Math.sqrt(dx * dx + dy * dy) < 0.23;
    });
    if (!tooClose) selected.push(candidate);
    if (selected.length === 3) break;
  }

  if (selected.length === 0) return { spots: fallbackSpots(), fallback: true };

  const maxScore = Math.max(...selected.map((item) => item.score), 0.01);
  const spots = selected.map((item, index) => {
    const x = (item.cell.col + 0.55) / cols;
    const y = (item.cell.row + 0.52) / rows;
    const score = Math.round(clamp(60 + (item.score / maxScore) * 28, 60, 90) - index * 2);
    const type = spotType(item.cell, item.area);
    return {
      id: index,
      letter: String.fromCharCode(65 + index),
      x: round(x, 3),
      y: round(y, 3),
      score,
      label: positionName(x, y),
      type,
      approach:
        type === "近岸植被边"
          ? "贴着植被外侧找底，先避开最容易挂底的根部"
          : type === "岸线结构边"
            ? "沿岸线结构外侧扇形试抛，留意落差和暗坎"
            : "从近岸缓坡向明水过渡带逐步试探",
      reasons: [
        {
          label: "岸线",
          value: item.area.landCount >= 3 ? "水陆交界清晰" : "贴近岸线变化"
        },
        {
          label: "结构",
          value:
            item.area.greenery > 0.18
              ? "附近有植被遮蔽"
              : item.area.structure > 0.16
                ? "附近有明暗结构"
                : "前方明水较完整"
        },
        {
          label: "水面",
          value:
            item.area.waterRatio > 0.66
              ? "有向深水调整空间"
              : "近岸与明水相接"
        }
      ]
    };
  });

  const anchor = spots[0];
  const supplements = [
    [0.2, 0.07, "明水过渡带"],
    [-0.14, 0.13, "近岸缓坡前沿"]
  ];
  for (const [dx, dy, type] of supplements) {
    if (spots.length >= 3) break;
    const x = clamp(anchor.x + dx, 0.12, 0.88);
    const y = clamp(anchor.y + dy, 0.24, 0.88);
    const id = spots.length;
    spots.push({
      id,
      letter: String.fromCharCode(65 + id),
      x: round(x, 3),
      y: round(y, 3),
      score: Math.max(58, anchor.score - id * 3),
      label: positionName(x, y),
      type,
      approach:
        type === "明水过渡带"
          ? "从近岸结构向明水过渡带逐步试探"
          : "沿岸线缓坡向水面搜索落差与鱼口",
      reasons: [
        { label: "岸线", value: "保留已识别的岸线变化" },
        { label: "水面", value: "向明水方向补充试探点" },
        { label: "提醒", value: "现场确认水深和落脚安全" }
      ]
    });
  }

  return { spots, fallback: false, partial: selected.length < 3 };
}

function buildStructures(spots, scene) {
  const baseConfidence = clamp(scene.confidence / 100, 0.42, 0.9);
  const anchor = spots[0];
  const shoreY = clamp(anchor.y, 0.28, 0.74);
  return [
    {
      number: 1,
      key: "fish-path",
      label: "鱼道",
      surface: "underwater",
      x: clamp(anchor.x, 0.1, 0.85),
      y: shoreY,
      confidence: Math.round(clamp(baseConfidence - 0.08, 0.35, 0.86) * 100),
      basis: "沿边水色与明暗连续性"
    },
    {
      number: 2,
      key: "channel",
      label: "水道",
      surface: "underwater",
      x: clamp(anchor.x + 0.18, 0.22, 0.58),
      y: clamp(shoreY + 0.075, 0.34, 0.82),
      confidence: Math.round(clamp(baseConfidence - 0.14, 0.32, 0.8) * 100),
      basis: "明水延伸与流线方向"
    },
    {
      number: 3,
      key: "drop",
      label: "陡坎",
      surface: "inferred",
      x: clamp(anchor.x + 0.36, 0.4, 0.76),
      y: clamp(shoreY + 0.025, 0.3, 0.8),
      confidence: Math.round(clamp(baseConfidence - 0.19, 0.3, 0.76) * 100),
      basis: "岸线落差与局部强边缘"
    },
    {
      number: 4,
      key: "slope",
      label: "斜坡",
      surface: "visible",
      x: clamp(anchor.x + 0.1, 0.16, 0.55),
      y: clamp(shoreY + 0.16, 0.4, 0.86),
      confidence: Math.round(clamp(baseConfidence - 0.11, 0.34, 0.84) * 100),
      basis: "近岸缓坡线与水面过渡"
    }
  ];
}

function classifyScene(cells, water) {
  const waterCells = cells.filter((_, index) => water.mask[index]);
  const landCells = cells.filter((_, index) => !water.mask[index]);
  const average = (items, key) =>
    items.length ? items.reduce((sum, item) => sum + item[key], 0) / items.length : 0;
  const tone = {
    r: average(waterCells, "r"),
    g: average(waterCells, "g"),
    b: average(waterCells, "b"),
    luma: average(waterCells, "luma"),
    saturation: average(waterCells, "saturation"),
    edge: average(waterCells, "edge")
  };
  const landGreenery = average(landCells, "green");
  const structure = average(landCells, "edge");
  const frameLuma = average(cells, "luma");

  let waterTone = "normal";
  if (tone.r > tone.b + 10 && tone.saturation > 0.16) waterTone = "muddy";
  else if (tone.b > tone.r + 9 || (tone.saturation < 0.12 && tone.luma < 0.42)) waterTone = "clear";

  const flow = tone.edge > 0.18 ? "slow" : "still";
  const bank = landGreenery > 0.15 ? "植被岸" : structure > 0.13 ? "土石岸" : "硬质岸线";
  const waterShape =
    water.ratio > 0.48 ? "开阔水面" : water.ratio > 0.24 ? "河湾水面" : "近岸窄水面";
  const light = frameLuma < 0.3 ? "低光" : frameLuma > 0.66 ? "亮水" : "自然光";
  const structureLabel =
    structure > 0.2 ? "岸线结构较丰富" : structure > 0.12 ? "近岸有少量结构" : "结构信息偏少";
  const quality =
    clamp(water.ratio / 0.48) * 0.42 +
    clamp((percentile(cells.map((cell) => cell.edge), 0.65) - 0.03) / 0.24) * 0.23 +
    clamp(1 - Math.abs(frameLuma - 0.5) / 0.5) * 0.2 +
    clamp(landGreenery * 2.4) * 0.15;
  const confidence = Math.round(clamp(0.46 + quality * 0.48, 0.46, 0.93) * 100);

  return {
    waterTone,
    flow,
    bank,
    waterShape,
    light,
    structure,
    greenery: landGreenery,
    waterRatio: water.ratio,
    confidence,
    title: `${waterShape} · ${flow === "slow" ? "缓流" : "静水感"}`,
    description: `${bank}，${structureLabel}，${light}。`,
    chips: [
      bank,
      structureLabel,
      waterTone === "muddy" ? "水色偏浑" : waterTone === "clear" ? "水色偏清" : "水色正常",
      light
    ]
  };
}

function inferConditions(now = new Date()) {
  const month = now.getMonth() + 1;
  const hour = now.getHours();
  const season =
    month >= 3 && month <= 5
      ? "spring"
      : month >= 6 && month <= 8
        ? "summer"
        : month >= 9 && month <= 11
          ? "autumn"
          : "winter";
  const time =
    hour >= 5 && hour < 8
      ? "morning"
      : hour >= 8 && hour < 16
        ? "noon"
        : hour >= 16 && hour < 19
          ? "evening"
          : "night";
  return { season, time };
}

const fishProfiles = SHANGLUO_FISH;

function resolveConditions(features, conditions = {}, now = new Date()) {
  const inferred = inferConditions(now);
  return {
    season:
      conditions.season && conditions.season !== "auto" ? conditions.season : inferred.season,
    time: conditions.time && conditions.time !== "auto" ? conditions.time : inferred.time,
    water:
      conditions.water && conditions.water !== "auto"
        ? conditions.water
        : features.scene.waterTone,
    flow:
      conditions.flow && conditions.flow !== "auto" ? conditions.flow : features.scene.flow
  };
}

function recommendFish(features, conditions) {
  const structureBonus = clamp(features.scene.structure / 0.28) * 3;
  const vegetationBonus = clamp(features.scene.greenery / 0.24) * 2;
  const temperatureMid = Number.isFinite(conditions.temperature)
    ? (conditions.temperature - 2.5)
    : null;

  return fishProfiles
    .map((fish) => {
      let score = fish.seasons[conditions.season] ?? 60;
      score += fish.times[conditions.time] ?? 0;
      score += fish.water[conditions.water] ?? 0;
      score += fish.flow[conditions.flow] ?? 0;
      score += structureBonus;
      if (temperatureMid !== null && fish.tempRange) {
        const preferredMid = (fish.tempRange[0] + fish.tempRange[1]) / 2;
        score += Math.max(-7, 4 - Math.abs(temperatureMid - preferredMid) * 0.35);
      }
      if (["鲫鱼", "鲤鱼", "鲶鱼"].includes(fish.name)) score += vegetationBonus;
      return {
        ...fish,
        match: Math.round(clamp(score, 35, 94))
      };
    })
    .sort((a, b) => b.match - a.match)
    .slice(0, 4);
}

function conditionLabels(conditions) {
  const season = { spring: "春季", summer: "夏季", autumn: "秋季", winter: "冬季" }[
    conditions.season
  ];
  const time = { morning: "清晨", noon: "白天", evening: "傍晚", night: "夜间" }[
    conditions.time
  ];
  return { season, time, label: `${season} · ${time}` };
}

export function buildAdvice(features, conditions = {}, now = new Date()) {
  const resolved = resolveConditions(features, conditions, now);
  const labels = conditionLabels(resolved);
  const spots = features.spots.map((spot, index) => {
    let adjustment = 0;
    if (resolved.flow === "fast" && spot.type === "明水过渡带") adjustment -= 2;
    if (resolved.flow === "still" && spot.type === "近岸植被边") adjustment += 1;
    return {
      ...spot,
      score: Math.round(clamp(spot.score + adjustment - index * 0, 45, 94))
    };
  });

  return {
    spots,
    species: recommendFish(features, resolved),
    conditions: {
      ...resolved,
      seasonLabel: labels.season,
      timeLabel: labels.time,
      label: labels.label
    },
    fallback: features.fallback
  };
}

export function analyzePhoto(imageData, conditions = {}, now = new Date()) {
  if (
    !imageData ||
    !Number.isFinite(imageData.width) ||
    !Number.isFinite(imageData.height) ||
    !imageData.data
  ) {
    throw new TypeError("需要有效的图像数据");
  }

  const { cells, cols, rows } = buildGrid(imageData.data, imageData.width, imageData.height);
  const water = findConnectedWater(cells, cols, rows);
  const scene = classifyScene(cells, water);
  const candidates = extractCandidates(cells, cols, rows, water);
  const features = {
    scene,
    spots: candidates.spots,
    structures: buildStructures(candidates.spots, scene),
    fallback: candidates.fallback,
    partial: candidates.partial ?? false
  };
  const advice = buildAdvice(features, conditions, now);

  return {
    ...advice,
    features
  };
}

export { inferConditions };
