'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: '📊' },
  { href: '/orders', label: '주문·결제', icon: '🧾' },
  { href: '/reports', label: '보고서', icon: '📄' },
  { href: '/members', label: '회원', icon: '👤' },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col justify-between border-r border-slate-200 bg-white">
      <div>
        <div className="px-5 py-5">
          <span className="text-base font-semibold text-slate-900">DearName 어드민</span>
        </div>
        <nav className="mt-2 flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <span className="mt-1 flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300">
            <span>⚙️</span>
            설정 (예정)
          </span>
        </nav>
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <p className="truncate text-xs text-slate-500" title={email}>{email}</p>
        <form action="/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className="text-xs font-medium text-slate-400 hover:text-slate-700"
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
