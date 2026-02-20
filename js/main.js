import { Scatterplot } from "./scatterplot.js";
import { Histogram } from "./histogram.js";
import { Chloropleth } from "./chloropleth.js";

// Load data once, then hand it to the chart class.
d3.csv("./data/pre_processed/combined_2022.csv", d3.autoType).then((data) => {
  new Scatterplot(
    {
      parentElement: "#chart",
      containerWidth: 900,
      containerHeight: 550,
    },
    data
  );

  const histogram = new Histogram(
    {
      parentElement: "#histogram",
      containerWidth: 900,
      containerHeight: 320,
      valueKey: "Healthcare expenditure (% of GDP)",
      binCount: 18,
    },
    data
  );

  const metricSelect = document.querySelector("#histogram-metric");
  metricSelect.addEventListener("change", (event) => {
    histogram.setValueKey(event.target.value);
  });

  new Chloropleth(
    {
      parentElement: "#chloropleth",
      containerWidth: 900,
      containerHeight: 550,
    },
    data
  );
});
