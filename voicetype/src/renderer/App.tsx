import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppSettings, RecordingState, DEFAULT_SETTINGS } from '../../shared/types';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { transcribe } from './services/whisper';
import { postProcessText } from './services/postprocess';
import Settings from './components/Settings';
import StatusIndicator from './components/StatusIndicator';
import RecordingOverlay from './components/RecordingOverlay';
import About from './components/About';

interface HistoryItem {
  id: number;
  text: string;
  timestamp: Date;
}

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'settings'>('home');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const settingsRef = useRef(settings);
  const isRecordingRef = useRef(false);

  // Keep refs updated
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

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

  // Sync recording state to main process
  useEffect(() => {
    window.electronAPI.syncRecordingState(isRecording);
  }, [isRecording]);

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
    if (isRecordingRef.current) return;

    setError(null);
    setState('recording');

    try {
      await startRecording(settingsRef.current.selectedMicrophone || undefined);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
      setState('error');
      window.electronAPI.syncRecordingState(false);
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    setState('processing');

    try {
      const audioBlob = await stopRecording();

      if (!audioBlob || audioBlob.size === 0) {
        setError('No audio recorded');
        setState('error');
        window.electronAPI.syncRecordingState(false);
        return;
      }

      // Check for API key
      if (!settingsRef.current.apiKey) {
        setError('Please configure your OpenAI API key in settings');
        setState('error');
        window.electronAPI.syncRecordingState(false);
        return;
      }

      // Transcribe audio
      let text = await transcribe(audioBlob, settingsRef.current.apiKey, {
        language: settingsRef.current.language,
      });

      // Post-process if enabled
      if (settingsRef.current.postProcessing) {
        text = postProcessText(text);
      }

      // Add to history
      const historyItem: HistoryItem = {
        id: Date.now(),
        text,
        timestamp: new Date(),
      };
      setHistory(prev => [historyItem, ...prev].slice(0, 50)); // Keep last 50

      // Insert text into active field
      await window.electronAPI.insertText(text);
      window.electronAPI.sendTranscriptionResult(text);

      setState('idle');
      window.electronAPI.syncRecordingState(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      console.error('Transcription error:', err);
      setError(errorMessage);
      window.electronAPI.sendTranscriptionError(errorMessage);
      setState('error');
      window.electronAPI.syncRecordingState(false);
    }
  }, [stopRecording]);

  const handleCancel = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    }
    setState('idle');
    setError(null);
    window.electronAPI.syncRecordingState(false);
  }, [isRecording, stopRecording]);

  const handleManualRecord = async () => {
    if (state === 'recording') {
      await handleStopRecording();
    } else if (state === 'idle') {
      await handleStartRecording();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const deleteHistoryItem = (id: number) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
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
            onClick={() => setActiveTab('history')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            History {history.length > 0 && `(${history.length})`}
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
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Quick status card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
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
                    ? 'Speak now... Press hotkey again to stop'
                    : state === 'processing'
                    ? 'Transcribing your speech'
                    : error || 'Something went wrong'}
                </p>
              </div>
            </div>

            {/* Last transcription */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-500">
                    Last Transcription
                  </h3>
                  <button
                    onClick={() => copyToClipboard(history[0].text)}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-gray-800">{history[0].text}</p>
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
                  Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">{settings.hotkey}</kbd> to start/stop recording
                </li>
                <li>The app works in the background - just focus on any text field</li>
                {settings.insertMode === 'clipboard' ? (
                  <li>Text is copied to clipboard - paste with Ctrl+V</li>
                ) : (
                  <li>Text is automatically typed at your cursor</li>
                )}
                {settings.postProcessing && (
                  <li>Say "period", "comma", "new line" for punctuation</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">History</h2>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Clear all
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm border text-center">
                <p className="text-gray-500">No transcriptions yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Your transcription history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-4 shadow-sm border"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-gray-800 flex-1">{item.text}</p>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyToClipboard(item.text)}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                          title="Copy to clipboard"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => deleteHistoryItem(item.id)}
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {item.timestamp.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
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
