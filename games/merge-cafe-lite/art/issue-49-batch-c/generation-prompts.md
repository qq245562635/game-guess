# C 批内置 image_gen 提示词

每张资源独立调用 image_gen 生成或编辑；参考 P0 icon_star，以及浓缩杯旧稿、美式和主界面效果图。交付阶段仅裁透明边、等比缩放、按锚点摆放和格式编码；三张绿植做256色RGBA量化后仍保存为32位RGBA PNG。未使用代码绘制美术。

## item_coffee_03

```text
Use case: stylized-concept. Asset type: a single transparent PNG sprite for the Western casual game Merge Café Lite. Reference1 is STYLE ONLY (existing P0 currency icon): match its rounded thick-painted 2D shapes, warm clean color fills, deep brown #3a2416 contour, broad soft volume shading and top-left highlights. Crisp readable small-scale silhouette, simple large shapes, no tiny texture, no photo or 3D render. Genuine transparent background. No text, lettering, watermark, ground, floor ellipse or drop shadow. Subject: ONE tiny white porcelain ESPRESSO DEMITASSE with single small handle on right. Squat low bowl-shaped small cup, visibly shorter and wider than a tall Americano mug; thick cream ceramic lip, simple round foot, NO saucer or spoon. Elevated three-quarter view so the inside is a large visible oval. Coffee surface is covered with DISTINCT GOLDEN-BROWN CREMA, mostly warm caramel tan with a subtle golden spiral, not a black pool; just a few tiny bubbles. Reference2 is old espresso to REPLACE: new silhouette must be much squatter. Reference3 is Americano for comparison: do not copy its tall mug or saucer. Render a clean centered object with surrounding transparent air; final content will be resized to141px wide inside256px canvas (55% width). Broad pale highlights, few contours, no steam. Preserve established P0 warm painted porcelain style.
```

## deco_plant_pot

```text
Use case: precise-object-edit. Production small-sprite simplification for a256x256PNG budget<=50KB. Keep pot, five coral flowers, overall silhouette and saturated greens. SIMPLIFY to only eight broad leaves. Each leaf and petal has a clean uniform flat basecolor, ONE broad painted shadow patch and ONE broad highlight shape, not continuous noisy gradients. Pot a matte terracotta base with one smooth shadow side, one simple rim highlight. Remove all fine color variation, texture, tiny highlights and leaf veins. Still rounded warm thick-painted mobile-game style with darkbrown outercontour, not a flat diagram. Genuine transparent background, no ground, shadows, text, extra props. Do not add any colors or details outside the plant. Keep full silhouette visible and existing camera.
```

## deco_plant_fern

```text
Use case: precise-object-edit. Production small-sprite simplification for a256x256PNG budget<=50KB. Keep central root as lowestpoint and all fronds radiating UPWARD and sideways. Simplify to FIVE broad fronds, each with just FOUR large pairs of leaflets. Leaves should have a clean uniform flat green basecolor plus ONE broad painted darkgreen shadow shape and ONE broad lime highlight; NO continuous gradients, veins, texture or speckles. Strong saturatedgreens and readable simple silhouette, darkbrown outercontour, warm casual rounded painted style. Genuine transparent background, no ground, shadows, text, extra props. Do not add any colors or details outside the plant. Keep full silhouette visible and existing camera.
```

## deco_plant_bush

```text
Use case: precise-object-edit. Production small-sprite simplification for a256x256PNG budget<=50KB. Keep compact round no-pot floweringbush with six ivory/pink flowers, saturated greens and bottomcenterbase. SIMPLIFY foliage into twelve large rounded LEAF MASSES rather than dozens of separate leaves. Each mass uses clean flat green basefill plus ONE broad shadow shape and ONE broad highlight; no continuous gradients, veins or tiny texture. Flowers simple broad fivepetals with smallcenter, no fine details. Warm rounded thick-painted mobile-game style with darkbrown outercontour. Genuine transparent background, no ground, shadows, text, extra props. Do not add any colors or details outside the plant. Keep full silhouette visible and existing camera.
```

## nav_cafe

