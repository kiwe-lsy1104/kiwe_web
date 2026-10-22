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
$rows = $sheetXml.worksheet.sheetData.row | Select-Object -First 25

foreach ($r in $rows) {
    $rNum = $r.r
    $vals = @{}
    foreach ($c in $r.c) {
        $colLetter = $c.r -replace '\d+',''
        $val = $c.v
        $type = $c.t
        $text = if ($type -eq 's') { $sst[[int]$val] } else { $val }
        $vals[$colLetter] = $text
    }
    Write-Host ("Row " + $rNum + " | F:" + $vals['F'] + " | G:" + $vals['G'] + " | R:" + $vals['R'] + " | T:" + $vals['T'] + " | V:" + $vals['V'] + " | W:" + $vals['W'] + " | Y:" + $vals['Y'] + " | AH:" + $vals['AH'])
}
