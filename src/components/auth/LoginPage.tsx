import React, { useState, useEffect } from 'react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const slides = [
  {
    heading: 'Precision Hydro-Acoustics',
    caption: 'Real-time submarine acoustic detection, LFM chirp waveform synthesis, and deep sea oceanographic telemetry.',
  },
  {
    heading: 'Synthetic Aperture Sonar',
    caption: 'High-resolution seafloor imaging and Doppler beamforming algorithms for littoral reconnaissance.',
  },
  {
    heading: 'Autonomous Target Tracking',
    caption: 'Multi-sensor Kalman filtering and acoustic signature classification for submerged contacts.',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('sarah.vance@sonar.ocean');
  const [password, setPassword] = useState('SonarPass2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);

  // Auto cycle carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess();
  };

  return (
    <main className="fullscreen-split-layout" id="loginView">
      {/* LEFT 50%: Full-Cover Submarine Image + Rising Bubbles + Narrative Overlay */}
      <section className="left-image-cover-panel" id="submarineArtPanel">
        <img
          src="/assets/user_submarine.jpg"
          alt="Underwater Submarine Sonar Acoustic Detection"
          className="submarine-full-cover-img"
          id="submarineImg"
        />

        {/* Ambient Underwater Bubbles Rising Automatically */}
        <div className="underwater-bubbles-container" id="bubblesContainer">
          {[...Array(12)].map((_, i) => (
            <span
              key={i}
              className="bubble"
              style={{
                left: `${(i * 8.3 + 4) % 100}%`,
                animationDelay: `${(i * 0.7) % 5}s`,
                animationDuration: `${5 + (i % 4) * 1.5}s`,
                width: `${4 + (i % 5) * 3}px`,
                height: `${4 + (i % 5) * 3}px`,
              }}
            />
          ))}
        </div>

        {/* Atmospheric Dark Gradient Overlay for Cinematic Depth */}
        <div className="image-atmosphere-overlay"></div>

        {/* Narrative Text & Carousel at Bottom */}
        <div className="narrative-overlay-block">
          <h2 className="narrative-heading" id="carouselHeading">
            {slides[activeSlide].heading}
          </h2>
          <p className="narrative-caption" id="carouselCaption">
            {slides[activeSlide].caption}
          </p>

          {/* 3 Modern Carousel Indicator Dots */}
          <div className="carousel-dots-row">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`c-dot ${idx === activeSlide ? 'active' : ''}`}
                onClick={() => setActiveSlide(idx)}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* RIGHT 50%: Modern, Beautiful White Login Interface */}
      <section className="right-form-panel">
        <div className="form-centering-wrapper">
          {/* Brand Header with Modern Logo & Script Signature */}
          <div className="brand-top-header">
            <div className="brand-icon-bubble" title="Wave Forge">
              <svg
                className="brand-wave-svg"
                viewBox="0 0 26 26"
                width="24"
                height="24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="waveForgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
                <path
                  d="M2.5 13C4.5 13 5.5 6 7.5 6C9.5 6 10.5 20 12.5 20C14.5 20 15.5 8 17.5 8C19.5 8 20.5 15 22.5 15"
                  stroke="url(#waveForgeGrad)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5.5 13C7 13 7.8 9 9.5 9C11.2 9 12 17 13.5 17C15 17 15.8 11.5 17.5 11.5C19 11.5 20 14 21.5 14"
                  stroke="#ffffff"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.45"
                />
              </svg>
            </div>
            <span className="script-brand-title">Wave Forge</span>
          </div>

          {/* Welcome Text */}
          <div className="form-title-group">
            <h1 className="welcome-heading">Welcome back</h1>
            <p className="welcome-subheading">
              Enter your credentials to access the hydro-acoustic console
            </p>
          </div>

          {/* Modern Authentication Form */}
          <form className="login-form-body" id="loginForm" onSubmit={handleSubmit} autoComplete="on">
            {/* Email / Username Field */}
            <div className="modern-input-group">
              <label className="modern-label" htmlFor="inputEmail">
                Email or username
              </label>
              <div className="input-field-wrapper">
                <i className="fa-regular fa-envelope input-leading-icon"></i>
                <input
                  type="text"
                  className="modern-text-input"
                  id="inputEmail"
                  placeholder="sarah.vance@sonar.ocean"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="modern-input-group">
              <label className="modern-label" htmlFor="inputPassword">
                Password
              </label>
              <div className="input-field-wrapper">
                <i className="fa-solid fa-lock input-leading-icon"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="modern-text-input has-trailing-btn"
                  id="inputPassword"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eye-toggle-btn"
                  id="btnTogglePassword"
                  title="Show or hide password"
                  aria-label="Show or hide password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} id="eyeIcon"></i>
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="form-options-row">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  id="rememberMeCheckbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="custom-checkmark"></span>
                <span className="checkbox-label-text">Remember for 30 days</span>
              </label>
              <a href="#" className="forgot-pass-link" id="forgotPassLink" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
            </div>

            {/* Modern Primary Action Button */}
            <button type="submit" className="btn-modern-primary" id="btnSignIn">
              <span>Sign in to console</span>
              <i className="fa-solid fa-arrow-right btn-arrow-icon"></i>
            </button>

            {/* Divider */}
            <div className="or-divider-strip">
              <span className="divider-line"></span>
              <span className="or-text">or continue with</span>
              <span className="divider-line"></span>
            </div>

            {/* Google SSO Button */}
            <button
              type="button"
              className="btn-modern-google"
              id="btnGoogleSignIn"
              onClick={onLoginSuccess}
            >
              <svg className="google-svg-logo" viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>

            {/* Bottom Sign Up Link */}
            <div className="bottom-signup-row">
              <span>Don't have an account?</span>
              <a href="#" className="create-account-link" id="btnCreateAccount" onClick={(e) => e.preventDefault()}>
                Create an account
              </a>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};
