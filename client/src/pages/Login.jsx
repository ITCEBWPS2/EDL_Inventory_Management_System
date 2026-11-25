import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import loginBg from '../assets/edl_ims_bg.png';
import edlLogo from '../assets/EDL.png';
import {
  normalizeIdentifier,
  validateIdentifier,
  validatePassword
} from '../utils/authValidation';

export const Login = ({ skipIntro: propSkipIntro = false } = {}) => {
  const location = useLocation();
  const [skipIntro] = useState(() => Boolean(propSkipIntro || location.state?.fromWelcome));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated user to Dashboard
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Preload assets and set dark maroon base background while Login is shown
  useEffect(() => {
    // Clean up history state so that any subsequent refresh (F5) will play the entrance animation
    if (location.state?.fromWelcome) {
      try {
        const { fromWelcome: _, ...restState } = window.history.state?.usr || {};
        window.history.replaceState(
          { ...window.history.state, usr: Object.keys(restState).length > 0 ? restState : null },
          ''
        );
      } catch {}
    }

    // Preload & decode background image and logo into memory
    const bgImg = new Image();
    bgImg.src = loginBg;
    bgImg.decode?.().catch(() => {});

    const logoImg = new Image();
    logoImg.src = edlLogo;
    logoImg.decode?.().catch(() => {});

    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    const rootEl = document.getElementById('root');
    const prevRootBg = rootEl ? rootEl.style.backgroundColor : '';

    document.documentElement.style.backgroundColor = '#280818';
    document.body.style.backgroundColor = '#280818';
    if (rootEl) rootEl.style.backgroundColor = '#280818';

    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
      if (rootEl) rootEl.style.backgroundColor = prevRootBg;
    };
  }, []);

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    if (usernameError) {
      // Clear error as soon as the value becomes valid
      const err = validateIdentifier(val.trim().toLowerCase());
      if (!err) {
        setUsernameError('');
      }
    }
    if (serverError) setServerError('');
  };

  const handleUsernameBlur = () => {
    const norm = normalizeIdentifier(username);
    setUsername(norm);
    const err = validateIdentifier(norm);
    setUsernameError(err || '');
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (passwordError) {
      const err = validatePassword(val);
      if (!err) {
        setPasswordError('');
      }
    }
    if (serverError) setServerError('');
  };

  const handlePasswordBlur = () => {
    const err = validatePassword(password);
    setPasswordError(err || '');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (loading) return;

    // Normalise username/email on submit
    const normUsername = normalizeIdentifier(username);
    setUsername(normUsername);

    const userErr = validateIdentifier(normUsername);
    const passErr = validatePassword(password);

    setUsernameError(userErr || '');
    setPasswordError(passErr || '');
    setServerError('');

    if (userErr) {
      usernameInputRef.current?.focus();
      return;
    }

    if (passErr) {
      passwordInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await login(normUsername, password);
      if (res?.user?.permission_level === 'disposal_only') {
        navigate('/disposal-requests');
      } else {
        navigate('/');
      }
    } catch (err) {
      let msg = 'Incorrect username/email or password.';
      if (err.status === 429 || (err.message && err.message.toLowerCase().includes('too many'))) {
        const retrySecs = err.retryAfter ? parseInt(err.retryAfter, 10) : 900;
        const retryMins = !isNaN(retrySecs) ? Math.ceil(retrySecs / 60) : 15;
        msg = `Too many attempts. Try again in ${retryMins} minute${retryMins === 1 ? '' : 's'}.`;
      } else if (err.status === 403 || (err.message && err.message.toLowerCase().includes('inactive'))) {
        msg = 'Your account is inactive. Contact your administrator.';
      } else if (err.status === 400 && err.data?.message) {
        msg = err.data.message;
      } else if (
        err.name === 'TypeError' ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError') ||
        !err.status
      ) {
        msg = 'Cannot reach the server. Check your connection and try again.';
      } else if (err.status === 401) {
        msg = 'Incorrect username/email or password.';
      } else if (err.message) {
        msg = err.message;
      }
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-page-wrapper relative flex items-center justify-center overflow-hidden w-full"
      style={{
        minHeight: '100dvh',
        height: '100vh',
        padding: '24px',
        backgroundColor: '#280818'
      }}
    >
      <style>{`
        .login-card {
          width: min(92vw, 430px);
          padding: 34px 34px 28px;
          border-radius: 26px;
          background-color: rgba(251, 246, 241, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.55);
          box-shadow: 0 28px 70px rgba(20, 4, 12, 0.45);
        }
        .login-card-animated {
          animation: loginFadeUp 450ms ease-out both;
        }
        @supports (backdrop-filter: blur(18px)) or (-webkit-backdrop-filter: blur(18px)) {
          .login-card {
            background-color: rgba(251, 246, 241, 0.82);
            backdrop-filter: blur(18px) saturate(1.15);
            -webkit-backdrop-filter: blur(18px) saturate(1.15);
          }
        }
        @keyframes loginFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-card-animated {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
        @media (max-width: 480px) {
          .login-page-wrapper {
            padding: 16px !important;
          }
          .login-card {
            width: calc(100vw - 32px) !important;
            padding: 28px 20px 24px !important;
          }
          .login-logo-img {
            width: 150px !important;
          }
        }
        @media (max-height: 560px) {
          .login-footer-text {
            display: none !important;
          }
        }
        .login-input {
          width: 100%;
          height: 48px;
          border-radius: 14px;
          background-color: #ffffff;
          border: 1px solid rgba(122, 28, 61, 0.18);
          color: #2a1520;
          font-size: 13px;
          transition: border-color 150ms ease, box-shadow 150ms ease;
          outline: none;
        }
        .login-input::placeholder {
          color: #7d6a73;
          opacity: 1;
        }
        .login-input:focus {
          border-color: #7a1c3d !important;
          box-shadow: 0 0 0 3px rgba(122, 28, 61, 0.22) !important;
          outline: none;
        }
        .login-input.has-error {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.20) !important;
        }
        .login-input::-ms-reveal,
        .login-input::-ms-clear {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .login-submit-btn {
          width: 100%;
          height: 50px;
          border-radius: 14px;
          background: linear-gradient(135deg, #8a2247, #6b1735);
          color: #ffffff;
          font-weight: 700;
          letter-spacing: 0.08em;
          font-size: 14px;
          border: none;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(122, 28, 61, 0.35);
          transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .login-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #7a1c3d, #5a1230);
          transform: translateY(-1px);
        }
        .login-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-submit-btn:focus-visible {
          outline: 3px solid #f6b400;
          outline-offset: 2px;
        }
        .login-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .login-forgot-link {
          display: inline-block;
          font-size: 13.5px;
          font-weight: 600;
          color: #7a1c3d;
          margin-top: 18px;
          text-decoration: none;
          transition: color 150ms ease;
        }
        .login-forgot-link:hover {
          text-decoration: underline;
        }
        .login-forgot-link:focus-visible {
          outline: 2px solid #f6b400;
          outline-offset: 2px;
          border-radius: 4px;
        }
      `}</style>

      {/* Sharp Fullscreen Background Photo - No blur, no filter, no transform */}
      <img
        src={loginBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
      />

      {/* Dark Maroon Overlay above the photo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(40,8,24,0.70) 0%, rgba(52,10,30,0.55) 55%, rgba(40,8,24,0.70) 100%)'
        }}
      />

      {/* Centered Cream Frosted-Glass Card */}
      <main className={`login-card relative z-10 flex flex-col items-center ${!skipIntro ? 'login-card-animated' : ''}`}>
        {/* a) "ELECTRICITY DISTRIBUTION LANKA": 12px, weight 700, letter-spacing 0.14em, color #5a1230 */}
        <div
          className="text-center uppercase"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#5a1230',
            lineHeight: 1.3
          }}
        >
          ELECTRICITY DISTRIBUTION LANKA
        </div>

        {/* b) EDL Logo: width 180px, height auto, margin 14px 0 10px */}
        <div className="flex items-center justify-center" style={{ margin: '14px 0 10px' }}>
          <img
            src={edlLogo}
            alt="EDL"
            className="login-logo-img"
            style={{
              width: '180px',
              height: 'auto',
              display: 'block'
            }}
          />
        </div>

        {/* c) "INVENTORY MANAGEMENT SYSTEM": 13px, weight 600, letter-spacing 0.12em, color #5a1230 */}
        <div
          className="text-center uppercase"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: '#5a1230',
            lineHeight: 1.3
          }}
        >
          INVENTORY MANAGEMENT SYSTEM
        </div>

        {/* d) Short gold divider: width 48px, height 3px, border-radius 2px, background #f6b400, margin 16px auto 24px */}
        <div
          aria-hidden="true"
          style={{
            width: '48px',
            height: '3px',
            borderRadius: '2px',
            backgroundColor: '#f6b400',
            margin: '16px auto 24px'
          }}
        />

        {/* e) Login Form */}
        <form onSubmit={handleSubmit} noValidate className="w-full flex flex-col gap-3.5">
          {/* Username or Email Input */}
          <div className="w-full">
            <label htmlFor="login-username" className="sr-only">
              Username or email
            </label>
            <div className="relative w-full">
              <User
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: '#7a1c3d' }}
              />
              <input
                ref={usernameInputRef}
                id="login-username"
                type="text"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                aria-invalid={usernameError ? 'true' : 'false'}
                aria-describedby={usernameError ? 'login-username-error' : undefined}
                placeholder="Username or email"
                value={username}
                onChange={handleUsernameChange}
                onBlur={handleUsernameBlur}
                className={`login-input pl-10 pr-3.5 ${usernameError ? 'has-error' : ''}`}
              />
            </div>
            {usernameError && (
              <p
                id="login-username-error"
                role="alert"
                className="text-[12px] font-medium text-[#dc2626] text-left mt-1 pl-1"
              >
                {usernameError}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="w-full">
            <label htmlFor="login-password" className="sr-only">
              Password
            </label>
            <div className="relative w-full">
              <Lock
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: '#7a1c3d' }}
              />
              <input
                ref={passwordInputRef}
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                maxLength={128}
                aria-invalid={passwordError ? 'true' : 'false'}
                aria-describedby={passwordError ? 'login-password-error' : undefined}
                placeholder="Password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                className={`login-input pl-10 pr-11 ${passwordError ? 'has-error' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f6b400]"
                style={{ color: '#7a1c3d' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {passwordError && (
              <p
                id="login-password-error"
                role="alert"
                className="text-[12px] font-medium text-[#dc2626] text-left mt-1 pl-1"
              >
                {passwordError}
              </p>
            )}
          </div>

          {/* Form-level Server Error Box */}
          {serverError && (
            <div
              role="alert"
              className="w-full text-center font-medium animate-in fade-in duration-150"
              style={{
                background: 'rgba(254, 226, 226, 0.95)',
                color: '#991b1b',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '13px'
              }}
            >
              {serverError}
            </div>
          )}

          {/* LOGIN Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="login-submit-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>LOGGING IN...</span>
              </>
            ) : (
              <span>LOGIN</span>
            )}
          </button>

          {/* Below the button: two small links side by side, separated by a thin divider */}
          <div className="flex items-center justify-center gap-2.5 text-center mt-3">
            <Link
              to="/forgot-password"
              id="link-forgot-password"
              className="login-forgot-link !mt-0"
            >
              Forgot password?
            </Link>
            <span className="text-[rgba(122,28,61,0.30)] select-none text-xs">|</span>
            <Link
              to="/update-password"
              id="link-update-password"
              className="login-forgot-link !mt-0"
            >
              Update password
            </Link>
          </div>
        </form>
      </main>

      {/* 3) Small footer text */}
      <footer
        className="login-footer-text absolute bottom-4 left-0 right-0 text-center pointer-events-none select-none z-10 px-4"
        style={{
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.8)',
          textShadow: '0 1px 6px rgba(0, 0, 0, 0.5)'
        }}
      >
        &copy; 2026 Electricity Distribution Lanka (Pvt) Ltd.
      </footer>
    </div>
  );
};

export default Login;
