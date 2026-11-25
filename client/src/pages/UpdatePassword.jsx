import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { User, Lock, KeyRound, Eye, EyeOff, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import loginBg from '../assets/edl_ims_bg.png';
import edlLogo from '../assets/EDL.png';
import {
  normalizeIdentifier,
  validateIdentifier,
  checkPasswordRules,
  validateNewPassword
} from '../utils/authValidation';

export const UpdatePassword = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If user is already authenticated, send to Dashboard (same as /login)
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [samePasswordError, setSamePasswordError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [redirectCount, setRedirectCount] = useState(3);

  const usernameRef = useRef(null);
  const currentPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);

  // Set page background color to EDL dark maroon
  useEffect(() => {
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

  // Handle countdown on success
  useEffect(() => {
    let timer = null;
    if (isSuccess) {
      timer = setInterval(() => {
        setRedirectCount((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/login');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSuccess, navigate]);

  const passwordRules = checkPasswordRules(newPassword);
  const isDiffFromCurrent = !currentPassword || !newPassword || currentPassword !== newPassword;
  const isFormValid =
    username.trim().length >= 3 &&
    Boolean(currentPassword) &&
    passwordRules.isValid &&
    isDiffFromCurrent &&
    !usernameError &&
    !passwordError &&
    !samePasswordError;

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    if (usernameError) {
      const err = validateIdentifier(val.trim().toLowerCase());
      if (!err) setUsernameError('');
    }
    if (serverError) setServerError('');
  };

  const handleUsernameBlur = () => {
    const norm = normalizeIdentifier(username);
    setUsername(norm);
    const err = validateIdentifier(norm);
    setUsernameError(err || '');
  };

  const handleCurrentPasswordChange = (e) => {
    const val = e.target.value;
    setCurrentPassword(val);
    if (newPassword && val === newPassword) {
      setSamePasswordError('New password must differ from current password.');
    } else {
      setSamePasswordError('');
    }
    if (serverError) setServerError('');
  };

  const handleNewPasswordChange = (e) => {
    const val = e.target.value;
    setNewPassword(val);
    if (passwordError) {
      const err = validateNewPassword(val);
      if (!err) setPasswordError('');
    }
    if (currentPassword && val === currentPassword) {
      setSamePasswordError('New password must differ from current password.');
    } else {
      setSamePasswordError('');
    }
    if (serverError) setServerError('');
  };

  const handleNewPasswordBlur = () => {
    if (!newPassword) {
      setPasswordError('Enter a new password.');
    } else {
      const err = validateNewPassword(newPassword);
      setPasswordError(err || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || isSuccess) return;

    const normUsername = normalizeIdentifier(username);
    setUsername(normUsername);

    const userErr = validateIdentifier(normUsername);
    if (userErr) {
      setUsernameError(userErr);
      usernameRef.current?.focus();
      return;
    }

    if (!currentPassword) {
      currentPasswordRef.current?.focus();
      return;
    }

    if (!passwordRules.isValid) {
      newPasswordRef.current?.focus();
      return;
    }

    if (currentPassword === newPassword) {
      setSamePasswordError('New password must differ from current password.');
      newPasswordRef.current?.focus();
      return;
    }

    setLoading(true);
    setServerError('');

    try {
      const res = await api.post('/auth/update-password', {
        username: normUsername,
        current_password: currentPassword,
        new_password: newPassword
      });

      if (res?.success) {
        setIsSuccess(true);
      } else {
        setServerError(res?.message || 'Username or current password is incorrect.');
      }
    } catch (err) {
      setServerError(err.message || 'Username or current password is incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="update-page-wrapper relative flex items-center justify-center overflow-hidden w-full"
      style={{
        minHeight: '100dvh',
        height: '100vh',
        padding: '24px',
        backgroundColor: '#280818'
      }}
    >
      <style>{`
        .update-card {
          width: min(92vw, 430px);
          padding: 30px 32px 24px;
          border-radius: 26px;
          background-color: rgba(251, 246, 241, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.55);
          box-shadow: 0 28px 70px rgba(20, 4, 12, 0.45);
          max-height: 94vh;
          overflow-y: auto;
        }
        @supports (backdrop-filter: blur(18px)) or (-webkit-backdrop-filter: blur(18px)) {
          .update-card {
            background-color: rgba(251, 246, 241, 0.84);
            backdrop-filter: blur(18px) saturate(1.15);
            -webkit-backdrop-filter: blur(18px) saturate(1.15);
          }
        }
        @media (max-width: 480px) {
          .update-page-wrapper {
            padding: 12px !important;
          }
          .update-card {
            width: calc(100vw - 24px) !important;
            padding: 24px 18px 20px !important;
          }
          .update-logo-img {
            width: 140px !important;
          }
        }
        @media (max-height: 600px) {
          .update-footer-text {
            display: none !important;
          }
        }
        .update-input {
          width: 100%;
          height: 44px;
          border-radius: 12px;
          background-color: #ffffff;
          border: 1px solid rgba(122, 28, 61, 0.18);
          color: #2a1520;
          font-size: 13px;
          transition: border-color 150ms ease, box-shadow 150ms ease;
          outline: none;
        }
        .update-input::placeholder {
          color: #7d6a73;
          opacity: 1;
        }
        .update-input:focus {
          border-color: #7a1c3d !important;
          box-shadow: 0 0 0 3px rgba(122, 28, 61, 0.22) !important;
          outline: none;
        }
        .update-input.has-error {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.20) !important;
        }
        .update-input::-ms-reveal,
        .update-input::-ms-clear {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .update-submit-btn {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #8a2247, #6b1735);
          color: #ffffff;
          font-weight: 700;
          letter-spacing: 0.08em;
          font-size: 13.5px;
          border: none;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(122, 28, 61, 0.35);
          transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .update-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #7a1c3d, #5a1230);
          transform: translateY(-1px);
        }
        .update-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .update-submit-btn:focus-visible {
          outline: 3px solid #f6b400;
          outline-offset: 2px;
        }
        .update-submit-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>

      {/* Sharp Fullscreen Background Photo */}
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
      <main className="update-card relative z-10 flex flex-col items-center">
        {/* Company header */}
        <div
          className="text-center uppercase"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#5a1230',
            lineHeight: 1.2
          }}
        >
          ELECTRICITY DISTRIBUTION LANKA
        </div>

        {/* EDL Logo */}
        <div className="my-2 flex items-center justify-center">
          <img
            src={edlLogo}
            alt="EDL"
            className="update-logo-img"
            style={{
              width: '160px',
              height: 'auto',
              display: 'block'
            }}
          />
        </div>

        {/* System Title */}
        <div
          className="text-center uppercase"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#5a1230',
            lineHeight: 1.2
          }}
        >
          INVENTORY MANAGEMENT SYSTEM
        </div>

        {/* Gold divider line */}
        <div
          role="separator"
          aria-hidden="true"
          style={{
            width: '44px',
            height: '3px',
            borderRadius: '2px',
            backgroundColor: '#f6b400',
            margin: '10px auto 18px'
          }}
        />

        {isSuccess ? (
          <div
            role="status"
            aria-live="polite"
            className="w-full bg-[rgba(240,253,244,0.95)] border border-emerald-300 rounded-xl p-5 text-center space-y-3 animate-in zoom-in-95 duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-900">Password updated. You can now log in.</h2>
              <p className="text-xs text-emerald-700 mt-1">
                Redirecting to login in {redirectCount} second{redirectCount !== 1 ? 's' : ''}...
              </p>
            </div>
            <button
              type="button"
              id="btn-go-to-login"
              onClick={() => navigate('/login')}
              className="update-submit-btn w-full mt-2"
            >
              <span>Go to Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="w-full flex flex-col gap-3">
            {/* Username */}
            <div className="w-full">
              <label
                htmlFor="update-username"
                className="block text-xs font-semibold mb-1"
                style={{ color: '#3b2430' }}
              >
                Username
              </label>
              <div className="relative w-full">
                <User
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#7d6a73]"
                />
                <input
                  ref={usernameRef}
                  id="update-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-invalid={usernameError ? 'true' : 'false'}
                  aria-describedby={usernameError ? 'update-username-error' : undefined}
                  placeholder="Enter username"
                  value={username}
                  onChange={handleUsernameChange}
                  onBlur={handleUsernameBlur}
                  className={`update-input pl-10 pr-3.5 ${usernameError ? 'has-error' : ''}`}
                />
              </div>
              {usernameError && (
                <p
                  id="update-username-error"
                  role="alert"
                  className="text-[11.5px] font-medium text-[#dc2626] text-left mt-1 pl-1"
                >
                  {usernameError}
                </p>
              )}
            </div>

            {/* Current Password */}
            <div className="w-full">
              <label
                htmlFor="update-current-password"
                className="block text-xs font-semibold mb-1"
                style={{ color: '#3b2430' }}
              >
                Current Password
              </label>
              <div className="relative w-full">
                <Lock
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#7d6a73]"
                />
                <input
                  ref={currentPasswordRef}
                  id="update-current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  name="current-password"
                  autoComplete="current-password"
                  maxLength={128}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={handleCurrentPasswordChange}
                  className="update-input pl-10 pr-11"
                />
                <button
                  type="button"
                  id="toggle-update-current-password"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors text-[#7d6a73] hover:text-[#5a1230] focus:outline-none"
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  title={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Secure Password */}
            <div className="w-full">
              <label
                htmlFor="update-new-password"
                className="block text-xs font-semibold mb-1"
                style={{ color: '#3b2430' }}
              >
                New Secure Password
              </label>
              <div className="relative w-full">
                <KeyRound
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#7d6a73]"
                />
                <input
                  ref={newPasswordRef}
                  id="update-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  name="new-password"
                  autoComplete="new-password"
                  maxLength={128}
                  aria-invalid={(samePasswordError || passwordError) ? 'true' : 'false'}
                  aria-describedby={(samePasswordError || passwordError) ? 'update-same-password-error' : undefined}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  onBlur={handleNewPasswordBlur}
                  className={`update-input pl-10 pr-11 ${(samePasswordError || passwordError) ? 'has-error' : ''}`}
                />
                <button
                  type="button"
                  id="toggle-update-new-password"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors text-[#7d6a73] hover:text-[#5a1230] focus:outline-none"
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  title={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {(samePasswordError || passwordError) && (
                <p
                  id="update-same-password-error"
                  role="alert"
                  className="text-[11.5px] font-medium text-[#dc2626] text-left mt-1 pl-1"
                >
                  {samePasswordError || passwordError}
                </p>
              )}
            </div>

            {/* Server Error Message Box */}
            {serverError && (
              <div
                role="alert"
                aria-live="polite"
                className="w-full text-xs font-medium text-center animate-in fade-in duration-150"
                style={{
                  background: 'rgba(254, 226, 226, 0.95)',
                  color: '#991b1b',
                  borderRadius: '10px',
                  padding: '8px 12px'
                }}
              >
                {serverError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-update-password-submit"
              disabled={!isFormValid || loading}
              className="update-submit-btn mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>UPDATING...</span>
                </>
              ) : (
                <span>UPDATE PASSWORD</span>
              )}
            </button>

            {/* Remembered password / Return to Login Link */}
            <div className="mt-1 text-center text-xs" style={{ color: '#3b2430' }}>
              Remembered your password?{' '}
              <Link
                to="/login"
                id="link-back-to-login"
                className="font-semibold transition-colors hover:underline text-[#7a1c3d]"
              >
                Log in
              </Link>
            </div>
          </form>
        )}
      </main>

      {/* Footer text pinned at the bottom */}
      <footer
        className="update-footer-text absolute bottom-3 left-0 right-0 text-center text-xs pointer-events-none select-none z-10"
        style={{
          color: 'rgba(255, 255, 255, 0.72)',
          letterSpacing: '0.04em',
          fontWeight: 500
        }}
      >
        © {new Date().getFullYear()} Electricity Distribution Lanka (Pvt) Ltd.
      </footer>
    </div>
  );
};

export default UpdatePassword;

