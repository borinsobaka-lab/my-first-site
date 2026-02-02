# 🎾 Padel Coach AI

AI-powered padel match analysis using Google Gemini. Upload a YouTube link to your match and get professional coaching feedback for each player.

## Features

- **Player Identification**: Automatically identifies players by clothing and position
- **Positioning Analysis**: Evaluates court coverage, transitions, and partner coordination
- **Tactical Assessment**: Reviews shot selection, patience, and decision-making
- **Team Dynamics**: Analyzes partner synchronization and communication
- **Technique Evaluation**: Assesses shot preparation and body balance
- **Personalized Drills**: Provides specific exercises for each area of improvement
- **Timestamped Examples**: Links directly to video moments for review

## Prerequisites

- Python 3.11+
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

## Quick Start

### 1. Clone and Setup

```bash
cd padel-coach-ai

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Gemini API key
# GEMINI_API_KEY=your_api_key_here
```

### 3. Run the Server

```bash
cd backend
uvicorn main:app --reload
```

### 4. Open the Application

Navigate to [http://localhost:8000](http://localhost:8000) in your browser.

## Usage

1. **Paste YouTube URL**: Enter the URL of a public padel match recording
2. **Start Analysis**: Click "Analyze Match" and wait 5-10 minutes
3. **Review Results**: Explore individual player analysis, team dynamics, and patterns
4. **Click Timestamps**: Jump directly to video moments mentioned in the analysis

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Start video analysis |
| `/api/status/{task_id}` | GET | Check analysis progress |
| `/api/result/{task_id}` | GET | Get analysis results |
| `/api/history` | GET | List previous analyses |
| `/api/analysis/{task_id}` | DELETE | Delete an analysis |
| `/api/health` | GET | Health check |

### Example Request

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"youtube_url": "https://youtube.com/watch?v=VIDEO_ID", "player_count": 4}'
```

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## Project Structure

```
padel-coach-ai/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── gemini_service.py    # Gemini API integration
│   ├── prompts/
│   │   └── padel_analysis.py # Analysis prompt
│   ├── models.py            # Pydantic models
│   ├── database.py          # SQLite operations
│   ├── tasks.py             # Background task manager
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── components/
│       ├── progress.js
│       └── results.js
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## Analysis Categories

### Positioning (35% weight)
- Court zone distribution
- "No man's land" avoidance
- Return to base position
- Partner distance maintenance
- Center coverage

### Tactics (30% weight)
- Shot direction choices
- Lob usage
- Patience and timing
- Exploiting opponent weaknesses

### Teamwork (20% weight)
- Partner synchronization
- Position switches (cambio)
- Communication
- Support after errors

### Technique (15% weight)
- Shot preparation
- Body position after contact
- Balance and stability

## Video Requirements

- **Public YouTube video**: Must be accessible without login
- **Duration**: Up to 3 hours
- **Camera angle**: Behind the court, above players
- **Visibility**: All 4 players and full court visible

## Cost Estimation

With Gemini 2.5 Flash and low media resolution:
- ~2 hour video ≈ $0.25-0.50 per analysis

## Limitations

- Gemini samples video at ~1 FPS, so fast actions (ball flight, exact contact) are not visible
- Analysis focuses on positioning, tactics, and patterns rather than detailed biomechanics
- Private/unlisted videos cannot be analyzed

## Troubleshooting

### "API key not configured"
Ensure `GEMINI_API_KEY` is set in your `.env` file.

### "Video must be public"
Check that the YouTube video is publicly accessible without login.

### Analysis taking too long
Long videos (>1.5 hours) may take 10+ minutes. Check `/api/status/{task_id}` for progress.

## License

MIT License
