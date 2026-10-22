# Export validation

All 6 final files decoded successfully as opaque WebP, 1200 x 600 (2:1).
Each file <= 50,000 bytes; combined <= 300,000 bytes.

| id | dimensions | quality | bytes | SHA-256 |
|---|---|---:|---:|---|
| comic_reg_mia | 1200 x 600 | 78 | 48,048 | 8182b918addbcbf45222b0cf581a807ec97af8bc3119df55ea2dee1d6edad194 |
| comic_reg_kai | 1200 x 600 | 75 | 48,374 | c8471d37f3ace5cf254903e32b162aea14f6139564d15a06c22f595c3770483f |
| comic_reg_rose | 1200 x 600 | 80 | 45,598 | 425ab867827b8349925636ace5f651031cdc097bbf8e3c557b02cb28bc3c3fd2 |
| comic_reg_leo | 1200 x 600 | 80 | 49,352 | 454cfdc7c38944837ba168ca9f9a2b3b1909db8a50729760172fda3f9288ae1a |
| comic_reg_marcus | 1200 x 600 | 75 | 48,072 | 4e3b1a230c616ade1052f4efea5f24e73516fef77b46dd87e8e67757720242c9 |
| comic_reg_chloe | 1200 x 600 | 78 | 49,456 | bedacc9f4d138c70690e807264de3f1393c71f42a1f665f7c5d62212938045d7 |

Total: 288,900 bytes. Baseline assets: 3,591,813 bytes; after G: 3,880,713 bytes (< 4,000,000). Review sheets are under art/, outside runtime assets.

Visual review: identity compared against each original avatar; barista compared against comic_01. Text-free props checked; faces, gestures and props remain within side crop safety. Mobile previews use 390 x 195 and rounded corners.

No runtime code, art.json, localization or existing assets changed. No runtime tests run for image-only delivery.
