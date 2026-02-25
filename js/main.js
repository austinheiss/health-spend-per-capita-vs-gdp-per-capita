import { Scatterplot } from "./scatterplot.js";
import { Histogram } from "./histogram.js";
import { Chloropleth } from "./chloropleth.js";

const HEALTH_SOURCE_KEY =
  "Current health expenditure (CHE) as percentage of gross domestic product (GDP) (%)";
const LIFE_SOURCE_KEY = "Life expectancy at birth, totals, period";
const HEALTH_DISPLAY_KEY = "Healthcare expenditure (% of GDP)";
const LIFE_DISPLAY_KEY = "Life expectancy at birth (years)";

function observeAndResize(containerSelector, svgSelector, chart) {
  const containerEl = document.querySelector(containerSelector);
  const svgEl = document.querySelector(svgSelector);
  let lastWidth = 0;
  let lastHeight = 0;

  const applyResize = () => {
    const { width, height } = svgEl.getBoundingClientRect();
    const nextWidth = Math.round(width);
    const nextHeight = Math.round(height);

    if (nextWidth <= 0 || nextHeight <= 0) return;
    if (nextWidth === lastWidth && nextHeight === lastHeight) return;

    lastWidth = nextWidth;
    lastHeight = nextHeight;
    chart.resize(nextWidth, nextHeight);
  };

  const ro = new ResizeObserver(() => {
    applyResize();
  });
  ro.observe(containerEl);
  applyResize();
}

class YearBrush {
  constructor(config, years, onRangeChange) {
    this.config = {
      parentElement: config.parentElement,
      containerWidth: config.containerWidth || 90,
      containerHeight: config.containerHeight || 600,
      margin: config.margin || { top: 16, right: 16, bottom: 16, left: 18 },
    };
    this.onRangeChange = onRangeChange;
    this.selectedRange = [years[years.length - 1], years[years.length - 1]];
    this.minYear = years[0];
    this.maxYear = years[years.length - 1];

    this.initVis();
  }

  initVis() {
    const vis = this;
    vis.width =
      vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height =
      vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    vis.svg = d3
      .select(vis.config.parentElement)
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    vis.chart = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    vis.yScale = d3
      .scaleLinear()
      .domain([vis.minYear, vis.maxYear])
      .range([vis.height, 0]);

    vis.axisGroup = vis.chart
      .append("g")
      .attr("class", "year-brush-axis")
      .attr("transform", `translate(${vis.width / 2},0)`);

    vis.brushGroup = vis.chart.append("g").attr("class", "year-brush-g");
    vis.initBrush();
    vis.renderVis();
  }

  initBrush() {
    const vis = this;
    vis.brush = d3
      .brushY()
      .extent([
        [0, 0],
        [vis.width, vis.height],
      ])
      .on("brush end", (event) => {
        if (!event.selection) return;
        const nextRange = vis.rangeFromSelection(event.selection);
        vis.selectedRange = nextRange;
        vis.onRangeChange(nextRange);

        if (event.type === "end" && event.sourceEvent) {
          vis.brushGroup.call(
            vis.brush.move,
            vis.selectionFromRange(vis.selectedRange)
          );
        }
      });
  }

  selectionFromRange([startYear, endYear]) {
    const yTop = this.yScale(endYear);
    const yBottom = this.yScale(startYear);
    if (startYear === endYear) {
      const oneYearPx = this.maxYear === this.minYear
        ? 6
        : Math.max(6, Math.abs(this.yScale(this.minYear) - this.yScale(this.minYear + 1)));
      return [Math.max(0, yTop - oneYearPx / 2), Math.min(this.height, yBottom + oneYearPx / 2)];
    }
    return [yTop, yBottom];
  }

  rangeFromSelection([y0, y1]) {
    const clampedTop = Math.max(0, Math.min(y0, y1));
    const clampedBottom = Math.min(this.height, Math.max(y0, y1));
    const newestYear = Math.round(this.yScale.invert(clampedTop));
    const oldestYear = Math.round(this.yScale.invert(clampedBottom));
    return [
      Math.max(this.minYear, Math.min(oldestYear, newestYear)),
      Math.min(this.maxYear, Math.max(oldestYear, newestYear)),
    ];
  }

  renderVis() {
    const vis = this;
    const tickStep = Math.max(1, Math.ceil((vis.maxYear - vis.minYear) / 12));

    vis.axisGroup.call(
      d3
        .axisRight(vis.yScale)
        .tickFormat(d3.format("d"))
        .tickValues(d3.range(vis.minYear, vis.maxYear + 1, tickStep))
    );

    vis.brushGroup.call(vis.brush).call(
      vis.brush.move,
      vis.selectionFromRange(vis.selectedRange)
    );
  }

  resize(containerWidth, containerHeight) {
    const vis = this;
    vis.config.containerWidth = containerWidth;
    vis.config.containerHeight = containerHeight;
    vis.width =
      vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height =
      vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    vis.svg
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);
    vis.chart.attr(
      "transform",
      `translate(${vis.config.margin.left},${vis.config.margin.top})`
    );
    vis.yScale.range([vis.height, 0]);
    vis.axisGroup.attr("transform", `translate(${vis.width / 2},0)`);
    vis.initBrush();
    vis.renderVis();
  }
}

