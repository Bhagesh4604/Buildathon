from flask import Blueprint, request, jsonify
import google.generativeai as genai
import os
import json

bp = Blueprint('infographic', __name__)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

@bp.route('/generate-infographic', methods=['POST'])
def generate_infographic():
    data = request.get_json()
    user_content = data.get('prompt', '')
    image_base64 = data.get('imageBase64')

    if not user_content and not image_base64:
        return jsonify({"error": "No content provided"}), 400

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""
        AI Infographic Generator.
        Your task is to take a given text and transform it into a structured infographic.
        The output MUST be a valid JSON object.

        ### 1. CORE INSTRUCTIONS:
        1.  **Identify the Core Topic:** This will be the title of the infographic.
        2.  **Extract Key Insights:** Identify 2-3 key takeaways from the text.
        3.  **Create Sections:** Divide the content into logical sections, each with a heading.
        4.  **Populate Sections:** For each section, provide a list of items (bullet points).
        5.  **Assign Visual Hints:** For each section, suggest a visual hint (e.g., 'chart', 'timeline', 'list').

        ### 2. INFOGRAPHIC GENERATION RULES
        - The JSON structure must contain a `title` and a list of `sections`.
        - Each section object in the list must have:
          - `heading`: The title of the section.
          - `content_type`: 'list', 'steps', or 'comparison'.
          - `visual_hint`: 'chart', 'timeline', 'arrow-flow', or 'list'.
          - `items`: A list of strings.

        ### 3. EXAMPLE:
        **Input Text:** "The water cycle is the continuous movement of water on, above, and below the surface of the Earth. The main stages are evaporation, condensation, precipitation, and collection."

        **Output JSON:**
        ```json
        {{
          "title": "The Water Cycle",
          "highlight_insights": ["Continuous Movement", "Four Main Stages"],
          "sections": [
            {{
              "heading": "Stages of the Water Cycle",
              "content_type": "steps",
              "visual_hint": "arrow-flow",
              "items": [
                "Evaporation: Water turns into vapor and rises into the air.",
                "Condensation: Water vapor in the air gets cold and changes back into liquid, forming clouds.",
                "Precipitation: Water falls from the clouds in the form of rain, snow, sleet, or hail.",
                "Collection: Water collects in rivers, lakes, oceans, or underground."
              ]
            }}
          ]
        }}
        ```
        
        Generate the infographic using the following content:
        {user_content}
        """
        
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
            infographic_json = json.loads(text_to_parse)
        except json.JSONDecodeError:
            print("Error: Failed to decode JSON from Gemini API response.")
            # Return a default response or an error message
            return jsonify({"error": "The AI model returned an invalid response."}), 500
        
        return jsonify(infographic_json)

    except Exception as e:
        print(f"An error occurred during infographic generation: {e}")
        return jsonify({"error": "Failed to generate infographic"}), 500
