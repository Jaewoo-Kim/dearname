/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 사이드바 탭 통합(전환율 퍼널+AI 비용 → 분석, 감사 로그 → 팀 관리 하위)으로
  // 옮겨진 경로 — 북마크·즐겨찾기가 깨지지 않도록 리다이렉트한다.
  async redirects() {
    return [
      { source: '/funnel', destination: '/analytics', permanent: true },
      { source: '/ai-usage', destination: '/analytics/ai-usage', permanent: true },
      { source: '/audit-logs', destination: '/team/audit-logs', permanent: true },
    ];
  },
};

module.exports = nextConfig;
