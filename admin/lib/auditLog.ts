export const ACTION_LABEL: Record<string, string> = {
  refund: '환불 처리',
  grant_report_credit: '재발급(생성권 부여)',
  edit_report_content: '보고서 본문 수정',
  reply_inquiry: '고객문의 답변',
  update_hanja: '한자 DB 정정',
  revert_hanja: '한자 DB 정정 원복',
  add_taboo_hanja: '금기 한자 추가',
  remove_taboo_hanja: '금기 한자 삭제',
  update_settings: '운영 관리 변경(즉시 반영)',
  request_settings_change: '운영 관리 변경 요청',
  approve_settings_change: '운영 관리 변경 승인',
  reject_settings_change: '운영 관리 변경 반려',
  add_admin_user: '어드민 계정 추가',
  update_admin_role: '어드민 등급 변경',
  remove_admin_user: '어드민 계정 삭제',
};

const TARGET_LABEL: Record<string, string> = {
  order: '주문',
  report: '보고서',
  inquiry: '고객문의',
  settings: '운영 관리',
  admin_user: '어드민 계정',
};

const TARGET_LINKABLE = new Set(['order', 'report', 'inquiry']);

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] || action;
}

export function targetLabel(targetType: string | null): string {
  if (!targetType) return '-';
  return TARGET_LABEL[targetType] || targetType;
}

export function targetHref(targetType: string | null, targetId: string | null): string | null {
  if (!targetType || !targetId || !TARGET_LINKABLE.has(targetType)) return null;
  return `/${targetType}s/${targetId}`;
}
