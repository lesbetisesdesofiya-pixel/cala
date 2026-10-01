# outils/prep-livres.ps1 — Scans d'un livre -> convention ClassiNote.
# Usage :
#   .\outils\prep-livres.ps1 -Source "C:\scans\maths-6eme" -Dossier "6eme/mathematiques-tome1"
#   .\outils\prep-livres.ps1 -Source "C:\scans\maths-6eme" -Dossier "6eme/mathematiques-tome1" -Cover "C:\scans\couv.jpg"
# Résultat : react/public/livres/<Dossier>/cover.jpg + p01.jpg ... pNN.jpg
# (1280px max, JPEG qualité 75). Ensuite : INSERT SQL + git add/commit/push.
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Dossier,
  [string]$Cover = "",
  [int]$Largeur = 1280,
  [int]$Qualite = 75
)
Add-Type -AssemblyName System.Drawing
$root = Join-Path $PSScriptRoot "..\react\public\livres"
$dest = Join-Path $root $Dossier
New-Item -ItemType Directory -Path $dest -Force | Out-Null
$files = Get-ChildItem -LiteralPath $Source -File |
  Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp|bmp|tif|tiff)$' } |
  Sort-Object Name
if (!$files.Count) { throw "Aucune image dans $Source" }
$enc = [System.Drawing.Imaging.Encoder]::Quality
$par = New-Object System.Drawing.Imaging.EncoderParameters(1)
$par.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($enc, [long]$Qualite)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" }

function Save-Jpg($img, $path) {
  $w = $img.Width; $h = $img.Height
  if ($w -gt $Largeur) { $h = [int]($h * $Largeur / $w); $w = $Largeur }
  $out = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $out.Save($path, $codec, $par)
  $out.Dispose()
}

$i = 0
foreach ($f in $files) {
  $i++
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  Save-Jpg $img (Join-Path $dest ("p{0:d2}.jpg" -f $i))
  $img.Dispose()
}
if ($Cover -and (Test-Path -LiteralPath $Cover)) {
  $c = [System.Drawing.Image]::FromFile($Cover)
  Save-Jpg $c (Join-Path $dest "cover.jpg")
  $c.Dispose()
} else {
  Copy-Item -LiteralPath (Join-Path $dest "p01.jpg") -Destination (Join-Path $dest "cover.jpg") -Force
}
$Mo = [math]::Round(((Get-ChildItem $dest | Measure-Object Length -Sum).Sum / 1MB), 1)
"OK : $i pages + cover dans $dest ($Mo Mo)"
"SQL : insert into livres(classe, matiere, titre, dossier, couverture, nb_pages) values ('...', '...', '...', '$($Dossier.Replace('\','/'))', '/livres/$($Dossier.Replace('\','/'))/cover.jpg', $i);"
