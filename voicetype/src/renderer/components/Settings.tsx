import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, SUPPORTED_LANGUAGES, GPT_MODELS } from '../../../shared/types';
import { getAudioDevices } from '../hooks/useAudioRecorder';
import { validateApiKey, testApiKey } from '../services/whisper';

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: Partial<AppSettings>) => void;
}

type HotkeyField = 'hotkey' | 'aiHotkey';

export const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [isTestingWhisperKey, setIsTestingWhisperKey] = useState(false);
  const [isTestingGptKey, setIsTestingGptKey] = useState(false);
  const [whisperKeyTestResult, setWhisperKeyTestResult] = useState<'success' | 'error' | null>(null);
  const [gptKeyTestResult, setGptKeyTestResult] = useState<'success' | 'error' | null>(null);
  const [recordingHotkey, setRecordingHotkey] = useState<HotkeyField | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const hotkeyInputRef = useRef<HTMLInputElement>(null);
  const aiHotkeyInputRef = useRef<HTMLInputElement>(null);

  // Load audio devices on mount
  useEffect(() => {
    loadAudioDevices();
  }, []);

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasChanges(changed);
  }, [localSettings, settings]);

  // Handle global keydown for hotkey recording
  useEffect(() => {
    if (!recordingHotkey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      // Get the actual key (not modifier)
      const key = e.key;
      const code = e.code;

      // Skip if only modifier is pressed
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        return;
      }

      // Map special keys
      let keyName = key;
      if (key === ' ') keyName = 'Space';
      else if (code.startsWith('Key')) keyName = code.replace('Key', '');
      else if (code.startsWith('Digit')) keyName = code.replace('Digit', '');
      else if (code.startsWith('Numpad')) keyName = code;
      else if (key.length === 1) keyName = key.toUpperCase();
      else keyName = key.charAt(0).toUpperCase() + key.slice(1);

      parts.push(keyName);

      const hotkey = parts.join('+');
      handleChange(recordingHotkey, hotkey);
      setRecordingHotkey(null);

      // Blur the active input
      if (recordingHotkey === 'hotkey') {
        hotkeyInputRef.current?.blur();
      } else {
        aiHotkeyInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [recordingHotkey]);

  const loadAudioDevices = async () => {
    const devices = await getAudioDevices();
    setAudioDevices(devices);
  };

  const handleChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    // Reset test results when keys change
    if (key === 'whisperApiKey') setWhisperKeyTestResult(null);
    if (key === 'gptApiKey') setGptKeyTestResult(null);
  };

  const handleSave = () => {
    onSave(localSettings);
    setHasChanges(false);
  };

  const handleTestWhisperKey = async () => {
    if (!validateApiKey(localSettings.whisperApiKey)) {
      setWhisperKeyTestResult('error');
      return;
    }

    setIsTestingWhisperKey(true);
    const isValid = await testApiKey(localSettings.whisperApiKey);
    setWhisperKeyTestResult(isValid ? 'success' : 'error');
    setIsTestingWhisperKey(false);
  };

  const handleTestGptKey = async () => {
    if (!validateApiKey(localSettings.gptApiKey)) {
      setGptKeyTestResult('error');
      return;
    }

    setIsTestingGptKey(true);
    const isValid = await testApiKey(localSettings.gptApiKey);
    setGptKeyTestResult(isValid ? 'success' : 'error');
    setIsTestingGptKey(false);
  };

  const startHotkeyRecording = (field: HotkeyField) => {
    setRecordingHotkey(field);
  };

  return (
    <div className="space-y-6 max-h-[calc(100vh-140px)] overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-800">Настройки</h1>

      {/* Section: API Keys */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">API-ключи</h2>

        {/* Whisper API Key */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Ключ для транскрибации (Whisper)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={localSettings.whisperApiKey}
              onChange={(e) => handleChange('whisperApiKey', e.target.value)}
              placeholder="sk-..."
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={handleTestWhisperKey}
              disabled={isTestingWhisperKey || !localSettings.whisperApiKey}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {isTestingWhisperKey ? '...' : 'Тест'}
            </button>
          </div>
          {whisperKeyTestResult && (
            <p className={`text-sm ${whisperKeyTestResult === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {whisperKeyTestResult === 'success' ? '✓ Ключ действителен' : '✕ Ключ недействителен'}
            </p>
          )}
          <p className="text-xs text-gray-500">Используется для преобразования голоса в текст</p>
        </div>

        {/* GPT API Key */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Ключ для генерации (GPT)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={localSettings.gptApiKey}
              onChange={(e) => handleChange('gptApiKey', e.target.value)}
              placeholder="sk-... (можно такой же)"
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={handleTestGptKey}
              disabled={isTestingGptKey || !localSettings.gptApiKey}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {isTestingGptKey ? '...' : 'Тест'}
            </button>
          </div>
          {gptKeyTestResult && (
            <p className={`text-sm ${gptKeyTestResult === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {gptKeyTestResult === 'success' ? '✓ Ключ действителен' : '✕ Ключ недействителен'}
            </p>
          )}
          <p className="text-xs text-gray-500">Используется для AI-генерации текста по инструкции</p>
        </div>
      </div>

      {/* Section: Hotkeys */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Горячие клавиши</h2>

        {/* Dictation Hotkey */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              Диктовка (голос → текст)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              ref={hotkeyInputRef}
              type="text"
              value={recordingHotkey === 'hotkey' ? 'Нажмите клавиши...' : localSettings.hotkey}
              onFocus={() => startHotkeyRecording('hotkey')}
              readOnly
              placeholder="Нажмите для назначения..."
              className={`flex-1 min-w-0 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                recordingHotkey === 'hotkey'
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            />
            {recordingHotkey === 'hotkey' && (
              <button
                onClick={() => setRecordingHotkey(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex-shrink-0"
              >
                Отмена
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">Записывает голос и вставляет текст как есть</p>
        </div>

        {/* AI Generation Hotkey */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
              AI-генерация (инструкция → текст)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              ref={aiHotkeyInputRef}
              type="text"
              value={recordingHotkey === 'aiHotkey' ? 'Нажмите клавиши...' : localSettings.aiHotkey}
              onFocus={() => startHotkeyRecording('aiHotkey')}
              readOnly
              placeholder="Нажмите для назначения..."
              className={`flex-1 min-w-0 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                recordingHotkey === 'aiHotkey'
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            />
            {recordingHotkey === 'aiHotkey' && (
              <button
                onClick={() => setRecordingHotkey(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex-shrink-0"
              >
                Отмена
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">Записывает инструкцию и генерирует текст через GPT</p>
        </div>
      </div>

      {/* Section: AI Model */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">AI-модель</h2>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Модель для генерации
          </label>
          <select
            value={localSettings.gptModel}
            onChange={(e) => handleChange('gptModel', e.target.value as 'gpt-4o-mini' | 'gpt-4o')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {GPT_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Section: General */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Общие настройки</h2>

        {/* Language */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Язык распознавания
          </label>
          <select
            value={localSettings.language}
            onChange={(e) => handleChange('language', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Microphone */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Микрофон
          </label>
          <div className="flex gap-2">
            <select
              value={localSettings.selectedMicrophone || ''}
              onChange={(e) =>
                handleChange('selectedMicrophone', e.target.value || null)
              }
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Микрофон по умолчанию</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Микрофон ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <button
              onClick={loadAudioDevices}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex-shrink-0"
              title="Обновить список устройств"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Insert Mode */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Режим вставки текста
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="insertMode"
                value="type"
                checked={localSettings.insertMode === 'type'}
                onChange={() => handleChange('insertMode', 'type')}
                className="text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Автовставка (вставляет автоматически)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="insertMode"
                value="clipboard"
                checked={localSettings.insertMode === 'clipboard'}
                onChange={() => handleChange('insertMode', 'clipboard')}
                className="text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">
                Только буфер обмена (вставьте через Ctrl+V)
              </span>
            </label>
          </div>
        </div>

        {/* Sound notifications */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.soundEnabled}
              onChange={(e) => handleChange('soundEnabled', e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Звуковые уведомления
            </span>
          </label>
          <p className="text-xs text-gray-500 ml-6">
            Воспроизводить звук при начале и окончании записи
          </p>
        </div>

        {/* Auto-start */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.autoStart}
              onChange={(e) => handleChange('autoStart', e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Запускать при входе в систему
            </span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
            hasChanges
              ? 'bg-primary-600 hover:bg-primary-700 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Сохранить настройки
        </button>
      </div>
    </div>
  );
};

export default Settings;
