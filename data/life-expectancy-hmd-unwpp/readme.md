# Life expectancy - Data package

This data package contains the data that powers the chart ["Life expectancy"](https://ourworldindata.org/grapher/life-expectancy-hmd-unwpp?v=1&csvType=full&useColumnShortNames=false) on the Our World in Data website. It was downloaded on February 13, 2026.

### Active Filters

A filtered subset of the full data was downloaded. The following filters were applied:

## CSV Structure

The high level structure of the CSV file is that each row is an observation for an entity (usually a country or region) and a timepoint (usually a year).

The first two columns in the CSV file are "Entity" and "Code". "Entity" is the name of the entity (e.g. "United States"). "Code" is the OWID internal entity code that we use if the entity is a country or region. For most countries, this is the same as the [iso alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code of the entity (e.g. "USA") - for non-standard countries like historical countries these are custom codes.

The third column is either "Year" or "Day". If the data is annual, this is "Year" and contains only the year as an integer. If the column is "Day", the column contains a date string in the form "YYYY-MM-DD".

The final column is the data column, which is the time series that powers the chart. If the CSV data is downloaded using the "full data" option, then the column corresponds to the time series below. If the CSV data is downloaded using the "only selected data visible in the chart" option then the data column is transformed depending on the chart type and thus the association with the time series might not be as straightforward.


## Metadata.json structure

The .metadata.json file contains metadata about the data package. The "charts" key contains information to recreate the chart, like the title, subtitle etc.. The "columns" key contains information about each of the columns in the csv, like the unit, timespan covered, citation for the data etc..

## About the data

Our World in Data is almost never the original producer of the data - almost all of the data we use has been compiled by others. If you want to re-use data, it is your responsibility to ensure that you adhere to the sources' license and to credit them correctly. Please note that a single time series may have more than one source - e.g. when we stich together data from different time periods by different producers or when we calculate per capita metrics using population data from a second source.

## Detailed information about the data


## Life expectancy at birth – totals, period tables – HMD
The period life expectancy at birth among totals, in a given year.
Last updated: October 22, 2025  
Next update: October 2026  
Date range: 1751–2023  
Unit: years  


### How to cite this data

#### In-line citation
If you have limited space (e.g. in data visualizations), you can use this abbreviated in-line citation:  
Human Mortality Database (2025); UN, World Population Prospects (2024) – processed by Our World in Data

#### Full citation
Human Mortality Database (2025); UN, World Population Prospects (2024) – processed by Our World in Data. “Life expectancy at birth – HMD – totals, period tables” [dataset]. Human Mortality Database, “Human Mortality Database”; United Nations, “World Population Prospects” [original data].
Source: Human Mortality Database (2025), UN, World Population Prospects (2024) – processed by Our World In Data

### What you should know about this data
* Period life expectancy is a metric that summarizes death rates across all age groups in one particular year.
* For a given year, it represents the average lifespan for a hypothetical group of people, if they experienced the same age-specific death rates throughout their whole lives as the age-specific death rates seen in that particular year.
* Prior to 1950, we use HMD (2025) data. From 1950 onwards, we use UN WPP (2024) data.

### Sources

#### Human Mortality Database
Retrieved on: 2025-10-22  
Retrieved from: https://www.mortality.org/Data/ZippedDataFiles  

#### United Nations – World Population Prospects
Retrieved on: 2024-12-02  
Retrieved from: https://population.un.org/wpp/downloads/  


    