import React from 'react';

interface WelcomeScreenProps {
  onEnterConsole: () => void;
  onBackToLogin: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onEnterConsole,
  onBackToLogin,
}) => {
  return (
    <div className="landing-page-overlay" id="landingPageOverlay">
      {/* Minimal Back to Sign In button */}
      <button
        type="button"
        className="btn-landing-back"
        id="btnLandingBack"
        title="Back to Sign In"
        onClick={onBackToLogin}
      >
        <i className="fa-solid fa-arrow-left"></i>
        <span>Back</span>
      </button>

      {/* Main Hero: Left Text & Enter Button + Right 3D Hand Holding Cube */}
      <section className="landing-hero-container">
        {/* Left Side: "WELCOME TO WAVE FORGE" and "Enter" button under it */}
        <div className="landing-hero-left" id="landingHeroLeft">
          <h1 className="landing-hero-title">
            <span className="title-welcome">WELCOME TO</span>
            <span className="title-brand">WAVE FORGE</span>
          </h1>
          <p className="landing-hero-desc">
            A next-generation software-defined adaptive sonar transmitter engineering high-precision acoustic waveforms with real-time in-situ environmental telemetry.
          </p>
          <div className="landing-hero-actions">
            <button
              type="button"
              className="btn-enter-dashboard"
              id="btnEnterDashboard"
              onClick={onEnterConsole}
            >
              <span>Enter</span>
              <i className="fa-solid fa-arrow-right btn-enter-arrow"></i>
            </button>
          </div>
        </div>

        {/* Right Side: 3D Hand Holding the Glowing Waveform Cube */}
        <div className="landing-hero-right" id="landingHeroRight">
          <div className="hand-cube-visual-wrapper">
            <img
              src="/assets/exact_cyber_hand_cube.jpg"
              alt="3D Hand Holding Waveform Cube"
              className="hand-cube-img"
              id="handCubeImg"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
