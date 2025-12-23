import React, { useState, useEffect, useCallback } from 'react';
import { AppSettings, RecordingState, DEFAULT_SETTINGS } from '../../shared/types';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { transcribe } from './services/whisper';
import { postProcessText } from './services/postprocess';
import Settings from './components/Settings';
import StatusIndicator from './components/StatusIndicator';
import RecordingOverlay from './components/RecordingOverlay';
import About from './components/About';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<RecordingState>('idle');
  const [lastTranscription, setLastTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  // Load settings on mount
  useEffect(() => {
    loadSettings();

    // Listen for recording start/stop from main process
    const unsubStart = window.electronAPI.onRecordingStart(() => {
      handleStartRecording();
    });

    const unsubStop = window.electronAPI.onRecordingStop(() => {
      handleStopRecording();
    });

    const unsubAbout = window.electronAPI.onShowAbout(() => {
      setShowAbout(true);
    });

    return () => {
      unsubStart();
      unsubStop();
      unsubAbout();
    };
  }, []);

  // Update tray state when recording state changes
  useEffect(() => {
    window.electronAPI.updateTrayState(state);
  }, [state]);

  const loadSettings = async () => {
    try {
      const loadedSettings = await window.electronAPI.getSettings();
      setSettings(loadedSettings);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const updatedSettings = await window.electronAPI.setSettings(newSettings);
      setSettings(updatedSettings);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleStartRecording = useCallback(async () => {
    if (isRecording || state === 'processing') return;

    setError(null);
    setState('recording');

    try {
      await startRecording(settings.selectedMicrophone || undefined);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
      setState('error');
    }
  }, [isRecording, state, settings.selectedMicrophone, startRecording]);

  const handleStopRecording = useCallback(async () => {
    if (!isRecording) return;

    setState('processing');

    try {
      const audioBlob = await stopRecording();

      if (!audioBlob || audioBlob.size === 0) {
        setError('No audio recorded');
        setState('error');
        return;
      }

      // Check for API key
      if (!settings.apiKey) {
        setError('Please configure your OpenAI API key in settings');
        setState('error');
        return;
      }

      // Transcribe audio
      let text = await transcribe(audioBlob, settings.apiKey, {
        language: settings.language,
      });

      // Post-process if enabled
      if (settings.postProcessing) {
        text = postProcessText(text);
      }

      setLastTranscription(text);

      // Insert text into active field
      await window.electronAPI.insertText(text);
      window.electronAPI.sendTranscriptionResult(text);

      setState('idle');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      console.error('Transcription error:', err);
      setError(errorMessage);
      window.electronAPI.sendTranscriptionError(errorMessage);
      setState('error');
    }
  }, [isRecording, stopRecording, settings]);

  const handleCancel = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    }
    setState('idle');
    setError(null);
  }, [isRecording, stopRecording]);

  const handleManualRecord = async () => {
    if (state === 'recording') {
      await handleStopRecording();
    } else if (state === 'idle') {
      await handleStartRecording();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-800">VoiceType</h1>
        </div>
        <StatusIndicator state={state} />
      </header>

      {/* Navigation tabs */}
      <nav className="bg-white border-b px-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('home')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'home'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Settings
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="p-4">
        {activeTab === 'home' ? (
          <div className="space-y-6">
            {/* Quick status card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="text-center">
                <div className="mb-4">
                  <button
                    onClick={handleManualRecord}
                    disabled={state === 'processing'}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                      state === 'recording'
                        ? 'bg-recording animate-pulse-recording'
                        : state === 'processing'
                        ? 'bg-processing cursor-not-allowed'
                        : 'bg-primary-500 hover:bg-primary-600 hover:scale-105'
                    }`}
                  >
                    <svg
                      className="w-12 h-12 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </button>
                </div>

                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                  {state === 'idle'
                    ? 'Ready to Record'
                    : state === 'recording'
                    ? 'Recording...'
                    : state === 'processing'
                    ? 'Processing...'
                    : 'Error'}
                </h2>
                <p className="text-sm text-gray-500">
                  {state === 'idle'
                    ? `Press ${settings.hotkey} or click the button`
                    : state === 'recording'
                    ? 'Speak now...'
                    : state === 'processing'
                    ? 'Transcribing your speech'
                    : error || 'Something went wrong'}
                </p>
              </div>
            </div>

            {/* Last transcription */}
            {lastTranscription && (
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Last Transcription
                </h3>
                <p className="text-gray-800">{lastTranscription}</p>
              </div>
            )}

            {/* Error message */}
            {error && state === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Quick tips */}
            <div className="bg-gray-100 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Quick Tips
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>
                  • Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">{settings.hotkey}</kbd> to start/stop recording
                </li>
                <li>• The app works in the background - just focus on any text field</li>
                <li>• Transcribed text is automatically inserted at your cursor</li>
                {settings.postProcessing && (
                  <li>• Say "period", "comma", "new line" for punctuation</li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          <Settings settings={settings} onSave={handleSaveSettings} />
        )}
      </main>

      {/* Recording overlay */}
      <RecordingOverlay state={state} onCancel={handleCancel} />

      {/* About modal */}
      {showAbout && <About onClose={() => setShowAbout(false)} />}
    </div>
  );
};

export default App;
