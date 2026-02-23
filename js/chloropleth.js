export class Chloropleth {
  constructor(config, data) {
    this.config = {
      parentElement: config.parentElement,
      containerWidth: config.containerWidth || 900,
      containerHeight: config.containerHeight || 550,
      margin: config.margin || { top: 20, right: 20, bottom: 20, left: 20 },
      tooltipPadding: config.tooltipPadding || 12,
    };

    this.data = data;
    this.valueKey = config.valueKey || "Healthcare expenditure (% of GDP)";

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

    vis.countriesGroup = vis.chart.append("g"); // layer for country marks

    // load world geometry, then run data processing + render
    d3.json("data/world.geojson").then((world) => {
      vis.worldData = world;
      vis.projection.fitSize([vis.width, vis.height], world);
      vis.updateVis();
    });
  }

  updateVis() {
    const vis = this;

    // keep only rows with country code and selected metric
    vis.cleanData = vis.data.filter(
      (d) => d.Code != null && d[vis.valueKey] != null
    );

    // ISO code -> row lookup
    vis.rowsByCode = Object.fromEntries(vis.cleanData.map((d) => [d.Code, d]));

    // map metric values to color scale
    const values = vis.cleanData.map((d) => d[vis.valueKey]);
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
      .on("mouseover", (event, d) => {
        vis.countriesGroup.selectAll(".country").style("opacity", 0.5);
        d3.select(event.currentTarget)
          .style("opacity", 1)
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
      .on("mouseleave", () => {
        vis.countriesGroup
          .selectAll(".country")
          .style("opacity", 0.9)
          .style("stroke", "#fff")
          .style("stroke-width", 0.5);
        vis.tooltip.style("display", "none");
      });

    countries.exit().remove();

    // Add or update legend
    vis.updateLegend();
  }

  setValueKey(valueKey) {
    this.valueKey = valueKey;
    this.updateVis();
  }

  updateLegend() {
    const vis = this;
    const legendWidth = 200;
    const legendHeight = 12;
    const legendX = vis.width - legendWidth - 10;
    const legendY = vis.height - 30;

    const domain = vis.colorScale.domain();
    const isHealthcare = vis.valueKey.includes("Healthcare");
    const formatVal = (v) =>
      isHealthcare ? `${v.toFixed(1)}%` : v.toFixed(1);
    const suffix = isHealthcare ? "of GDP" : "years";

    // Remove existing legend elements
    vis.chart.selectAll(".chloropleth-legend").remove();

    // Create or update gradient
    let defs = vis.svg.select("defs");
    if (defs.empty()) {
      defs = vis.svg.append("defs");
    }
    let gradient = defs.select("#chloropleth-gradient");
    if (gradient.empty()) {
      gradient = defs
        .append("linearGradient")
        .attr("id", "chloropleth-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
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
      .style("fill", "url(#chloropleth-gradient)");

    legendGroup
      .append("text")
      .attr("x", legendX)
      .attr("y", legendY - 4)
      .attr("font-size", 11)
      .attr("fill", "#666")
      .text(formatVal(domain[0]));

    legendGroup
      .append("text")
      .attr("x", legendX + legendWidth)
      .attr("y", legendY - 4)
      .attr("text-anchor", "end")
      .attr("font-size", 11)
      .attr("fill", "#666")
      .text(`${formatVal(domain[1])} ${suffix}`);
  }
}
