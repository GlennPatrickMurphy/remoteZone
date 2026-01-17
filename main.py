#!/usr/bin/env python3
"""
Main entry point for Cloud Run deployment
"""
import os
from web_controller import app

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
else:
    # For WSGI servers (gunicorn, uwsgi, etc.)
    application = app