```text
undefinedSubject: navigation icon, a tiny FRONT-FACING BEACH COFFEE KIOSK. Coral-red and ivory alternating striped awning, just FIVE broad stripes, honeywood rectangular counter with a small teal inset panel, cream sideposts. Compact square silhouette with simple shallow roof, no separate signboard, no text, no table, flowers or scenery. Match existing warm painted currency icon, bold darkbrown outline about5% final96px width, sparse details and broad fills readableat26px. Icon fills about84% canvas, centered. Must stand out on BOTH cream #f6ead3 and coral #ef7965 button backgrounds. Use solid multicolor forms, not white lineart. Strictly transparent outside kiosk, no floor/drop shadow.
```

## nav_merge

```text
undefinedSubject: navigation icon for MERGE: TWO large rounded roast-brown coffee beans tilted inward toward one small GOLDEN FOUR-POINT SPARK in the center. Two beans equally prominent, one left leaning right, one right leaning left, center spark between them; each has ONE simple curved dark seam and broad warm caramel highlight. Compact balanced silhouette, no arrows, plus or letters, no bowl, no spoon, no scene. Same front-ish gently dimensional view as nav_cafe. Bold deepbrown outlines about5% final96pxwidth, broad clear colored forms readableat26px on both cream#f6ead3 andcoral#ef7965. Centered fills84%canvas, no tinybeans/particles.
```

## nav_tasks

```text
Use case: stylized-concept. Asset type: a single transparent PNG sprite for the Western casual game Merge Café Lite. Reference1 is STYLE ONLY (existing P0 currency icon): match its rounded thick-painted 2D shapes, warm clean color fills, deep brown #3a2416 contour, broad soft volume shading and top-left highlights. Crisp readable small-scale silhouette, simple large shapes, no tiny texture, no photo or 3D render. Genuine transparent background. No text, lettering, watermark, ground, floor ellipse or drop shadow. Subject: navigation icon of ONE small honey-brown wooden CLIPBOARD with cream paper inset, rounded thick dark brown contour, a simple bronze topclip. On paper only ONE BIG GREEN CHECKMARK and two short muted brown horizontal lines above it, no words or letters. Broad simple frontview, centered fills84%canvas, polished rounded playful forms in same P0 set. Designed for26pxactualsize: avoid tiny screws/ruledlines, thickclear check, warm solid frame visible on both cream#f6ead3 andcoral#ef7965. No white outline-only treatment.
```

## icon_lock

```text
Use case: stylized-concept. Asset type: a single transparent PNG sprite for the Western casual game Merge Café Lite. Reference1 is STYLE ONLY (existing P0 currency icon): match its rounded thick-painted 2D shapes, warm clean color fills, deep brown #3a2416 contour, broad soft volume shading and top-left highlights. Crisp readable small-scale silhouette, simple large shapes, no tiny texture, no photo or 3D render. Genuine transparent background. No text, lettering, watermark, ground, floor ellipse or drop shadow. Subject: one compact BRASS PADLOCK with round-cornered golden brass body, a rounded inverted-U shackle above it, one obvious DARK BROWN KEYHOLE in front. Mostly front view, single broad upperleft highlight and one shaded rightedge. Body slightly taller thanwide, narrow centered silhouette, fill70%canvaswidth and84%canvasheight. Thick deepbrown #3a2416 outline (about5% of96pixelcanvas), largekeyhole readableat15px. No ornate engraving, keys, labels or additionalparts. Must contrast on beige#e3d2b3 at60%opacity as well as fullopacity.
```

## icon_check

```text
Use case: stylized-concept. Asset type: a single transparent PNG sprite for the Western casual game Merge Café Lite. Reference1 is STYLE ONLY (existing P0 currency icon): match its rounded thick-painted 2D shapes, warm clean color fills, deep brown #3a2416 contour, broad soft volume shading and top-left highlights. Crisp readable small-scale silhouette, simple large shapes, no tiny texture, no photo or 3D render. Genuine transparent background. No text, lettering, watermark, ground, floor ellipse or drop shadow. Subject: one bold WHITE CHECKMARK inside a saturated mediumgreen circular disk #3bb36a. Disk has a clean thick IVORY-WHITE RIM so it separates from colorful item images; very subtle deepgreen shaded loweredge and top-left highlight, slight warm brown outercontour thin enough not to replace white rim. Check thick and simple, two joined straight diagonal strokes with roundedcorners, largeinsidecircle. Full circular badge centered fills84%canvas. Must read instantlyat13px on cream and colorfulfood icons. No star, text, border ornaments, shadow or extra symbols. Keep diskopaquegreen.
```

