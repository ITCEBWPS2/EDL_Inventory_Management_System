import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import loginBg from '../assets/edl_ims_bg.png';
import edlLogo from '../assets/EDL.png';
import {
  normalizeIdentifier,
  validateIdentifier,
  checkPasswordRules,
  validateNewPassword
} from '../utils/authValidation';

export const ForgotPassword = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // If user is already authenticated, send to Dashboard (same as /login)
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [redirectCount, setRedirectCount] = useState(3);

  const usernameRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

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
  const isConfirmValid = confirmPassword && confirmPassword === newPassword;
  const isFormValid =
    username.trim().length >= 3 &&
    passwordRules.isValid &&
    isConfirmValid &&
    !usernameError &&
    !passwordError &&
    !confirmError;

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

  const handleNewPasswordChange = (e) => {
    const val = e.target.value;
    setNewPassword(val);
    if (passwordError) {
      const err = validateNewPassword(val);
      if (!err) setPasswordError('');
    }
    if (confirmPassword && val !== confirmPassword) {
      setConfirmError('Passwords do not match.');
    } else {
      setConfirmError('');
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

  const handleConfirmPasswordChange = (e) => {
    const val = e.target.value;
    setConfirmPassword(val);
    if (val && val !== newPassword) {
      setConfirmError('Passwords do not match.');
    } else {
      setConfirmError('');
    }
    if (serverError) setServerError('');
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

    if (!passwordRules.isValid) {
      newPasswordRef.current?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      confirmPasswordRef.current?.focus();
      return;
    }

    setLoading(true);
    setServerError('');

    try {
      const res = await api.post('/auth/forgot-password', {
        username: normUsername,
        newPassword,
        confirmPassword
      });

      if (res?.success) {
        setIsSuccess(true);
      } else {
        setServerError(res?.message || 'Unable to reset the password. Please check the details and try again.');
      }
    } catch (err) {
      setServerError(err.message || 'Unable to reset the password. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="forgot-page-wrapper relative flex items-center justify-center overflow-hidden w-full"
      style={{
        minHeight: '100dvh',
        height: '100vh',
        padding: '24px',
        backgroundColor: '#280818'
      }}
    >
      <style>{`
        .forgot-card {
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
          .forgot-card {
            background-color: rgba(251, 246, 241, 0.84);
            backdrop-filter: blur(18px) saturate(1.15);
            -webkit-backdrop-filter: blur(18px) saturate(1.15);
          }
        }
        @media (max-width: 480px) {
          .forgot-page-wrapper {
            padding: 12px !important;
          }
          .forgot-card {
            width: calc(100vw - 24px) !important;
            padding: 24px 18px 20px !important;
          }
          .forgot-logo-img {
            width: 140px !important;
          }
        }
        @media (max-height: 600px) {
          .forgot-footer-text {
            display: none !important;
          }
        }
        .forgot-input {
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
        .forgot-input::placeholder {
          color: #7d6a73;
          opacity: 1;
        }
        .forgot-input:focus {
          border-color: #7a1c3d !important;
          box-shadow: 0 0 0 3px rgba(122, 28, 61, 0.22) !important;
          outline: none;
        }
        .forgot-input.has-error {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.20) !important;
        }
        .forgot-input::-ms-reveal,
        .forgot-input::-ms-clear {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .forgot-submit-btn {
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
        .forgot-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #7a1c3d, #5a1230);
          transform: translateY(-1px);
        }
        .forgot-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .forgot-submit-btn:focus-visible {
          outline: 3px solid #f6b400;
          outline-offset: 2px;
        }
        .forgot-submit-btn:disabled {
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
      <main className="forgot-card relative z-10 flex flex-col items-center">
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
            className="forgot-logo-img"
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
              className="forgot-submit-btn w-full mt-2"
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
                htmlFor="forgot-username"
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
                  id="forgot-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-invalid={usernameError ? 'true' : 'false'}
                  aria-describedby={usernameError ? 'forgot-username-error' : undefined}
                  placeholder="Enter username"
                  value={username}
                  onChange={handleUsernameChange}
                  onBlur={handleUsernameBlur}
                  className={`forgot-input pl-10 pr-3.5 ${usernameError ? 'has-error' : ''}`}
                />
              </div>
              {usernameError && (
                <p
                  id="forgot-username-error"
                  role="alert"
                  className="text-[11.5px] font-medium text-[#dc2626] text-left mt-1 pl-1"
                >
                  {usernameError}
                </p>
              )}
            </div>

            {/* New Password */}
            <div className="w-full">
              <label
                htmlFor="forgot-new-password"
                className="block text-xs font-semibold mb-1"
                style={{ color: '#3b2430' }}
              >
                New Password
              </label>
              <div className="relative w-full">
                <Lock
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#7d6a73]"
                />
                <input
                  ref={newPasswordRef}
                  id="forgot-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  name="new-password"
                  autoComplete="new-password"
                  maxLength={128}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  onBlur={handleNewPasswordBlur}
                  className={`forgot-input pl-10 pr-11 ${passwordError ? 'has-error' : ''}`}
                />
                <button
                  type="button"
                  id="toggle-forgot-new-password"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors text-[#7d6a73] hover:text-[#5a1230] focus:outline-none"
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  title={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {passwordError && (
                <p
                  id="forgot-new-password-error"
                  role="alert"
                  className="text-[11.5px] font-medium text-[#dc2626] text-left mt-1 pl-1"
                >
                  {passwordError}
                </p>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="w-full">
              <label
                htmlFor="forgot-confirm-password"
                className="block text-xs font-semibold mb-1"
                style={{ color: '#3b2430' }}
              >
                Confirm New Password
              </label>
              <div className="relative w-full">
                <Lock
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#7d6a73]"
                />
                <input
                  ref={confirmPasswordRef}
                  id="forgot-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm-password"
                  autoComplete="new-password"
                  maxLength={128}
                  aria-invalid={confirmError ? 'true' : 'false'}
                  aria-describedby={confirmError ? 'forgot-confirm-password-error' : undefined}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  className={`forgot-input pl-10 pr-11 ${confirmError ? 'has-error' : ''}`}
                />
                <button
                  type="button"
                  id="toggle-forgot-confirm-password"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors text-[#7d6a73] hover:text-[#5a1230] focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmError && (
                <p
                  id="forgot-confirm-password-error"
                  role="alert"
                  className="text-[11.5px] font-medium text-[#dc2626] text-left mt-1 pl-1"
                >
                  {confirmError}
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
              id="btn-forgot-password-submit"
              disabled={!isFormValid || loading}
              className="forgot-submit-btn mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>RESETTING...</span>
                </>
              ) : (
                <span>RESET PASSWORD</span>
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
        className="forgot-footer-text absolute bottom-3 left-0 right-0 text-center text-xs pointer-events-none select-none z-10"
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

export default ForgotPassword;
