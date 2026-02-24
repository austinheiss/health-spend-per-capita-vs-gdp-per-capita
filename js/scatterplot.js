export class Scatterplot {
  constructor(config, data) {
    this.config = {
      parentElement: config.parentElement,
      containerWidth: config.containerWidth || 900,
      containerHeight: config.containerHeight || 550,
      margin: config.margin || { top: 20, right: 20, bottom: 60, left: 70 },
      tooltipPadding: config.tooltipPadding || 12,
    };

    this.data = data;
    this.xKey = "Healthcare expenditure (% of GDP)";
    this.yKey = "Life expectancy at birth (years)";
    this.yearRange = null;

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
      .attr("class", "x-axis-label")
      .attr("x", vis.config.containerWidth / 2)
      .attr("y", vis.config.containerHeight - 15)
      .attr("text-anchor", "middle")
      .text(vis.xKey);

    vis.svg
      .append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)") // rotate so the y label goes vertically along the axis
      .attr("x", -vis.config.containerHeight / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .text(vis.yKey);

    vis.pointsGroup = vis.chart.append("g"); // layer for point marks
    vis.tooltip = d3.select("#tooltip");

    vis.updateVis(); // trigger initial data processing and rendering
  }

  updateVis() {
    const vis = this;

    const [startYear, endYear] = vis.yearRange || [-Infinity, Infinity];

    // keep only rows with both required numeric values
    vis.cleanData = vis.data.filter(
      (d) =>
        d[vis.xKey] != null &&
        d[vis.yKey] != null &&
        d.Year >= startYear &&
        d.Year <= endYear
    );

    if (!vis.cleanData.length) {
      vis.xScale.domain([0, 1]);
      vis.yScale.domain([0, 1]);
      vis.xAxis = d3.axisBottom(vis.xScale);
      vis.yAxis = d3.axisLeft(vis.yScale);
      vis.renderVis();
      return;
    }

    // map data domains to pixel ranges
    // extent finds [min, max], rounds bounds to nicer tick values
    vis.xScale.domain(d3.extent(vis.cleanData, (d) => d[vis.xKey])).nice();
    vis.yScale.domain(d3.extent(vis.cleanData, (d) => d[vis.yKey])).nice();

    // rebuild axes from current scales
    vis.xAxis = d3.axisBottom(vis.xScale);
    vis.yAxis = d3.axisLeft(vis.yScale);

    vis.renderVis();
  }

  setYearRange(startYear, endYear) {
    this.yearRange = [startYear, endYear];
    this.updateVis();
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
      .on("mouseover", (event, d) => {
        vis.tooltip
          .style("display", "block")
          .html(
            `<strong>${d.Entity}</strong><br>` +
              `Life expectancy: ${d[vis.yKey].toFixed(2)} years<br>` +
              `Healthcare spend: ${d[vis.xKey].toFixed(2)}% GDP`
          );
      })
      .on("mousemove", (event) => {
        vis.tooltip
          .style("left", `${event.pageX + vis.config.tooltipPadding}px`)
          .style("top", `${event.pageY + vis.config.tooltipPadding}px`);
      })
      .on("mouseleave", () => {
        vis.tooltip.style("display", "none");
      });

    circles.exit().remove(); // remove circles that no longer have data (for filters, date updates, etc...)
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
    vis.xScale.range([0, vis.width]);
    vis.yScale.range([vis.height, 0]);
    vis.chart.attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);
    vis.xAxisGroup.attr("transform", `translate(0,${vis.height})`);
    vis.svg.select(".x-axis-label")
      .attr("x", vis.config.containerWidth / 2)
      .attr("y", vis.config.containerHeight - 15);
    vis.svg.select(".y-axis-label")
      .attr("x", -vis.config.containerHeight / 2);
    vis.updateVis();
  }
}
