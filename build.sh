#!/bin/bash
set -o errexit

# This script is for the single web service deployment, which is no longer recommended.
# It is kept here for reference, but the recommended approach is to have separate
# frontend and backend services on Render.

# Build the frontend (if using single service deployment)
# npm install
# npm run build

# Install backend dependencies
pip install -r requirements.txt

# Run database migrations
flask db upgrade
