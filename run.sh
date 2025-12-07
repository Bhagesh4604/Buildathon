#!/usr/bin/env bash
exec gunicorn --workers 1 --worker-class gthread "backend:create_app()"