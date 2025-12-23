import React, { useState, useEffect } from 'react';
import { AppSettings, SUPPORTED_LANGUAGES } from '../../../shared/types';
import { getAudioDevices } from '../hooks/useAudioRecorder';
import { validateApiKey, testApiKey } from '../services/whisper';

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: Partial<AppSettings>) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<'success' | 'error' | null>(null);
  const [recordingHotkey, setRecordingHotkey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load audio devices on mount
  useEffect(() => {
    loadAudioDevices();
  }, []);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasChanges(changed);
  }, [localSettings, settings]);

  const loadAudioDevices = async () => {
    const devices = await getAudioDevices();
    setAudioDevices(devices);
  };

  const handleChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setKeyTestResult(null);
  };

  const handleSave = () => {
    onSave(localSettings);
    setHasChanges(false);
  };

  const handleTestApiKey = async () => {
    if (!validateApiKey(localSettings.apiKey)) {
      setKeyTestResult('error');
      return;
    }

    setIsTestingKey(true);
    const isValid = await testApiKey(localSettings.apiKey);
    setKeyTestResult(isValid ? 'success' : 'error');
    setIsTestingKey(false);
  };

  const handleHotkeyRecord = (e: React.KeyboardEvent) => {
    if (!recordingHotkey) return;

    e.preventDefault();

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    // Get the key
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta')
      return; // Don't add modifier alone

    key = key.charAt(0).toUpperCase() + key.slice(1);
    parts.push(key);

    const hotkey = parts.join('+');
    handleChange('hotkey', hotkey);
    setRecordingHotkey(false);
  };

  return (
    <div className="p-6 space-y-6 max-h-[calc(100vh-100px)] overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>

      {/* API Key */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          OpenAI API Key
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={localSettings.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            placeholder="sk-..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={handleTestApiKey}
            disabled={isTestingKey || !localSettings.apiKey}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {isTestingKey ? 'Testing...' : 'Test'}
          </button>
        </div>
        {keyTestResult && (
          <p
            className={`text-sm ${
              keyTestResult === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {keyTestResult === 'success'
              ? '✓ API key is valid'
              : '✕ API key is invalid'}
          </p>
        )}
      </div>

      {/* Language */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Recognition Language
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
          Microphone
        </label>
        <div className="flex gap-2">
          <select
            value={localSettings.selectedMicrophone || ''}
            onChange={(e) =>
              handleChange('selectedMicrophone', e.target.value || null)
            }
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Default microphone</option>
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
          <button
            onClick={loadAudioDevices}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            title="Refresh device list"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Hotkey */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Global Hotkey
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={localSettings.hotkey}
            onKeyDown={handleHotkeyRecord}
            onFocus={() => setRecordingHotkey(true)}
            onBlur={() => setRecordingHotkey(false)}
            readOnly
            placeholder="Click and press keys..."
            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              recordingHotkey
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300'
            }`}
          />
        </div>
        <p className="text-xs text-gray-500">
          Click the field and press your desired key combination
        </p>
      </div>

      {/* Hotkey Mode */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Hotkey Mode
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="hotkeyMode"
              value="toggle"
              checked={localSettings.hotkeyMode === 'toggle'}
              onChange={() => handleChange('hotkeyMode', 'toggle')}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              Toggle (press to start/stop)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="hotkeyMode"
              value="push-to-talk"
              checked={localSettings.hotkeyMode === 'push-to-talk'}
              onChange={() => handleChange('hotkeyMode', 'push-to-talk')}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Push-to-talk (hold)</span>
          </label>
        </div>
      </div>

      {/* Insert Mode */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Text Insertion Mode
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="insertMode"
              value="type"
              checked={localSettings.insertMode === 'type'}
              onChange={() => handleChange('insertMode', 'type')}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Type text directly</span>
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
              Copy to clipboard + paste
            </span>
          </label>
        </div>
      </div>

      {/* Post-processing */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={localSettings.postProcessing}
            onChange={(e) => handleChange('postProcessing', e.target.checked)}
            className="rounded text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Enable post-processing
          </span>
        </label>
        <p className="text-xs text-gray-500 ml-6">
          Process voice commands like "period", "comma", "new line"
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
            Start on system login
          </span>
        </label>
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
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default Settings;
