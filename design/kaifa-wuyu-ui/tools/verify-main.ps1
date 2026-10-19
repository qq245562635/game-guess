param([string]$Root = (Resolve-Path "$PSScriptRoot/../../..").Path)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$dir=Join-Path $Root 'games/kaifa-wuyu/assets/ui'
$meta=Get-Content (Join-Path $dir 'metadata.json') -Raw | ConvertFrom-Json
$sheet=[Drawing.Bitmap]::new(1440,([int][Math]::Ceiling($meta.assets.Count/3)*190))
$g=[Drawing.Graphics]::FromImage($sheet);$g.Clear([Drawing.ColorTranslator]::FromHtml('#E8E4DB'))
$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font=[Drawing.Font]::new('Segoe UI',13);$label=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#043E3D'))
$checks=[Collections.Generic.List[object]]::new();$i=0
foreach($asset in $meta.assets){
  $b=[Drawing.Bitmap]::new((Join-Path $dir "$($asset.key).png"))
  if($b.Width -ne $asset.width*2 -or $b.Height -ne $asset.height*2){throw "Invalid dimensions: $($asset.key)"}
  if($b.PixelFormat -ne [Drawing.Imaging.PixelFormat]::Format32bppArgb){throw "Invalid alpha format: $($asset.key)"}
  $cx=($i%3)*480;$cy=[Math]::Floor($i/3)*190
  $g.DrawString("$($asset.key)  $($b.Width)x$($b.Height)",$font,$label,($cx+12),($cy+9))
  $g.FillRectangle([Drawing.Brushes]::WhiteSmoke,($cx+12),($cy+40),456,138)
  $s=[Math]::Min(440.0/$b.Width,124.0/$b.Height)
  $dw=[int]($b.Width*$s);$dh=[int]($b.Height*$s)
  $g.DrawImage($b,[Drawing.Rectangle]::new(($cx+20),[int]($cy+46+(124-$dh)/2),$dw,$dh))
  $checks.Add([ordered]@{key=$asset.key;dimensions='pass';rgba='pass';cornerAlpha=$b.GetPixel(0,0).A})
  $b.Dispose();$i++
}
$g.Dispose();$font.Dispose();$label.Dispose()
$sheet.Save((Join-Path $Root 'games/kaifa-wuyu/art/previews/ui-main-v2-contact.png'),[Drawing.Imaging.ImageFormat]::Png);$sheet.Dispose()
[ordered]@{count=$checks.Count;scale=2;checks=$checks;scope='file dimensions/alpha only; contact sheet inspected separately; runtime not integrated'} | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $Root 'design/kaifa-wuyu-ui/validation.json') -Encoding utf8
Write-Output "Passed $($checks.Count) dimensions and RGBA checks."
