import React from 'react';

interface AboutProps {
  onClose: () => void;
}

export const About: React.FC<AboutProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4">
        <div className="flex flex-col items-center text-center">
          {/* Logo/Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <svg
              className="w-10 h-10 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-1">VoiceType</h1>
          <p className="text-gray-500 mb-4">Version 1.0.0</p>

          <p className="text-gray-600 mb-6">
            Speech-to-Text desktop application that allows you to dictate text
            and insert it into any active text field using a global hotkey.
          </p>

          <div className="space-y-2 text-sm text-gray-500 mb-6">
            <p>Powered by OpenAI Whisper API</p>
            <p>Built with Electron + React + TypeScript</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
