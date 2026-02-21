# Reference Images (Samples)

This folder contains small, demo-friendly reference images used by the inference service.

Structure:

- `images/<sku>/*.jpg` (one or more reference images per SKU)

Current sample mapping:

- `1001` -> Apple (`Granny-Smith*`, `Pink-Lady*`)
- `1002` -> Banana (`Banana*`)
- `1003` -> Milk 1L (`Arla-Standard-Milk*`)
- `2001..2100` -> auto-generated sample SKUs (100 products) from GroceryStoreDataset classes

Image source:

- GroceryStoreDataset by marcusklasson (MIT License)
- Copied from its `sample_images/` folder and a small subset of `dataset/train/...`
- Repo: https://github.com/marcusklasson/GroceryStoreDataset
- License: `LICENSE-GroceryStoreDataset.txt`

Note:

- Auto-generated SKUs use refs from `dataset/train|val|test` plus iconic images.
