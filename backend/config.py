import os
from dotenv import load_dotenv

# Construct the path to the .env file
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
# Load the .env file
load_dotenv(dotenv_path=dotenv_path)

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
