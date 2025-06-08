#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Log file for debugging
LOG_FILE="$SCRIPT_DIR/service.log"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_message "Starting Chrome Security service..."
log_message "Script directory: $SCRIPT_DIR"

# Activate virtual environment if it exists
if [ -d "$SCRIPT_DIR/venv" ]; then
    log_message "Activating virtual environment"
    source "$SCRIPT_DIR/venv/bin/activate"
else
    log_message "Virtual environment not found, attempting to create one"
    python3 -m venv "$SCRIPT_DIR/venv"
    source "$SCRIPT_DIR/venv/bin/activate"
    pip install -r "$SCRIPT_DIR/requirements.txt"
    log_message "Virtual environment created and packages installed"
fi

# Change to script directory
cd "$SCRIPT_DIR"

# Start the FastAPI server
log_message "Starting FastAPI server"

# Use PORT environment variable if set, otherwise use default
PORT=${PORT:-27843}
log_message "Using port: $PORT"

exec python app.py --port $PORT
