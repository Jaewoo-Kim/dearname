'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  Bot,
  Filter,
  FileText,
  History,
  LanguagesIcon,
  LogOut,
  Menu,
  MessageCircle,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { ROLE_LABEL, type AdminRole } from '@/lib/roles';

const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: BarChart3 },
  { href: '/orders', label: '주문·결제', icon: Receipt },
  { href: '/reports', label: '보고서', icon: FileText },
  { href: '/inquiries', label: '고객문의', icon: MessageCircle },
  { href: '/members', label: '회원', icon: Users },
  { href: '/funnel', label: '전환율 퍼널', icon: Filter },
  { href: '/ai-usage', label: 'AI 비용', icon: Bot },
  { href: '/hanja-db', label: '한자 DB', icon: LanguagesIcon },
  { href: '/settings', label: '운영 관리', icon: Settings },
];

const ADMIN_ONLY_NAV_ITEMS = [
  { href: '/team', label: '팀 관리', icon: ShieldCheck },
  { href: '/audit-logs', label: '감사 로그', icon: History },
];

export default function Sidebar({
  email,
  role,
  pendingInquiryCount = 0,
  pendingApprovalCount = 0,
}: {
  email: string;
  role: AdminRole;
  pendingInquiryCount?: number;
  pendingApprovalCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = role === 'admin' ? [...NAV_ITEMS, ...ADMIN_ONLY_NAV_ITEMS] : NAV_ITEMS;
  const badgeCount: Record<string, number> = {
    '/inquiries': pendingInquiryCount,
    '/settings': pendingApprovalCount,
  };

  return (
    <>
      {/* 모바일 상단바 */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <span className="text-base font-semibold text-slate-900">DearName 어드민</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* 모바일 드로어 배경 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 -translate-x-full flex-col justify-between border-r border-slate-200 bg-white transition-transform duration-200 ease-out md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? 'translate-x-0' : ''
        }`}
      >
        <div>
          <div className="flex items-center justify-between px-5 py-5">
            <span className="text-base font-semibold text-slate-900">DearName 어드민</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 md:hidden"
              aria-label="메뉴 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-2 flex flex-col gap-1 px-3">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const count = badgeCount[item.href] || 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                    strokeWidth={2}
                  />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 && (
                    <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <p className="truncate text-xs text-slate-500" title={email}>
            {email}
          </p>
          <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {ROLE_LABEL[role]}
          </span>
          <form action="/auth/signout" method="post" className="mt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
