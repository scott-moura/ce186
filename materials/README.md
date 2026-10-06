# CE186 Materials Library

A static, browsing-only catalog for Fall 2026. The page lists **initial purchased quantities**, not live availability. Requests are handled in the Google Sheet provided in Sprint4. There are no prices, reservations, accounts, or return workflows.

## Edit or add materials

1. Open `data/materials-catalog.xlsx` in Excel or another spreadsheet editor. The **Catalog** worksheet is the authoritative data source.
2. Edit the table or append a row directly below it. Give every item a unique, stable ID such as `soil-moisture-sensor`. Do not rename headers. All fields are plain values; no formulas are needed.
3. Fill in the name, category, initial quantity, unit, and description. Add the model, interface, power requirements, wiring notes, links, and photo source when known. Keep unknown details blank rather than guessing. Use HTTPS URLs for external links and photos.
4. Save and close the workbook, then run from this folder:

   ```sh
   python3 scripts/build-catalog.py
   ```

   Python 3 is required; no additional packages are needed. The script validates IDs, quantities, and URLs before generating `data/catalog.js` and the downloadable `data/materials-catalog.csv`.
5. Preview and commit the workbook and both generated files along with any page edits.

Categories are generated from the spreadsheet. The starting categories are Controllers, Sensors, Actuators, Displays & inputs, Power & cables, and Prototyping. New categories appear automatically. Items appear in spreadsheet order unless the student changes the sort.

`Initial quantity` counts the purchased unit: resistor kits and harness packs are counted as kits/packs. `Pack contents` describes the contents of each purchased unit. Avoid summing these unlike units into a misleading inventory total.

The `Purchase source` field records the original purchase-order filename, row, and DigiKey part number. For later cache additions, replace it with the relevant inventory reference. Do not copy pricing or student information into this public catalog.

## Photos and technical references

Photo URLs point to the exact purchased product's supplier image, using DigiKey images where retrieved and manufacturer images otherwise. Photos remain hosted by the supplier; no third-party images are relicensed by this repository's license. Each item's details link to the image source and to technical documentation. Suppliers sometimes use representative package photos. If a photo stops loading, the page shows a labeled fallback and keeps the product reference accessible.

Product 1438 is described as Motor Shield v2 in the purchase order; the current manufacturer page calls it v3. The catalog preserves the order's identity and asks students to check the delivered revision and library support.

The quantity values were imported from `Microkit-Components-2026-09-23.xlsx`, not from earlier recommendations or supplier stock counts. The original purchase workbook, with its prices, is not included in this public site.

## Preview

From the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/materials/`. The page also works by opening `materials/index.html` directly, because browser data is loaded as a local script. Photos and optional web fonts require internet access; system fonts and photo fallbacks are provided.

## GitHub Pages

If the repository already publishes from `main` / `(root)`, adding this folder makes the catalog available at `https://scott-moura.github.io/ce186/materials/` on the next deployment. Otherwise, in **Settings → Pages**, select **Deploy from a branch**, then **main** and **/(root)**, and save. The existing root showcase page stays in place. No build workflow, server, custom domain, or paid hosting is needed.

This folder is ready to publish. Creation of the local page does not push changes or enable Pages automatically.

## Verify

```sh
python3 scripts/build-catalog.py --check
```

This checks the generated data against the current workbook without rewriting anything. Verify search, category filtering, sorting, and keyboard opening/closing of item details when changing the page.
