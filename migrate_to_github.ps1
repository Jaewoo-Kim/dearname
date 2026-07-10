# DearName — GitLab → GitHub 마이그레이션 스크립트
# 실행: PowerShell에서 .\migrate_to_github.ps1

Set-Location "C:\dearname"

# 1. GitHub 사용자명 입력
$GH_USER = Read-Host "GitHub 사용자명 입력 (예: crazystudio1)"

# 2. 저장소 이름 (기본값 제안)
$REPO_NAME = Read-Host "저장소 이름 입력 (엔터 = DearName-project)"
if ([string]::IsNullOrWhiteSpace($REPO_NAME)) { $REPO_NAME = "DearName-project" }

# 3. 공개/비공개 선택
$PRIVATE_INPUT = Read-Host "비공개 저장소로 만들까요? (Y/n, 엔터 = Y)"
$IS_PRIVATE = if ($PRIVATE_INPUT -eq "n") { "false" } else { "true" }

# 4. 토큰 입력 (화면에 표시 안 됨)
$TOKEN_SECURE = Read-Host "GitHub Personal Access Token 입력" -AsSecureString
$TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($TOKEN_SECURE)
)

Write-Host ""
Write-Host "▶ GitHub 저장소 생성 중..." -ForegroundColor Cyan

# 5. GitHub API로 저장소 생성
$BODY = @{
    name        = $REPO_NAME
    private     = ($IS_PRIVATE -eq "true")
    description = "한자 작명 서비스 SPA — DearName v2"
    auto_init   = $false
} | ConvertTo-Json

$HEADERS = @{
    Authorization = "token $TOKEN"
    Accept        = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

try {
    $RESPONSE = Invoke-RestMethod -Method POST `
        -Uri "https://api.github.com/user/repos" `
        -Headers $HEADERS `
        -Body $BODY `
        -ContentType "application/json"

    $REPO_URL = $RESPONSE.clone_url
    Write-Host "✅ 저장소 생성 완료: $REPO_URL" -ForegroundColor Green
} catch {
    $ERR = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ 저장소 생성 실패: $($ERR.message)" -ForegroundColor Red
    exit 1
}

# 6. remote 변경 (GitLab → GitHub)
Write-Host "▶ remote 변경 중..." -ForegroundColor Cyan
git remote rename origin gitlab-backup
git remote add origin $REPO_URL

# 인증 포함 URL로 push (토큰 임시 사용)
$AUTH_URL = $REPO_URL -replace "https://", "https://${GH_USER}:${TOKEN}@"

Write-Host "▶ 전체 히스토리 push 중 (커밋 140개)..." -ForegroundColor Cyan
git push $AUTH_URL --all
git push $AUTH_URL --tags

# 7. remote URL을 토큰 없는 깔끔한 URL로 교체
git remote set-url origin $REPO_URL

# 8. GitLab backup remote 제거 여부 확인
Write-Host ""
$REMOVE_GL = Read-Host "GitLab remote(백업)를 제거할까요? (y/N, 엔터 = N)"
if ($REMOVE_GL -eq "y") {
    git remote remove gitlab-backup
    Write-Host "✅ GitLab remote 제거 완료" -ForegroundColor Green
} else {
    Write-Host "ℹ GitLab remote는 'gitlab-backup' 이름으로 유지됩니다." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ 마이그레이션 완료!" -ForegroundColor Green
Write-Host "   GitHub: https://github.com/$GH_USER/$REPO_NAME" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# 토큰 메모리에서 제거
$TOKEN = $null
[System.GC]::Collect()
