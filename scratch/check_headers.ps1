[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$sharedXml = [xml](Get-Content 'scratch/xlsx_unzip/xl/sharedStrings.xml' -Encoding UTF8)
$sst = @()
foreach ($si in $sharedXml.sst.si) {
    if ($si.t) {
        $sst += $si.t
    } elseif ($si.r) {
        $t = ($si.r | ForEach-Object { $_.t }) -join ''
        $sst += $t
    } else {
        $sst += ""
    }
}

$sheetXml = [xml](Get-Content 'scratch/xlsx_unzip/xl/worksheets/sheet1.xml' -Encoding UTF8)
$row1 = $sheetXml.worksheet.sheetData.row | Where-Object { $_.r -eq '1' }

Write-Host "=== ROW 1 (HEADERS) ==="
foreach ($c in $row1.c) {
    $ref = $c.r
    $val = $c.v
    $type = $c.t
    $text = if ($type -eq 's') { $sst[[int]$val] } else { $val }
    Write-Host "$ref : $text"
}

Write-Host "`n=== ROW 2 (SAMPLE DATA) ==="
$row2 = $sheetXml.worksheet.sheetData.row | Where-Object { $_.r -eq '2' }
foreach ($c in $row2.c) {
    $ref = $c.r
    $val = $c.v
    $type = $c.t
    $text = if ($type -eq 's') { $sst[[int]$val] } else { $val }
    Write-Host "$ref : $text"
}
