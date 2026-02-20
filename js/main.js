import { Scatterplot } from "./scatterplot.js";

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
});
