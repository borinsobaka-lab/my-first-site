import React, { useState, useEffect, useRef } from 'react';
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
  const hotkeyInputRef = useRef<HTMLInputElement>(null);

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
      handleChange('hotkey', hotkey);
      setRecordingHotkey(false);
      hotkeyInputRef.current?.blur();
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

  const startHotkeyRecording = () => {
    setRecordingHotkey(true);
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
            ref={hotkeyInputRef}
            type="text"
            value={recordingHotkey ? 'Press keys...' : localSettings.hotkey}
            onFocus={startHotkeyRecording}
            readOnly
            placeholder="Click to set hotkey..."
            className={`flex-1 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
              recordingHotkey
                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          />
          {recordingHotkey && (
            <button
              onClick={() => setRecordingHotkey(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Click the field, then press your desired key combination (e.g., Ctrl+Shift+Space)
        </p>
      </div>

      {/* Insert Mode */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Text Insertion Mode
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
            <span className="text-sm text-gray-700">Type text directly (auto-paste)</span>
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
              Copy to clipboard only (you paste with Ctrl+V)
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
