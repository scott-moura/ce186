#!/usr/bin/env node
/* Mechanical export of public catalog IDs; never reads the private request Sheet. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(root,'data/catalog.js'),'utf8');
const catalog = JSON.parse(source.slice(source.indexOf('=')+1).trim().replace(/;$/,''));
const ids = catalog.items.map(item => item.id);
if (ids.length !== new Set(ids).size || !ids.every(id => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) throw new Error('Invalid or duplicate catalog IDs.');
const destination = path.join(root,'apps-script/CatalogIds.gs');
const generated = '// Public catalog allowlist. Regenerate when catalog item IDs change, then redeploy.\nconst CATALOG_IDS = ' + JSON.stringify(ids,null,2) + ';\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(destination,'utf8') !== generated) throw new Error('Inventory ID list is stale. Run node scripts/update-inventory-ids.cjs.');
} else {
  fs.writeFileSync(destination,generated);
}
console.log(`Checked ${ids.length} public catalog item IDs${process.argv.includes('--check') ? '' : ' and regenerated the Apps Script allowlist'}.`);
