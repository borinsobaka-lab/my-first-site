import React from 'react';
import { RecordingState } from '../../../shared/types';

interface StatusIndicatorProps {
  state: RecordingState;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  className = '',
}) => {
  const getStateConfig = () => {
    switch (state) {
      case 'idle':
        return {
          color: 'bg-idle',
          text: 'Ready',
          icon: '●',
          animation: '',
        };
      case 'recording':
        return {
          color: 'bg-recording',
          text: 'Recording...',
          icon: '●',
          animation: 'animate-pulse-recording',
        };
      case 'processing':
        return {
          color: 'bg-processing',
          text: 'Processing...',
          icon: '◐',
          animation: 'animate-spin-slow',
        };
      case 'error':
        return {
          color: 'bg-gray-500',
          text: 'Error',
          icon: '✕',
          animation: '',
        };
      default:
        return {
          color: 'bg-gray-400',
          text: 'Unknown',
          icon: '?',
          animation: '',
        };
    }
  };

  const config = getStateConfig();

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${className}`}
    >
      <span
        className={`inline-block w-3 h-3 rounded-full ${config.color} ${config.animation}`}
      />
      <span className="text-sm font-medium text-gray-700">{config.text}</span>
    </div>
  );
};

export default StatusIndicator;
