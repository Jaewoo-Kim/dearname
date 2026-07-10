# build_admin_ppt.ps1 — DearName 운영 어드민 기획서 PPT 생성 (PowerPoint COM)
$ErrorActionPreference = "Stop"

$OUT = "C:\dearname\DearName_어드민_기획서.pptx"
$PREVIEW = "C:\dearname\_ppt_preview"

# ── 색상 팔레트 (Midnight Executive 변형) ──
$navy  = "1E2761"
$navy2 = "2C3E6B"
$blue  = "3B6FB5"
$ice   = "CADCFC"
$light = "F4F7FB"
$ink   = "1A1A2E"
$gray  = "64748B"
$line  = "CBD5E1"
$green = "2E9E5B"
$amber = "DD9B1F"
$red   = "E53E3E"
$white = "FFFFFF"

# ── 헬퍼 ──
function C($hex){
  $r=[Convert]::ToInt32($hex.Substring(0,2),16)
  $g=[Convert]::ToInt32($hex.Substring(2,2),16)
  $b=[Convert]::ToInt32($hex.Substring(4,2),16)
  return ($r + $g*256 + $b*65536)
}

function Box($s,$x,$y,$w,$h,$fill,$lin,$rounded){
  $t=1; if($rounded){$t=5}
  $sh=$s.Shapes.AddShape($t,[single]$x,[single]$y,[single]$w,[single]$h)
  $sh.Shadow.Visible=0
  if($null -eq $fill){ $sh.Fill.Visible=0 } else { $sh.Fill.Solid(); $sh.Fill.ForeColor.RGB=[int](C $fill) }
  if($null -eq $lin){ $sh.Line.Visible=0 } else { $sh.Line.ForeColor.RGB=[int](C $lin); $sh.Line.Weight=[single]1 }
  if($rounded){ try { $sh.Adjustments.Item(1)=[single]0.06 } catch {} }
  return $sh
}

function Ln($s,$x1,$y1,$x2,$y2){
  $l=$s.Shapes.AddLine([single]$x1,[single]$y1,[single]$x2,[single]$y2)
  $l.Line.ForeColor.RGB=[int](C $line)
  $l.Line.Weight=[single]2
  return $l
}

function Txt($s,$x,$y,$w,$h,$text,$size,$bold,$color,$align,$anchor){
  if($null -eq $align){$align=1}
  if($null -eq $anchor){$anchor=1}
  $tb=$s.Shapes.AddTextbox(1,[single]$x,[single]$y,[single]$w,[single]$h)
  $tf=$tb.TextFrame
  $tf.WordWrap=[int]-1
  $tf.MarginLeft=[single]2;$tf.MarginRight=[single]2;$tf.MarginTop=[single]1;$tf.MarginBottom=[single]1
  $tf.VerticalAnchor=[int]$anchor
  $tr=$tf.TextRange
  $tr.Text=[string]$text
  $tr.Font.Size=[single]$size
  if($bold -ne 0){ $tr.Font.Bold=$true } else { $tr.Font.Bold=$false }
  $tr.Font.Name="맑은 고딕"
  $tr.Font.Color.RGB=[int](C $color)
  $tr.ParagraphFormat.Alignment=[int]$align
  return $tb
}

function NewSlide($bg){
  $s=$pres.Slides.Add($pres.Slides.Count+1,12)
  $s.FollowMasterBackground=0
  $s.Background.Fill.Solid()
  $s.Background.Fill.ForeColor.RGB=[int](C $bg)
  return $s
}

function Header($s,$kicker,$title,$pageno){
  (Box $s 0 0 12 540 $navy $null $false)|Out-Null
  (Txt $s 48 38 760 18 $kicker 12 -1 $blue 1 1)|Out-Null
  (Txt $s 47 56 860 40 $title 29 -1 $ink 1 1)|Out-Null
  (Txt $s 48 516 480 16 "DearName 운영 어드민 기획서" 9 0 $gray 1 1)|Out-Null
  (Txt $s 812 516 100 16 $pageno 9 0 $gray 3 1)|Out-Null
}

function Badge($s,$x,$y,$w,$text,$fill,$tcol){
  $b=Box $s $x $y $w 16 $fill $null $true
  try{$b.Adjustments.Item(1)=0.5}catch{}
  (Txt $s $x ($y-1) $w 18 $text 8 -1 $tcol 2 3)|Out-Null
}

function Chrome($s,$x,$y,$w,$h,$active){
  (Box $s $x $y $w $h $white $line $true)|Out-Null
  (Box $s $x $y $w 24 "E9EDF3" $null $false)|Out-Null
  (Box $s ($x+12) ($y+8) 8 8 "E06C75" $null $false)|Out-Null
  (Box $s ($x+26) ($y+8) 8 8 "E5C07B" $null $false)|Out-Null
  (Box $s ($x+40) ($y+8) 8 8 "98C379" $null $false)|Out-Null
  (Txt $s ($x+62) ($y+3) ($w-80) 18 "dearname-admin.vercel.app" 8 0 "64748B" 1 3)|Out-Null
  $sbW=130
  (Box $s $x ($y+24) $sbW ($h-24) $navy $null $false)|Out-Null
  (Txt $s ($x+14) ($y+32) ($sbW-18) 18 "DearName" 11 -1 $white 1 1)|Out-Null
  (Txt $s ($x+14) ($y+49) ($sbW-18) 12 "ADMIN" 8 -1 $ice 1 1)|Out-Null
  $items=@("대시보드","주문·결제","보고서","회원","설정")
  $iy=$y+72
  for($i=0;$i -lt 5;$i++){
    $label=$items[$i]
    if($label -eq $active){
      (Box $s ($x+8) $iy ($sbW-16) 25 $blue $null $true)|Out-Null
      (Txt $s ($x+18) ($iy) ($sbW-28) 22 $label 10 -1 $white 1 3)|Out-Null
    } else {
      $col=$ice; if($label -eq "설정"){$col="6B79A8"}
      (Txt $s ($x+18) ($iy) ($sbW-28) 22 $label 10 0 $col 1 3)|Out-Null
    }
    $iy+=30
  }
  return @{cx=($x+$sbW+16);cy=($y+34);cw=($w-$sbW-32);ch=($h-44)}
}

function Spec($s,$x,$y,$w,$label,$text){
  (Txt $s $x $y $w 16 $label 11 -1 $blue 1 1)|Out-Null
  (Txt $s $x ($y+17) $w 64 $text 10.5 0 "334155" 1 1)|Out-Null
}

# ── PowerPoint 시작 ──
$ppt=New-Object -ComObject PowerPoint.Application
$ppt.Visible=1
$pres=$ppt.Presentations.Add()
$pres.PageSetup.SlideWidth=[single]960
$pres.PageSetup.SlideHeight=[single]540

# ════════ 슬라이드 1 — 표지 ════════
$s=NewSlide $navy
(Box $s 640 -120 360 360 $navy2 $null $false)|Out-Null
(Box $s 760 300 320 320 $navy2 $null $false)|Out-Null
(Box $s 0 0 8 540 $blue $null $false)|Out-Null
(Txt $s 70 120 760 22 "PRODUCT REQUIREMENTS  ·  기능 & UI/UX" 13 -1 $ice 1 1)|Out-Null
(Txt $s 68 150 820 60 "DearName 운영 어드민" 40 -1 $white 1 1)|Out-Null
(Txt $s 68 212 820 48 "기획서" 40 -1 $white 1 1)|Out-Null
(Box $s 72 290 120 4 $blue $null $false)|Out-Null
(Txt $s 70 312 820 24 "주문·결제   ·   매출 통계   ·   보고서 재발급   ·   회원 관리   ·   통합 상세(360°)" 13.5 0 $ice 1 1)|Out-Null
(Txt $s 70 430 800 90 "프로젝트: DearName (한자 작명 서비스)`n문서 버전: v1.1 — 회원 관리 탭 + 통합 상세(360°) 보강    ·    작성일: 2026-06-06`n운영사: Crazystudio Co." 11 0 "9AAED6" 1 1)|Out-Null

