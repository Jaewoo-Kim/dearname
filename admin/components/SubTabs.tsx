import Link from 'next/link';

export default function SubTabs({ tabs, active }: { tabs: { href: string; label: string }[]; active: string }) {
  return (
    <div className="mb-4 flex gap-4 border-b border-slate-200">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`-mb-px border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
            active === tab.href
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
