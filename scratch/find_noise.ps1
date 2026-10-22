[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$sheetXml = [xml](Get-Content 'scratch/xlsx_unzip/xl/worksheets/sheet1.xml' -Encoding UTF8)
$sharedXml = [xml](Get-Content 'scratch/xlsx_unzip/xl/sharedStrings.xml' -Encoding UTF8)
$sst = @()
foreach ($si in $sharedXml.sst.si) {
    if ($si.t) { $sst += $si.t }
    elseif ($si.r) { $sst += (($si.r | ForEach-Object { $_.t }) -join '') }
    else { $sst += '' }
}

foreach ($r in $sheetXml.worksheet.sheetData.row) {
    $rowCells = @{}
    foreach ($c in $r.c) {
        $colLetter = $c.r -replace '\d+',''
        $val = if ($c.t -eq 's') { $sst[[int]$c.v] } else { $c.v }
        $rowCells[$colLetter] = $val
    }
    if ($rowCells['G'] -like '*소음*' -or $rowCells['AG'] -like '*소음*') {
        Write-Host ("Row " + $r.r + " | G(인자):" + $rowCells['G'] + " | R(위치):" + $rowCells['R'] + " | T(근로자):" + $rowCells['T'] + " | AH(시료번호):" + $rowCells['AH'])
    }
}
