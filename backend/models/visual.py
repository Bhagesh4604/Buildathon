from ..extensions import db

class Visual(db.Model):
    __tablename__ = 'visuals'

    id = db.Column(db.String(80), primary_key=True)
    type = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    data = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False)
    student_id = db.Column(db.String(80), db.ForeignKey('students.id'), nullable=False)
