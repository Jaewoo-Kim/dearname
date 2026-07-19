import { AlertTriangle } from 'lucide-react';

export default function AllowlistWarningBanner() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <b>ADMIN_ALLOWED_EMAILS</b>가 설정되지 않아 로그인한 모든 계정이 어드민 전체 권한을 갖습니다.
        운영 배포 전 반드시 환경변수를 채워주세요.
      </span>
    </div>
  );
}
