$baseDir = "c:\Users\AKIHIRO\.gemini\antigravity\playground\solar-aldrin"
$mdFiles = Get-ChildItem -Path $baseDir -Include *.md -Recurse

# 置換マッピング
$replacements = @{
    # ディレクトリ
    "docs/30_design" = "docs/10_design"
    "docs\\30_design" = "docs\10_design"
    "docs/20_reviews" = "docs/30_reviews"
    "docs\\20_reviews" = "docs\30_reviews"
    "docs/10_manuals" = "docs/20_manuals"
    "docs\\10_manuals" = "docs\20_manuals"
    "../30_design/" = "../10_design/"
    "../20_reviews/" = "../30_reviews/"
    "../10_manuals/" = "../20_manuals/"

    # ファイル名 (Planning)
    "01_品質改善提案_Quality_Improvement.md" = "01_Quality_Improvement.md"
    "02_機能拡張一覧_Phase2x.md" = "02_Feature_Expansion_Phase2x.md"
    "03_Phase2ロードマップ_Phase2_Roadmap.md" = "03_Phase2_Roadmap.md"
    "04_要件定義書_REQUIREMENTS.md" = "04_Requirements.md"
    "05_技術仕様書_Technical_Spec.md" = "05_Technical_Spec.md"
    "06_システム設計書_System_Design.md" = "06_System_Design.md"

    # ファイル名 (Design)
    "01_システムアーキテクチャ_System_Architecture.md" = "01_System_Architecture.md"
    "02_機能設計_Phase2_Detail.md" = "02_Feature_Design_Phase2.md"
    "03_API設計_API_Design.md" = "03_API_Design.md"
    "04_データモデル設計_Data_Model.md" = "04_Data_Model_Design.md"
    "05_対話UX設計_Conversation_UX.md" = "05_Conversation_UX_Design.md"
    "06_非機能設計_Non_Functional.md" = "06_Non_Functional_Design.md"
}

foreach ($file in $mdFiles) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $newContent = $content
        $modified = $false

        foreach ($key in $replacements.Keys) {
            if ($newContent -match [regex]::Escape($key)) {
                $newContent = $newContent -replace [regex]::Escape($key), $replacements[$key]
                $modified = $true
            }
        }

        if ($modified) {
            Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
            Write-Host "Updated: $($file.Name)"
        }
    } catch {
        Write-Host "Error processing $($file.FullName): $_"
    }
}

Write-Host "Link replacement completed."
