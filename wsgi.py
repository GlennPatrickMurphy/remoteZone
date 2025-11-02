#!/usr/bin/env python3
"""
WSGI entry point for production deployment
"""
from web_controller import app

if __name__ == "__main__":
    app.run()

