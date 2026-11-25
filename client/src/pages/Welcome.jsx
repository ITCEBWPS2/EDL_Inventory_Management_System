import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown } from 'lucide-react';
import welcomeBg from '../assets/edl_ims_bg.png';
import edlLogo from '../assets/EDL.png';
import { Login } from './Login';

export const Welcome = () => {
  const [isExiting, setIsExiting] = useState(false);
  const [showLoginUnderneath, setShowLoginUnderneath] = useState(false);
  const navigate = useNavigate();

  // Preload/decode assets and ensure maroon base color while Welcome is active
  useEffect(() => {
    // Preload & decode new background image and EDL logo so they are immediately available in memory
    const bgImg = new Image();
    bgImg.src = welcomeBg;
    bgImg.decode?.().catch(() => {});

    const logoImg = new Image();
    logoImg.src = edlLogo;
    logoImg.decode?.().catch(() => {});

    // Set dark maroon base background so no white flash is ever revealed
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    const rootEl = document.getElementById('root');
    const prevRootBg = rootEl ? rootEl.style.backgroundColor : '';

    document.documentElement.style.backgroundColor = '#280818';
    document.body.style.backgroundColor = '#280818';
    if (rootEl) rootEl.style.backgroundColor = '#280818';

    return () => {
      // If navigating to /login, Login component manages the background
      if (!window.location.pathname.startsWith('/login')) {
        document.documentElement.style.backgroundColor = prevHtmlBg;
        document.body.style.backgroundColor = prevBodyBg;
        if (rootEl) rootEl.style.backgroundColor = prevRootBg;
      }
    };
  }, []);

  const handleGetStarted = () => {
    if (isExiting) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) {
      navigate('/login', { replace: true, state: { fromWelcome: true } });
      return;
    }

    // Mount Login underneath so it is immediately visible as the Welcome layer slides up
    setShowLoginUnderneath(true);
    setIsExiting(true);

    setTimeout(() => {
      navigate('/login', { replace: true, state: { fromWelcome: true } });
    }, 700);
  };

  return (
    <div
      className="relative w-full overflow-hidden bg-[#280818]"
      style={{
        minHeight: '100dvh',
        height: '100vh'
      }}
    >
      <style>{`
        @keyframes welcomeFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .welcome-anim-logo {
          animation: welcomeFadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 0ms both;
        }
        .welcome-anim-label {
          animation: welcomeFadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
        }
        .welcome-anim-title {
          animation: welcomeFadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both;
        }
        .welcome-anim-button {
          animation: welcomeFadeUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 360ms both;
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-anim-logo,
          .welcome-anim-label,
          .welcome-anim-title,
          .welcome-anim-button {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
        .welcome-logo-plate {
          background-color: #fbf6f1;
          border-radius: 20px;
          padding: 14px 30px;
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.35);
          text-shadow: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .welcome-logo-img {
          width: 170px;
          height: auto;
          display: block;
        }
        @media (max-width: 640px) {
          .welcome-logo-plate {
            padding: 12px 24px;
            border-radius: 16px;
          }
          .welcome-logo-img {
            width: 140px;
          }
        }
        .welcome-btn-get-started {
          height: 58px;
          padding: 0 38px;
          border-radius: 29px;
          border: 0;
          background-color: #f6c026;
          color: #3b0c20;
          font-size: 16px;
          font-weight: 700;
          gap: 12px;
          margin-top: 10px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
          text-shadow: none;
          cursor: pointer;
          transition: background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
          outline: none;
        }
        .welcome-btn-get-started:hover {
          background-color: #ffd24a;
          transform: translateY(-1px);
        }
        .welcome-btn-get-started:active {
          transform: translateY(0);
        }
        .welcome-btn-get-started:focus-visible {
          outline: 3px solid #ffffff;
          outline-offset: 3px;
        }
      `}</style>

      {/* Part C: Real Login layer mounted underneath the Welcome curtain */}
      {showLoginUnderneath && (
        <div
          className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden"
          aria-hidden="true"
          tabIndex={-1}
        >
          <Login skipIntro={true} />
        </div>
      )}

      {/* Welcome Sliding Curtain Layer */}
      <div
        className="relative z-10 w-full h-full min-h-[100dvh] overflow-hidden bg-[#280818] text-white flex flex-col items-center justify-center text-center px-6"
        style={{
          transform: isExiting ? 'translateY(-100%)' : 'translateY(0)',
          transition: isExiting ? 'transform 700ms cubic-bezier(0.7, 0, 0.2, 1)' : 'none',
          willChange: isExiting ? 'transform' : 'auto'
        }}
      >
        {/* Sharp Background Photo - No blur, no filter */}
        <img
          src={welcomeBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
        />

        {/* Dark Maroon Overlay above the photo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(40,8,24,0.78) 0%, rgba(52,10,30,0.66) 55%, rgba(40,8,24,0.78) 100%)'
          }}
        />

        {/* Centered Content Container */}
        <main
          className="relative z-10 flex flex-col items-center text-center w-full"
          style={{
            maxWidth: '900px',
            gap: '26px'
          }}
        >
          {/* EDL logo on cream plate */}
          <div className="welcome-anim-logo">
            <div className="welcome-logo-plate">
              <img
                src={edlLogo}
                alt="EDL"
                className="welcome-logo-img select-none pointer-events-none"
              />
            </div>
          </div>

          {/* Monospace Gold Company Label */}
          <div
            className="welcome-anim-label uppercase"
            style={{
              fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.14em',
              color: '#f6c026',
              textShadow: '0 2px 24px rgba(0, 0, 0, 0.5)'
            }}
          >
            ELECTRICITY DISTRIBUTION LANKA (PVT) LTD
          </div>

          {/* Big White Title */}
          <h1
            className="welcome-anim-title font-bold text-white tracking-tight"
            style={{
              fontSize: 'clamp(34px, 5.6vw, 64px)',
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              textShadow: '0 2px 24px rgba(0, 0, 0, 0.5)'
            }}
          >
            Welcome To EDL Inventory{' '}
            <br className="hidden sm:inline" />
            Management System
          </h1>

          {/* Gold "Get started" button with down-arrow icon */}
          <div className="welcome-anim-button">
            <button
              type="button"
              onClick={handleGetStarted}
              className="welcome-btn-get-started group inline-flex items-center justify-center"
            >
              <span>Get started</span>
              <ArrowDown className="w-4 h-4 transition-transform duration-200 group-hover:translate-y-0.5" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Welcome;
