from flask import Blueprint, request, jsonify
import google.generativeai as genai
import os
import json
import traceback

bp = Blueprint('mindmap', __name__)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

MINDMAP_PROMPT_TEMPLATE = """
AI Mindmap Generator inspired by Google NotebookLM.
Your task is to take a given text and transform it into a structured, hierarchical mindmap.
The output MUST be a valid JSON object.

### 1. CORE INSTRUCTIONS:
1.  **Identify the Core Topic:** This will be the root node of the mindmap.
2.  **Extract Main Branches:** These are the primary themes or sections of the text.
3.  **Extract Sub-Branches:** For each main branch, identify key points, concepts, or data. Go one level deeper if the text supports it (sub-sub-branches).
4.  **Assign Keywords/Themes:** For each branch and sub-branch, assign a short, descriptive keyword (1-3 words).
5.  **Assign Colors/Themes (Optional but Recommended):** Assign a color theme (e.g., 'blue', 'green', 'purple') to each main branch to visually group related concepts.

### 2. MINDMAP GENERATION RULES
- The JSON structure must contain a `title` (the core topic) and a flat list of `nodes`.
- Each node object in the list must have:
  - `id`: A unique string identifier (e.g., "node-1", "node-2.1").
  - `label`: The short, descriptive keyword for the node.
  - `parentId`: (Optional) The `id` of the parent node. The root node will not have a `parentId`.
  - `theme`: (Optional) The color theme for the branch, inherited by children.

### 3. EXAMPLE:
**Input Text:** "Photosynthesis is the process by which green plants use sunlight, water, and carbon dioxide to create their own food. The process is divided into two main stages: the light-dependent reactions and the light-independent reactions (Calvin Cycle). The light reactions capture solar energy, and the Calvin Cycle uses that energy to make glucose."

**Output JSON:**
```json
{
  "title": "Photosynthesis",
  "nodes": [
    {
      "id": "root",
      "label": "Photosynthesis"
    },
    {
      "id": "node-1",
      "label": "Inputs",
      "parentId": "root",
      "theme": "blue"
    },
    {
      "id": "node-1.1",
      "label": "Sunlight",
      "parentId": "node-1"
    },
    {
      "id": "node-1.2",
      "label": "Water",
      "parentId": "node-1"
    },
    {
      "id": "node-1.3",
      "label": "Carbon Dioxide",
      "parentId": "node-1"
    },
    {
      "id": "node-2",
      "label": "Stages",
      "parentId": "root",
      "theme": "green"
    },
    {
      "id": "node-2.1",
      "label": "Light-Dependent Reactions",
      "parentId": "node-2"
    },
    {
      "id": "node-2.2",
      "label": "Calvin Cycle",
      "parentId": "node-2"
    },
    {
      "id": "node-3",
      "label": "Outputs",
      "parentId": "root",
      "theme": "orange"
    },
    {
      "id": "node-3.1",
      "label": "Glucose",
      "parentId": "node-3"
    }
  ]
}
```

Generate the mindmap using the following content:
<<INSERT USER CONTENT HERE>>
"""

@bp.route('/generate-mindmap', methods=['POST'])
def generate_mindmap():
    data = request.get_json()
    user_content = data.get('prompt', '')
    image_base64 = data.get('imageBase64')

    if not user_content and not image_base64:
        return jsonify({"error": "No content provided"}), 400

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = MINDMAP_PROMPT_TEMPLATE.replace("<<INSERT USER CONTENT HERE>>", user_content)
        
        if image_base64:
            image_parts = [{"mime_type": "image/jpeg", "data": image_base64}]
            response = model.generate_content([prompt, image_parts])
        else:
            response = model.generate_content(prompt)

        print(f"Gemini API response: {response.text}")

        # Strip the markdown wrapper if it exists
        text_to_parse = response.text
        if text_to_parse.startswith("```json"):
            text_to_parse = text_to_parse[7:]
        if text_to_parse.endswith("```"):
            text_to_parse = text_to_parse[:-3]

        try:
            mindmap_json = json.loads(text_to_parse)
        except json.JSONDecodeError:
            print("Error: Failed to decode JSON from Gemini API response.")
            # Return a default response or an error message
            return jsonify({"error": "The AI model returned an invalid response."}), 500
        
        return jsonify(mindmap_json)

    except Exception as e:
        print("An error occurred during mindmap generation:")
        traceback.print_exc()
        return jsonify({"error": "Failed to generate mindmap"}), 500

