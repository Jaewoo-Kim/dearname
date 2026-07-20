export type AdminRole = 'admin' | 'editor' | 'viewer';

export const ROLE_LABEL: Record<AdminRole, string> = {
  admin: '어드민',
  editor: '편집자',
  viewer: '뷰어',
};

export const ALL_ROLES: AdminRole[] = ['admin', 'editor', 'viewer'];

export function isValidRole(value: unknown): value is AdminRole {
  return value === 'admin' || value === 'editor' || value === 'viewer';
}

// 편집자/어드민은 쓰기 작업 가능(단, 운영 관리 설정은 편집자의 경우 승인 대기로 빠진다).
// 뷰어는 조회만 가능.
export function canWrite(role: AdminRole | null | undefined): boolean {
  return role === 'admin' || role === 'editor';
}

export function isAdmin(role: AdminRole | null | undefined): boolean {
  return role === 'admin';
}
