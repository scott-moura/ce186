"""Validation and source-reconciliation tests; no spreadsheet is modified."""
from pathlib import Path
from unittest.mock import patch
import importlib.util
import json
import unittest

SPEC = importlib.util.spec_from_file_location('build_catalog', Path(__file__).with_name('build-catalog.py'))
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)

def column(index):
    result = ''
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result

class CatalogValidation(unittest.TestCase):
    def load_item(self, changes=None, duplicate=False, legacy=False):
        headings = [h for h in catalog.HEADERS if not legacy or h not in catalog.OPTIONAL_HEADERS]
        row = dict(ID='test-item', Name='Test item', Category='Prototyping', Unit='units', Description='A test material.')
        row['Initial quantity'] = '3'
        row.update(changes or {})
        header = {column(i+1): name for i, name in enumerate(headings)}
        data = {column(i+1): row.get(name, '') for i, name in enumerate(headings)}
        rows = [('5', header), ('6', data)]
        if duplicate:
            rows.append(('7', data.copy()))
        with patch.object(catalog, 'read_rows', return_value=rows):
            return catalog.load_catalog(Path('unused.xlsx'))

    def test_exact_and_zero(self):
        self.assertEqual(self.load_item()[0]['quantity'], 3)
        self.assertEqual(self.load_item({'Initial quantity':'0'})[0]['quantity'], 0)

    def test_unknown_is_not_zero(self):
        item = self.load_item({'Initial quantity':'', 'Quantity label':'Many (uncounted)'})[0]
        self.assertIsNone(item['quantity'])
        self.assertEqual(item['quantity_label'], 'Many (uncounted)')

    def test_missing_or_contradictory_count_rejected(self):
        for changes in ({'Initial quantity':''}, {'Quantity label':'Many'}, {'Initial quantity':'-1'}, {'Initial quantity':'1.5'}, {'Initial quantity':'nan'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.load_item(changes)

    def test_duplicate_id_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate ID'):
            self.load_item(duplicate=True)

    def test_invalid_ids_and_urls_rejected(self):
        for changes in ({'ID':'../bad'}, {'Product URL':'javascript:alert(1)'}, {'Image URL':'images/../../outside.jpg'}, {'Image URL':'//example.com/photo.jpg'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.load_item(changes)

    def test_local_asset_and_missing_file(self):
        self.assertTrue(self.load_item({'Image URL':'images/lab/row-003.webp'})[0]['image_url'])
        with self.assertRaisesRegex(ValueError, 'image file does not exist'):
            self.load_item({'Image URL':'images/lab/nonexistent-test-file.webp'})

    def test_legacy_columns_supported(self):
        self.assertEqual(self.load_item(legacy=True)[0]['quantity'], 3)

class InventoryReconciliation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.items = catalog.load_catalog(catalog.ROOT / 'data/materials-catalog.xlsx')
        cls.by_id = {item['id']:item for item in cls.items}

    def test_all_source_rows_reconciled(self):
        self.assertEqual(len(self.items), 167)
        lab_rows = [int(item['inventory_row']) for item in self.items if item['inventory_row']]
        self.assertEqual(len(lab_rows), 141)
        self.assertEqual(len(set(lab_rows)), 141)
        self.assertEqual(sum(item['collection']=='Lab cache' for item in self.items), 138)
        self.assertEqual(len({item['category'] for item in self.items}), 9)

    def test_combined_quantities(self):
        for key, value in {'ultrasonic':14, 'resistors':24, 'servo':18}.items():
            self.assertEqual(self.by_id[key]['quantity'], value)
        self.assertEqual(self.by_id['resistors']['unit'], 'kits')

    def test_non_exact_counts_and_source_values_preserved(self):
        uncertain = [item for item in self.items if item['quantity_label']]
        self.assertEqual(len(uncertain), 20)
        self.assertTrue(all(item['quantity'] is None for item in uncertain))
        self.assertTrue(all(item['original_inventory_quantity'] for item in uncertain))

    def test_generated_script_matches_workbook(self):
        source = (catalog.ROOT / 'data/catalog.js').read_text()
        exported = json.loads(source[source.index('=')+1:].strip().removesuffix(';'))
        self.assertEqual(exported['items'], self.items)

if __name__ == '__main__':
    unittest.main()
