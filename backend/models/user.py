from ..extensions import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(80), primary_key=True)
    email = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    name = db.Column(db.String(80), nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(50))

    __mapper_args__ = {
        'polymorphic_on': role
    }

    def __repr__(self):
        return f'<User {self.name}>'
