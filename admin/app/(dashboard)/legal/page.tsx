import { createClient } from '@/lib/supabase/server';
import { fetchRole } from '@/lib/adminUser';
import { formatDate } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import LegalDocumentEditor from '@/components/LegalDocumentEditor';
import { LEGAL_DOC_LABELS } from '@/lib/types';
import type { LegalDocType, LegalDocumentRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DOC_TYPES: LegalDocType[] = ['terms', 'privacy'];

// 저장된 본문이 없으면 본 서비스가 저장소의 기본 본문을 초기값으로 내려준다.
async function loadContent(siteUrl: string | undefined, docType: LegalDocType) {
  if (!siteUrl) return { content: '', source: 'unavailable' as const };
  try {
    const res = await fetch(`${siteUrl.replace(/\/$/, '')}/proxy/legal/${docType}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { content: '', source: 'unavailable' as const };
    const data = await res.json();
    return {
      content: typeof data.content === 'string' ? data.content : '',
      source: (data.source === 'db' ? 'db' : 'file') as 'db' | 'file',
    };
  } catch {
    return { content: '', source: 'unavailable' as const };
  }
}

export default async function LegalPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = await fetchRole(supabase, user?.email || '');
  const isAdmin = role === 'admin';

  const siteUrl = process.env.NEXT_PUBLIC_DEARNAME_SITE_URL;

  const { data: historyData } = await supabase
    .from('legal_documents')
    .select('id, created_at, doc_type, effective_date, updated_by')
    .order('created_at', { ascending: false })
    .limit(30);
  const history = (historyData as unknown as LegalDocumentRow[]) || [];

  const loaded = await Promise.all(DOC_TYPES.map((t) => loadContent(siteUrl, t)));

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="약관·방침 관리"
        description="이용약관과 개인정보처리방침 본문을 직접 수정합니다. 저장하면 서비스 페이지에 즉시 반영되고, 이전 내용은 개정 이력으로 남습니다."
      />

      {!isAdmin && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          약관·개인정보처리방침은 법적 효력이 있는 문서라 <b>어드민 등급만</b> 수정할 수 있습니다.
          내용 확인은 가능합니다.
        </div>
      )}

      <div className="space-y-5">
        {DOC_TYPES.map((docType, i) => {
          const latest = history.find((h) => h.doc_type === docType) || null;
          return (
            <LegalDocumentEditor
              key={docType}
              docType={docType}
              label={LEGAL_DOC_LABELS[docType]}
              initialContent={loaded[i].content}
              initialEffectiveDate={latest?.effective_date ?? null}
              source={loaded[i].source}
              publicUrl={siteUrl ? `${siteUrl.replace(/\/$/, '')}/${docType}.html` : null}
              readOnly={!isAdmin}
              readOnlyReason="어드민 등급만 수정할 수 있습니다."
            />
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-500">개정 이력</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            아직 어드민에서 저장한 기록이 없습니다. 현재는 저장소의 기본 본문이 게시되고 있습니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">저장일시</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">문서</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">시행일</th>
                  <th className="whitespace-nowrap py-2 font-medium">수정자</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => {
                  const isLive = history.findIndex((x) => x.doc_type === h.doc_type) === idx;
                  return (
                    <tr key={h.id} className="border-b border-slate-50 last:border-0">
                      <td className="whitespace-nowrap py-2 pr-4 text-slate-500">{formatDate(h.created_at)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-slate-700">
                        {LEGAL_DOC_LABELS[h.doc_type] || h.doc_type}
                        {isLive && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            게시중
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 text-slate-500">{h.effective_date || '-'}</td>
                      <td className="whitespace-nowrap py-2 text-slate-500">{h.updated_by || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
