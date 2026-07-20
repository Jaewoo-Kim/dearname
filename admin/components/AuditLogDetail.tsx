'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function AuditLogDetail({ detail }: { detail: unknown }) {
  const [open, setOpen] = useState(false);

  if (detail == null || (typeof detail === 'object' && Object.keys(detail as object).length === 0)) {
    return <span className="text-slate-300">-</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        상세
      </button>
      {open && (
        <pre className="mt-1 max-w-md overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </div>
  );
}