function buildCombinedDataset(healthRows, lifeRows) {
  const lifeByKey = new Map(
    lifeRows
      .filter((d) => d.Code != null && d.Year != null && d[LIFE_SOURCE_KEY] != null)
      .map((d) => [`${d.Code}|${d.Year}`, d])
  );

  return healthRows
    .filter((d) => d.Code != null && d.Year != null && d[HEALTH_SOURCE_KEY] != null)
    .map((d) => {
      const matchingLife = lifeByKey.get(`${d.Code}|${d.Year}`);
      if (!matchingLife) return null;
      return {
        Entity: d.Entity || matchingLife.Entity,
        Code: d.Code,
        Year: d.Year,
        [HEALTH_DISPLAY_KEY]: d[HEALTH_SOURCE_KEY],
        [LIFE_DISPLAY_KEY]: matchingLife[LIFE_SOURCE_KEY],
      };
    })
    .filter((d) => d != null)
    .sort((a, b) => a.Year - b.Year);
}

Promise.all([
  d3.csv("./data/total-healthcare-expenditure-gdp/total-healthcare-expenditure-gdp.csv", d3.autoType),
  d3.csv("./data/life-expectancy-hmd-unwpp/life-expectancy-hmd-unwpp.csv", d3.autoType),
]).then(([healthRows, lifeRows]) => {
  const data = buildCombinedDataset(healthRows, lifeRows);
  const years = Array.from(new Set(data.map((d) => d.Year))).sort((a, b) => a - b);
  if (!years.length) return;

  let highlightedCountryKeys = new Set();

  const scatter = new Scatterplot(
    {
      parentElement: "#chart",
      containerWidth: 800,
      containerHeight: 300,
      onSelectionChange: (countryKeys) =>
        applyCountryHighlights(countryKeys, "scatter"),
    },
    data
  );
  observeAndResize("#scatter-panel", "#chart", scatter);

  const histHealth = new Histogram(
    {
      parentElement: "#histogram-health",
      containerWidth: 400,
      containerHeight: 200,
      valueKey: HEALTH_DISPLAY_KEY,
      binCount: 18,
      onSelectionChange: (countryKeys) =>
        applyCountryHighlights(countryKeys, "hist-health"),
    },
    data
  );
  observeAndResize("#histogram-health-panel", "#histogram-health", histHealth);

  const histLife = new Histogram(
    {
      parentElement: "#histogram-life",
      containerWidth: 400,
      containerHeight: 200,
      valueKey: LIFE_DISPLAY_KEY,
      binCount: 18,
      onSelectionChange: (countryKeys) =>
        applyCountryHighlights(countryKeys, "hist-life"),
    },
    data
  );
  observeAndResize("#histogram-life-panel", "#histogram-life", histLife);

  const chlorHealth = new Chloropleth(
    {
      parentElement: "#chloropleth-health",
      containerWidth: 400,
      containerHeight: 250,
      valueKey: HEALTH_DISPLAY_KEY,
    },
    data
  );
  observeAndResize(
    "#chloropleth-health-panel",
    "#chloropleth-health",
    chlorHealth
  );

  const chlorLife = new Chloropleth(
    {
      parentElement: "#chloropleth-life",
      containerWidth: 400,
      containerHeight: 250,
      valueKey: LIFE_DISPLAY_KEY,
    },
    data
  );
  observeAndResize("#chloropleth-life-panel", "#chloropleth-life", chlorLife);

  function applyCountryHighlights(countryKeys = [], source = null) {
    highlightedCountryKeys = new Set(countryKeys);
    const keys = Array.from(highlightedCountryKeys);

    if (source !== "scatter") scatter.setHighlightedCountries(keys);
    if (source !== "hist-health") histHealth.setHighlightedCountries(keys);
    if (source !== "hist-life") histLife.setHighlightedCountries(keys);
    chlorHealth.setHighlightedCountries(keys);
    chlorLife.setHighlightedCountries(keys);
  }

  const applyYearRange = ([startYear, endYear]) => {
    scatter.setYearRange(startYear, endYear);
    histHealth.setYearRange(startYear, endYear);
    histLife.setYearRange(startYear, endYear);
    chlorHealth.setYearRange(startYear, endYear);
    chlorLife.setYearRange(startYear, endYear);
    applyCountryHighlights(Array.from(highlightedCountryKeys));

    document.querySelector("#year-display").textContent =
      startYear === endYear ? String(endYear) : `${startYear}–${endYear}`;
  };

  const yearBrush = new YearBrush(
    { parentElement: "#year-brush", containerWidth: 90, containerHeight: 500 },
    years,
    applyYearRange
  );
  observeAndResize("#year-brush-panel", "#year-brush", yearBrush);

  const initialYear = years[years.length - 1];
  applyYearRange([initialYear, initialYear]);
});