## icon_clock

```text
Use case: stylized-concept. Asset type: a single transparent PNG sprite for the Western casual game Merge Café Lite. Reference1 is STYLE ONLY (existing P0 currency icon): match its rounded thick-painted 2D shapes, warm clean color fills, deep brown #3a2416 contour, broad soft volume shading and top-left highlights. Crisp readable small-scale silhouette, simple large shapes, no tiny texture, no photo or 3D render. Genuine transparent background. No text, lettering, watermark, ground, floor ellipse or drop shadow. Subject: ONE small ROUND CLOCK, front view, ivory WHITE FACE with thick darkbrown #3a2416 outerring. Just TWO stout darkbrown hands at10:10 and a small central pivot dot. Four short bold ticks at12/3/6/9 ONLY; no numbers, letters, alarms, bells or extra decoration. Calm neutralcream/brown palette, no goldcoloredrim or brightcolors; designed to sit quietly next to countdown text on cream#f6ead3. Centered circlefills84%canvas. Very clear silhouetteat15px, clean mattefills, modestleftlight.
```

## icon_hand

```text
Use case: stylized-concept. Asset type: a single transparent PNG sprite for the Western casual game Merge Café Lite. Reference1 is STYLE ONLY (existing P0 currency icon): match its rounded thick-painted 2D shapes, warm clean color fills, deep brown #3a2416 contour, broad soft volume shading and top-left highlights. Crisp readable small-scale silhouette, simple large shapes, no tiny texture, no photo or 3D render. Genuine transparent background. No text, lettering, watermark, ground, floor ellipse or drop shadow. Subject: ONE tutorial pointer HAND in a white cartoon GLOVE, INDEX FINGER STRAIGHT UP, other three fingers folded into fist, thumb curved around folded fingers. Wrist extends diagonally DOWN AND RIGHT to a simple thick rounded glove cuff. Back of right hand facing viewer; familiar readable pointer shape with natural five-finger anatomy. FINGER TIP target at normalized canvasx40%,y6%; rest of fist spansaboutx30%..80%,y45%..83%, wrist endsnearx85%,y100%. Image is square and can have wristcuff nearbottom edge, large transparent area left. Thick darkbrown #3a2416 contour, warm ivorywhitefill, broad pale beige shading bottomright only, no black/gray glove, no sparkle or targetmarker. No extra fingers, no disconnected handbits, no gestures other than pointing straight upward. Simplify for35px actualdisplay.
```

## bg_wood_tile

```text
Use case: precise-object-edit. Make this existing pale horizontal wood texture into a mathematically repeatable seamless tile. Keep exact pale honey color and very faint grain, no objects, text, knots or vignette. The current texture has seven internal seams and NO seam at the tile boundary, which creates one double-height board every8rows when tiled. Fix ONLY plank periodicity: image needs EIGHT evenly spaced horizontal seams across fullwidth, at normalized y=0%,12.5%,25%,37.5%,50%,62.5%,75%,87.5%. The TOP edge is a narrow HALF-SEAM, bottomedge the otherHALF so top/bottom together form one normal seam. Boardwidthfullcanvas, left andright edge colors/grain join seamlessly. Eight boards of equalheight64px at512final. Flat lowcontrast matte fill#e6c48f, thin seams only slightlydarker#d4af7c; no bevel shading. Make it exactly seamless on all4sides, not a framed panel. Output ONE opaque square tile. Do not render repeatedpreview.
```

## 初始生成与中间编辑（最终编辑稿上下文）

### deco_plant_pot

