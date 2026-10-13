# 1024x1024 iOS uygulama simgesi üretir (saydamlık yok): resources/icon.png
# Altın saatte kanyon, ortada parlayan mavi kalkan ve "CS" yazısı.
Add-Type -AssemblyName System.Drawing
$S = 1024
$out = Join-Path $PSScriptRoot "..\resources\icon.png"
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null

$bmp = New-Object System.Drawing.Bitmap $S, $S, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

# gökyüzü: altın saat geçişi
$sky = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 0, $S), ([System.Drawing.Color]::FromArgb(255, 196, 110)), ([System.Drawing.Color]::FromArgb(214, 96, 52))
$g.FillRectangle($sky, 0, 0, $S, $S)

# kum zemin
$sand = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(236, 176, 112))
$g.FillRectangle($sand, 0, 700, $S, 324)

# kanyon duvarları (katmanlı)
function Cliff($pts, $r, $gr, $b) {
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($r, $gr, $b))
  $g.FillPolygon($brush, [System.Drawing.Point[]]$pts)
}
Cliff @((New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 300, 0), (New-Object System.Drawing.Point 250, 300), (New-Object System.Drawing.Point 330, 560), (New-Object System.Drawing.Point 250, 820), (New-Object System.Drawing.Point 0, 1024)) 150 64 34
Cliff @((New-Object System.Drawing.Point 0, 120), (New-Object System.Drawing.Point 190, 160), (New-Object System.Drawing.Point 230, 420), (New-Object System.Drawing.Point 170, 700), (New-Object System.Drawing.Point 0, 760)) 190 92 46
Cliff @((New-Object System.Drawing.Point 1024, 0), (New-Object System.Drawing.Point 724, 0), (New-Object System.Drawing.Point 774, 300), (New-Object System.Drawing.Point 694, 560), (New-Object System.Drawing.Point 774, 820), (New-Object System.Drawing.Point 1024, 1024)) 150 64 34
Cliff @((New-Object System.Drawing.Point 1024, 120), (New-Object System.Drawing.Point 834, 160), (New-Object System.Drawing.Point 794, 420), (New-Object System.Drawing.Point 854, 700), (New-Object System.Drawing.Point 1024, 760)) 190 92 46

# lazer ışınları
$laser = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 140, 235, 255)), 14
$laser.StartCap = 'Round'; $laser.EndCap = 'Round'
foreach ($x in @(400, 470, 554, 624)) { $g.DrawLine($laser, $x, 120, $x + ($x - 512) * 0.15, 300) }

# kalkan: parlak mavi daire
$cx = 512; $cy = 600; $R = 250
$glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 120, 220, 255))
$g.FillEllipse($glow, $cx - $R - 40, $cy - $R - 40, ($R + 40) * 2, ($R + 40) * 2)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse($cx - $R, $cy - $R, $R * 2, $R * 2)
$pg = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
$pg.CenterPoint = New-Object System.Drawing.PointF ($cx - 60), ($cy - 80)
$pg.CenterColor = [System.Drawing.Color]::FromArgb(110, 225, 255)
$pg.SurroundColors = @([System.Drawing.Color]::FromArgb(22, 110, 210))
$g.FillPath($pg, $path)
$ring = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 22
$g.DrawEllipse($ring, $cx - $R, $cy - $R, $R * 2, $R * 2)

# "CS" yazısı (gölgeli)
$font = New-Object System.Drawing.Font ("Arial Black", 210, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
$shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(13, 70, 140))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$g.DrawString("CS", $font, $shadow, (New-Object System.Drawing.RectangleF ($cx - 300), ($cy - 190), 600, 400), $fmt)
$g.DrawString("CS", $font, $white, (New-Object System.Drawing.RectangleF ($cx - 300), ($cy - 205), 600, 400), $fmt)

$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "Yazildi: $out"
