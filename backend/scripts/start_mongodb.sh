#!/bin/bash
# Start MongoDB for development

# Configuration
DATA_DIR="$HOME/.mongodb/data"
LOG_DIR="$HOME/.mongodb/logs"
PORT=27017

# Create directories if they don't exist
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

# Check if MongoDB is already running
if pgrep -x "mongod" > /dev/null; then
    echo "✅ MongoDB is already running"
    echo "Connection URI: mongodb://localhost:$PORT/"
    exit 0
fi

# Start MongoDB
echo "🚀 Starting MongoDB..."
mongod --dbpath "$DATA_DIR" \
       --logpath "$LOG_DIR/mongod.log" \
       --port $PORT \
       --fork \
       --bind_ip 127.0.0.1

if [ $? -eq 0 ]; then
    echo "✅ MongoDB started successfully"
    echo "📁 Data directory: $DATA_DIR"
    echo "📝 Log file: $LOG_DIR/mongod.log"
    echo "🔗 Connection URI: mongodb://localhost:$PORT/"
    echo ""
    echo "To stop MongoDB, run: mongod --dbpath $DATA_DIR --shutdown"
else
    echo "❌ Failed to start MongoDB"
    exit 1
fi
