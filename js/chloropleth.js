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
    this.valueKey = "Healthcare expenditure (% of GDP)";

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
            ? `<strong>${row.Entity}</strong><br>Healthcare expenditure: ${value.toFixed(2)}% of GDP`
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

    // Add legend
    if (!vis.legendAdded) {
      const legendWidth = 200;
      const legendHeight = 12;
      const legendX = vis.width - legendWidth - 10;
      const legendY = vis.height - 30;

      const defs = vis.svg.append("defs");
      const linearGradient = defs
        .append("linearGradient")
        .attr("id", "chloropleth-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

      const domain = vis.colorScale.domain();
      linearGradient
        .selectAll("stop")
        .data([
          { offset: "0%", color: vis.colorScale(domain[0]) },
          { offset: "100%", color: vis.colorScale(domain[1]) },
        ])
        .enter()
        .append("stop")
        .attr("offset", (d) => d.offset)
        .attr("stop-color", (d) => d.color);

      vis.chart
        .append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#chloropleth-gradient)");

      vis.chart
        .append("text")
        .attr("x", legendX)
        .attr("y", legendY - 4)
        .attr("font-size", 11)
        .attr("fill", "#666")
        .text(`${domain[0].toFixed(1)}%`); // min value

      vis.chart
        .append("text")
        .attr("x", legendX + legendWidth)
        .attr("y", legendY - 4)
        .attr("text-anchor", "end")
        .attr("font-size", 11)
        .attr("fill", "#666")
        .text(`${domain[1].toFixed(1)}% of GDP`); // max value

      vis.legendAdded = true;
    }
  }
}
