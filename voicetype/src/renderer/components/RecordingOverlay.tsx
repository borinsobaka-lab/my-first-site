import React from 'react';
import { RecordingState } from '../../../shared/types';

interface RecordingOverlayProps {
  state: RecordingState;
  onCancel?: () => void;
}

export const RecordingOverlay: React.FC<RecordingOverlayProps> = ({
  state,
  onCancel,
}) => {
  if (state === 'idle') {
    return null;
  }

  const getContent = () => {
    switch (state) {
      case 'recording':
        return {
          icon: (
            <div className="relative">
              <div className="w-16 h-16 bg-recording rounded-full animate-pulse-recording flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              {/* Animated rings */}
              <div className="absolute inset-0 -m-4 border-4 border-recording/30 rounded-full animate-ping" />
              <div
                className="absolute inset-0 -m-8 border-2 border-recording/20 rounded-full animate-ping"
                style={{ animationDelay: '0.5s' }}
              />
            </div>
          ),
          text: 'Listening...',
          subtext: 'Press hotkey again to stop',
          color: 'text-recording',
        };
      case 'processing':
        return {
          icon: (
            <div className="w-16 h-16 bg-processing rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ),
          text: 'Processing...',
          subtext: 'Transcribing your speech',
          color: 'text-processing',
        };
      case 'error':
        return {
          icon: (
            <div className="w-16 h-16 bg-gray-500 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          ),
          text: 'Error',
          subtext: 'Something went wrong',
          color: 'text-gray-500',
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
        {content.icon}
        <h2 className={`text-xl font-semibold ${content.color}`}>
          {content.text}
        </h2>
        <p className="text-gray-500 text-sm text-center">{content.subtext}</p>

        {(state === 'recording' || state === 'error') && onCancel && (
          <button
            onClick={onCancel}
            className="mt-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default RecordingOverlay;