# ════════ 슬라이드 2 — 목차 ════════
$s=NewSlide $light
Header $s "AGENDA" "목차" "02"
$agenda=@(
  @("01","배경 & 문제 정의","왜 어드민이 필요한가"),
  @("02","목표 & 범위","1차 In/Out of Scope"),
  @("03","정보 구조","메뉴 트리"),
  @("04","기능 요구사항","F-01 ~ F-14"),
  @("05","화면 설계 (UI/UX)","로그인·대시보드·주문·통합상세·보고서·회원"),
  @("06","데이터 & 보안","데이터 상세 · 개인정보 · 환불 기술"),
  @("07","출시 로드맵","Phase 0~3 · 개발 구현 순서"),
  @("08","다음 단계","바로 할 일")
)
$ax=48; $ay=120; $cw=430; $ch=88
for($i=0;$i -lt 8;$i++){
  $col=$i % 2; $row=[math]::Floor($i/2)
  $x=$ax + $col*($cw+16); $y=$ay + $row*($ch+8)
  (Box $s $x $y $cw $ch $white $line $true)|Out-Null
  (Box $s $x $y 6 $ch $blue $null $false)|Out-Null
  (Box $s ($x+20) ($y+24) 40 40 $navy $null $true)|Out-Null
  (Txt $s ($x+20) ($y+24) 40 40 $agenda[$i][0] 15 -1 $white 2 3)|Out-Null
  (Txt $s ($x+76) ($y+20) ($cw-90) 24 $agenda[$i][1] 15 -1 $ink 1 1)|Out-Null
  (Txt $s ($x+76) ($y+46) ($cw-90) 20 $agenda[$i][2] 10.5 0 $gray 1 1)|Out-Null
}

# ════════ 슬라이드 3 — 배경 & 문제 ════════
$s=NewSlide $light
Header $s "01 · 배경 & 문제 정의" "왜 어드민이 필요한가" "03"
# 현재 상태 카드
(Box $s 48 118 410 150 $white $line $true)|Out-Null
(Txt $s 68 132 370 22 "현재 상태" 13 -1 $navy 1 1)|Out-Null
(Txt $s 68 162 374 96 "· 백엔드 서버는 DB가 없는 프록시 구조`n· 토스 결제검증은 코드 주석만 있는 스텁`n· 주문·보고서·매출이 어디에도 기록 안 됨" 11.5 0 "334155" 1 1)|Out-Null
# 빅 스탯
(Box $s 48 286 410 132 $navy $null $true)|Out-Null
(Txt $s 68 300 374 22 "기록되는 운영 데이터" 12 -1 $ice 1 1)|Out-Null
(Txt $s 68 322 374 70 "0 건" 52 -1 $white 1 3)|Out-Null
# 결과(그래서) 우측
(Txt $s 488 118 424 22 "그래서, 지금은…" 13 -1 $blue 1 1)|Out-Null
$cons=@(
  @("보고서 재발급 불가","고객이 다시 받고 싶어도 대응 수단 없음"),
  @("정산·환불 근거 부재","결제 내역을 추적할 수 없음"),
  @("매출·마진 파악 불가","얼마 벌었는지, AI 비용이 얼만지 모름")
)
$cy=150
foreach($c in $cons){
  (Box $s 488 $cy 424 76 $white $line $true)|Out-Null
  (Box $s 488 $cy 6 76 $red $null $false)|Out-Null
  (Txt $s 512 ($cy+12) 388 22 $c[0] 13 -1 $ink 1 1)|Out-Null
  (Txt $s 512 ($cy+38) 388 26 $c[1] 10.5 0 $gray 1 1)|Out-Null
  $cy+=90
}
# 전제 박스
(Box $s 48 430 864 64 "FFF8E1" "F0C040" $true)|Out-Null
(Txt $s 66 440 880 46 "전제: 어드민 화면보다 먼저, 본 서비스가 주문·보고서·AI사용을 저장하기 시작하는 선행 작업(Phase 0)이 반드시 필요하다. 데이터가 없으면 어드민은 빈 화면이다." 11.5 -1 "7A5B00" 1 3)|Out-Null

# ════════ 슬라이드 4 — 목표 & 범위 ════════
$s=NewSlide $light
Header $s "02 · 목표 & 범위" "목표와 1차 범위" "04"
# 목표 3개
$goals=@("결제 건을 빠짐없이 기록·조회·환불","보고서를 보관하고 언제든 재발급","매출·이용을 한 화면에서 파악")
$gx=48
for($i=0;$i -lt 3;$i++){
  (Box $s $gx 116 272 70 $navy $null $true)|Out-Null
  (Txt $s ($gx+16) 124 36 54 ("0"+($i+1)) 20 -1 $ice 1 3)|Out-Null
  (Txt $s ($gx+56) 124 204 54 $goals[$i] 11.5 -1 $white 1 3)|Out-Null
  $gx+=288
}
# In scope
(Box $s 48 206 410 286 $white $line $true)|Out-Null
(Box $s 48 206 410 40 "E6F4EA" $null $true)|Out-Null
(Txt $s 68 206 380 40 "✅  1차 포함 (In Scope)" 14 -1 "1B7A41" 1 3)|Out-Null
$ins=@("주문·결제 + 통합 상세(360°)","매출·이용 통계  (대시보드)","보고서 조회·재발급·환불","회원 관리 (회원정보·구매이력)","운영자 로그인 (인증)")
$iy=256
foreach($it in $ins){
  (Txt $s 74 $iy 360 24 ("•  "+$it) 12 0 "1F2937" 1 3)|Out-Null
  $iy+=44
}
# Out scope
(Box $s 488 206 424 286 $white $line $true)|Out-Null
(Box $s 488 206 424 40 "F1F5F9" $null $true)|Out-Null
(Txt $s 508 206 390 40 "⏸  후순위 (Out of Scope)" 14 -1 $gray 1 3)|Out-Null
$outs=@(
  @("콘텐츠 관리","한자 DB·금기 한자·현대명 DB","후순위"),
  @("운영 설정","가격 변경·점검(maintenance) 모드","후순위"),
  @("회원 등급/포인트","회원정보 조회는 1차. 등급·CRM은 후순위","후순위"),
  @("고급 통계","전환율 퍼널·AI 비용 대시보드","2차")
)
$oy=258
foreach($o in $outs){
  (Txt $s 510 $oy 300 22 $o[0] 12 -1 "475569" 1 1)|Out-Null
  (Txt $s 510 ($oy+19) 318 18 $o[1] 9 0 $gray 1 1)|Out-Null
  if($o[2] -eq "2차"){ Badge $s 836 ($oy+4) 52 "2차" $amber $white } else { Badge $s 820 ($oy+4) 68 "후순위" "94A3B8" $white }
  $oy+=54
}

