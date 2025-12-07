#!/bin/bash
gunicorn "backend:create_app()"
