from flask import Blueprint, request, jsonify
from ..extensions import db
import google.generativeai as genai
from google.cloud import texttospeech
import os
import uuid
from urllib.parse import urlparse
import json
from backend.routes.mindmap import MINDMAP_PROMPT_TEMPLATE

bp = Blueprint('ai', __name__)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def get_system_instruction(language):
    return f"""
You are NXT TUTOR, an expert AI Tutor for all subjects. Your goal is to provide clear, direct, and comprehensive explanations that are well-structured and easy to read.

### EXPERTISE:
You are an expert in a wide range of subjects, including but not limited to: Math, Science (Physics, Chemistry, Biology), History, Literature, Computer Science, and more.

### CORE INSTRUCTIONS:
1.  **Provide Direct Answers:** When a student asks a question, provide a clear, direct, and accurate answer.
2.  **Structure Your Explanation:** Use markdown for formatting to create a clear and organized explanation.
    *   Use headings (`##`, `###`) to structure your answer.
    *   Use bold text (`**...**`) for key terms.
    *   Use bullet points (`*` or `-`) for lists.
3.  **Explain Step-by-Step:** Break down your explanations into a series of small, easy-to-understand steps.
4.  **Use Visual Aids:**
    *   **LaTeX for Math:** When explaining math or science concepts, always use LaTeX for formulas. Wrap equations in `$` for inline math and `$$` for block math.
    *   **Mermaid for Diagrams:** For concepts that benefit from diagrams, use Mermaid syntax. Wrap Mermaid code in ````mermaid ... ```` blocks.
    *   **Markdown Code Blocks for Code:** When explaining code, always wrap it in markdown code blocks with the language specified.
5.  **Proactive Guidance:** After answering the student's question, suggest a related topic, a real-world application, or a more advanced question to deepen their knowledge.
6.  **Visual Analysis:** If the student uploads an image or file, analyze it and provide a direct explanation or answer related to it.

### LANGUAGE & FORMAT:
- **Student Language:** {language} (Fluency is required).

### OUTPUT SCHEMA:
You MUST respond with a single valid JSON object. Do not include any other text before or after the JSON object.
The JSON object must have the following fields:
- "steps": An array of strings, where each string is a small step in the explanation. Use markdown, LaTeX, Mermaid, and code blocks.
- "tutor_response": A concluding remark or a summary of the explanation.
- "pedagogical_reasoning": "Direct explanation provided."
- "detected_sentiment": "NEUTRAL"
- "suggested_action": "NONE"
"""

def transform_history(history):
    transformed = []
    for message in history:
        transformed.append({
            "role": message["role"],
            "parts": [message["content"]]
        })
    return transformed

@bp.route('/socratic-chat', methods=['POST'])
def socratic_chat():
    data = request.get_json()
    history = data.get('history', [])
    current_message = data.get('currentMessage')
    language = data.get('language', 'en')
    attachment = data.get('attachment')

    if not current_message:
        return jsonify({"error": "Missing current message"}), 400

    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=get_system_instruction(language)
        )
        
        transformed_history = transform_history(history)
        chat = model.start_chat(history=transformed_history)
        
        parts = [current_message]
        if attachment:
            image_blob = {"mime_type": attachment['mimeType'], "data": attachment['data']}
            parts.append(image_blob)
            
        response = chat.send_message(parts)

        print(f"Gemini API response: {response.text}")

        # Strip the markdown wrapper if it exists
        text_to_parse = response.text
        if text_to_parse.startswith("```json"):
            text_to_parse = text_to_parse[7:]
        if text_to_parse.endswith("```"):
            text_to_parse = text_to_parse[:-3]

        try:
            response_json = json.loads(text_to_parse)
        except json.JSONDecodeError:
            print("Error: Failed to decode JSON from Gemini API response. Wrapping in a valid JSON object.")
            response_json = {
                "tutor_response": text_to_parse,
                "pedagogical_reasoning": "No reasoning provided.",
                "detected_sentiment": "NEUTRAL",
                "suggested_action": "NONE"
            }
        
        return jsonify(response_json)

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "An unexpected error occurred with the AI service."} ), 500

@bp.route('/generate-title', methods=['POST'])
def generate_chat_title():
    return jsonify({"title": "New Conversation"})

@bp.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    data = request.get_json()
    text = data.get('text')

    if not text:
        return jsonify({"error": "Missing text"}), 400

    try:
        client = texttospeech.TextToSpeechClient()

        synthesis_input = texttospeech.SynthesisInput(text=text)

        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
        )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )

        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        return jsonify({"audio_content": response.audio_content})

    except Exception as e:
        print(f"An error occurred during text-to-speech conversion: {e}")
        return jsonify({"error": "An unexpected error occurred with the AI service."} ), 500

