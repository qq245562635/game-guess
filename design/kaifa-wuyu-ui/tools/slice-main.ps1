param([string]$Root = (Resolve-Path "$PSScriptRoot/../../..").Path)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$masterPath=Join-Path $Root 'games/kaifa-wuyu/art/reference/ui-main-v2.png'
$out=Join-Path $Root 'games/kaifa-wuyu/assets/ui'
$preview=Join-Path $Root 'games/kaifa-wuyu/art/previews'
New-Item -ItemType Directory -Force $out,$preview | Out-Null
$master=[Drawing.Bitmap]::new($masterPath)
$records=[Collections.Generic.List[object]]::new()
$cream=[Drawing.ColorTranslator]::FromHtml('#FDEED5')
$teal=[Drawing.ColorTranslator]::FromHtml('#075C63')
function Crop([int]$x,[int]$y,[int]$w,[int]$h) {
  return $master.Clone([Drawing.Rectangle]::new($x,$y,$w,$h),[Drawing.Imaging.PixelFormat]::Format32bppArgb)
}
function Canvas([int]$w,[int]$h) { return [Drawing.Bitmap]::new($w,$h,[Drawing.Imaging.PixelFormat]::Format32bppArgb) }
function Resize($img,[int]$w,[int]$h) {
  $b=Canvas $w $h; $g=[Drawing.Graphics]::FromImage($b)
  $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img,[Drawing.Rectangle]::new(0,0,$w,$h),0,0,$img.Width,$img.Height,[Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); return $b
}
function Mask-Round($b,[double]$r,[bool]$flushLeft=$false) {
  for($y=0;$y -lt $b.Height;$y++){ for($x=0;$x -lt $b.Width;$x++){
    $cx=[Math]::Max($r,[Math]::Min($b.Width-$r-1,$x))
    if($flushLeft -and $x -lt $r){$cx=$x}
    $cy=[Math]::Max($r,[Math]::Min($b.Height-$r-1,$y))
    $d=[Math]::Sqrt(($x-$cx)*($x-$cx)+($y-$cy)*($y-$cy))
    $a=[Math]::Min(1,[Math]::Max(0,$r-$d+0.5))
    if($a -lt 1){$c=$b.GetPixel($x,$y); $b.SetPixel($x,$y,[Drawing.Color]::FromArgb([int]($c.A*$a),$c.R,$c.G,$c.B))}
  }}
}
function Save-Asset([string]$key,$b,[int]$w,[int]$h,$slice,[string]$method,$rect=$null) {
  $scaled=Resize $b ($w*2) ($h*2)
  $scaled.Save((Join-Path $out "$key.png"),[Drawing.Imaging.ImageFormat]::Png)
  $scaled.Dispose(); $b.Dispose()
  $safe=switch($key){
    'ui_topbar_frame' {@(22,24,22,24)}
    'ui_info_frame' {@(24,24,24,24)}
    'ui_bb_btn' {@(16,16,16,16)}
    'ui_bb_btn_down' {@(16,16,16,16)}
    'ui_bb_btn_empty' {@(16,16,16,16)}
    'ui_tab_up' {@(16,22,16,22)}
    'ui_sidetab' {@(18,18,18,0)}
    'ui_sidetab_back' {@(18,18,18,0)}
    default {$slice}
  }
  $records.Add([ordered]@{key=$key;path="assets/ui/$key.png";width=$w;height=$h;pixels=@(($w*2),($h*2));nineSlice=$slice;safeNineSlice=$safe;method=$method;sourceRect=$rect})
}
function Paper([int]$x,[int]$y,[int]$w,[int]$h,[int]$radius,[int]$inset=5) {
  $b=Crop $x $y $w $h
  # Preserve master perimeter; replace ALL glyph/icon content with uniform safe stretch region.
  $g=[Drawing.Graphics]::FromImage($b); $brush=[Drawing.SolidBrush]::new($cream)
  $g.FillRectangle($brush,$inset,$radius,$w-2*$inset,$h-2*$radius)
  $g.FillRectangle($brush,$radius,$inset,$w-2*$radius,$h-2*$inset)
  # Corner interior includes no typography. Keep its original paper texture.
  $brush.Dispose();$g.Dispose();Mask-Round $b $radius; return $b
}
$top=Paper 1 26 868 88 25 5
Save-Asset 'ui_topbar_frame' $top 720 68 @(6,6,6,6) 'master perimeter; text, coin and divider removed from stretch region' @(1,26,868,88)
$panel=Canvas 708 56;$g=[Drawing.Graphics]::FromImage($panel);$g.Clear($cream);$g.Dispose();Mask-Round $panel 8
Save-Asset 'ui_topbar_panel' $panel 708 56 @(8,8,8,8) 'uniform master palette inner layer'
$info=Paper 1 1485 868 136 25 5
# Scroll marks are intentionally a separate layer, including the top/right corner interior.
$g=[Drawing.Graphics]::FromImage($info);$br=[Drawing.SolidBrush]::new($cream);$g.FillRectangle($br,810,7,43,122);$g.Dispose();$br.Dispose()
Save-Asset 'ui_info_frame' $info 720 118 @(6,6,6,6) 'master perimeter; text, divider and scrollbar removed' @(1,1485,868,136)
$panel=Canvas 710 108;$g=[Drawing.Graphics]::FromImage($panel);$g.Clear($cream);$g.Dispose();Mask-Round $panel 6
Save-Asset 'ui_info_panel' $panel 710 108 @(6,6,6,6) 'uniform master palette inner layer'
$button=Paper 20 1650 244 100 18 6
$down=$button.Clone([Drawing.Rectangle]::new(0,0,244,100),[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$empty=Canvas 244 100
for($y=0;$y -lt 100;$y++){for($x=0;$x -lt 244;$x++){
  $c=$button.GetPixel($x,$y)
  $down.SetPixel($x,$y,[Drawing.Color]::FromArgb($c.A,[int]($c.R*.92),[int]($c.G*.92),[int]($c.B*.90)))
  $edge=$x -lt 3 -or $x -gt 240 -or $y -lt 3 -or $y -gt 96
  $ec=if($edge){[Drawing.ColorTranslator]::FromHtml('#16747A')}else{[Drawing.ColorTranslator]::FromHtml('#03505B')}
  $empty.SetPixel($x,$y,[Drawing.Color]::FromArgb($c.A,$ec.R,$ec.G,$ec.B))
}}
Save-Asset 'ui_bb_btn' $button 196 84 @(14,14,14,14) 'master button perimeter; uniform blank center' @(20,1650,244,100)
Save-Asset 'ui_bb_btn_down' $down 196 84 @(14,14,14,14) 'same master silhouette; pressed tonal variant'
Save-Asset 'ui_bb_btn_empty' $empty 196 84 @(14,14,14,14) 'same master silhouette; inset teal state'
$tab=Paper 355 1703 159 55 15 5
Save-Asset 'ui_tab_up' $tab 200 56 @(12,12,12,12) 'master pull tab perimeter; arrow separated' @(355,1703,159,55)
function Isolate([int]$x,[int]$y,[int]$w,[int]$h,[string]$kind) {
  $b=Crop $x $y $w $h
  for($iy=0;$iy -lt $h;$iy++){for($ix=0;$ix -lt $w;$ix++){
    $c=$b.GetPixel($ix,$iy)
    $keep=switch($kind){
      'orange' { $c.R -gt 215 -and $c.G -gt 45 -and $c.G -lt 190 -and $c.B -lt 140 }
      'gold' { $c.R -gt 130 -and $c.R-$c.B -gt 60 -and $c.G-$c.B -gt 25 }
      'blue' { $c.B -gt $c.R+20 -and $c.B -gt 130 }
      'white' { $c.R -gt 205 -and $c.G -gt 215 -and $c.B -gt 210 }
      'ink' { $c.R -lt 65 -and $c.G -lt 140 -and $c.B -lt 145 }
    }
    if(!$keep){$b.SetPixel($ix,$iy,[Drawing.Color]::Transparent)}
  }};return $b
}
$arrow=Isolate 408 1715 54 33 'orange';$arrowDown=$arrow.Clone([Drawing.Rectangle]::new(0,0,54,33),[Drawing.Imaging.PixelFormat]::Format32bppArgb);$arrowDown.RotateFlip([Drawing.RotateFlipType]::RotateNoneFlipY)
Save-Asset 'ui_tab_arrow_up' $arrow 44 24 $null 'isolated original orange triangle' @(408,1715,54,33)
Save-Asset 'ui_tab_arrow_down' $arrowDown 44 24 $null 'vertical flip of extracted triangle'
$badge=Crop 32 141 75 73;Mask-Round $badge 18
Save-Asset 'ui_badge_icon' $badge 56 56 $null 'original blue crowd badge, excluding count and sky' @(32,141,75,73)
$coin=Isolate 584 39 66 63 'gold'
Save-Asset 'ui_coin' $coin 48 48 $null 'isolated original coin stack; separate from frame' @(584,39,66,63)
$side=Canvas 64 134;$g=[Drawing.Graphics]::FromImage($side);$g.Clear([Drawing.Color]::FromArgb(235,7,92,99));$g.Dispose();Mask-Round $side 20 $true
$chevron=Isolate 19 1006 24 31 'white'
$g=[Drawing.Graphics]::FromImage($side);$g.DrawImageUnscaled($chevron,19,52);$g.Dispose()
$back=$side.Clone([Drawing.Rectangle]::new(0,0,64,134),[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g=[Drawing.Graphics]::FromImage($back);$g.Clear([Drawing.Color]::FromArgb(235,7,92,99));$chevron.RotateFlip([Drawing.RotateFlipType]::RotateNoneFlipX);$g.DrawImageUnscaled($chevron,19,52);$g.Dispose();Mask-Round $back 20 $true;$chevron.Dispose()
Save-Asset 'ui_sidetab' $side 52 118 @(12,16,12,0) 'master shape and original chevron; remove underlying scene; uniform translucent teal' @(0,954,64,134)
Save-Asset 'ui_sidetab_back' $back 52 118 @(12,16,12,0) 'same left-flush tab with mirrored chevron only'
$divider=Canvas 2 80;$g=[Drawing.Graphics]::FromImage($divider);$g.Clear([Drawing.ColorTranslator]::FromHtml('#C7AA82'));$g.Dispose()
Save-Asset 'ui_info_divider' $divider 2 80 $null 'master sampled tan; uniform stretch-safe divider'
$date=Canvas 8 8;$g=[Drawing.Graphics]::FromImage($date);$g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias;$br=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#043E3D'));$g.FillEllipse($br,1,1,6,6);$br.Dispose();$g.Dispose()
Save-Asset 'ui_date_dot' $date 6 6 $null 'separate blink indicator in master ink color'
$up=Isolate 831 1497 22 18 'ink';$dn=Isolate 831 1591 22 18 'ink'
Save-Asset 'ui_scroll_up' $up 36 24 $null 'original scrollbar up mark' @(831,1497,22,18)
Save-Asset 'ui_scroll_down' $dn 36 24 $null 'original scrollbar down mark' @(831,1591,22,18)
$track=Isolate 833 1517 18 72 'blue'
for($y=0;$y -lt $track.Height;$y++){for($x=0;$x -lt $track.Width;$x++){$c=$track.GetPixel($x,$y);$track.SetPixel($x,$y,[Drawing.Color]::FromArgb($c.A,134,175,201))}}
Save-Asset 'ui_scroll_track' $track 12 60 @(6,0,6,0) 'original blue scroll track' @(833,1517,18,72)
$thumb=Isolate 833 1517 18 37 'blue'
Mask-Round $thumb 8
Save-Asset 'ui_scroll_thumb' $thumb 12 30 @(6,0,6,0) 'original saturated-blue thumb' @(833,1517,18,37)
# Tile only the blank master footer paper; mirror each axis to create matching tile edges.
$tile=Crop 280 1768 48 32;$tileX=$tile.Clone();$tileX.RotateFlip([Drawing.RotateFlipType]::RotateNoneFlipX)
$seamless=Canvas 96 64;$g=[Drawing.Graphics]::FromImage($seamless);$g.DrawImageUnscaled($tile,0,0);$g.DrawImageUnscaled($tileX,48,0);$tile.RotateFlip([Drawing.RotateFlipType]::RotateNoneFlipY);$tileX.RotateFlip([Drawing.RotateFlipType]::RotateNoneFlipY);$g.DrawImageUnscaled($tile,0,32);$g.DrawImageUnscaled($tileX,48,32);$g.Dispose();$tile.Dispose();$tileX.Dispose()
$footer=Canvas 1440 372;$g=[Drawing.Graphics]::FromImage($footer);$texture=[Drawing.TextureBrush]::new($seamless,[Drawing.Drawing2D.WrapMode]::Tile);$g.FillRectangle($texture,0,0,1440,372);$g.Dispose();$texture.Dispose();$seamless.Dispose()
# Already at final pixels; Save-Asset preserves its intended logical size.
Save-Asset 'ui_bottombar_bg' $footer 720 186 $null 'master blank footer paper, mirrored seamless tile; no controls or scene' @(280,1768,48,32)
$manifest=[ordered]@{schema=1;batch='ui-main-v2';scale=2;master='art/reference/ui-main-v2.png';sourceSize=@(870,1808);nineSliceOrder='top,right,bottom,left; logical pixels, multiply by 2 for source PNG';assets=$records;notes=@('Menu/dialog are preview-only pending user approval.','Frame assets are self-contained; optional inner panels belong behind dynamic content.','All labels, money, fan count and date are rendered by code. Coin, divider and date dot are separate.','Uniform centers deliberately remove text and prevent texture distortion.','No office or town pixels are included. Not yet integrated into the game.')}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $out 'metadata.json') -Encoding utf8
@($records | ForEach-Object {$_.key}) | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $out 'index.json') -Encoding utf8
$master.Dispose()
Write-Output "Exported $($records.Count) UI assets to $out"
