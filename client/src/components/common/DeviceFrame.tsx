// ============================================================================
// Tactaka - Mobile Device Frame & Screen Shell
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Volume2, VolumeX, Sun, Moon } from 'lucide-react';
import { soundManager } from '../../audio/soundEffects';

interface DeviceFrameProps {
  children: React.ReactNode;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => {
  const [isMobileFrame, setIsMobileFrame] = useState(true);
  const [isMuted, setIsMuted] = useState(soundManager.getIsMuted());
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tactaka_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('tactaka_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-dark');
    } else {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-light');
    }
  }, [theme]);

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div
      className={`min-h-screen ${
        theme === 'light' ? 'bg-slate-200 text-slate-900 theme-light' : 'bg-[#05070a] text-slate-100 theme-dark'
      } flex flex-col items-center justify-center p-0 md:p-4 font-sans selection:bg-cyan-500 selection:text-black transition-colors duration-300`}
    >
      {/* Top Controller Bar (for previewing device mode, theme & sound) */}
      <header className="w-full max-w-md hidden md:flex items-center justify-between px-4 py-2 mb-2 glass-panel rounded-xl text-xs font-semibold text-slate-300">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Tactaka Tactical Suite</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Day / Night Theme Toggle */}
          <button
            onClick={handleToggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
            title={theme === 'dark' ? 'Switch to Stadium Day Mode' : 'Switch to Floodlit Night Mode'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold">Day</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold">Night</span>
              </>
            )}
          </button>

          <button
            onClick={handleToggleMute}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
          </button>
          <button
            onClick={() => setIsMobileFrame(!isMobileFrame)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            {isMobileFrame ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span>Full View</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>Mobile Frame</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main
        className={`w-full transition-all duration-300 ${
          isMobileFrame
            ? 'max-w-[420px] h-[100dvh] md:h-[860px] md:max-h-[92vh] md:rounded-[40px] md:border-[8px] md:border-slate-800 md:shadow-2xl md:shadow-black/80'
            : 'max-w-5xl h-[100dvh] md:h-[90vh] md:rounded-2xl md:border md:border-slate-800'
        } ${theme === 'light' ? 'bg-slate-100' : 'bg-[#080B10]'} flex flex-col relative overflow-hidden`}
      >
        {/* Android Notch / Camera Pill (Visible in mobile frame mode on desktop) */}
        {isMobileFrame && (
          <div className="hidden md:flex justify-center items-center h-5 w-full bg-transparent absolute top-0 z-50 pointer-events-none">
            <div className="w-20 h-3.5 bg-slate-900 rounded-b-xl flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-950 border border-slate-700"></div>
            </div>
          </div>
        )}

        {/* Inner Content Area */}
        <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
};