# ════════ 슬라이드 5 — 정보 구조 ════════
$s=NewSlide $light
Header $s "03 · 정보 구조" "정보 구조 (메뉴 트리)" "05"
# 로그인
(Box $s 80 150 150 50 $navy $null $true)|Out-Null
(Txt $s 80 150 150 50 "🔐  로그인" 13 -1 $white 2 3)|Out-Null
(Ln $s 230 175 300 175)|Out-Null
# 대시보드
(Box $s 300 150 170 50 $blue $null $true)|Out-Null
(Txt $s 300 150 170 50 "📊  대시보드 (홈)" 12.5 -1 $white 2 3)|Out-Null
# 분기 라인
(Ln $s 470 175 510 175)|Out-Null
(Ln $s 510 127 510 403)|Out-Null
# 4개 가지 (주문·보고서·회원·설정)
$branches=@(
  @(104,"🧾  주문·결제",@("주문 목록","★ 통합 상세(360°)")),
  @(196,"📄  보고서",@("보고서 목록","상세 (+재발급·환불)")),
  @(288,"👤  회원  (신규)",@("회원 목록","회원 상세 (정보·이력)")),
  @(380,"⚙️  설정",@("콘텐츠·가격·점검 (후순위)"))
)
foreach($b in $branches){
  $by=$b[0]
  (Ln $s 510 ($by+23) 548 ($by+23))|Out-Null
  $isDim = ($b[1] -like "*설정*")
  $fill = $navy2; if($isDim){$fill="A3AEC7"}
  if($b[1] -like "*회원*"){$fill=$blue}
  (Box $s 548 $by 188 46 $fill $null $true)|Out-Null
  (Txt $s 548 $by 188 46 $b[1] 11.5 -1 $white 2 3)|Out-Null
  $subs=$b[2]
  for($k=0;$k -lt $subs.Count;$k++){
    $syy=$by + $k*23
    (Box $s 752 $syy 178 20 $white $line $true)|Out-Null
    (Txt $s 758 $syy 178 20 $subs[$k] 8.5 0 "475569" 1 3)|Out-Null
  }
}
# 통합 상세 강조 콜아웃
(Box $s 80 250 360 110 "EEF4FF" "B3CEF0" $true)|Out-Null
(Txt $s 96 262 330 20 "★ 통합 상세 (360°) 원칙" 12 -1 $navy 1 1)|Out-Null
(Txt $s 96 286 330 70 "주문·보고서·회원 어느 탭으로 들어오든 회원·결제·보고서·환불을 한 화면에서 본다. '환불은 주문 탭, 재발급은 보고서 탭'처럼 흩어지지 않게." 10 0 "334155" 1 1)|Out-Null

# ════════ 슬라이드 6 — 기능 목록 ════════
$s=NewSlide $light
Header $s "04 · 기능 요구사항" "기능 요구사항 (F-01 ~ F-14)" "06"
$feats=@(
  @("F-01","운영자 로그인","허용된 운영자만 인증 후 접근","1"),
  @("F-02","대시보드","오늘/이번달 매출·주문 요약","1"),
  @("F-03","주문 목록","기간·상태·상품 필터, 검색","1"),
  @("F-04","통합 상세(360°)","회원+결제+보고서+환불 한 화면","1"),
  @("F-05","환불 처리","주문·보고서·회원 어디서든 환불","1"),
  @("F-06","보고서 목록","이름·날짜 검색","1"),
  @("F-07","보고서 상세","저장본 렌더링 +환불","1"),
  @("F-08","보고서 재발급","고객에게 재발송","1"),
  @("F-13","회원 목록 (신규)","가입일·연락처·구매횟수","1"),
  @("F-14","회원 상세 (신규)","회원정보+구매이력+보고서","1"),
  @("F-09","전환율 퍼널","셀프→프리미엄 전환","2"),
  @("F-10","AI 비용 모니터링","Claude/Gemini 토큰·비용","2"),
  @("F-11","매출 추이 차트","일/월 매출 그래프","2"),
  @("F-12","콘텐츠/설정 관리","한자 DB·가격·점검","3")
)
$fx=48; $fy=112; $fw=430; $fh=50
for($i=0;$i -lt 14;$i++){
  $col=$i % 2; $row=[math]::Floor($i/2)
  $x=$fx + $col*($fw+16); $y=$fy + $row*($fh+4)
  (Box $s $x $y $fw $fh $white $line $true)|Out-Null
  (Box $s ($x+12) ($y+12) 50 26 $light $null $true)|Out-Null
  (Txt $s ($x+12) ($y+12) 50 26 $feats[$i][0] 10.5 -1 $navy 2 3)|Out-Null
  (Txt $s ($x+72) ($y+7) 230 20 $feats[$i][1] 12 -1 $ink 1 1)|Out-Null
  (Txt $s ($x+72) ($y+27) 250 16 $feats[$i][2] 9 0 $gray 1 1)|Out-Null
  $p=$feats[$i][3]
  if($p -eq "1"){ Badge $s ($x+$fw-56) ($y+8) 44 "1차" $red $white }
  elseif($p -eq "2"){ Badge $s ($x+$fw-56) ($y+8) 44 "2차" $amber $white }
  else{ Badge $s ($x+$fw-62) ($y+8) 50 "후순위" "94A3B8" $white }
}

# ════════ 슬라이드 7 — 화면① 로그인 ════════
$s=NewSlide $light
Header $s "05 · 화면 설계 (UI/UX)" "화면 ① 운영자 로그인" "07"
Spec $s 44 116 300 "화면 목적" "허용된 운영자만 어드민에 진입하도록 인증한다."
Spec $s 44 200 300 "구성 요소" "서비스 로고 · 이메일 로그인 버튼 · 접근 안내 문구"
Spec $s 44 284 300 "주요 동작" "성공 → 대시보드 이동 / 허용목록 외 → 접근 거부"
Spec $s 44 368 300 "예외 처리" "미인증 상태로 내부 URL 직접 접근 시 로그인으로 강제 이동"
# mockup (browser frame, centered card)
$x=372;$y=110;$w=540;$h=388
(Box $s $x $y $w $h $white $line $true)|Out-Null
(Box $s $x $y $w 24 "E9EDF3" $null $false)|Out-Null
(Box $s ($x+12) ($y+8) 8 8 "E06C75" $null $false)|Out-Null
(Box $s ($x+26) ($y+8) 8 8 "E5C07B" $null $false)|Out-Null
(Box $s ($x+40) ($y+8) 8 8 "98C379" $null $false)|Out-Null
(Box $s $x ($y+24) $w ($h-24) $light $null $false)|Out-Null
# login card
$lcx=$x+150;$lcy=$y+90;$lcw=240;$lch=210
(Box $s $lcx $lcy $lcw $lch $white $line $true)|Out-Null
(Box $s ($lcx+90) ($lcy+26) 60 60 $navy $null $true)|Out-Null
(Txt $s ($lcx+90) ($lcy+26) 60 60 "D" 28 -1 $white 2 3)|Out-Null
(Txt $s $lcx ($lcy+92) $lcw 22 "DearName ADMIN" 13 -1 $ink 2 3)|Out-Null
(Txt $s $lcx ($lcy+114) $lcw 18 "운영자 로그인" 10 0 $gray 2 3)|Out-Null
(Box $s ($lcx+30) ($lcy+140) ($lcw-60) 34 $blue $null $true)|Out-Null
(Txt $s ($lcx+30) ($lcy+140) ($lcw-60) 34 "이메일로 로그인" 11 -1 $white 2 3)|Out-Null
(Txt $s $lcx ($lcy+180) $lcw 18 "허용된 운영자만 접근할 수 있습니다" 8.5 0 $gray 2 3)|Out-Null

