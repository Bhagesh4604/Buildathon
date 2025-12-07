from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.visual import Visual
import datetime

bp = Blueprint('library', __name__)

@bp.route('/save', methods=['POST'])
@jwt_required()
def save_visual():
    current_user_id = get_jwt_identity()
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    new_visual = Visual(
        id=data.get('id'),
        type=data.get('type'),
        title=data.get('title'),
        data=data.get('data'),
        created_at=datetime.datetime.fromtimestamp(data.get('createdAt') / 1000.0),
        student_id=current_user_id
    )

    db.session.add(new_visual)
    db.session.commit()

@bp.route('/visuals', methods=['GET'])
@jwt_required()
def get_visuals():
    current_user_id = get_jwt_identity()
    
    visuals = Visual.query.filter_by(student_id=current_user_id).order_by(Visual.created_at.desc()).all()
    
    visuals_list = []
    for v in visuals:
        visuals_list.append({
            'id': v.id,
            'type': v.type,
            'title': v.title,
            'data': v.data,
            'createdAt': v.created_at.timestamp() * 1000, # Convert to JS timestamp
            'student_id': v.student_id
        })
        
    return jsonify(visuals_list)

