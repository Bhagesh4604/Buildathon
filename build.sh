#!/bin/bash

# Exit on error
set -o errexit

# Frontend
npm install
npm run build

# Backend
pip install -r requirements.txt
