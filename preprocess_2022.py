import csv
import os

YEAR = "2022"
LIFE_COL = "Life expectancy at birth, totals, period"
HEALTH_COL = "Current health expenditure (CHE) as percentage of gross domestic product (GDP) (%)"

root = os.path.dirname(os.path.abspath(__file__))
life_csv = os.path.join(root, "data", "life-expectancy-hmd-unwpp", "life-expectancy-hmd-unwpp.csv")
health_csv = os.path.join(root, "data", "total-healthcare-expenditure-gdp", "total-healthcare-expenditure-gdp.csv")
output_csv = os.path.join(root, "combined_2022.csv")

life_by_code = {}
with open(life_csv, "r", encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        if row["Year"] == YEAR and row["Code"]:
            life_by_code[row["Code"]] = row

rows = []
with open(health_csv, "r", encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        code = row["Code"]
        if row["Year"] != YEAR or not code or code not in life_by_code:
            continue
        life_row = life_by_code[code]
        rows.append(
            {
                "Entity": life_row["Entity"] or row["Entity"],
                "Code": code,
                "Year": YEAR,
                "Life expectancy at birth (years)": life_row[LIFE_COL],
                "Healthcare expenditure (% of GDP)": row[HEALTH_COL],
            }
        )

rows.sort(key=lambda r: r["Entity"])

with open(output_csv, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["Entity", "Code", "Year", "Life expectancy at birth (years)", r"Healthcare expenditure (% of GDP)"])
    writer.writeheader()
    writer.writerows(rows)

print(f"Wrote {len(rows)} rows to {output_csv}")
