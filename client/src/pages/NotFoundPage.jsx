import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { FileQuestion, ArrowLeft, LayoutDashboard } from 'lucide-react';

export const NotFoundPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const content = (
    <div className="min-h-[55vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[rgba(123,28,62,0.08)] border border-[rgba(123,28,62,0.15)] text-[#7B1C3E] flex items-center justify-center mb-4 shadow-2xs">
        <FileQuestion className="w-8 h-8 text-[#7B1C3E]" />
      </div>
      <h1 className="text-2xl font-bold text-ink mb-2">404 - Page Not Found</h1>
      <p className="text-xs text-slate max-w-md mb-6 leading-relaxed">
        The page you are looking for does not exist, has been removed, or the link is incorrect.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => navigate(-1)}
          variant="secondary"
          size="regular"
          icon={ArrowLeft}
          label="Go Back"
        />
        <Button
          to="/dashboard"
          variant="primary"
          size="regular"
          icon={LayoutDashboard}
          label="Back to Dashboard"
        />
      </div>
    </div>
  );

  if (user) {
    return (
      <AppShell breadcrumbs={[{ label: 'Page Not Found' }]}>
        {content}
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="content-card max-w-md w-full p-8 shadow-lg text-center">
        {content}
      </div>
    </div>
  );
};

