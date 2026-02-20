export class Scatterplot {
  constructor(config, data) {
    this.config = {
      parentElement: config.parentElement,
      containerWidth: config.containerWidth || 900,
      containerHeight: config.containerHeight || 550,
      margin: config.margin || { top: 20, right: 20, bottom: 60, left: 70 },
    };

    this.data = data;
    this.xKey = "Healthcare expenditure (% of GDP)";
    this.yKey = "Life expectancy at birth (years)";

    this.initVis();
  }

  initVis() {
    const vis = this;

    // inner plotting area (chart area excluding margins)
    vis.width =
      vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height =
      vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // bind to existing SVG element in the DOM
    vis.svg = d3
      .select(vis.config.parentElement)
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    // main translated group so marks can use inner coordinates
    vis.chart = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`); // shift the plot area right/down so axes and points use the margins

    // scales are deifned once, then domains are updated in updateVis()
    vis.xScale = d3.scaleLinear().range([0, vis.width]);
    vis.yScale = d3.scaleLinear().range([vis.height, 0]); // y is inverted so larger values appear higher on the screen

    // define axis containers
    vis.xAxisGroup = vis.chart
      .append("g")
      .attr("transform", `translate(0,${vis.height})`); // put x-axis at the bottom of the inner chart area
    vis.yAxisGroup = vis.chart.append("g");

    // define axis labels
    vis.svg
      .append("text")
      .attr("x", vis.config.containerWidth / 2)
      .attr("y", vis.config.containerHeight - 15)
      .attr("text-anchor", "middle")
      .text(vis.xKey);

    vis.svg
      .append("text")
      .attr("transform", "rotate(-90)") // rotate so the y label goes vertically along the axis
      .attr("x", -vis.config.containerHeight / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .text(vis.yKey);

    vis.pointsGroup = vis.chart.append("g"); // layer for point marks

    vis.updateVis(); // trigger initial data processing and rendering
  }

  updateVis() {
    const vis = this;

    // keep only rows with both required numeric values
    vis.cleanData = vis.data.filter(
      (d) => d[vis.xKey] != null && d[vis.yKey] != null
    );

    // map data domains to pixel ranges
    // extent finds [min, max], rounds bounds to nicer tick values
    vis.xScale.domain(d3.extent(vis.cleanData, (d) => d[vis.xKey])).nice();
    vis.yScale.domain(d3.extent(vis.cleanData, (d) => d[vis.yKey])).nice();

    // rebuild axes from current scales
    vis.xAxis = d3.axisBottom(vis.xScale);
    vis.yAxis = d3.axisLeft(vis.yScale);

    vis.renderVis();
  }

  renderVis() {
    const vis = this;

    // draw axes into their groups
    vis.xAxisGroup.call(vis.xAxis);
    vis.yAxisGroup.call(vis.yAxis);

    const circles = vis.pointsGroup.selectAll("circle").data(vis.cleanData); // data join for circles

    circles
      .enter()
      .append("circle")
      .merge(circles) // merge enter and update selections so both are styled the same way
      .attr("cx", (d) => vis.xScale(d[vis.xKey]))
      .attr("cy", (d) => vis.yScale(d[vis.yKey]))
      .attr("r", 3)
      .attr("fill", "#2563eb")
      .selectAll("title")
      .data((d) => [d]) // wrap in an array because join expects an array for each selected parent, needed for tooltip updates
      .join("title")
      .text(
        (d) => `${d.Entity}: ${d[vis.yKey]} years, ${d[vis.xKey]}% GDP`
      );

    circles.exit().remove(); // remove circles that no longer have data (for filters, date updates, etc...)
  }
}