# ════════ 슬라이드 8 — 화면② 대시보드 (시각화) ════════
$s=NewSlide $light
Header $s "05 · 화면 설계 (UI/UX)" "화면 ② 대시보드 — 매출 현황 시각화" "08"
Spec $s 44 114 300 "화면 목적" "전체 서비스 현황(매출·주문·환불)을 한눈에. 추이를 그래프로 본다."
Spec $s 44 188 300 "구간 전환" "일 / 월 / 연 세그먼트 → 카드 금액·그래프가 함께 바뀜."
Spec $s 44 262 300 "지표·그래프" "구간별 매출·주문·객단가·환불액 금액 + 매출 추이 막대그래프."
Spec $s 44 336 300 "집계" "orders를 date_trunc(일/월/연)로 그룹·합산해 산출."
$r=Chrome $s 372 110 540 388 "대시보드"
$cx=$r.cx;$cy=$r.cy;$cw=$r.cw
# 타이틀 + 일/월/연 토글
(Txt $s $cx $cy 160 22 "매출 현황" 12 -1 $ink 1 3)|Out-Null
$seg=@("일","월","연"); $sgx=$cx+$cw-132
for($i=0;$i -lt 3;$i++){
  $on = ($seg[$i] -eq "월")
  $f=$white; $tc=$gray; if($on){$f=$blue;$tc=$white}
  (Box $s $sgx $cy 42 22 $f $line $true)|Out-Null
  (Txt $s $sgx ($cy-1) 42 22 $seg[$i] 9.5 -1 $tc 2 3)|Out-Null
  $sgx+=44
}
# KPI 4 cards (구간별 금액)
$cards=@(@("이번달 매출","₩ 1.24M"),@("주문","42건"),@("객단가","₩29,500"),@("환불액","₩29K"))
$gap=8; $sw=($cw-3*$gap)/4
for($i=0;$i -lt 4;$i++){
  $bx=$cx + $i*($sw+$gap)
  (Box $s $bx ($cy+30) $sw 58 $light $null $true)|Out-Null
  (Txt $s ($bx+7) ($cy+37) ($sw-10) 14 $cards[$i][0] 8 0 $gray 1 1)|Out-Null
  (Txt $s ($bx+7) ($cy+52) ($sw-10) 26 $cards[$i][1] 12.5 -1 $navy 1 1)|Out-Null
}
# 매출 추이 막대그래프
(Txt $s $cx ($cy+98) 200 16 "월별 매출 추이" 9.5 -1 $ink 1 1)|Out-Null
$gBase=$cy+232; $gLeft=$cx+8
(Ln $s $gLeft ($gBase) ($cx+$cw-6) ($gBase))|Out-Null
$bars=@(@("1월",46),@("2월",58),@("3월",72),@("4월",98),@("5월",116),@("6월",128))
$bw=34; $bgap=( ($cw-30) - 6*$bw )/5
for($i=0;$i -lt 6;$i++){
  $bx=$gLeft + $i*($bw+$bgap)
  $bh=$bars[$i][1]
  $bcol=$blue; if($i -eq 5){$bcol=$navy}
  (Box $s $bx ($gBase-$bh) $bw $bh $bcol $null $true)|Out-Null
  (Txt $s ($bx-4) ($gBase+2) ($bw+8) 16 $bars[$i][0] 8 0 $gray 2 1)|Out-Null
}
(Txt $s ($cx+$cw-150) ($cy+118) 150 16 "단위: 백만원" 8 0 $gray 3 1)|Out-Null

# ════════ 슬라이드 9 — 화면③ 주문 목록 ════════
$s=NewSlide $light
Header $s "05 · 화면 설계 (UI/UX)" "화면 ③ 주문·결제 — 목록" "09"
Spec $s 44 116 300 "화면 목적" "전체 결제 내역을 조회·검색·필터한다."
Spec $s 44 196 300 "구성 요소" "기간·상태·상품 필터, 검색창, 주문 표, 페이지네이션"
Spec $s 44 290 300 "테이블 컬럼" "주문일시 · 상품 · 금액 · 상태 · 구매자"
$r=Chrome $s 372 110 540 388 "주문·결제"
$cx=$r.cx;$cy=$r.cy;$cw=$r.cw
# filters
$chips=@("기간 ▾","상태 ▾","상품 ▾")
$chx=$cx
foreach($ch in $chips){ (Box $s $chx $cy 64 24 $light $line $true)|Out-Null; (Txt $s $chx $cy 64 24 $ch 9 0 "475569" 2 3)|Out-Null; $chx+=72 }
(Box $s ($cx+$cw-120) $cy 120 24 $white $line $true)|Out-Null
(Txt $s ($cx+$cw-114) $cy 120 24 "🔍 검색…" 9 0 $gray 1 3)|Out-Null
# table
$ty=$cy+36
(Box $s $cx $ty $cw 22 $navy $null $false)|Out-Null
(Txt $s ($cx+10) $ty 110 22 "주문일시" 9 -1 $white 1 3)|Out-Null
(Txt $s ($cx+130) $ty 90 22 "상품" 9 -1 $white 1 3)|Out-Null
(Txt $s ($cx+225) $ty 80 22 "금액" 9 -1 $white 1 3)|Out-Null
(Txt $s ($cx+305) $ty 70 22 "상태" 9 -1 $white 1 3)|Out-Null
$rows=@(
  @("06-06 14:21","프리미엄","₩29,000","결제완료"),
  @("06-06 13:08","프리미엄","₩29,000","결제완료"),
  @("06-06 11:55","프리미엄","₩29,000","환불"),
  @("06-06 09:30","셀프","₩4,900","결제완료"),
  @("06-05 22:14","프리미엄","₩29,000","실패")
)
$ry=$ty+22
foreach($rw in $rows){
  (Box $s $cx $ry $cw 26 $white $null $false)|Out-Null
  (Box $s $cx ($ry+25) $cw 1 "E2E8F0" $null $false)|Out-Null
  (Txt $s ($cx+10) $ry 110 26 $rw[0] 9 0 "475569" 1 3)|Out-Null
  (Txt $s ($cx+130) $ry 90 26 $rw[1] 9 0 "1F2937" 1 3)|Out-Null
  (Txt $s ($cx+225) $ry 80 26 $rw[2] 9 -1 "1F2937" 1 3)|Out-Null
  if($rw[3] -eq "환불"){ Badge $s ($cx+305) ($ry+5) 56 "환불" "FEE2E2" "B91C1C" }
  elseif($rw[3] -eq "실패"){ Badge $s ($cx+305) ($ry+5) 56 "실패" "F1F5F9" "64748B" }
  else{ Badge $s ($cx+305) ($ry+5) 60 "결제완료" "D1FAE5" "047857" }
  $ry+=26
}
# pagination
(Txt $s $cx ($ry+6) $cw 18 "‹  1  2  3  ›" 9 0 $gray 2 3)|Out-Null

