# CE186 Materials Library

A browsing-only catalog for Fall 2026. Each card shows **Initial quantity** and **Remaining unrequested**. Initial quantities are recorded starting stock; remaining quantities subtract linked Moura Lab requests read through a separately authorized Apps Script service. This is not physical inventory or a reservation system. Requests are handled in the Google Sheet provided in Sprint4. There are no prices, reservations, accounts, or return workflows.

The live service is configured in `inventory-config.js` and was verified against all nine team tabs. See [the connection and local-preview instructions](apps-script/README.md). Failed or unconfigured connections show `Unavailable`, not zero. Negative balances remain negative and red; uncounted initial stock shows `Not counted` for remaining quantities. Source spreadsheet files are not changed by the request-count feature. Missing or invalid item links are excluded with a visible review warning, so remaining counts may be too high until those requests are corrected.

## Edit or add materials

1. Open `data/materials-catalog.xlsx` in Excel or another spreadsheet editor. The **Catalog** worksheet is the authoritative data source.
2. Edit the table or append a row directly below it. Give every item a unique, stable ID such as `soil-moisture-sensor`. Do not rename headers. All fields are plain values; no formulas are needed.
3. Fill in the name, category, unit, and description. Enter either an exact whole-number **Initial quantity**, or leave that blank and enter a **Quantity label** such as `Many (uncounted)`, `Few (uncounted)`, or `About 10`. Never replace an unknown count with zero. Add the model, interface, power requirements, wiring notes, links, and photo source when known. Keep unknown details blank rather than guessing. Use HTTPS URLs for external links and photos. A local image may instead use a path such as `images/lab/my-component.webp`.
4. Save and close the workbook, then run from this folder:

   ```sh
   python3 scripts/build-catalog.py
   ```

   Python 3 is required; no additional packages are needed. The script validates IDs, quantities, and URLs before generating `data/catalog.js` and the downloadable `data/materials-catalog.csv`.
5. If you added, removed or changed item IDs, run `node scripts/update-inventory-ids.cjs` and update/redeploy the private Apps Script project's `CatalogIds` file too. See the connection instructions above. Node.js is needed only for this allowlist helper and the JavaScript tests, not for the spreadsheet-to-catalog build.
6. Preview and commit the workbook and both generated files along with any page edits. During a local-only review, leave the changes uncommitted and do not push until publication is approved.

Categories are generated from the spreadsheet. The catalog includes Controllers, Sensors, Actuators, Displays & inputs, Power & cables, Prototyping, Structural & hardware, Enclosures & storage, and Tools. New categories appear automatically. Items appear in spreadsheet order unless the student changes the sort. Quantity sorting puts approximate/uncounted items after exact counts.

`Initial quantity` counts the inventoried unit: resistor kits and harness packs are counted as kits/packs, while loose switches and connector pieces are counted individually. `Pack contents` describes the contents of each kit/pack. Avoid summing these unlike units into a misleading inventory total.

The legacy `Purchase source` field records the purchase-order or lab-inventory reference. The added fields `Collection`, `Storage location`, `Image credit`, `Inventory source URL`, `Inventory row`, and `Original inventory quantity` preserve provenance and the source count. `Quantity label` controls the display of non-exact quantities. These fields are optional for backward compatibility. Storage locations are only populated where explicitly recorded; blank locations are not inherited from neighboring rows. Do not copy pricing or student information into this public catalog.

## October 15, 2026 lab-inventory merge

All 141 material entries in [eCAL Materials Inventory - CE 186 F26](https://docs.google.com/spreadsheets/d/1EAuskHs8YWEsrWqPZJ0_IKjBCN9P_-znKS7qX1TvKnY/edit) were reconciled: 138 new listings and three matched additions, giving 167 catalog listings. Section headings and blank rows are not materials.

The matched totals are 14 ultrasonic sensors (12 + 2), 24 resistor kits (4 + 20), and 18 FS5103B servos (4 + 14). The instructor confirmed that the 20 resistor kits are complete kits and that the 28 switched battery holders should be listed as 9 V despite the photo filename. Different or unverified variants, such as battery-holder styles and Motor Shield revisions, remain separate. Twenty source quantities are approximate or uncounted and retain a text label rather than an invented exact count.

Inventory photographs and primary documentation were used to correct clear mismatches, including the AD8495 analog thermocouple board, ENS160 product reference, NTE6085 rectifier, and photographed 9 V DC adapter. Unpopulated custom PCBs are labeled as bare boards. Unidentified compounds, devices, connectors, or LED types retain explicit verification notes. Conflicting example-product links are omitted rather than presented as exact specifications. The source Google Sheet is unchanged.

## Photos and technical references

Purchased-item photo URLs use DigiKey images where retrieved and manufacturer images otherwise. Lab images supplied through the inventory are stored as optimized WebP assets in `images/lab/`, so students do not need a Drive sign-in to view them. Their source and image type (lab photo versus reference image) are recorded in the workbook. Only images actually referenced by catalog entries are published. Unrelated/misplaced images are not used; missing photos show a labeled fallback. Third-party reference images are not relicensed by this repository's license. Product and documentation links are included where appropriate to the identified item.

Product 1438 is described as Motor Shield v2 in the purchase order; the current manufacturer page calls it v3. The catalog preserves the order's identity and asks students to check the delivered revision and library support.

Purchased quantities were imported from `Microkit-Components-2026-09-23.xlsx`, not from earlier recommendations or supplier stock counts. Lab additions preserve the inventory's counts and the instructor's clarifications. The original purchase workbook, with its prices, is not included in this public site.

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
python3 -m unittest discover -s scripts -p 'test_*.py'
node scripts/update-inventory-ids.cjs --check
node --test scripts/test-availability.cjs
```

The check compares generated data against the current workbook without rewriting anything. The tests cover exact versus uncounted quantities, IDs, URLs, local assets, and inventory reconciliation. Verify search, category filtering, sorting, and keyboard opening/closing of item details when changing the page.
