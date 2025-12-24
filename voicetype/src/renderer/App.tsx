import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppSettings, RecordingState, LogEntry, DEFAULT_SETTINGS } from '../../shared/types';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { transcribe } from './services/whisper';
import { playStartSound, playStopSound, playErrorSound } from './services/sounds';
import Settings from './components/Settings';
import StatusIndicator from './components/StatusIndicator';
import RecordingOverlay from './components/RecordingOverlay';
import About from './components/About';

interface HistoryItem {
  id: number;
  text: string;
  timestamp: Date;
  durationSeconds: number;
}

// Format seconds to human-readable string
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours} ч ${minutes} мин ${seconds} сек`;
  } else if (minutes > 0) {
    return `${minutes} мин ${seconds} сек`;
  } else {
    return `${seconds} сек`;
  }
}

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'logs' | 'settings'>('home');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const settingsRef = useRef(settings);
  const isRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Keep refs updated
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Load settings and logs on mount
  useEffect(() => {
    loadSettings();
    loadLogs();

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

    // Listen for new log messages
    const unsubLog = window.electronAPI.onLogMessage((entry: LogEntry) => {
      setLogs(prev => [...prev, entry].slice(-100)); // Keep last 100
    });

    return () => {
      unsubStart();
      unsubStop();
      unsubAbout();
      unsubLog();
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

  const loadLogs = async () => {
    try {
      const loadedLogs = await window.electronAPI.getLogs();
      setLogs(loadedLogs);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const clearLogs = async () => {
    try {
      await window.electronAPI.clearLogs();
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
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
    recordingStartTimeRef.current = Date.now();

    // Play start sound if enabled
    if (settingsRef.current.soundEnabled) {
      playStartSound();
    }

    try {
      await startRecording(settingsRef.current.selectedMicrophone || undefined);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Не удалось начать запись');
      setState('error');
      if (settingsRef.current.soundEnabled) {
        playErrorSound();
      }
      window.electronAPI.syncRecordingState(false);
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    // Calculate recording duration using ref
    const startTime = recordingStartTimeRef.current;
    const durationSeconds = startTime
      ? Math.round((Date.now() - startTime) / 1000)
      : 0;

    // Play stop sound if enabled
    if (settingsRef.current.soundEnabled) {
      playStopSound();
    }

    setState('processing');

    try {
      const audioBlob = await stopRecording();

      if (!audioBlob || audioBlob.size === 0) {
        setError('Аудио не записано');
        setState('error');
        if (settingsRef.current.soundEnabled) {
          playErrorSound();
        }
        window.electronAPI.syncRecordingState(false);
        return;
      }

      // Check for API key
      if (!settingsRef.current.apiKey) {
        setError('Укажите API-ключ OpenAI в настройках');
        setState('error');
        if (settingsRef.current.soundEnabled) {
          playErrorSound();
        }
        window.electronAPI.syncRecordingState(false);
        return;
      }

      // Transcribe audio
      const text = await transcribe(audioBlob, settingsRef.current.apiKey, {
        language: settingsRef.current.language,
      });

      // Add to history
      const historyItem: HistoryItem = {
        id: Date.now(),
        text,
        timestamp: new Date(),
        durationSeconds,
      };
      setHistory(prev => [historyItem, ...prev].slice(0, 50)); // Keep last 50

      // Update total recording time
      const newTotal = settingsRef.current.totalRecordingSeconds + durationSeconds;
      handleSaveSettings({ totalRecordingSeconds: newTotal });

      // Insert text into active field
      await window.electronAPI.insertText(text);
      window.electronAPI.sendTranscriptionResult(text);

      setState('idle');
      window.electronAPI.syncRecordingState(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка транскрибации';
      console.error('Transcription error:', err);
      setError(errorMessage);
      if (settingsRef.current.soundEnabled) {
        playErrorSound();
      }
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
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
      <nav className="bg-white border-b px-4 flex-shrink-0">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('home')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'home'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Главная
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            История {history.length > 0 && `(${history.length})`}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Логи {logs.filter(l => l.level === 'error').length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                {logs.filter(l => l.level === 'error').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Настройки
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Quick status card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <button
                    onClick={handleManualRecord}
                    disabled={state === 'processing'}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
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
                    ? 'Готово к записи'
                    : state === 'recording'
                    ? 'Идёт запись...'
                    : state === 'processing'
                    ? 'Обработка...'
                    : 'Ошибка'}
                </h2>
                <p className="text-sm text-gray-500">
                  {state === 'idle'
                    ? `Нажмите ${settings.hotkey} или кнопку выше`
                    : state === 'recording'
                    ? 'Говорите... Нажмите хоткей снова для остановки'
                    : state === 'processing'
                    ? 'Распознавание речи'
                    : error || 'Произошла ошибка'}
                </p>
              </div>
            </div>

            {/* Last transcription */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-500">
                    Последняя транскрибация
                  </h3>
                  <button
                    onClick={() => copyToClipboard(history[0].text)}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Копировать
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
                    className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
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
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-red-800">Ошибка</h3>
                    <p className="text-sm text-red-600 mt-1 break-words">{error}</p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Закрыть
                </button>
              </div>
            )}

            {/* Quick tips */}
            <div className="bg-gray-100 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Подсказки
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>
                  Нажмите <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">{settings.hotkey}</kbd> для начала/остановки записи
                </li>
                <li>Приложение работает в фоне — просто переключитесь на текстовое поле</li>
                {settings.insertMode === 'clipboard' ? (
                  <li>Текст копируется в буфер обмена — вставьте через Ctrl+V</li>
                ) : (
                  <li>Текст автоматически вставляется в активное поле</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Recording time counter */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-primary-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-primary-600 font-medium">Всего записано</p>
                  <p className="text-lg font-semibold text-primary-800">
                    {formatTime(settings.totalRecordingSeconds)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">История</h2>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Очистить всё
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm border text-center">
                <p className="text-gray-500">Транскрибаций пока нет</p>
                <p className="text-sm text-gray-400 mt-1">
                  История ваших записей появится здесь
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
                      <p className="text-gray-800 flex-1 break-words min-w-0">{item.text}</p>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyToClipboard(item.text)}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                          title="Копировать"
                        >
                          Копировать
                        </button>
                        <button
                          onClick={() => deleteHistoryItem(item.id)}
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Удалить"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{item.timestamp.toLocaleString('ru-RU')}</span>
                      <span>•</span>
                      <span>{item.durationSeconds} сек</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Логи</h2>
              {logs.length > 0 && (
                <button
                  onClick={clearLogs}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Очистить
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm border text-center">
                <p className="text-gray-500">Логов пока нет</p>
                <p className="text-sm text-gray-400 mt-1">
                  Здесь будут отображаться события и ошибки
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...logs].reverse().map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-lg p-3 border ${
                      log.level === 'error'
                        ? 'bg-red-50 border-red-200'
                        : log.level === 'warn'
                        ? 'bg-yellow-50 border-yellow-200'
                        : log.level === 'success'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                          log.level === 'error'
                            ? 'bg-red-500 text-white'
                            : log.level === 'warn'
                            ? 'bg-yellow-500 text-white'
                            : log.level === 'success'
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {log.level === 'error' ? '!' : log.level === 'warn' ? '⚠' : log.level === 'success' ? '✓' : 'i'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          log.level === 'error'
                            ? 'text-red-800'
                            : log.level === 'warn'
                            ? 'text-yellow-800'
                            : log.level === 'success'
                            ? 'text-green-800'
                            : 'text-gray-800'
                        }`}>
                          {log.message}
                        </p>
                        {log.details && (
                          <p className={`text-xs mt-1 break-words ${
                            log.level === 'error'
                              ? 'text-red-600'
                              : log.level === 'warn'
                              ? 'text-yellow-600'
                              : log.level === 'success'
                              ? 'text-green-600'
                              : 'text-gray-500'
                          }`}>
                            {log.details}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Copy logs button */}
            {logs.length > 0 && (
              <button
                onClick={() => {
                  const logText = logs.map(log =>
                    `[${new Date(log.timestamp).toLocaleString('ru-RU')}] [${log.level.toUpperCase()}] ${log.message}${log.details ? ` - ${log.details}` : ''}`
                  ).join('\n');
                  navigator.clipboard.writeText(logText);
                }}
                className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
              >
                Копировать все логи
              </button>
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