# ════════ 슬라이드 10 — 화면④ 통합 상세 (360°) ════════
$s=NewSlide $light
Header $s "05 · 화면 설계 (UI/UX)" "화면 ④ ★ 통합 상세 (360°)" "10"
Spec $s 44 114 300 "화면 목적" "회원·결제·보고서·환불을 한 화면에서 처리. 화면 이동 없이 모든 응대."
Spec $s 44 188 300 "구성 요소" "①회원 요약 ②결제·주문 정보 ③연결 보고서 ④환불·재발급 액션"
# 통합 강조 콜아웃
(Box $s 44 268 300 216 "EEF4FF" "B3CEF0" $true)|Out-Null
(Txt $s 60 280 270 20 "★ 통합(360°) 원칙" 12 -1 $navy 1 1)|Out-Null
(Txt $s 60 304 272 120 "주문·보고서·회원 어느 탭으로 들어와도 똑같은 이 화면으로 모인다.`n`n환불은 항상 운영자가 직접 클릭. 토스 시크릿키는 서버에서만 호출, 감사 로그 기록." 10 0 "334155" 1 1)|Out-Null
$r=Chrome $s 372 110 540 388 "주문·결제"
$cx=$r.cx;$cy=$r.cy;$cw=$r.cw
(Txt $s $cx $cy 220 18 "통합 상세 · 주문 #A1B2-2026" 11 -1 $ink 1 1)|Out-Null
Badge $s ($cx+$cw-60) ($cy+1) 58 "결제완료" "D1FAE5" "047857"
# ① 회원 요약 strip
(Box $s $cx ($cy+22) $cw 46 $light $null $true)|Out-Null
(Box $s ($cx+10) ($cy+30) 30 30 $navy $null $true)|Out-Null
(Txt $s ($cx+10) ($cy+30) 30 30 "남" 12 -1 $white 2 3)|Out-Null
(Txt $s ($cx+48) ($cy+27) 200 18 "남O호  (구매 회원)" 10.5 -1 "1F2937" 1 1)|Out-Null
(Txt $s ($cx+48) ($cy+45) 220 16 "010-****-1234 · 구글 · 가입 2026-05-20" 8.5 0 $gray 1 1)|Out-Null
(Txt $s ($cx+$cw-74) ($cy+30) 70 30 "회원 상세 ›" 9 -1 $blue 2 3)|Out-Null
# ② 결제·주문 정보
(Txt $s $cx ($cy+76) 200 16 "② 결제·주문 정보" 9.5 -1 $blue 1 1)|Out-Null
$pf=@(@("금액","₩ 29,000"),@("결제수단","토스 · 카드"),@("주문번호","toss_8842F1"),@("결제일시","06-06 14:21"))
for($i=0;$i -lt 4;$i++){
  $pcol=$i % 2; $prow=[math]::Floor($i/2)
  $bx=$cx + $pcol*($cw/2); $byy=$cy+96 + $prow*26
  (Txt $s $bx $byy 70 22 $pf[$i][0] 9 0 $gray 1 3)|Out-Null
  (Txt $s ($bx+62) $byy (($cw/2)-66) 22 $pf[$i][1] 9.5 -1 "1F2937" 1 3)|Out-Null
}
# ③ 연결 보고서
(Box $s $cx ($cy+150) $cw 38 $white $line $true)|Out-Null
(Txt $s ($cx+12) ($cy+150) 220 38 "③ 보고서  김O연 (金소연) · 92점" 9.5 0 "1F2937" 1 3)|Out-Null
(Txt $s ($cx+$cw-104) ($cy+150) 100 38 "보기 · 재발급 ›" 9 -1 $blue 2 3)|Out-Null
# ④ 액션 버튼
(Box $s $cx ($cy+200) 150 34 $red $null $true)|Out-Null
(Txt $s $cx ($cy+200) 150 34 "④ 환불 처리" 11 -1 $white 2 3)|Out-Null
(Box $s ($cx+160) ($cy+200) 150 34 $blue $null $true)|Out-Null
(Txt $s ($cx+160) ($cy+200) 150 34 "보고서 재발급" 11 -1 $white 2 3)|Out-Null

# ════════ 슬라이드 11 — 화면⑤ 보고서 상세 (재발급·환불) ════════
$s=NewSlide $light
Header $s "05 · 화면 설계 (UI/UX)" "화면 ⑤ 보고서 상세 (핵심 일부 + 디어네임 열기)" "11"
Spec $s 44 114 300 "화면 목적" "보고서 핵심 일부를 빠르게 확인하고 재발송·환불. 전체는 디어네임에서."
Spec $s 44 188 300 "표시 내용" "저장본에서 이름·점수·핵심 메시지·요약만 발췌(전체 본문은 X)."
Spec $s 44 262 300 "디어네임 열기" "[디어네임에서 열기 ↗] → 본 서비스 보고서 화면을 새 탭으로."
(Box $s 44 342 300 142 "F0FFF4" "68D391" $true)|Out-Null
(Txt $s 60 352 270 20 "핵심 설계" 12 -1 "1B7A41" 1 1)|Out-Null
(Txt $s 60 376 272 100 "어드민엔 핵심 일부만. 전체 열람은 [디어네임에서 열기]로 본 서비스 화면을 재사용 → 보고서 렌더링 중복 구현 불필요." 10 0 "1B5E33" 1 1)|Out-Null
$r=Chrome $s 372 110 540 388 "보고서"
$cx=$r.cx;$cy=$r.cy;$cw=$r.cw
(Txt $s $cx $cy 220 24 "김O연  金소연" 15 -1 $ink 1 1)|Out-Null
(Box $s ($cx+$cw-56) ($cy+2) 52 22 $navy $null $true)|Out-Null
(Txt $s ($cx+$cw-56) ($cy+1) 52 22 "92점" 11 -1 $white 2 3)|Out-Null
# 핵심 일부 패널
(Box $s $cx ($cy+30) $cw 120 $light $null $true)|Out-Null
(Txt $s ($cx+14) ($cy+38) 200 16 "핵심 메시지 (발췌)" 9 -1 $blue 1 1)|Out-Null
(Txt $s ($cx+14) ($cy+55) ($cw-28) 30 "물의 지혜와 나무의 성장을 함께 품은 이름" 10.5 -1 "1F2937" 1 1)|Out-Null
(Txt $s ($cx+14) ($cy+88) 200 16 "요약" 9 -1 $blue 1 1)|Out-Null
(Box $s ($cx+14) ($cy+106) ($cw-28) 6 "D8E0EC" $null $true)|Out-Null
(Box $s ($cx+14) ($cy+118) ($cw-80) 6 "D8E0EC" $null $true)|Out-Null
# 디어네임 열기 (강조 outline 버튼)
(Box $s $cx ($cy+162) $cw 34 "EEF4FF" $blue $true)|Out-Null
(Txt $s $cx ($cy+162) $cw 34 "↗  디어네임에서 전체 보고서 열기" 11 -1 $blue 2 3)|Out-Null
# 액션: 재발급 + 환불
(Box $s $cx ($cy+206) 150 34 $blue $null $true)|Out-Null
(Txt $s $cx ($cy+206) 150 34 "보고서 재발급" 11 -1 $white 2 3)|Out-Null
(Box $s ($cx+160) ($cy+206) 110 34 $white $red $true)|Out-Null
(Txt $s ($cx+160) ($cy+206) 110 34 "환불" 11 -1 $red 2 3)|Out-Null