@bp.route('/search-resources', methods=['POST'])
def search_study_resources():
    data = request.get_json()
    query = data.get('query')

    if not query:
        return jsonify({"error": "Missing query"}), 400

    try:
        model = genai.GenerativeModel('gemini-2.5-flash', tools=[{"google_search": {}}])
        
        response = model.generate_content(f"Find study materials, lecture notes, PDF downloads, and previous year question papers for the following topic: \"{query}\". Prioritize results from universities (like VTU), educational portals, and PDF repositories. Summarize the available resources and key concepts covered.")

        print(f"Gemini API response: {response.text}")

        summary = response.text or "No summary available."
        
        # Extract Grounding Chunks (URLs)
        chunks = response.candidates[0].grounding_metadata.grounding_chunks or []
        resources = []

        for chunk in chunks:
            if chunk.web and chunk.web.uri and chunk.web.title:
                uri = chunk.web.uri
                resource_type = 'PDF' if uri.lower().endswith('.pdf') else 'WEB'
                
                resources.append({
                    "id": str(uuid.uuid4()),
                    "title": chunk.web.title,
                    "uri": uri,
                    "source": urlparse(uri).hostname,
                    "type": resource_type
                })

        # Deduplicate resources based on URI
        unique_resources = {res['uri']: res for res in resources}.values()

        return jsonify({"summary": summary, "resources": list(unique_resources)})

    except Exception as e:
        print(f"An error occurred during resource search: {e}")
        return jsonify({"error": "An unexpected error occurred with the AI service."} ), 500

@bp.route('/generate-quiz', methods=['POST'])
def generate_quiz_questions():
    data = request.get_json()
    topic = data.get('topic')
    difficulty = data.get('difficulty', 'Medium')
    moduleId = data.get('moduleId')

    if not topic:
        return jsonify({"error": "Missing topic"}), 400

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""
You are an expert quiz creator. Generate 5 multiple-choice questions for a quiz on the topic of "{topic}" with a difficulty level of "{difficulty}".

        You MUST respond in a single valid JSON object. The root of the object should be a list of question objects.
        Each question object must have the following schema:
        {{
            "id": "A unique integer for the question (e.g., 1, 2, 3...)",
            "question": "The question text.",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "The index of the correct answer in the options array (0-3).",
            "topic": "{topic}",
            "moduleId": "{moduleId}"
        }}

        Example of a valid response:
        ```json
        [
            {{
                "id": 1,
                "question": "What is the capital of France?",
                "options": ["Berlin", "Madrid", "Paris", "Rome"],
                "correctAnswer": 2,
                "topic": "Geography",
                "moduleId": "geo101"
            }}
        ]
        ```
        """
        
        response = model.generate_content(prompt)
        
        text_to_parse = response.text
        if text_to_parse.startswith("```json"):
            text_to_parse = text_to_parse[7:]
        if text_to_parse.endswith("```"):
            text_to_parse = text_to_parse[:-3]
            
        response_json = json.loads(text_to_parse)

        return jsonify(response_json)

    except Exception as e:
        print(f"An error occurred during quiz generation: {e}")
        return jsonify({"error": "An unexpected error occurred with the AI service."} ), 500

@bp.route('/transcribe-audio', methods=['POST'])
def transcribe_audio():
    data = request.get_json()
    audio_data = data.get('audioBase64')
    mime_type = data.get('mimeType')

    if not audio_data or not mime_type:
        return jsonify({"error": "Missing audio data or mime type"}), 400

    try:
        audio_blob = {"mime_type": mime_type, "data": audio_data}
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(["Transcribe this audio.", audio_blob])
        
        return jsonify({"text": response.text})

    except Exception as e:
        print(f"An error occurred during transcription: {e}")
        return jsonify({"error": "An unexpected error occurred with the AI service."} ), 500

@bp.route('/analyze-code', methods=['POST'])
def analyze_code():
    data = request.get_json()
    image_data = data.get('imageBase64')
    language = data.get('language', 'plaintext')

    if not image_data:
        return jsonify({"error": "Missing image data"}), 400

    try:
        image_blob = {"mime_type": "image/jpeg", "data": image_data}
        
        prompt = f"""
        As an expert software engineer, analyze the following image of code written in {language}.
        1.  Identify any bugs, errors, or major inefficiencies.
        2.  Provide a corrected version of the code.
        3.  Provide a brief, clear explanation of the fixes.

        You MUST respond in a single valid JSON object with the following schema:
        {{
            "fixedCode": "The corrected code snippet.",
            "explanation": "A clear, concise explanation of the changes."
        }}
        """
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content([prompt, image_blob])
        
        # Strip markdown and parse
        text_to_parse = response.text
        if text_to_parse.startswith("```json"):
            text_to_parse = text_to_parse[7:]
        if text_to_parse.endswith("```"):
            text_to_parse = text_to_parse[:-3]
            
        response_json = json.loads(text_to_parse)
        return jsonify(response_json)

    except Exception as e:
        print(f"An error occurred during code analysis: {e}")
        return jsonify({"error": "An unexpected error occurred with the AI service."} ), 500

@bp.route('/analyze-exam-trends', methods=['POST'])
def analyze_exam_trends():
    data = request.get_json()
    topic = data.get('topic')

    if not topic:
        return jsonify({"error": "Missing topic"}), 400

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""
        Based on the topic "{topic}", predict 3-5 high-probability exam questions.
        For each question, provide the probability ('HIGH', 'MEDIUM', 'LOW'), a list of years it has appeared in exams, the marks it is likely to carry, and a tip for answering it.

        You MUST respond in a single valid JSON object with the following schema:
        {{
            "questions": [
                {{
                    "id": "a unique id",
                    "question": "The predicted question.",
                    "probability": "HIGH" | "MEDIUM" | "LOW",
                    "yearsAppeared": ["year1", "year2"],
                    "marks": "5",
                    "tips": "A tip for answering the question."
                }}
            ]
        }}
        """
        
        response = model.generate_content(prompt)
        
        text_to_parse = response.text
        if text_to_parse.startswith("```json"):
            text_to_parse = text_to_parse[7:]
        if text_to_parse.endswith("```"):
            text_to_parse = text_to_parse[:-3]
            
        response_json = json.loads(text_to_parse)
        
        # Add unique IDs to the questions
        for i, q in enumerate(response_json['questions']):
            q['id'] = f'pred_{{i+1}}'

        return jsonify(response_json['questions'])

    except Exception as e:
        print(f"An error occurred during exam trend analysis: {e}")
        return jsonify({"error": "An unexpected error occurred with the AI service."} ), 500

