# QA Metrics Dashboard

A comprehensive dashboard for tracking QA team metrics across GitHub, Jira, and ReportPortal.

## Features

- **Real-time Metrics**: Track open bugs, automation coverage, test pass rates, and PR activity
- **Team Activity**: Monitor individual and team-wide contributions
- **PR Review Tracking**: Track human and AI (Copilot) code reviews
- **Redis Caching**: Fast dashboard loading with background data refresh
- **Squad Filtering**: View metrics by squad or across the entire QA team

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│      Redis      │
│   (React/Vite)  │     │    (FastAPI)    │     │     (Cache)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   External APIs     │
                    │ GitHub │ Jira │ RP  │
                    └─────────────────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- GitHub Token (with repo access)
- Jira API Token
- ReportPortal credentials

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Anaconda-Sandbox/qa-metrics-dashboard.git
cd qa-metrics-dashboard
```

2. Create environment file:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials
```

3. Start the services:
```bash
docker compose up -d
```

4. Access the dashboard:
- Frontend: http://localhost:3001
- Backend API: http://localhost:8001
- API Docs: http://localhost:8001/docs

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token |
| `GITHUB_ORG` | GitHub organization name |
| `JIRA_BASE_URL` | Jira instance URL |
| `JIRA_USER_EMAIL` | Jira user email |
| `JIRA_API_TOKEN` | Jira API token |
| `REPORTPORTAL_URL` | ReportPortal instance URL |
| `REPORTPORTAL_TOKEN` | ReportPortal API token |
| `REPORTPORTAL_PROJECT` | ReportPortal project name |
| `REDIS_URL` | Redis connection URL |

### Cache Settings

| Metric | Cache TTL |
|--------|-----------|
| Jira Data | 30 minutes |
| GitHub PR Stats | 1 hour |
| Review Stats | 2 hours |
| Member Activity | 1 hour |

Background refresh runs every 30 minutes.

## API Endpoints

### Jira
- `GET /api/jira/defect-density` - Bug counts and distribution
- `GET /api/jira/automation-coverage` - Test automation stats
- `GET /api/jira/bugs` - Open bugs list

### GitHub
- `GET /api/github/pr-stats` - PR statistics
- `GET /api/github/pr-trends` - Weekly PR trends
- `GET /api/github/team-contributions` - Team PR activity
- `GET /api/github/team-review-stats` - Review statistics

### ReportPortal
- `GET /api/reportportal/stats` - Test execution stats
- `GET /api/reportportal/flaky-tests` - Flaky test detection
- `GET /api/reportportal/launches` - Recent test launches

### Members
- `GET /api/members/list` - QA team member list
- `GET /api/members/activity/{username}` - Individual activity

## Development

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## License

Internal use only - Anaconda, Inc.