# ════════ 슬라이드 12 — 화면⑥ 회원 관리 (회원 상세) ════════
$s=NewSlide $light
Header $s "05 · 화면 설계 (UI/UX)" "화면 ⑥ 회원 관리 (신규)" "12"
Spec $s 44 114 300 "화면 목적" "회원 목록에서 검색 → 회원 정보와 모든 거래·보고서를 한눈에 보고 응대."
Spec $s 44 196 300 "구성 요소" "회원 정보 + 구매 이력(각 주문 환불 가능) + 보고서 목록"
(Box $s 44 278 300 206 "EEF4FF" "B3CEF0" $true)|Out-Null
(Txt $s 60 290 270 20 "📌 통합 관점" 12 -1 $navy 1 1)|Out-Null
(Txt $s 60 314 272 160 "이 고객이 무엇을 사고, 어떤 보고서를 받았고, 환불이 있었는지를 한 곳에서.`n`n구매 이력의 주문을 누르면 통합 상세(360°)로 이어진다." 10 0 "334155" 1 1)|Out-Null
$r=Chrome $s 372 110 540 388 "회원"
$cx=$r.cx;$cy=$r.cy;$cw=$r.cw
# 회원 헤더
(Box $s $cx $cy 44 44 $navy $null $true)|Out-Null
(Txt $s $cx $cy 44 44 "남" 18 -1 $white 2 3)|Out-Null
(Txt $s ($cx+54) ($cy+2) 200 20 "남O호" 14 -1 $ink 1 1)|Out-Null
Badge $s ($cx+108) ($cy+4) 52 "구글" "E0E7FF" "3730A3"
(Txt $s ($cx+54) ($cy+24) 240 18 "010-****-1234" 9.5 0 $gray 1 1)|Out-Null
# 회원 정보 grid
$mf=@(@("가입일","2026-05-20"),@("구매횟수","3회"),@("누적결제","₩ 62,900"),@("최근주문","06-06"))
for($i=0;$i -lt 4;$i++){
  $mcol=$i % 2; $mrow=[math]::Floor($i/2)
  $bx=$cx + $mcol*($cw/2); $byy=$cy+54 + $mrow*24
  (Txt $s $bx $byy 70 22 $mf[$i][0] 9 0 $gray 1 3)|Out-Null
  (Txt $s ($bx+62) $byy (($cw/2)-66) 22 $mf[$i][1] 9.5 -1 "1F2937" 1 3)|Out-Null
}
# 구매 이력 table
(Txt $s $cx ($cy+108) 200 16 "구매 이력" 9.5 -1 $blue 1 1)|Out-Null
$ty=$cy+126
(Box $s $cx $ty $cw 20 $navy $null $false)|Out-Null
(Txt $s ($cx+8) $ty 90 20 "주문일시" 8.5 -1 $white 1 3)|Out-Null
(Txt $s ($cx+108) $ty 80 20 "상품" 8.5 -1 $white 1 3)|Out-Null
(Txt $s ($cx+185) $ty 80 20 "금액" 8.5 -1 $white 1 3)|Out-Null
(Txt $s ($cx+265) $ty 90 20 "상태" 8.5 -1 $white 1 3)|Out-Null
$mh=@(@("06-06 14:21","프리미엄","₩29,000","결제완료"),@("05-28 10:02","프리미엄","₩29,000","환불"),@("05-20 18:40","셀프","₩4,900","결제완료"))
$ry=$ty+20
foreach($rw in $mh){
  (Box $s $cx ($ry+23) $cw 1 "E2E8F0" $null $false)|Out-Null
  (Txt $s ($cx+8) $ry 95 24 $rw[0] 8.5 0 "475569" 1 3)|Out-Null
  (Txt $s ($cx+108) $ry 80 24 $rw[1] 8.5 0 "1F2937" 1 3)|Out-Null
  (Txt $s ($cx+185) $ry 80 24 $rw[2] 8.5 -1 "1F2937" 1 3)|Out-Null
  if($rw[3] -eq "환불"){ Badge $s ($cx+265) ($ry+4) 52 "환불" "FEE2E2" "B91C1C" }
  else{ Badge $s ($cx+265) ($ry+4) 58 "결제완료" "D1FAE5" "047857" }
  $ry+=24
}
(Txt $s $cx ($ry+4) $cw 16 "각 주문에서 [환불]·[보고서 보기] 가능 → 통합 상세로 이동" 8.5 0 $gray 1 1)|Out-Null

# ════════ 슬라이드 13 — 데이터 정의 ════════
$s=NewSlide $light
Header $s "06 · 데이터 & 보안" "운영 데이터 정의 (회원 중심)" "13"
$data=@(
  @("회원 (member) 신규","가입일·이름·연락처·로그인수단`n구매횟수·누적결제·최근주문","회원 관리","1"),
  @("주문 (order)","주문일시·회원·상품·금액·상태`n토스 결제정보","주문·환불 관리","1"),
  @("보고서 (report)","연결 주문·이름(한글/한자)`n생년월일시·점수·보고서 전체","조회·재발급","1"),
  @("AI 사용 (ai_usage)","호출 시각·종류·모델`n토큰·추정 비용","비용 모니터링","2"),
  @("이벤트 (event)","단계명·익명 세션ID·시각","전환율 통계","2")
)
$dx=48;$dy=116;$dw=430;$dh=112
for($i=0;$i -lt 5;$i++){
  $col=$i % 2; $row=[math]::Floor($i/2)
  $x=$dx+$col*($dw+16); $y=$dy+$row*($dh+12)
  (Box $s $x $y $dw $dh $white $line $true)|Out-Null
  $bar=$navy; if($i -eq 0){$bar=$blue}
  (Box $s $x $y 6 $dh $bar $null $false)|Out-Null
  (Txt $s ($x+22) ($y+12) 290 22 $data[$i][0] 13 -1 $navy 1 1)|Out-Null
  if($data[$i][3] -eq "1"){ Badge $s ($x+$dw-56) ($y+14) 44 "1차" $red $white } else { Badge $s ($x+$dw-56) ($y+14) 44 "2차" $amber $white }
  (Txt $s ($x+22) ($y+38) ($dw-40) 44 $data[$i][1] 10 0 "334155" 1 1)|Out-Null
  (Box $s ($x+22) ($y+$dh-28) ($dw-44) 20 $light $null $true)|Out-Null
  (Txt $s ($x+30) ($y+$dh-28) ($dw-50) 20 ("용도:  "+$data[$i][2]) 9 -1 $gray 1 3)|Out-Null
}
# 6번째 셀 = 개인정보 경고
$x=$dx+($dw+16); $y=$dy+2*($dh+12)
(Box $s $x $y $dw $dh "FFF8E1" "F0C040" $true)|Out-Null
(Txt $s ($x+18) ($y+12) ($dw-30) 20 "⚠️ 개인정보 주의" 12 -1 "7A5B00" 1 1)|Out-Null
(Txt $s ($x+18) ($y+36) ($dw-32) 70 "회원 이름·연락처, 보고서의 생년월일시·아이 이름은 민감 개인정보.`n최소 수집 · 운영자 한정 접근 · 목록 마스킹 · 보관기간 정책 필요." 9.5 0 "7A5B00" 1 1)|Out-Null
(Txt $s 48 484 864 16 "연결: 회원 1 — N 주문 1 — 1 보고서  ·  통합 상세는 이 연결을 따라 한 화면에 묶어 보여준다." 9.5 0 $gray 1 1)|Out-Null

