import os
import json
from flask import Blueprint, request, jsonify
import google.generativeai as genai

bp = Blueprint('mindmap', __name__)

MINDMAP_PROMPT_TEMPLATE = """
AI Mindmap Generator inspired by Google NotebookLM. 
Your job is to convert any topic, text, or notes into a structured, 
intelligent, interactive mindmap.

Follow ALL rules strictly.

============================
### 1. OUTPUT FORMAT (STRICT JSON)

Return ONLY JSON in the following format:

{
  "title": "",
  "nodes": [
    {
      "id": "unique_id",
      "parent": "parent_id_or_null",
      "text": "short node title",
      "summary": "1–2 line explanation",
      "example": "practical example",
      "analogy": "simple analogy",
      "connections": ["ids_of_related_nodes"]
    }
  ],
  "suggested_improvements": [
    "improvement_1",
    "improvement_2",
    "improvement_3"
  ]
}

============================
### 2. MINDMAP GENERATION RULES

- Identify the MAIN concept → make it the root node.
- Create clear subtopics → branch nodes.
- Create finer concepts → child nodes.
- Keep node titles SHORT and meaningful.
- Keep summaries simple and student-friendly.
- All nodes must have:
  * summary  
  * example  
  * analogy  
  * optional cross-connections  

- Use correct hierarchical structure.
- Avoid unnecessary depth.
- Do NOT include too many nodes—clarity over quantity.

============================
### 3. KNOWLEDGE RELATIONSHIPS

- Detect concepts that are related.
- Add their node IDs to the "connections" field.
- This creates a mini knowledge graph inside the mindmap.

============================
### 4. IMPROVEMENT SUGGESTIONS

Add 2–3 helpful suggestions, like:
- missing subtopics
- better structure
- recommended merges
- extra examples to add

============================
### 5. INPUT CONTENT
Generate the mindmap using the following content:
<<INSERT USER CONTENT HERE>>

============================

Return ONLY valid JSON—no explanations, no markdown.
"""

@bp.route('/generate-mindmap', methods=['POST'])
def generate_mindmap():
    data = request.get_json()
    user_content = data.get('content')

    if not user_content:
        return jsonify({"error": "Missing content"}), 400

    try:
        prompt = MINDMAP_PROMPT_TEMPLATE.replace("<<INSERT USER CONTENT HERE>>", user_content)
        
        model = genai.GenerativeModel(
            'gemini-2.5-flash',
            generation_config={"response_mime_type": "application/json"}
        )
        response = model.generate_content(prompt)
        
        # The model should return a valid JSON string
        # We need to parse it
        mindmap_json = json.loads(response.text)
        
        return jsonify(mindmap_json)

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "An unexpected error occurred with the AI service."}), 500
