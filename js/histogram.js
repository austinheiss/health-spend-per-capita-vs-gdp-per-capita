export class Histogram {
  constructor(config, data) {
    this.config = {
      parentElement: config.parentElement,
      containerWidth: config.containerWidth || 900,
      containerHeight: config.containerHeight || 320,
      margin: config.margin || { top: 20, right: 20, bottom: 45, left: 55 },
      valueKey: config.valueKey,
      binCount: config.binCount || 20,
      tooltipPadding: config.tooltipPadding || 12,
    };

    this.data = data;
    this.yearRange = null;
    this.selectedRange = null;
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

    // main translated group so bars and axes use inner coordinates
    vis.chart = vis.svg
      .append("g")
      .attr(
        "transform",
        `translate(${vis.config.margin.left},${vis.config.margin.top})`
      );

    // scales are defined once, then domains are updated in updateVis()
    vis.xScale = d3.scaleLinear().range([0, vis.width]);
    vis.yScale = d3.scaleLinear().range([vis.height, 0]); // y is inverted so taller bars grow upward

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
      .attr("y", vis.config.containerHeight - 10)
      .attr("text-anchor", "middle")
      .text(vis.config.valueKey);

    vis.svg
      .append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -vis.config.containerHeight / 2)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .text("Count of countries");

    vis.barsGroup = vis.chart.append("g"); // layer for bar marks
    vis.brushGroup = vis.chart.append("g").attr("class", "histogram-brush-g");
    vis.tooltip = d3.select("#tooltip");
    vis.initBrush();

    vis.updateVis(); // trigger initial data processing and rendering
  }

  updateVis() {
    const vis = this;
    const [startYear, endYear] = vis.yearRange || [-Infinity, Infinity];

    // keep only valid numeric values for the selected measure
    const values = vis.data
      .filter((d) => d.Year >= startYear && d.Year <= endYear)
      .map((d) => d[vis.config.valueKey])
      .filter((v) => v != null && !Number.isNaN(v));

    if (!values.length) {
      vis.bins = [];
      vis.xScale.domain([0, 1]);
      vis.yScale.domain([0, 1]);
      vis.renderVis();
      return;
    }

    // map data domain to pixel range on x-axis
    vis.xScale.domain(d3.extent(values)).nice();

    // bin values into equal-width buckets across the x domain
    vis.bins = d3
      .bin()
      .domain(vis.xScale.domain())
      .thresholds(vis.config.binCount)(values);

    // y domain is counts per bin
    vis.yScale
      .domain([0, d3.max(vis.bins, (d) => d.length)])
      .nice();

    vis.renderVis();
  }

  setYearRange(startYear, endYear) {
    this.yearRange = [startYear, endYear];
    this.updateVis();
  }

  initBrush() {
    const vis = this;
    vis.brush = d3
      .brushX()
      .extent([
        [0, 0],
        [vis.width, vis.height],
      ])
      .on("brush end", (event) => {
        if (!event.selection) {
          vis.selectedRange = null;
          vis.updateBrushedStyles();
          return;
        }

        const nextRange = vis.rangeFromSelection(event.selection);
        vis.selectedRange = nextRange;
        vis.updateBrushedStyles();

        if (event.type === "end" && event.sourceEvent) {
          vis.brushGroup.call(vis.brush.move, vis.selectionFromRange(vis.selectedRange));
        }
      });
  }

  rangeFromSelection([x0, x1]) {
    const [domainMin, domainMax] = this.xScale.domain();
    const left = Math.max(0, Math.min(x0, x1));
    const right = Math.min(this.width, Math.max(x0, x1));
    const rangeMin = this.xScale.invert(left);
    const rangeMax = this.xScale.invert(right);
    return [
      Math.max(domainMin, Math.min(rangeMin, rangeMax)),
      Math.min(domainMax, Math.max(rangeMin, rangeMax)),
    ];
  }

  selectionFromRange([rangeMin, rangeMax]) {
    const x0 = this.xScale(rangeMin);
    const x1 = this.xScale(rangeMax);
    return [Math.max(0, Math.min(x0, x1)), Math.min(this.width, Math.max(x0, x1))];
  }

  updateBrushedStyles() {
    const vis = this;
    const hasSelection = Array.isArray(vis.selectedRange);
    const [rangeMin, rangeMax] = hasSelection ? vis.selectedRange : [null, null];

    vis.barsGroup
      .selectAll("rect")
      .attr("fill", (d) => {
        if (!hasSelection) return "#60a5fa";
        const overlapsRange = d.x1 >= rangeMin && d.x0 <= rangeMax;
        return overlapsRange ? "#2563eb" : "#93c5fd";
      })
      .attr("opacity", (d) => {
        if (!hasSelection) return 1;
        const overlapsRange = d.x1 >= rangeMin && d.x0 <= rangeMax;
        return overlapsRange ? 1 : 0.35;
      });
  }

  renderVis() {
    const vis = this;

    // draw axes from current scales
    vis.xAxisGroup.call(d3.axisBottom(vis.xScale));
    vis.yAxisGroup.call(d3.axisLeft(vis.yScale).ticks(6).tickFormat(d3.format("d")));

    const bars = vis.barsGroup.selectAll("rect").data(vis.bins); // data join for bars

    bars
      .enter()
      .append("rect")
      .merge(bars) // merge enter and update selections so both are styled the same way
      .attr("class", "histogram-bar")
      .attr("x", (d) => vis.xScale(d.x0) + 1)
      .attr("y", (d) => vis.yScale(d.length))
      .attr("width", (d) =>
        Math.max(0, vis.xScale(d.x1) - vis.xScale(d.x0) - 1)
      )
      .attr("height", (d) => vis.height - vis.yScale(d.length))
      .on("mouseover", (event, d) => {
        vis.tooltip
          .style("display", "block")
          .html(
            `${vis.config.valueKey}<br>` +
              `Range: ${d.x0.toFixed(2)} - ${d.x1.toFixed(2)}<br>` +
              `Countries: ${d.length}`
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

    bars.exit().remove(); // remove bars with no corresponding bin (for updates/filters)

    vis.brushGroup.call(vis.brush);
    if (vis.selectedRange) {
      vis.brushGroup.call(vis.brush.move, vis.selectionFromRange(vis.selectedRange));
    }
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
    vis.chart.attr(
      "transform",
      `translate(${vis.config.margin.left},${vis.config.margin.top})`
    );
    vis.xAxisGroup.attr("transform", `translate(0,${vis.height})`);
    vis.svg.select(".x-axis-label")
      .attr("x", vis.config.containerWidth / 2)
      .attr("y", vis.config.containerHeight - 10);
    vis.svg.select(".y-axis-label").attr("x", -vis.config.containerHeight / 2);
    vis.initBrush();
    vis.updateVis();
  }
}
