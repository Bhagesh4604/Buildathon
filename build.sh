#!/bin/bash
set -o errexit
npm install
npm run build
pip install -r requirements.txt