$baseDir = "c:\Users\AKIHIRO\.gemini\antigravity\playground\solar-aldrin\apps\v2-modern\docs"

# 1. ディレクトリ構造の変更 (番号の付け替え)
# 注意: 移動先に同名ディレクトリがあるとエラーになるため、一時名を経由するか慎重に操作
# 30_design -> 10_design
if (Test-Path "$baseDir\30_design") {
    Move-Item "$baseDir\30_design" "$baseDir\10_design" -Force
}
# 10_manuals -> 20_manuals
if (Test-Path "$baseDir\10_manuals") {
    Move-Item "$baseDir\10_manuals" "$baseDir\20_manuals" -Force
}
# 20_reviews -> 30_reviews
if (Test-Path "$baseDir\20_reviews") {
    Move-Item "$baseDir\20_reviews" "$baseDir\30_reviews" -Force
}

# 2. ファイル名のリネーム (Planning)
$planningDir = "$baseDir\00_planning"
$planningRenames = @{
    "01_品質改善提案_Quality_Improvement.md" = "01_Quality_Improvement.md"
    "02_機能拡張一覧_Phase2x.md" = "02_Feature_Expansion_Phase2x.md"
    "03_Phase2ロードマップ_Phase2_Roadmap.md" = "03_Phase2_Roadmap.md"
    "04_要件定義書_REQUIREMENTS.md" = "04_Requirements.md"
    "05_技術仕様書_Technical_Spec.md" = "05_Technical_Spec.md"
    "06_システム設計書_System_Design.md" = "06_System_Design.md"
}

foreach ($old in $planningRenames.Keys) {
    if (Test-Path "$planningDir\$old") {
        Rename-Item "$planningDir\$old" $planningRenames[$old]
    }
}

# 3. ファイル名のリネーム (Design - moved to 10_design)
$designDir = "$baseDir\10_design"
$designRenames = @{
    "01_システムアーキテクチャ_System_Architecture.md" = "01_System_Architecture.md"
    "02_機能設計_Phase2_Detail.md" = "02_Feature_Design_Phase2.md"
    "03_API設計_API_Design.md" = "03_API_Design.md"
    "04_データモデル設計_Data_Model.md" = "04_Data_Model_Design.md"
    "05_対話UX設計_Conversation_UX.md" = "05_Conversation_UX_Design.md"
    "06_非機能設計_Non_Functional.md" = "06_Non_Functional_Design.md"
}

foreach ($old in $designRenames.Keys) {
    if (Test-Path "$designDir\$old") {
        Rename-Item "$designDir\$old" $designRenames[$old]
    }
}

Write-Host "Documentation restructuring completed."
