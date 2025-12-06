from ..extensions import db


class TranscriptItem(db.Model):
    __tablename__ = 'transcript_items'

    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(50), nullable=False)
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False)
    live_session_id = db.Column(db.String(80), db.ForeignKey('live_sessions.id'), nullable=False)
