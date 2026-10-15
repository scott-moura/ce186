/** Read-only endpoint. Paste availability-core.js into a second file named Core.gs. */
const REQUEST_SPREADSHEET_ID = '1rc4oldV-4UBVAPdwYUdvE60H9zSEW7yMkq2k_D7CPlY';
const REQUIRED_TEAM_TABS = ['Team1','Team2','Team3','Team4','Team5','Team6','Team7','Team8','Team9'];

function readRequestSheets_() {
  const book = SpreadsheetApp.openById(REQUEST_SPREADSHEET_ID);
  const sheets = book.getSheets().filter(sheet => /^Team\s*[1-9]\d*$/i.test(sheet.getName()));
  const names = sheets.map(sheet => sheet.getName());
  if (REQUIRED_TEAM_TABS.some(name => !names.includes(name))) throw new Error('A required team tab is missing.');
  return sheets.map(sheet => {
    const width = sheet.getLastColumn();
    if (width < 10) throw new Error('Request columns are missing.');
    const header = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(value => value.trim().toLowerCase());
    if (header[4] !== 'quantity' || header[6] !== 'supplier') throw new Error('Quantity or supplier column moved.');
    const urlColumns = header.map((value,index) => /^url(?:\s*\(required\))?$/.test(value) ? index + 1 : 0).filter(Boolean);
    if (urlColumns.length !== 1) throw new Error('URL column is missing or ambiguous.');
    const urlColumn = urlColumns[0], height = sheet.getLastRow() - 1;
    if (height < 1) return {name:sheet.getName(), rows:[]};
    const quantities = sheet.getRange(2,5,height,1).getValues();
    const suppliers = sheet.getRange(2,7,height,1).getDisplayValues();
    const urlRange = sheet.getRange(2,urlColumn,height,1);
    const urls = urlRange.getDisplayValues(), rich = urlRange.getRichTextValues(), formulas = urlRange.getFormulas();
    const rows = quantities.map((values,index) => {
      const cell = rich[index][0];
      let url = cell && cell.getLinkUrl();
      if (!url && cell) {
        const links = [...new Set(cell.getRuns().map(run => run.getLinkUrl()).filter(Boolean))];
        if (links.length === 1) url = links[0];
        else if (links.length > 1) return {row:index+2, quantity:values[0], supplier:suppliers[index][0], url:''};
      }
      if (!url) {
        const formula = /^=HYPERLINK\(\s*"((?:[^"]|"")+)"/i.exec(formulas[index][0]);
        url = formula ? formula[1].replace(/""/g,'"') : urls[index][0];
      }
      return {row:index+2, quantity:values[0], supplier:suppliers[index][0], url};
    });
    return {name:sheet.getName(), rows};
  });
}

function doGet(event) {
  const callback = event && event.parameter && event.parameter.callback;
  if (callback && !/^__ce186Inventory_[a-f0-9]{16}$/.test(callback)) {
    return ContentService.createTextOutput('{"ok":false,"error":"invalid_callback"}').setMimeType(ContentService.MimeType.JSON);
  }
  let output;
  try {
    const result = CE186Availability.aggregate(readRequestSheets_(), CATALOG_IDS);
    // Deliberately exclude private audit issues: no team names, rows, URLs or raw cells.
    output = {version:1, ok:true, read_at:new Date().toISOString(), requested:result.requested,
      uncertain_ids:result.uncertain_ids, review_count:result.review_count,
      matched_rows:result.matched_rows, team_count:result.team_count};
  } catch (error) {
    console.error('Inventory read failed. Check tab names, headers, permissions and quotas.');
    output = {version:1, ok:false, error:'inventory_unavailable'};
  }
  const json = JSON.stringify(output);
  return ContentService.createTextOutput(callback ? callback + '(' + json + ');' : json)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

/** Run manually in the Apps Script editor; never exposed by doGet. */
function auditRequests() {
  const result = CE186Availability.aggregate(readRequestSheets_(), CATALOG_IDS);
  console.log(JSON.stringify(result.issues));
  return result.issues;
}
