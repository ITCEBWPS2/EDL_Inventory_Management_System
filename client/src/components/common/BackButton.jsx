import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const BackButton = ({ to, onClick, label = 'Back', className = '', id = 'btn-back' }) => {
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (!to) {
      e.preventDefault();
      navigate(-1);
    }
  };

  const content = (
    <>
      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
      <span>{label}</span>
    </>
  );

  const baseClasses = "inline-flex items-center gap-1.5 text-xs text-slate hover:text-ink transition-colors font-medium group select-none";

  if (to) {
    return (
      <div className={`mt-8 mb-4 ${className}`}>
        <Link
          to={to}
          id={id}
          className={baseClasses}
        >
          {content}
        </Link>
      </div>
    );
  }

  return (
    <div className={`mt-8 mb-4 ${className}`}>
      <button
        type="button"
        id={id}
        onClick={handleClick}
        className={baseClasses}
      >
        {content}
      </button>
    </div>
  );
};
