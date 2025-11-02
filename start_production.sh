#!/bin/bash

cd "$(dirname "$0")"
source venv/bin/activate

# Production startup with Gunicorn
# Run with 4 workers for handling multiple requests
gunicorn -w 4 -b 0.0.0.0:8080 --threads 2 --timeout 120 wsgi:app

