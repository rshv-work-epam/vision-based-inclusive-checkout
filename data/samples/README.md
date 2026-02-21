# Samples

- catalog.csv: minimal SKU dataset for local demos (`sku,name,price_cents`)
- images/<sku>/: reference images per SKU used by the inference matcher

Current sample size:

- 103 SKUs total
- Base SKUs: `1001..1003`
- Auto-added SKUs: `2001..2100` (100 products)

Data source for auto-added products:

- `data/external/GroceryStoreDataset/dataset/classes.csv`
- Reference photos copied from `dataset/train|val|test` + iconic image where available
