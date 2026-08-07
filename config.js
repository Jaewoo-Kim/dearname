// config.js — DearName v2 운영 설정 파일
// 이 파일을 수정하여 결제/로그인 기능을 활성화하세요
// 합본28_v2.html의 <head> 안에 가장 먼저 로드되어야 합니다
//
// 사용법:
//   <script src="config.js"></script>   ← 다른 스크립트보다 먼저

(function() {
    // ── 토스페이먼츠 ────────────────────────────────────────────────
    // 발급처: https://developers.tosspayments.com
    // 테스트 키: test_ck_로 시작, 라이브 키: live_ck_로 시작
    // 미설정(null)이면 결제 없이 소견서 생성 (개발·데모 모드)
    window.TOSS_CLIENT_KEY = null;
    // window.TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';

    // ── Google 로그인 ────────────────────────────────────────────────
    // 발급처: https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보
    // 미설정(null)이면 로그인 버튼 → 게스트 모드
    window.GOOGLE_CLIENT_ID = null;
    // window.GOOGLE_CLIENT_ID = '123456789-abcdef.apps.googleusercontent.com';

    // ── Apple 로그인 ─────────────────────────────────────────────────
    // 발급처: https://developer.apple.com → Certificates, Identifiers & Profiles
    // 미설정(null)이면 Apple 버튼 비활성
    window.APPLE_SERVICE_ID = null;
    // window.APPLE_SERVICE_ID = 'com.crazystudio.dearname';

    // ── Gemini API (채팅 상담용, 무료 테스트) ───────────────────────
    // 발급처: https://aistudio.google.com/apikey (무료, 로그인 후 즉시 발급)
    // 서버 환경변수 GEMINI_API_KEY 로 설정 — 이 파일에는 키를 넣지 마세요
    // (이 항목은 클라이언트에 노출되지 않음, 서버사이드에서만 사용)

    // ── 서비스 설정 ──────────────────────────────────────────────────
    window.DN_CONFIG = {
        serviceName:  'DearName',
        companyName:  'Crazystudio Co.',
        supportEmail: 'cs.crazystudio@gmail.com',
        version:      'v2.0.0',
        buildDate:    '2026-04-04',
    };

    console.log('[DearName] config.js 로드됨', window.DN_CONFIG);
})();