Use case: stylized-concept. Asset type: a single transparent PNG sprite for the Western casual game Merge Café Lite. Reference1 is STYLE ONLY (existing P0 currency icon): match its rounded thick-painted 2D shapes, warm clean color fills, deep brown #3a2416 contour, broad soft volume shading and top-left highlights. Crisp readable small-scale silhouette, simple large shapes, no tiny texture, no photo or 3D render. Genuine transparent background. No text, lettering, watermark, ground, floor ellipse or drop shadow. Subject: a single terracotta flowerpot with saturated emerald and fresh green broad leaves and five or six coral/pink simple five-petal flowers with warm centers. Match reference2 café mockup's flowerpot at bottom-right, but draw ONLY the isolated pot and plant. Compact lush silhouette with large readable leaf groups, front/threequarter view, warm red-orange tapered terracotta pot with thick rounded rim. NO soil scattered on ground, no shadow. Leaves and flowers occupy upper60%, pot lower40%. Plant centered, pot base flat horizontal and intended to sit within bottom5% of final256square canvas. Keep all leaves inside frame. Simple low-noise painted areas, not hundreds of tiny leaves.

### deco_plant_fern

Use case: precise-object-edit. Keep this isolated fern's warm painted style, saturated greens, brown outline and large pairedleaflets. Change ONLY the lowest fronds: curve the four lower fronds UPWARD so ALL leaf tips finish ABOVE the central root point. Central root/base must be the lowest point in the entire silhouette, at bottomcenter; nothing may droop lower than root. Fronds radiate upward and sideways like a fountain from bottomcenter, broad squatfan silhouette, not an upright branch with dangling bottom fronds. Seven fronds enough. No pot, soil, flowers, ground or shadow. Entire fern visible on genuinely transparent background, all leaf shapesinsidecanvas.

### deco_plant_bush

undefinedSubject: a single compact ROUND FLOWERING BUSH with NO POT. Rich saturated fresh green foliage, broad rounded leaf masses with just a few clearly drawn leaves, six to eight simple ivory and pale pink five-petal flowers distributed around crown. Shape rounded dome slightly wider than tall, gentle asymmetry, leaves gather to bottom center and touch baseline. Entire bush contained with small side margins, intended bottom in final5% of256square canvas. Friendly warm casual-game painted look, low detail so leaves and flowers stay distinct at46px. No pot, rocks, soil, ground, roots or shadow. Transparent background.

### bg_wood_tile

Use case: stylized-concept. Asset type: seamless repeatable LOW-CONTRAST WOOD BACKGROUND TILE for a casual beach café game. Make a square512x512-style image of EXACTLY EIGHT horizontal pale honeywood boards, each height64 in final512tile. Completely flat orthographic face-on texture, no perspective. Main color #e6c48f, narrow subtle seams a little darker #d4af7c, all boards same restrained lightness. VERY FAINT sparse horizontal grain only, broad clean flat surface, no knots, scratches, nails, vertical butt joints or board ends. Absolutely NO directional light, bevelhighlights, border, vignetting, darkedges, shadows, objects, text or glossyspots. It is background behind UI and must not attract attention. FOUR-WAY PERFECTLY SEAMLESS: left/right edge continuations and top/bottom edgecontinuations match, exactly periodictiling. Treat canvas as a torus, long boards continue beyond both sides. The horizontal8-row plank rhythm repeats every512pixels with no doublethick seam at verticalwrap. Smooth clean painted matte wood, extremely subtlegraineasilycompressed. Opaqueimage, fullbleed to all edges. Output only tile, not a mockup, not a3x3 preview.

### deco_plant_fern (initial)

Use case: stylized-concept. Asset type: a single transparent PNG sprite for the Western casual game Merge Café Lite. Reference1 is STYLE ONLY (existing P0 currency icon): match its rounded thick-painted 2D shapes, warm clean color fills, deep brown #3a2416 contour, broad soft volume shading and top-left highlights. Crisp readable small-scale silhouette, simple large shapes, no tiny texture, no photo or 3D render. Genuine transparent background. No text, lettering, watermark, ground, floor ellipse or drop shadow. Subject: a single saturated green FERN CLUMP with NO POT. Seven or nine broad arching fronds spread upward and outward from a tight root point at bottom center; each frond has a few large readable paired leaflets rather than hairlike detail. Attractive asymmetrical fan, emerald and fresh limegreen with deep forest green overlaps, restrained brown outer contours. All fronds visible, centered, broad compact silhouette fitting square canvas. Root/stem base intended to land within final bottom5%. NO pot, soil mound, flowers, ground, shadow or scene. No wispy texture, large simplified leaf shapes readable when whole256pximage shrinks to46px.
