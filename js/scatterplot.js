export class Scatterplot {
  constructor(config, data) {
    this.config = {
      parentElement: config.parentElement,
      containerWidth: config.containerWidth || 900,
      containerHeight: config.containerHeight || 550,
      margin: config.margin || { top: 20, right: 20, bottom: 60, left: 70 },
      tooltipPadding: config.tooltipPadding || 12,
      onSelectionChange: config.onSelectionChange || null,
    };

    this.data = data;
    this.xKey = "Healthcare expenditure (% of GDP)";
    this.yKey = "Life expectancy at birth (years)";
    this.yearRange = null;
    this.selectionMode = "none";
    this.selectedPointKeys = new Set();
    this.selectedCountryKeys = new Set();
    this.isProgrammaticBrushMove = false;

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

    // Keep brush behind points so point hover tooltips are not blocked.
    vis.brushGroup = vis.chart.append("g").attr("class", "scatter-brush-g");
    vis.pointsGroup = vis.chart.append("g"); // layer for point marks
    vis.tooltip = d3.select("#tooltip");
    vis.initBrush();

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
    if (this.selectionMode === "points") {
      // Keep selected countries persistent across year changes,
      // but drop the old geometric point selection.
      this.selectionMode = "countries";
      this.selectedPointKeys = new Set();
    }
    this.updateVis();
  }

  emitSelectionChange() {
    if (typeof this.config.onSelectionChange !== "function") return;
    if (this.selectionMode === "none") {
      this.config.onSelectionChange([]);
      return;
    }
    this.config.onSelectionChange(Array.from(this.selectedCountryKeys));
  }

  pointKey(d) {
    return `${d.Code || d.Entity}-${d.Year}`;
  }

  countryKey(d) {
    return d.Code || d.Entity;
  }

  initBrush() {
    const vis = this;
    vis.brush = d3
      .brush()
      .extent([
        [0, 0],
        [vis.width, vis.height],
      ])
      .on("brush end", (event) => {
        if (vis.isProgrammaticBrushMove) return;
        if (!event.selection) {
          vis.selectionMode = "none";
          vis.selectedCountryKeys = new Set();
          vis.selectedPointKeys = new Set();
          vis.updateBrushedStyles();
          vis.emitSelectionChange();
          return;
        }

        const [[x0, y0], [x1, y1]] = event.selection;
        const selectedRows = vis.cleanData.filter((d) => {
          const x = vis.xScale(d[vis.xKey]);
          const y = vis.yScale(d[vis.yKey]);
          return x >= x0 && x <= x1 && y >= y0 && y <= y1;
        });

        vis.selectedPointKeys = new Set(selectedRows.map((d) => vis.pointKey(d)));
        vis.selectedCountryKeys = new Set(selectedRows.map((d) => vis.countryKey(d)));
        vis.selectionMode = "points";
        vis.updateBrushedStyles();
        vis.emitSelectionChange();
      });
  }

  setHighlightedCountries(countryKeys) {
    const keys = new Set(countryKeys || []);
    if (!keys.size) {
      this.selectionMode = "none";
      this.selectedCountryKeys = new Set();
      this.selectedPointKeys = new Set();
    } else {
      this.selectionMode = "countries";
      this.selectedCountryKeys = keys;
      this.selectedPointKeys = new Set();
    }
    if (this.brushGroup && this.brush) {
      this.isProgrammaticBrushMove = true;
      this.brushGroup.call(this.brush.move, null);
      this.isProgrammaticBrushMove = false;
    }
    this.updateBrushedStyles();
  }

  updateBrushedStyles() {
    const vis = this;
    const hasSelection = vis.selectionMode !== "none";

    vis.pointsGroup
      .selectAll("circle")
      .classed(
        "is-selected",
        (d) =>
          vis.selectionMode === "points"
            ? vis.selectedPointKeys.has(vis.pointKey(d))
            : vis.selectionMode === "countries" &&
              vis.selectedCountryKeys.has(vis.countryKey(d))
      )
      .classed(
        "is-dimmed",
        (d) =>
          hasSelection &&
          (vis.selectionMode === "points"
            ? !vis.selectedPointKeys.has(vis.pointKey(d))
            : !vis.selectedCountryKeys.has(vis.countryKey(d)))
      );
  }

  renderVis() {
    const vis = this;

    // draw axes into their groups
    vis.xAxisGroup.call(vis.xAxis);
    vis.yAxisGroup.call(vis.yAxis);

    const circles = vis.pointsGroup
      .selectAll("circle")
      .data(vis.cleanData, (d) => vis.pointKey(d)); // data join for circles

    circles
      .enter()
      .append("circle")
      .merge(circles) // merge enter and update selections so both are styled the same way
      .attr("class", "scatter-point")
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
    vis.brushGroup.call(vis.brush);
    vis.updateBrushedStyles();
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
    vis.initBrush();
    vis.updateVis();
  }
}
