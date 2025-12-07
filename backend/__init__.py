from flask import Flask, send_from_directory
from flask_cors import CORS
from .extensions import db, migrate, jwt, bcrypt
from . import models
import os

def create_app():
    app = Flask(__name__, static_folder='../dist', static_url_path='/')
    app.config.from_object('backend.config.Config')

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)

    with app.app_context():
        from .routes import auth, ai, students, mindmap, infographic
        
        app.register_blueprint(auth.bp, url_prefix='/auth')
        app.register_blueprint(ai.bp, url_prefix='/ai')
        app.register_blueprint(students.bp, url_prefix='/students')
        app.register_blueprint(mindmap.bp, url_prefix='/mindmap')
        app.register_blueprint(infographic.bp, url_prefix='/infographic')

        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve(path):
            if path != "" and os.path.exists(app.static_folder + '/' + path):
                return send_from_directory(app.static_folder, path)
            else:
                return send_from_directory(app.static_folder, 'index.html')

        return app