# ════════ 슬라이드 14 — 운영 데이터 상세 (신규) ════════
$s=NewSlide $light
Header $s "06 · 데이터 & 보안" "운영 데이터 상세 (필드·관계)" "14"
$ent=@(
 @(60,"members  회원","id (PK)`ncreated_at  가입일`nname · contact  (개인정보)`nlogin_provider`norder_count · total_spent`nlast_order_at",$blue),
 @(350,"orders  주문","id (PK)`ncreated_at`nmember_id (FK)`nproduct · amount · status`ntoss_order_id / payment_key`nrefunded_at",$navy),
 @(640,"reports  보고서","id (PK)`norder_id (FK)`nbaby_name_kr / hanja`nbirth_dt  (개인정보)`nscore`nreport_json (jsonb)",$navy)
)
$ey=132; $ew=252; $eh=176
foreach($e in $ent){
  $ex=$e[0]
  (Box $s $ex $ey $ew $eh $white $line $true)|Out-Null
  (Box $s $ex $ey $ew 30 $e[3] $null $true)|Out-Null
  (Txt $s $ex $ey $ew 30 $e[1] 12 -1 $white 2 3)|Out-Null
  (Txt $s ($ex+14) ($ey+38) ($ew-22) 132 $e[2] 9.5 0 "334155" 1 1)|Out-Null
}
(Ln $s 312 ($ey+15) 350 ($ey+15))|Out-Null
(Txt $s 296 ($ey+18) 70 16 "1 — N" 8.5 -1 $blue 2 1)|Out-Null
(Ln $s 602 ($ey+15) 640 ($ey+15))|Out-Null
(Txt $s 586 ($ey+18) 70 16 "1 — 1" 8.5 -1 $blue 2 1)|Out-Null
$sub=@(@("audit_logs  감사로그 (신규)","actor · action · target · detail`n환불 등 민감작업 추적"),@("ai_usage","kind · model · tokens · est_cost`n비용 모니터링"),@("events","name · session_id`n전환율 통계(2차)"))
$sy=336; $sw2=276
for($i=0;$i -lt 3;$i++){
  $sx=60 + $i*($sw2+12)
  (Box $s $sx $sy $sw2 92 $white $line $true)|Out-Null
  $bar=$navy; if($i -eq 0){$bar="7C3AED"}
  (Box $s $sx $sy 6 92 $bar $null $false)|Out-Null
  (Txt $s ($sx+18) ($sy+12) ($sw2-28) 22 $sub[$i][0] 11.5 -1 $navy 1 1)|Out-Null
  (Txt $s ($sx+18) ($sy+38) ($sw2-30) 48 $sub[$i][1] 9 0 "334155" 1 1)|Out-Null
}
(Box $s 60 442 840 44 "EEF4FF" "B3CEF0" $true)|Out-Null
(Txt $s 76 450 824 30 "인덱스: orders(created_at·status·member_id) · reports(order_id) · members(contact)    |    대시보드 집계: orders를 date_trunc(일/월/연)로 그룹·합산" 9.5 -1 $navy 1 3)|Out-Null

# ════════ 슬라이드 15 — 보안 & 개인정보 ════════
$s=NewSlide $light
Header $s "06 · 데이터 & 보안" "보안 · 개인정보 보호" "15"
$secL=@(
  @("운영자 인증","허용된 이메일만 로그인, 그 외 접근 차단"),
  @("행 수준 접근권한(RLS)","일반 사용자는 어떤 운영 데이터도 조회 불가"),
  @("키 보관","토스 시크릿·서버 키는 환경변수에만, 코드 노출 금지")
)
$secR=@(
  @("민감정보 최소 수집","회원 이름·연락처, 생년월일시는 목적 외 사용 금지"),
  @("목록 마스킹","이름·연락처 일부 가림 (김O연, 010-****-1234)"),
  @("접근·감사 로그","회원정보 조회·환불·삭제는 누가·언제 기록")
)
(Txt $s 48 118 430 24 "🔐  보안" 14 -1 $navy 1 1)|Out-Null
$y=150
foreach($it in $secL){
  (Box $s 48 $y 430 92 $white $line $true)|Out-Null
  (Box $s 48 $y 6 92 $blue $null $false)|Out-Null
  (Txt $s 72 ($y+14) 390 22 $it[0] 13 -1 $ink 1 1)|Out-Null
  (Txt $s 72 ($y+42) 390 40 $it[1] 10.5 0 "334155" 1 1)|Out-Null
  $y+=104
}
(Txt $s 488 118 424 24 "🛡  개인정보 보호" 14 -1 $navy 1 1)|Out-Null
$y=150
foreach($it in $secR){
  (Box $s 488 $y 424 92 $white $line $true)|Out-Null
  (Box $s 488 $y 6 92 $green $null $false)|Out-Null
  (Txt $s 512 ($y+14) 384 22 $it[0] 13 -1 $ink 1 1)|Out-Null
  (Txt $s 512 ($y+42) 384 40 $it[1] 10.5 0 "334155" 1 1)|Out-Null
  $y+=104
}

# ════════ 슬라이드 16 — 환불·민감작업 기술 적용 (신규) ════════
$s=NewSlide $light
Header $s "06 · 데이터 & 보안" "환불·민감작업 기술 적용" "16"
(Txt $s 48 112 420 20 "처리 흐름 — 환불은 브라우저가 아닌 서버 함수를 거친다" 11 -1 $blue 1 1)|Out-Null
# Flow A
(Box $s 48 140 400 48 $navy2 $null $true)|Out-Null
(Txt $s 64 140 380 48 "① 어드민 화면 (브라우저)  — 환불 버튼 클릭" 11 -1 $white 1 3)|Out-Null
$ar=$s.Shapes.AddShape(36,[single]230,[single]190,[single]36,[single]18); $ar.Fill.Solid(); $ar.Fill.ForeColor.RGB=[int](C "94A3B8"); $ar.Line.Visible=0; $ar.Shadow.Visible=0
# Flow B (서버 함수 강조)
(Box $s 48 212 400 116 $white $blue $true)|Out-Null
(Box $s 48 212 400 28 $blue $null $true)|Out-Null
(Txt $s 64 212 380 28 "② 서버 함수 (Supabase Edge / Flask)" 11 -1 $white 1 3)|Out-Null
(Txt $s 64 246 372 76 "· 운영자 권한 검증   · 멱등키로 중복 환불 차단`n· 토스 환불 호출 (TOSS_SECRET, 서버 전용)`n· orders.status='refunded' + audit_logs 기록" 9.5 0 "334155" 1 1)|Out-Null
$ar=$s.Shapes.AddShape(36,[single]230,[single]330,[single]36,[single]18); $ar.Fill.Solid(); $ar.Fill.ForeColor.RGB=[int](C "94A3B8"); $ar.Line.Visible=0; $ar.Shadow.Visible=0
# Flow C
(Box $s 48 352 400 44 $navy $null $true)|Out-Null
(Txt $s 64 352 380 44 "③ 토스페이먼츠 API — 실제 환불 confirm" 11 -1 $white 1 3)|Out-Null
(Box $s 48 410 400 40 "FFF8E1" "F0C040" $true)|Out-Null
(Txt $s 62 410 374 40 "⚠️ 시크릿키·service_role 키는 서버 함수에만 (브라우저·깃허브 노출 금지)" 9.5 -1 "7A5B00" 1 3)|Out-Null
# 원칙 카드 (우측)
(Txt $s 488 112 424 20 "적용 원칙" 11 -1 $blue 1 1)|Out-Null
$pr=@(
  @("시크릿키 보호","TOSS_SECRET·service_role은 서버에만"),
  @("권한 검증","요청자의 운영자 인증 토큰 먼저 확인"),
  @("멱등성","order_id+멱등키로 중복 환불 차단"),
  @("운영자 직접 실행","자동 환불 금지 — 버튼+확인 모달"),
  @("감사 로그","환불·민감조회를 audit_logs에 기록"),
  @("실패 처리","토스 실패 시 상태 변경 없이 사유 노출")
)
$py2=140
foreach($p in $pr){
  (Box $s 488 $py2 424 50 $white $line $true)|Out-Null
  (Box $s 488 $py2 6 50 $red $null $false)|Out-Null
  (Txt $s 506 ($py2+7) 200 20 $p[0] 11.5 -1 $ink 1 1)|Out-Null
  (Txt $s 506 ($py2+27) 396 18 $p[1] 9 0 $gray 1 1)|Out-Null
  $py2+=54
}

