# VoiceType - Speech-to-Text Desktop App

A cross-platform desktop application for Windows, Mac, and Linux that allows you to dictate text and insert it into any active text field in any application.

## Features

- **Global Hotkey**: Activate recording from any application with a configurable keyboard shortcut
- **Speech Recognition**: Uses OpenAI Whisper API for accurate transcription
- **Automatic Text Insertion**: Transcribed text is automatically typed into the active text field
- **Multi-language Support**: Supports 20+ languages with auto-detection
- **System Tray**: Runs in the background with status indication
- **Post-processing**: Optional voice commands for punctuation ("period", "comma", "new line")
- **Customizable**: Choose between typing simulation or clipboard paste mode

## Requirements

- Node.js 18+
- OpenAI API key (for Whisper API)
- Microphone access

## Installation

### Development Setup

```bash
# Clone the repository
cd voicetype

# Install dependencies
npm install

# Run in development mode
npm run electron:dev
```

### Build for Production

```bash
# Build for your current platform
npm run dist

# Build for specific platforms
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

## Configuration

1. Launch the application
2. Go to Settings tab
3. Enter your OpenAI API key
4. Configure your preferred hotkey (default: Ctrl+Shift+Space)
5. Select your microphone
6. Choose recognition language

## Usage

1. Focus on any text input field in any application
2. Press the configured hotkey to start recording
3. Speak your text
4. Press the hotkey again to stop recording
5. Wait for processing - text will be automatically inserted

### Voice Commands (when post-processing is enabled)

- "period" / "точка" → .
- "comma" / "запятая" → ,
- "question mark" / "вопросительный знак" → ?
- "new line" / "новая строка" → ⏎
- "new paragraph" / "новый абзац" → ⏎⏎

## Architecture

```
voicetype/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Entry point
│   │   ├── tray.ts     # System tray
│   │   ├── shortcuts.ts # Global hotkeys
│   │   ├── settings.ts # Persistent settings
│   │   ├── textInput.ts # Text insertion
│   │   └── ipc.ts      # IPC handlers
│   ├── preload/        # Preload scripts
│   │   └── index.ts    # Context bridge
│   ├── renderer/       # React UI
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom hooks
│   │   ├── services/   # API services
│   │   └── styles/     # Tailwind styles
│   └── shared/         # Shared types
├── assets/             # Application icons
└── package.json
```

## Tech Stack

- **Runtime**: Electron 28+
- **Language**: TypeScript
- **Build**: Vite + electron-builder
- **UI**: React + Tailwind CSS
- **Settings**: electron-store
- **Input Simulation**: @nut-tree/nut-js
- **API**: OpenAI Whisper

## Security

- API keys are stored locally using electron-store (encrypted)
- Audio is processed server-side via OpenAI API
- No audio is stored after transcription
- Content Security Policy enabled

## Troubleshooting

### Hotkey not working
- Ensure no other application is using the same hotkey
- Try a different key combination in settings

### Microphone not detected
- Check system permissions for microphone access
- Click the refresh button in microphone settings

### Text not inserting
- Try switching to "clipboard" insert mode in settings
- Ensure the target application supports text input

## License

MIT License
