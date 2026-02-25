export class Chloropleth {
  constructor(config, data) {
    this.config = {
      parentElement: config.parentElement,
      containerWidth: config.containerWidth || 900,
      containerHeight: config.containerHeight || 550,
      margin: config.margin || { top: 20, right: 20, bottom: 20, left: 20 },
      tooltipPadding: config.tooltipPadding || 12,
      onSelectionChange: config.onSelectionChange || null,
    };

    this.data = data;
    this.valueKey = config.valueKey || "Healthcare expenditure (% of GDP)";
    this.yearRange = null;
    this.highlightedCountryKeys = new Set();
    this.gradientId = `chloropleth-gradient-${this.config.parentElement.replace("#", "")}`;

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

    // main translated group so marks use inner coordinates
    vis.chart = vis.svg
      .append("g")
      .attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    vis.tooltip = d3.select("#tooltip");

    vis.projection = d3.geoNaturalEarth1();
    vis.path = d3.geoPath().projection(vis.projection);

    vis.legendLeftMargin = 55; // space for vertical legend on left
    vis.countriesGroup = vis.chart
      .append("g")
      .attr("transform", `translate(${vis.legendLeftMargin}, 0)`);

    // load world geometry, then run data processing + render
    d3.json("data/world.geojson").then((world) => {
      vis.worldData = world;
      vis.projection.fitSize(
        [vis.width - vis.legendLeftMargin, vis.height],
        world
      );
      vis.updateVis();
    });
  }

  updateVis() {
    const vis = this;
    if (!vis.worldData) return;
    const [startYear, endYear] = vis.yearRange || [-Infinity, Infinity];

    // keep only rows with country code and selected metric
    vis.cleanData = vis.data.filter(
      (d) =>
        d.Code != null &&
        d[vis.valueKey] != null &&
        d.Year >= startYear &&
        d.Year <= endYear
    );

    const latestByCode = new Map();
    vis.cleanData.forEach((d) => {
      const previous = latestByCode.get(d.Code);
      if (!previous || d.Year > previous.Year) {
        latestByCode.set(d.Code, d);
      }
    });
    vis.cleanData = Array.from(latestByCode.values());

    // ISO code -> row lookup
    vis.rowsByCode = Object.fromEntries(vis.cleanData.map((d) => [d.Code, d]));

    // map metric values to color scale
    const values = vis.cleanData.map((d) => d[vis.valueKey]);
    if (!values.length) {
      vis.colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);
      vis.renderVis();
      return;
    }
    vis.colorScale = d3
      .scaleSequential(d3.interpolateBlues)
      .domain(d3.extent(values));

    vis.renderVis();
  }

  renderVis() {
    const vis = this;
    const getRow = (feature) => vis.rowsByCode[feature.id];
    const getValue = (feature) => getRow(feature)?.[vis.valueKey];

    const countries = vis.countriesGroup
      .selectAll("path")
      .data(vis.worldData.features);

    countries
      .enter()
      .append("path")
      .merge(countries)
      .attr("class", "country")
      .attr("d", vis.path)
      .attr("fill", (d) => {
        const value = getValue(d);
        return value != null ? vis.colorScale(value) : "#e5e7eb";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .style("opacity", 0.9)
      .style("cursor", (d) => (getRow(d) ? "pointer" : "default"))
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget)
          .style("stroke", "black")
          .style("stroke-width", 1.5);
        const row = getRow(d);
        const value = getValue(d);
        const name = d.properties?.name || d.id;
        const html =
          value != null
            ? `<strong>${row.Entity}</strong><br>${
                vis.valueKey.includes("Life expectancy")
                  ? `Life expectancy: ${value.toFixed(1)} years`
                  : `Healthcare expenditure: ${value.toFixed(2)}% of GDP`
              }`
            : `<strong>${name}</strong><br>No data`;

        vis.tooltip.style("display", "block").html(html);
      })
      .on("mousemove", (event) => {
        vis.tooltip
          .style("left", `${event.pageX + vis.config.tooltipPadding}px`)
          .style("top", `${event.pageY + vis.config.tooltipPadding}px`);
      })
      .on("click", (event, d) => {
        const row = getRow(d);
        if (!row?.Code) return;
        vis.toggleCountrySelection(row.Code);
      })
      .on("mouseleave", () => {
        vis.updateHighlightStyles();
        vis.tooltip.style("display", "none");
      });

    countries.exit().remove();
    vis.updateHighlightStyles();

    // Add or update legend
    vis.updateLegend();
  }

  setYearRange(startYear, endYear) {
    this.yearRange = [startYear, endYear];
    this.updateVis();
  }

  setHighlightedCountries(countryKeys) {
    this.highlightedCountryKeys = new Set(countryKeys || []);
    this.updateHighlightStyles();
  }

  emitSelectionChange() {
    if (typeof this.config.onSelectionChange !== "function") return;
    this.config.onSelectionChange(Array.from(this.highlightedCountryKeys));
  }

  toggleCountrySelection(countryCode) {
    if (!countryCode) return;
    if (this.highlightedCountryKeys.has(countryCode)) {
      this.highlightedCountryKeys.delete(countryCode);
    } else {
      this.highlightedCountryKeys.add(countryCode);
    }
    this.updateHighlightStyles();
    this.emitSelectionChange();
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
    vis.chart.attr("transform", `translate(${vis.config.margin.left},${vis.config.margin.top})`);
    vis.countriesGroup.attr("transform", `translate(${vis.legendLeftMargin}, 0)`);
    if (vis.worldData) {
      vis.projection.fitSize(
        [vis.width - vis.legendLeftMargin, vis.height],
        vis.worldData
      );
    }
    vis.updateVis();
  }

  updateLegend() {
    const vis = this;
    const legendWidth = 12;
    const legendHeight = 200;
    const legendX = vis.legendLeftMargin - legendWidth - 4;
    const legendY = Math.max(18, (vis.height - legendHeight) / 2);

    const domain = vis.colorScale.domain();
    const isHealthcare = vis.valueKey.includes("Healthcare");
    const formatVal = (v) =>
      isHealthcare ? `${v.toFixed(1)}%` : v.toFixed(1);
    const suffix = isHealthcare ? "of GDP" : "years";

    // Remove existing legend elements
    vis.chart.selectAll(".chloropleth-legend").remove();

    // Create or update gradient (vertical: bottom = min, top = max)
    let defs = vis.svg.select("defs");
    if (defs.empty()) {
      defs = vis.svg.append("defs");
    }
    let gradient = defs.select(`#${vis.gradientId}`);
    if (gradient.empty()) {
      gradient = defs
        .append("linearGradient")
        .attr("id", vis.gradientId)
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");
    }
    gradient
      .selectAll("stop")
      .data([
        { offset: "0%", color: vis.colorScale(domain[0]) },
        { offset: "100%", color: vis.colorScale(domain[1]) },
      ])
      .join("stop")
      .attr("offset", (d) => d.offset)
      .attr("stop-color", (d) => d.color);

    const legendGroup = vis.chart
      .append("g")
      .attr("class", "chloropleth-legend");

    legendGroup
      .append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", `url(#${vis.gradientId})`);

    legendGroup
      .append("text")
      .attr("x", legendX - 4)
      .attr("y", legendY + legendHeight - 6)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 11)
      .attr("fill", "#666")
      .text(formatVal(domain[0]));

    legendGroup
      .append("text")
      .attr("x", legendX - 4)
      .attr("y", legendY + 6)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 11)
      .attr("fill", "#666")
      .text(`${formatVal(domain[1])} ${suffix}`);
  }

  updateHighlightStyles() {
    const vis = this;
    const hasSelection = vis.highlightedCountryKeys.size > 0;
    const isSelected = (d) => {
      const code = vis.rowsByCode[d.id]?.Code;
      return code && vis.highlightedCountryKeys.has(code);
    };
    vis.countriesGroup
      .selectAll(".country")
      .style("opacity", (d) => {
        if (!hasSelection) return 0.9;
        return isSelected(d) ? 0.95 : 0.18;
      })
      .style("stroke", (d) => {
        if (!hasSelection) return "#fff";
        return isSelected(d) ? "#111827" : "#fff";
      })
      .style("stroke-width", (d) => {
        if (!hasSelection) return 0.5;
        return isSelected(d) ? 1.2 : 0.5;
      });
  }
}
