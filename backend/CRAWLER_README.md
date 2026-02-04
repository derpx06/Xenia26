# Web Crawler - Quick Start Guide

## Prerequisites
- MongoDB installed (v8.2.3+)
- Python 3.10+
- UV package manager

## Quick Start

### 1. Start MongoDB
```bash
bash scripts/start_mongodb.sh
```

### 2. Run the Crawler
```bash
# Full crawler with database storage
uv run python test_crawler.py <article-url>

# Simple crawler (no database needed)
uv run python test_crawler_simple.py <article-url>
```

### Example
```bash
uv run python test_crawler.py https://www.growandconvert.com/content-marketing/going-viral-medium/
```

## Available Crawlers

Located in `ml/application/crawlers/`:
- **custom_article.py** - Generic article crawler (works on any website)
- **medium.py** - Medium-specific crawler
- **linkedin.py** - LinkedIn crawler  
- **github.py** - GitHub crawler

## Configuration

Edit `.env` file to customize:
```bash
MONGO_URI=mongodb://localhost:27017/
DATABASE_NAME=ml_database
```

## Testing Database Connection
```bash
uv run python scripts/test_db_connection.py
```

## Features
- ✅ Automatic HTML to clean text conversion
- ✅ Metadata extraction (title, subtitle, language)
- ✅ Duplicate URL detection
- ✅ Database persistence with MongoDB
- ✅ Support for brotli compression

## Troubleshooting

**MongoDB not running?**
```bash
bash scripts/start_mongodb.sh
```

**Connection errors?**
```bash
uv run python scripts/test_db_connection.py
```

**Missing dependencies?**
```bash
uv sync
```
