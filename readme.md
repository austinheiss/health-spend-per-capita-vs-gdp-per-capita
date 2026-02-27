# Life Expectancy vs Total Health Spend (% of GDP)

An interactive D3.js dashboard for exploring the relationship between healthcare spending (as a share of GDP) and life expectancy, across countries and across time (2000–2022 in the combined dataset).

[View site demo here](https://youtu.be/nUyU-cw2V-Q)

## Motivation

Spending more on healthcare sounds like it should translate into longer lives, but it is not obvious that spending a larger *share of GDP* necessarily correlates with better outcomes. This dashboard lets you explore that tradeoff visually, compare countries, and spot patterns and outliers using multiple coordinated views (scatter plot, histograms, and choropleth maps). A vertical year brush makes it easy to see how the relationship changes over time.

---

## Data

The application combines two datasets from [Our World in Data](https://ourworldindata.org/):

1. **Total Healthcare Expenditure (% of GDP)** — Current health expenditure as a percentage of gross domestic product for countries worldwide.
   - Source: [ourworldindata.org/grapher/total-healthcare-expenditure-gdp](https://ourworldindata.org/grapher/total-healthcare-expenditure-gdp)

2. **Life Expectancy at Birth** — Period life expectancy at birth, sourced from the Human Mortality Database and UN World Population Prospects.
   - Source: [ourworldindata.org/grapher/life-expectancy-hmd-unwpp](https://ourworldindata.org/grapher/life-expectancy-hmd-unwpp?country=FRA~ZAF~NGA~CHN)

Both datasets are stored locally as CSV files under `data/`, along with a `world.geojson` file for country boundaries. During loading, the CSVs are joined by country code (`Code`) and year (`Year`). A third derived metric, **Health spend per life-year** (spend % of GDP divided by life expectancy), is computed at runtime.

---

## Sketches

I didn't use sketches for this project, but the layout was designed with a multiple linked view approach. The primary idea was to place the scatter plot prominently at the top to show the relationship between the two metrics, with histograms and choropleth maps arranged below to show more detail about each metric individually. A vertical year brush sits on the right side as a persistent time control across all views, I liked the vertical orientation of the year brush because it allows for more room to display the years and makes clear that it is a global control. This grid layout ensures all views are visible simultaneously so that cross-view interactions are intuitive.

---

## Visualization Components

The dashboard consists of **five linked views** and a **year brush controller**, arranged in a CSS grid layout.

### Scatter Plot (Top)
The main view. Each dot represents a **country-year** observation within the selected year window. (If you select a single year, that’s effectively one dot per country.) The x-axis and y-axis are controlled by the **Metric A** and **Metric B** dropdowns in the header. Users can:
- **Hover** over any dot to see a tooltip with the country name and exact values.
- **Brush** (click-and-drag) a rectangular region to select countries. Selected countries are highlighted across all other views, while non-selected countries are dimmed.

### Histograms (Middle Row)
Two histograms sit side by side, one for each selected metric (showing the distribution within the selected year window):
- **Left histogram** — distribution of Metric A values (e.g., healthcare expenditure).
- **Right histogram** — distribution of Metric B values (e.g., life expectancy).

Users can **brush** (drag horizontally) across bins to select a range. Countries falling within that range are highlighted across all views. Hovering over a bar shows the bin range and lists the countries within it.

### Choropleth Maps (Bottom Row)
Two world maps colored by each metric’s value using sequential color scales (greens/blues/oranges depending on the selected metric):
- **Left map** — colored by Metric A.
- **Right map** — colored by Metric B.

Each map includes a vertical **color legend** on the left side. When a year *range* is selected, the maps show the **most recent year in that window** for each country. Users can:
- **Hover** over a country to see its name and value in a tooltip.
- **Click** a country to toggle its selection. Selected countries are highlighted across all views, while non-selected countries fade out.

### Year Brush (Right Column)
A vertical slider spanning the full height of the dashboard. It displays a year axis and allows you to **brush** to select a single year or a range of years. The currently selected year(s) are shown as a label above the slider.

### Metric Dropdowns (Header)
Two dropdown selectors labeled **Metric A** and **Metric B** allow users to swap the metrics being visualized. Available metrics are:
- Healthcare expenditure (% of GDP)
- Life expectancy at birth (years)
- Health spend per life-year (derived ratio)

Changing a metric updates the scatter plot axes, the corresponding histogram, and the corresponding choropleth map instantly.

### Cross-View Linking
All views are linked: selecting countries in any view (via brush on the scatter plot, brush on a histogram, or click on a map) highlights those countries across every other view. This coordinated interaction makes it easy to ask questions like *"Which countries spend a lot on healthcare but have low life expectancy?"* and immediately see where those countries are on the map.

---

## Discoveries

### Higher spending does not always mean longer lives
While there is a general positive correlation between healthcare expenditure and life expectancy, the relationship is not linear. Many countries with moderate spending shares reach life expectancies comparable to countries that spend substantially more. The scatter plot makes this easy to spot.

### Regional clustering
Using the choropleth maps and scatter plot reveal strong regional patterns. African countries tend to cluster in the low-spend, low-expectancy region, while Western European nations cluster in the high-spend, high-expectancy region. The United States and Afghanistan stand out as high-expenditure outliers with comparatively lower life expectancy relative to its spending level.

### Historical trends via the year brush
Brushing through years from **2000 to 2022** shows life expectancy rising globally while healthcare spending as a share of GDP generally trends upward. Some countries improve life expectancy without proportional increases in spending.

---

## Process

### Libraries
- **[D3.js v6](https://d3js.org/)** — Used for all data loading (CSV, GeoJSON), scales, axes, binning, brushes, geographic projections (`geoNaturalEarth1`), and DOM bindings. The D3 library is included locally (`js/d3.v6.min.js`).

### Code Structure
The project is a vanilla HTML/CSS/JavaScript application with no build step or framework:

```
├── index.html              # Entry point with the layout and SVG containers
├── css/
│   └── style.css           # All styles: grid layout, tooltips, brush styling
├── js/
│   ├── d3.v6.min.js        # D3.js library (local copy)
│   ├── main.js             # App entry: loads data, wires up views & interactions
│   ├── scatterplot.js      # Scatterplot class with brush selection
│   ├── histogram.js        # Histogram class with brush selection
│   └── chloropleth.js      # Choropleth map class with click selection
├── data/
│   ├── total-healthcare-expenditure-gdp/
│   │   └── total-healthcare-expenditure-gdp.csv           # Healthcare expenditure dataset
│   ├── life-expectancy-hmd-unwpp/
│   │   └── life-expectancy-hmd-unwpp.csv                  # Life expectancy dataset
│   └── world.geojson       # Country boundary geometries
└── README.md
```

Each visualization is implemented as a self-contained ES module class (`Scatterplot`, `Histogram`, `Chloropleth`) with a consistent API: `setYearRange()`, `setHighlightedCountries()`, `setMetric()`/`setMetrics()`, and `resize()`. The `main.js` file orchestrates data loading, metric configuration, resize handling, and cross-view linking.

### Running the Application
Since ES modules require a server to load, open the project with any local HTTP server:

```bash
# Using Python
python3 -m http.server 3000

# Using Node.js
npx serve .
```

Then open `http://localhost:3000` (or the appropriate port) in your browser.

### Code Repository
The source code is hosted on GitHub: [austinheiss/health-spend-per-capita-vs-gdp-per-capita](https://github.com/austinheiss/health-spend-per-capita-vs-gdp-per-capita)

---

## Challenges & Future Work

### Challenges
- **Coordinated brushing across views** was the most complex part of the project. Ensuring that selections propagate correctly between the scatter plot, histograms, and maps without creating infinite update loops needed careful management of brush events.
- **Responsive resizing** with D3 required implementing `ResizeObserver` callbacks for every chart and recalculating scales, projections, and brush extents on each resize event.
- **Data joining** between two separate datasets by country code and year required filtering out aggregate/region codes (prefixed with `OWID_`) to avoid false data points.

### Future Work
- **Per-capita spend view**: Adding GDP per capita or total health spend per capita (in dollars) as an additional metric would provide a more nuanced picture than percentage of GDP alone.
- **Country search / highlight**: A text search input that lets users quickly find and highlight specific countries across all views.
- **Animated time playback**: An auto-play button on the year brush that animates through years, showing how the global landscape shifts over time.

---

## AI Use
I used AI tools to help prototype quick ideas for the layout and design of the visualization. It was also helpful for debugging issues during development, generating code snippets, and formatting this readme into proper markdown, improving write-up structure, and creating the ASCII file structure.
