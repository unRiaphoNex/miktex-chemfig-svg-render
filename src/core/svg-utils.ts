// ========== core/svg-utils.js - SVG处理工具 ==========

// v10.15.12: SVG 渲染缓存
const svgRenderCache = new Map();
const SVG_CACHE_MAX = 100;

/**
 * 生成 SVG 缓存键
 */
function getSvgCacheKey(groupSvgs, layout, canvasW, canvasH, bgColor) {
  const layoutStr = JSON.stringify(layout);
  return (
    canvasW +
    "x" +
    canvasH +
    ":" +
    bgColor +
    ":" +
    layoutStr.length +
    ":" +
    groupSvgs.length +
    ":" +
    layoutStr.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0)
  );
}

/**
 * 清空 SVG 渲染缓存
 */
function clearSvgRenderCache() {
  svgRenderCache.clear();
}

function mergeSvgs(groupSvgs, layout, canvasW, canvasH, bgColor) {
  // v10.15.12: 检查缓存
  const cacheKey = getSvgCacheKey(groupSvgs, layout, canvasW, canvasH, bgColor);
  const cached = svgRenderCache.get(cacheKey);
  if (cached) {
    cached.lastAccess = Date.now();
    return cached.result;
  }

  const bg = bgColor || "#ffffff";
  const parts = [];
  for (let i = 0; i < groupSvgs.length; i++) {
    const svgText = groupSvgs[i];
    const vbMatch = svgText.match(/viewBox="([^"]+)"/);
    const contentMatch = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    if (!contentMatch) continue;
    const vb = vbMatch ? vbMatch[1].split(/\s+/).map(Number) : [0, 0, 100, 100];
    const pos = layout[i] || { x: 50 + i * 150, y: 50, scaleX: 1, scaleY: 1 };
    const sx = pos.scaleX || pos.scale || 1;
    const sy = pos.scaleY || pos.scale || 1;
    parts.push(`<g transform="translate(${pos.x},${pos.y}) scale(${sx},${sy})">
  ${contentMatch[1].trim()}
</g>`);
  }
  const bgRect =
    bg === "transparent" ? "" : `<rect width="${canvasW}" height="${canvasH}" fill="${bg}"/>`;
  const result = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
${bgRect}
${parts.join("\n")}
</svg>`;
  const finalResult = ensureSvgNamespace(result);

  // v10.15.12: 存入缓存 (LRU)
  if (svgRenderCache.size >= SVG_CACHE_MAX) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, v] of svgRenderCache) {
      if (v.lastAccess < oldestTime) {
        oldestTime = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) svgRenderCache.delete(oldestKey);
  }
  svgRenderCache.set(cacheKey, { result: finalResult, lastAccess: Date.now() });

  return finalResult;
}

// 确保SVG根元素包含所有必要的命名空间声明

function ensureSvgNamespace(svg) {
  if (!svg || typeof svg !== "string") return svg;
  let result = svg;
  // 检查根元素是否有 xmlns:xlink
  if (/<svg\b[^>]*>/.test(result)) {
    const rootMatch = result.match(/<svg\b[^>]*>/);
    if (rootMatch && !/xmlns:xlink=/.test(rootMatch[0])) {
      result = result.replace(/<svg\b/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
  }
  return result;
}
