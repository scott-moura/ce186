#!/usr/bin/env python3
"""Build browser data from the editable Catalog worksheet. Python standard library only."""
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import argparse
import csv
import io
import json
import re

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
HEADERS = {
    'ID': 'id', 'Name': 'name', 'Category': 'category', 'Initial quantity': 'quantity',
    'Unit': 'unit', 'Pack contents': 'pack_contents', 'Model': 'model',
    'Description': 'description', 'Interface': 'interface', 'Power': 'power',
    'Notes': 'notes', 'Product URL': 'product_url', 'Guide URL': 'guide_url',
    'Image URL': 'image_url', 'Image source URL': 'image_source_url',
    'Purchase source': 'purchase_source', 'Keywords': 'keywords',
}

def read_rows(path):
    with ZipFile(path) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            shared = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        sheet = next((n for n in workbook.findall('s:sheets/s:sheet', NS) if n.get('name') == 'Catalog'), None)
        if sheet is None:
            raise ValueError('The workbook needs a worksheet named Catalog.')
        rid = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = next(n.get('Target') for n in rels if n.get('Id') == rid)
        sheet_path = str(PurePosixPath(target.lstrip('/'))) if target.startswith('/') else str(PurePosixPath('xl') / target)
        root = ET.fromstring(z.read(sheet_path))
        rows = []
        for row in root.findall('s:sheetData/s:row', NS):
            cells = {}
            for cell in row.findall('s:c', NS):
                column = re.match(r'[A-Z]+', cell.get('r')).group(0)
                if cell.find('s:f', NS) is not None:
                    raise ValueError(f'Use plain values rather than formulas in Catalog!{cell.get("r")}.')
                value = cell.findtext('s:v', default='', namespaces=NS)
                if cell.get('t') == 's':
                    value = shared[int(value)] if value else ''
                elif cell.get('t') == 'inlineStr':
                    inline = cell.find('s:is', NS)
                    value = ''.join(inline.itertext()) if inline is not None else ''
                cells[column] = value.strip()
            rows.append((row.get('r'), cells))
        return rows

def load_catalog(path):
    rows = read_rows(path)
    header_index = next((i for i, (_, row) in enumerate(rows) if 'ID' in row.values() and 'Initial quantity' in row.values()), None)
    if header_index is None:
        raise ValueError('Cannot find the Catalog header row.')
    columns = {heading: col for col, heading in rows[header_index][1].items() if heading in HEADERS}
    missing = set(HEADERS) - set(columns)
    if missing:
        raise ValueError(f'Missing columns: {", ".join(sorted(missing))}')
    items, seen = [], set()
    for number, row in rows[header_index + 1:]:
        item = {field: row.get(columns[heading], '') for heading, field in HEADERS.items()}
        if not any(item.values()):
            continue
        for field in ('id', 'name', 'category', 'quantity', 'unit', 'description'):
            if not item[field]:
                raise ValueError(f'Row {number}: {field} is required.')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', item['id']):
            raise ValueError(f'Row {number}: ID must be lowercase letters, numbers, and hyphens.')
        if item['id'] in seen:
            raise ValueError(f'Row {number}: duplicate ID {item["id"]}.')
        seen.add(item['id'])
        quantity = float(item['quantity'])
        if not quantity.is_integer() or not 0 <= quantity <= 100000:
            raise ValueError(f'Row {number}: initial quantity must be a whole number from 0 to 100000.')
        item['quantity'] = int(quantity)
        for field in ('product_url', 'guide_url', 'image_url', 'image_source_url'):
            url = item[field]
            if url and (urlparse(url).scheme != 'https' or not urlparse(url).netloc):
                raise ValueError(f'Row {number}: {field} must be an HTTPS URL or blank.')
        items.append(item)
    if not items:
        raise ValueError('The catalog contains no items.')
    return items

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'data/materials-catalog.xlsx')
    parser.add_argument('--check', action='store_true', help='Check that generated files match the spreadsheet without changing files.')
    args = parser.parse_args()
    items = load_catalog(args.source)
    data = {'title': 'CE186 Materials Library', 'semester': 'Fall 2026', 'items': items}
    script = '// Generated from materials-catalog.xlsx by scripts/build-catalog.py.\nwindow.CE186_CATALOG = ' + json.dumps(data, ensure_ascii=True, indent=2) + ';\n'
    buffer = io.StringIO(newline='')
    writer = csv.writer(buffer, lineterminator='\n')
    writer.writerow(HEADERS)
    writer.writerows([[item[field] for field in HEADERS.values()] for item in items])
    outputs = {ROOT / 'data/catalog.js': script, ROOT / 'data/materials-catalog.csv': buffer.getvalue()}
    for path, content in outputs.items():
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8') != content:
                raise ValueError(f'{path.name} is stale. Run python3 scripts/build-catalog.py.')
        else:
            path.write_text(content, encoding='utf-8')
    print(f'{"Checked" if args.check else "Built"} {len(items)} catalog items across {len(set(i["category"] for i in items))} categories.')

if __name__ == '__main__':
    main()
