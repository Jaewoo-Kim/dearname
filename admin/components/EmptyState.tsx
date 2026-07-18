import { Inbox, type LucideIcon } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="max-w-xs text-xs text-slate-400">{description}</p>}
    </div>
  );
}
