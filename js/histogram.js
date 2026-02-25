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
      onSelectionChange: config.onSelectionChange || null,
      baseFill: config.baseFill || "#16a34a",
      mutedFill: config.mutedFill || "#86efac",
    };

    this.data = data;
    this.yearRange = null;
    this.selectedRange = null;
    this.highlightedCountryKeys = new Set();
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

    // Keep brush behind bars so bar hover tooltips are not blocked.
    vis.brushGroup = vis.chart.append("g").attr("class", "histogram-brush-g");
    vis.barsGroup = vis.chart.append("g"); // layer for bar marks
    vis.tooltip = d3.select("#tooltip");
    vis.initBrush();

    vis.updateVis(); // trigger initial data processing and rendering
  }

  setMetric({ valueKey, baseFill, mutedFill }) {
    const vis = this;
    vis.config.valueKey = valueKey;
    if (baseFill) vis.config.baseFill = baseFill;
    if (mutedFill) vis.config.mutedFill = mutedFill;
    // Numeric range selection doesn't translate across metric changes.
    vis.selectedRange = null;
    vis.svg.select(".x-axis-label").text(vis.config.valueKey);
    vis.isProgrammaticBrushMove = true;
    vis.brushGroup.call(vis.brush.move, null);
    vis.isProgrammaticBrushMove = false;
    vis.updateVis();
  }

  updateVis() {
    const vis = this;
    const [startYear, endYear] = vis.yearRange || [-Infinity, Infinity];

    // keep only valid numeric values for the selected measure
    vis.cleanRows = vis.data
      .filter((d) => d.Year >= startYear && d.Year <= endYear)
      .map((d) => ({ row: d, value: d[vis.config.valueKey] }))
      .filter((d) => d.value != null && !Number.isNaN(d.value));

    const values = vis.cleanRows.map((d) => d.value);

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
    vis.binCountryKeySets = vis.bins.map((bin, i) => {
      const isLastBin = i === vis.bins.length - 1;
      const keys = new Set();
      const names = new Set();
      vis.cleanRows.forEach(({ row, value }) => {
        const inBin = value >= bin.x0 && (isLastBin ? value <= bin.x1 : value < bin.x1);
        if (inBin) {
          keys.add(row.Code || row.Entity);
          names.add(row.Entity || row.Code);
        }
      });
      bin.countryNames = Array.from(names).sort((a, b) => a.localeCompare(b));
      return keys;
    });

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

  emitSelectionChange() {
    if (typeof this.config.onSelectionChange !== "function") return;
    if (!Array.isArray(this.selectedRange)) {
      this.config.onSelectionChange([]);
      return;
    }
    const [rangeMin, rangeMax] = this.selectedRange;
    const selectedKeys = new Set(
      this.cleanRows
        .filter(({ value }) => value >= rangeMin && value <= rangeMax)
        .map(({ row }) => row.Code || row.Entity)
    );
    this.config.onSelectionChange(Array.from(selectedKeys));
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
        if (vis.isProgrammaticBrushMove) return;
        if (!event.selection) {
          vis.selectedRange = null;
          vis.updateBrushedStyles();
          vis.emitSelectionChange();
          return;
        }

        // A manual histogram brush becomes the active filter source,
        // so clear any prior map-driven country highlight state.
        vis.highlightedCountryKeys = new Set();
        const nextRange = vis.rangeFromSelection(event.selection);
        vis.selectedRange = nextRange;
        vis.updateBrushedStyles();
        vis.emitSelectionChange();

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
    const hasBrushSelection = Array.isArray(vis.selectedRange);
    const hasCountrySelection = vis.highlightedCountryKeys.size > 0;
    const [rangeMin, rangeMax] = hasBrushSelection ? vis.selectedRange : [null, null];

    const baseFill = vis.config.baseFill;
    const mutedFill = vis.config.mutedFill;
    const getBarStyle = (i) => {
      if (!hasBrushSelection && !hasCountrySelection) {
        return { fill: baseFill, opacity: 1 };
      }
      const isHighlighted = hasBrushSelection
        ? vis.bins[i].x1 >= rangeMin && vis.bins[i].x0 <= rangeMax
        : Array.from(vis.binCountryKeySets[i] || []).some((key) =>
            vis.highlightedCountryKeys.has(key)
          );
      return isHighlighted ? { fill: baseFill, opacity: 1 } : { fill: mutedFill, opacity: 0.35 };
    };

    vis.barsGroup.selectAll("rect").each(function (_, i) {
      const { fill, opacity } = getBarStyle(i);
      d3.select(this).attr("fill", fill).attr("opacity", opacity);
    });
  }

  updateBrushSelectionStyle() {
    const vis = this;
    vis.brushGroup
      .selectAll(".selection")
      .attr("fill", vis.config.mutedFill)
      .attr("fill-opacity", 0.2)
      .attr("stroke", vis.config.baseFill);
  }

  setHighlightedCountries(countryKeys) {
    this.highlightedCountryKeys = new Set(countryKeys || []);
    this.selectedRange = null;
    this.isProgrammaticBrushMove = true;
    this.brushGroup.call(this.brush.move, null);
    this.isProgrammaticBrushMove = false;
    this.updateBrushedStyles();
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
      .attr("x", (d) => vis.xScale(d.x0) + 1)
      .attr("y", (d) => vis.yScale(d.length))
      .attr("width", (d) =>
        Math.max(0, vis.xScale(d.x1) - vis.xScale(d.x0) - 1)
      )
      .attr("height", (d) => vis.height - vis.yScale(d.length))
      .on("pointerenter", (event, d) => {
        const countryNames = d.countryNames || [];
        const countryLabel =
          countryNames.length > 0 ? countryNames.join(", ") : "No countries in bin";
        vis.tooltip
          .style("display", "block")
          .style("left", `${event.pageX + vis.config.tooltipPadding}px`)
          .style("top", `${event.pageY + vis.config.tooltipPadding}px`)
          .html(
            `${vis.config.valueKey}<br>` +
              `Range: ${d.x0.toFixed(2)} - ${d.x1.toFixed(2)}<br>` +
              `Countries: ${countryLabel}`
          );
      })
      .on("pointermove", (event) => {
        vis.tooltip
          .style("left", `${event.pageX + vis.config.tooltipPadding}px`)
          .style("top", `${event.pageY + vis.config.tooltipPadding}px`);
      })
      .on("pointerleave", () => {
        vis.tooltip.style("display", "none");
      });

    bars.exit().remove(); // remove bars with no corresponding bin (for updates/filters)

    vis.brushGroup.call(vis.brush);
    if (vis.selectedRange) {
      vis.brushGroup.call(vis.brush.move, vis.selectionFromRange(vis.selectedRange));
    }
    vis.updateBrushSelectionStyle();
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
