import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DearName 어드민',
  description: 'DearName 운영 어드민 — 주문·보고서·회원 관리',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
