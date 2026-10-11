Add-Type -AssemblyName System.Drawing
$projectRoot = (Resolve-Path '.').Path
$masterIcon = [System.Drawing.Image]::FromFile((Join-Path $projectRoot 'assets/images/app-icon-master.png'))
$wordmarkImage = [System.Drawing.Image]::FromFile((Join-Path $projectRoot 'assets/images/logo.png'))
function Save-BrandBitmap([string]$outputPath, [int]$width, [int]$height, [System.Drawing.Image]$sourceImage, [double]$scale = 1) {
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $ratio = [Math]::Min($width / $sourceImage.Width, $height / $sourceImage.Height) * $scale
    $drawWidth = [int]($sourceImage.Width * $ratio)
    $drawHeight = [int]($sourceImage.Height * $ratio)
    $graphics.DrawImage($sourceImage, [int](($width-$drawWidth)/2), [int](($height-$drawHeight)/2), $drawWidth, $drawHeight)
    $bitmap.Save((Join-Path $projectRoot $outputPath), [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
}
Save-BrandBitmap 'assets/images/icon.png' 512 512 $masterIcon 0.90
Save-BrandBitmap 'assets/images/favicon.png' 192 192 $masterIcon 0.90
Save-BrandBitmap 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png' 1024 1024 $masterIcon 0.90
$sizes = @{ 'mdpi'=48; 'hdpi'=72; 'xhdpi'=96; 'xxhdpi'=144; 'xxxhdpi'=192 }
foreach ($density in $sizes.Keys) {
    $size = $sizes[$density]
    foreach ($name in @('ic_launcher','ic_launcher_round')) { Save-BrandBitmap "android/app/src/main/res/mipmap-$density/$name.png" $size $size $masterIcon 0.90 }
    $foregroundSize = [int]($size * 108 / 48)
    Save-BrandBitmap "android/app/src/main/res/mipmap-$density/ic_launcher_foreground.png" $foregroundSize $foregroundSize $masterIcon 0.78
}
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'android/app/src/main/res') -Filter splash.png -Recurse | ForEach-Object {
    $oldImage = [System.Drawing.Image]::FromFile($_.FullName)
    $splashWidth = $oldImage.Width; $splashHeight = $oldImage.Height
    $oldImage.Dispose()
    $relativePath = $_.FullName.Substring($projectRoot.Length+1)
    Save-BrandBitmap $relativePath $splashWidth $splashHeight $wordmarkImage 0.65
}
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'ios/App/App/Assets.xcassets/Splash.imageset') -Filter '*.png' | ForEach-Object {
    Save-BrandBitmap $_.FullName.Substring($projectRoot.Length+1) 2732 2732 $wordmarkImage 0.65
}
$masterIcon.Dispose(); $wordmarkImage.Dispose()
Write-Output 'Updated web, Android, and iOS branding assets.'
