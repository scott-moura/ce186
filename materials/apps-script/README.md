# Connect live request counts

The website remains on GitHub Pages. A separate, read-only Google Apps Script web app reads the private request spreadsheet on each page load and returns aggregate counts directly to the visitor. It does not create a public spreadsheet, edit requests, store snapshots, or publish team/student details. Neither the browser nor GitHub receives Google credentials.

## One-time setup (after reviewing the local preview)

1. Sign into the Google account that can read the request sheet and open [Google Apps Script](https://script.google.com/home). Create a **standalone New project**, not a script bound to the student-editable spreadsheet. Keep this script project private; students must not be able to edit code that executes under your account.
2. Replace the default `Code.gs` contents with [Code.gs](Code.gs) in this folder. Add a script file named `Core` and paste the complete contents of [availability-core.js](../availability-core.js) into it. Add another script file named `CatalogIds` and paste [CatalogIds.gs](CatalogIds.gs) into it.
3. In **Project Settings**, enable **Show appsscript.json manifest file in editor**. Replace its contents with the adjacent `appsscript.json`. Its only OAuth scope is `spreadsheets.readonly`; the implementation has no Sheet write functions, Drive access, or external fetches. The read permission covers spreadsheets accessible to your account, but the endpoint is hard-coded to the one request spreadsheet and accepts no spreadsheet/range selection from visitors.
4. Run `auditRequests` from the editor and authorize the read-only access yourself. Review its execution log for unmatched or invalid requests. The audit prints only tab names, row numbers and reasons inside your private script project. This function is not exposed by the web endpoint. Fix source requests only if desired; nothing in this setup changes the Sheet automatically.
5. Select **Deploy → New deployment → Web app**. Choose **Execute as: Me** and **Who has access: Anyone** (including anonymous visitors). Deploy and copy the URL ending in `/exec`, not the editor-only `/dev` URL. Only aggregate counts are public. If Berkeley's administrator does not permit anonymous web apps, stop here; do not make the request spreadsheet public or substitute a credential in website JavaScript. We will need an approved alternative backend.
6. Paste that `/exec` URL into `endpoint` in `materials/inventory-config.js`. This URL is public configuration, not a secret. Leave all credentials out of the repository. Reload the local preview **without** `inventory=demo`. Verify that the timestamp, request totals, review warning (if any), and individual balances look correct before authorizing publication of the website changes.

The owner has completed the one-time deployment and configured the public endpoint in `inventory-config.js`. Anonymous access, aggregate totals against all nine team tabs, and browser loading/refresh were verified before website publication. Deploying or changing a Google web app remains separate from publishing website files; the setup files alone do not deploy anything.

## Counting and matching

- Read tabs matching `Team1`, `Team2`, etc. Ignore `0.Example`, supplier summary tabs, and other summaries to avoid double counting. Team1–Team9 must exist; additional numbered team tabs are included automatically. Update `REQUIRED_TEAM_TABS` if the class's roster changes intentionally.
- Column E is quantity, G is supplier. Validate the `Quantity` and `Supplier` headers. Locate the URL column by its `URL (REQUIRED)` header; this handles Team3's K column as well as J elsewhere. Missing/ambiguous headers or failed Sheet reads fail the entire response, rather than returning partial totals as complete.
- Count all nonzero, nonnegative whole-number quantities whose supplier is `Moura Lab` (case/whitespace normalized). Distribution/received/approval status does not affect the count. Edits or deletions in the Sheet affect the next reading. Two distinct request rows for the same item are additive; they are not deduplicated.
- Match only explicit catalog URLs with a `#item=...` ID on the CE186 catalog's host/path. Search parameters are ignored for matching. Read plain URLs, rich-text hyperlinks and static `HYPERLINK` formulas in the URL column. Do not infer an item from its name, a supplier link, the catalog homepage, or a URL accidentally entered in a different column.
- Missing/invalid links and unknown IDs increase a public **review count**, without publishing the offending rows. The page warns that remaining quantities may be too high. Run the private audit to locate these entries. An invalid quantity on a known item marks that item's remaining count unavailable while keeping valid requests for other items usable.
- Approximate/uncounted initial stock shows `Not counted` as the remaining quantity. Exact stock displays `initial − requested`; negative results remain negative, red, and labeled `Over-requested`. Unrequested is not physical stock on hand and is not a reservation system.

## Transport, privacy and freshness

The public response contains only `version`, `ok`, `read_at`, `requested` (item IDs → totals), `uncertain_ids`, `review_count`, `matched_rows`, and `team_count`. No item descriptions, team/student names, individual row details, prices, source cells, raw URLs, or tokens are returned. Errors return a generic failure, not source content.

The browser requests the exact configured Google `/exec` endpoint using read-only JSONP, Google's documented browser-compatible Content Service method. Callback names are strictly validated; spreadsheet IDs and ranges cannot be supplied by a caller. JSONP executes JavaScript from the endpoint, so keep the script project controlled and only configure your own reviewed deployment. The endpoint is intentionally public and serves only non-sensitive aggregates.

Each page load, refresh-button click, or restoration from the browser back/forward cache makes a new request with a unique cache-busting parameter. The server does not use CacheService or persist results. `read_at` is the completion time of a fresh Sheet read, not the last time a student edited a request. The page does not poll continuously. Google availability/quotas or timeouts may prevent a reading; in that case exact remaining counts show `Unavailable`, never zero or cached balances. Initial quantities and the rest of the catalog remain usable.

The item-ID allowlist in `CatalogIds.gs` must match the published catalog. After adding or changing catalog IDs, run `node scripts/update-inventory-ids.cjs` from `materials/`, update the Apps Script project, and deploy a new version. Unknown IDs are flagged, not silently assigned to a similar component. Changes to Apps Script code require **Deploy → Manage deployments → Edit → New version**; keep the existing deployment URL.

## Local review

From the repository root, run `python3 -m http.server 8767 --bind 127.0.0.1`.

- Normal preview: `http://127.0.0.1:8767/materials/` (live request counts when configured; unavailable state on connection failure).
- Sample preview: `http://127.0.0.1:8767/materials/?inventory=demo#catalog` (invented requests, clearly labeled; Arduino shows −2).

Demo mode is allowed only on loopback hosts, never on the public GitHub Pages host. No real student request rows or snapshots are shipped in the repository.

Run `node --test materials/scripts/test-availability.cjs`, the existing Python catalog tests, and `python3 materials/scripts/build-catalog.py --check`. Browser review should cover both numbers, negative balances, search/filter persistence, details, unknown counts, error/unconfigured states and mobile layout. After any endpoint or deployment change, verify anonymous access, aggregate-only output, and the real cross-origin connection again.

References: [Content Service / JSONP](https://developers.google.com/apps-script/guides/content), [Web apps and deployment permissions](https://developers.google.com/apps-script/guides/web), [Rich-text hyperlinks](https://developers.google.com/apps-script/reference/spreadsheet/range#getRichTextValues()).
