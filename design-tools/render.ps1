param([string]$Deck, [string]$OutDir)
New-Item -ItemType Directory -Force $OutDir | Out-Null
Get-ChildItem $OutDir -Filter *.png | Remove-Item -Force
$app = New-Object -ComObject PowerPoint.Application
$p = $app.Presentations.Open($Deck, $true, $false, $false)
$i = 1
foreach ($s in $p.Slides) {
  $s.Export((Join-Path $OutDir ("slide-{0:D2}.png" -f $i)), "PNG", 1600, 900)
  $i++
}
$p.Close()
$app.Quit()
Get-ChildItem $OutDir -Filter *.png | ForEach-Object { $_.FullName }
