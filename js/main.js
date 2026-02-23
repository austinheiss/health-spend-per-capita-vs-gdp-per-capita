import { Scatterplot } from "./scatterplot.js";
import { Histogram } from "./histogram.js";
import { Chloropleth } from "./chloropleth.js";

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

d3.csv("./data/pre_processed/combined_2022.csv", d3.autoType).then((data) => {
  const scatter = new Scatterplot(
    { parentElement: "#chart", containerWidth: 800, containerHeight: 300 },
    data
  );
  observeAndResize("#scatter-panel", "#chart", scatter);

  const histHealth = new Histogram(
    {
      parentElement: "#histogram-health",
      containerWidth: 400,
      containerHeight: 200,
      valueKey: "Healthcare expenditure (% of GDP)",
      binCount: 18,
    },
    data
  );
  observeAndResize("#histogram-health-panel", "#histogram-health", histHealth);

  const histLife = new Histogram(
    {
      parentElement: "#histogram-life",
      containerWidth: 400,
      containerHeight: 200,
      valueKey: "Life expectancy at birth (years)",
      binCount: 18,
    },
    data
  );
  observeAndResize("#histogram-life-panel", "#histogram-life", histLife);

  const chlorHealth = new Chloropleth(
    {
      parentElement: "#chloropleth-health",
      containerWidth: 400,
      containerHeight: 250,
      valueKey: "Healthcare expenditure (% of GDP)",
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
      valueKey: "Life expectancy at birth (years)",
    },
    data
  );
  observeAndResize("#chloropleth-life-panel", "#chloropleth-life", chlorLife);
});
