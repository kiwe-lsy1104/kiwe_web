$files = Get-ChildItem -Filter *.html -Recurse
foreach ($file in $files) {
    if ($file.Name -like "*alyac*") { continue }
    $content = Get-Content $file.FullName -Raw
    if ($content -match "js/error_translator.js") {
        Write-Host "Skipping $($file.Name): Already exists"
        continue
    }
    # Inject after <head> or at the beginning of <head>
    if ($content -match "<head>") {
        $newContent = $content -replace "<head>", "<head>`n    <script src=`"js/error_translator.js`"></script>"
        Set-Content $file.FullName $newContent -NoNewline
        Write-Host "Updated $($file.Name)"
    }
}