@bp.route('/expand-topic', methods=['POST'])
def expand_topic():
    data = request.get_json()
    topic = data.get('topic')

    if not topic:
        return jsonify({"error": "Missing topic"}), 400

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = MINDMAP_PROMPT_TEMPLATE.replace("<<INSERT USER CONTENT HERE>>", f"A detailed breakdown of the topic: {topic}")
        
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
            return jsonify({"error": "The AI model returned an invalid response."}), 500
        
        return jsonify(mindmap_json)

    except Exception as e:
        print(f"An error occurred during mindmap expansion: {e}")
        return jsonify({"error": "Failed to generate expanded mindmap"}), 500

def get_visualize_instruction():
    return f"""
You are an expert data visualizer and educator. Your task is to take a given text and explain it visually, step-by-step, in a well-structured format.

### CORE INSTRUCTIONS:
1.  **Structure Your Explanation:** Use markdown for formatting to create a clear and organized explanation.
    *   Use headings (`##`, `###`) to structure your answer.
    *   Use bold text (`**...**`) for key terms.
    *   Use bullet points (`*` or `-`) for lists.
2.  **Break It Down Visually:** Your primary goal is to explain the concept in a series of small, easy-to-understand visual steps.
3.  **Use Mermaid for Diagrams:** For concepts that benefit from diagrams, use Mermaid syntax. Wrap Mermaid code in ````mermaid ... ```` blocks.
4.  **Use LaTeX for Math:** When explaining math or science concepts, always use LaTeX for formulas. Wrap equations in `$` for inline math and `$$` for block math.
5.  **Use Markdown Code Blocks for Code:** When explaining code, always wrap it in markdown code blocks with the language specified.

### OUTPUT SCHEMA:
You MUST respond with a single valid JSON object. The JSON object must have the following fields:
- "steps": An array of strings, where each string is a small step in the explanation.
- "tutor_response": A concluding remark.
- "pedagogical_reasoning": "Visual explanation generated."
- "detected_sentiment": "NEUTRAL"
- "suggested_action": "NONE"
"""

@bp.route('/visualize-text', methods=['POST'])
def visualize_text():
    data = request.get_json()
    text = data.get('text')

    if not text:
        return jsonify({"error": "Missing text"}), 400

    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=get_visualize_instruction()
        )
        
        response = model.generate_content(text)

        print(f"Gemini API response: {response.text}")

        # Strip the markdown wrapper if it exists
        text_to_parse = response.text
        if text_to_parse.startswith("```json"):
            text_to_parse = text_to_parse[7:]
        if text_to_parse.endswith("```"):
            text_to_parse = text_to_parse[:-3]

        try:
            response_json = json.loads(text_to_parse)
        except json.JSONDecodeError:
            print("Error: Failed to decode JSON from Gemini API response.")
            return jsonify({"error": "The AI model returned an invalid response."}), 500
        
        return jsonify(response_json)

    except Exception as e:
        print(f"An error occurred during text visualization: {e}")
        return jsonify({"error": "Failed to generate visual explanation"}), 500