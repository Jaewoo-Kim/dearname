import { Suspense } from 'react';
import LoginForm from './LoginForm';
import AllowlistWarningBanner from '@/components/AllowlistWarningBanner';
import { getAllowlist } from '@/lib/authz';

export default function LoginPage() {
  const allowlistConfigured = getAllowlist().length > 0;

  return (
    <Suspense fallback={null}>
      {!allowlistConfigured && (
        <div className="mx-auto max-w-sm px-4 pt-6">
          <AllowlistWarningBanner />
        </div>
      )}
      <LoginForm />
    </Suspense>
  );
}