# ════════ 슬라이드 17 — 출시 로드맵 ════════
$s=NewSlide $light
Header $s "07 · 출시 로드맵" "출시 로드맵 (Phase 0 ~ 3)" "17"
$phases=@(
  @("Phase 0","선행 필수","데이터 적재 시작`n결제·보고서·AI사용 기록",$navy),
  @("Phase 1","어드민 MVP","로그인·주문관리·보고서`n재발급·대시보드·환불",$blue),
  @("Phase 2","통계 강화","전환율 퍼널·매출 차트`nAI 비용 모니터링","6B8BBE"),
  @("Phase 3","후순위","콘텐츠(한자DB)·가격`n점검 모드 설정","A3AEC7")
)
$px=56;$pw=200;$py=170;$ph=240
for($i=0;$i -lt 4;$i++){
  $x=$px+$i*($pw+12)
  (Box $s $x $py $pw $ph $phases[$i][3] $null $true)|Out-Null
  (Txt $s ($x+16) ($py+22) ($pw-24) 26 $phases[$i][0] 18 -1 $white 1 1)|Out-Null
  (Box $s ($x+16) ($py+54) 84 22 "FFFFFF" $null $true)|Out-Null
  (Txt $s ($x+16) ($py+53) 84 22 $phases[$i][1] 9.5 -1 $phases[$i][3] 2 3)|Out-Null
  (Box $s ($x+16) ($py+88) ($pw-32) 1 "FFFFFF" $null $false)|Out-Null
  (Txt $s ($x+16) ($py+100) ($pw-28) 110 $phases[$i][2] 11 0 $white 1 1)|Out-Null
  if($i -lt 3){
    $ar=$s.Shapes.AddShape(33,[single]($x+$pw+0),[single]($py+$ph/2-10),[single]12,[single]20)
    $ar.Fill.Solid(); $ar.Fill.ForeColor.RGB=[int](C "94A3B8"); $ar.Line.Visible=0; $ar.Shadow.Visible=0
  }
}
(Txt $s 56 432 850 40 "Phase 0(데이터 적재)와 Phase 1(어드민 MVP)이 1차 목표. Phase 2~3은 운영 안정화 후 단계적으로 확장한다." 11.5 0 "334155" 1 1)|Out-Null

# ════════ 슬라이드 18 — 개발 구현 순서 (신규) ════════
$s=NewSlide $light
Header $s "07 · 출시 로드맵" "개발 구현 순서 (개발자 가이드)" "18"
(Txt $s 48 110 864 18 "읽기(조회) 먼저 → 쓰기(환불) 나중.  각 STEP의 완료기준(DoD)을 만족해야 다음 단계로 넘어간다." 11 -1 "334155" 1 1)|Out-Null
$steps=@(
 @("1","필수","Supabase 6테이블 + RLS + 인덱스 생성","수동 INSERT·조회·RLS 차단 확인"),
 @("2","필수","본 서비스 적재: 회원→주문→보고서→ai_usage","실제 결제 1건이 행으로 쌓임"),
 @("3","필수","어드민 뼈대: Next.js + Auth + 사이드바","허용 운영자만 로그인, 5메뉴"),
 @("4","필수","읽기 화면: 주문·통합상세·보고서·회원(조회)","데이터가 화면에 정확히 보임"),
 @("5","필수","환불(민감): 서버함수+토스+멱등성+감사로그","테스트 환불→'refunded'+로그 1건"),
 @("6","1차","보고서 재발급 + [디어네임에서 열기]","재발송·버튼 이동 동작"),
 @("7","1차","대시보드: 일/월/연 + 매출추이 그래프","구간 전환 시 숫자·그래프 일치"),
 @("8","2차","전환율 퍼널·AI 비용·차트 고도화","—"),
 @("9","후순위","콘텐츠/가격/점검 설정 화면","—")
)
$ry2=136
foreach($st in $steps){
  (Box $s 48 $ry2 864 38 $white $line $true)|Out-Null
  (Box $s 58 ($ry2+6) 26 26 $navy $null $true)|Out-Null
  (Txt $s 58 ($ry2+5) 26 26 $st[0] 12 -1 $white 2 3)|Out-Null
  (Txt $s 96 ($ry2+2) 446 34 $st[2] 11 -1 $ink 1 3)|Out-Null
  (Txt $s 548 ($ry2+2) 264 34 ("DoD: "+$st[3]) 9 0 $gray 1 3)|Out-Null
  $bd=$st[1]
  if($bd -eq "필수"){ Badge $s 820 ($ry2+11) 56 "필수" $red $white }
  elseif($bd -eq "1차"){ Badge $s 820 ($ry2+11) 56 "1차" $blue $white }
  elseif($bd -eq "2차"){ Badge $s 820 ($ry2+11) 56 "2차" $amber $white }
  else{ Badge $s 814 ($ry2+11) 62 "후순위" "94A3B8" $white }
  $ry2+=41
}

# ════════ 슬라이드 19 — 다음 단계 ════════
$s=NewSlide $navy
(Box $s 700 -100 360 360 $navy2 $null $false)|Out-Null
(Box $s 0 0 8 540 $blue $null $false)|Out-Null
(Txt $s 70 70 760 22 "NEXT STEPS" 13 -1 $ice 1 1)|Out-Null
(Txt $s 68 98 800 50 "다음 단계 — 바로 할 일" 32 -1 $white 1 1)|Out-Null
$steps=@(
  @("1","GitHub 빈 repo 생성","어드민용 별도 프로젝트 (dearname-admin)"),
  @("2","Supabase 프로젝트 + 테이블 생성","이 시점부터 임시 어드민(테이블 편집기) 확보"),
  @("3","Phase 0 — 데이터 적재 시작","server.py 결제검증 성공 지점에 주문 기록 추가")
)
$y=180
foreach($st in $steps){
  (Box $s 70 $y 820 86 $navy2 $null $true)|Out-Null
  (Box $s 86 ($y+19) 48 48 $blue $null $true)|Out-Null
  (Txt $s 86 ($y+19) 48 48 $st[0] 22 -1 $white 2 3)|Out-Null
  (Txt $s 152 ($y+16) 720 26 $st[1] 16 -1 $white 1 1)|Out-Null
  (Txt $s 152 ($y+46) 720 24 $st[2] 11.5 0 $ice 1 1)|Out-Null
  $y+=100
}
(Txt $s 70 502 820 24 "데이터가 쌓이기 시작하면 → Phase 1 어드민 MVP 착수" 12 -1 $ice 1 1)|Out-Null

# ── 저장 & 미리보기 내보내기 ──
if(Test-Path $OUT){ Remove-Item $OUT -Force }
$pres.SaveAs($OUT, 24)
if(Test-Path $PREVIEW){ Remove-Item $PREVIEW -Recurse -Force }
$pres.Export($PREVIEW,"PNG",1280,720)
$pres.Close()
$ppt.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($pres)|Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt)|Out-Null
Write-Output "DONE: $OUT"
