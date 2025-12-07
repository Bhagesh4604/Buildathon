from flask import Blueprint, request, jsonify
from ..extensions import db
import google.generativeai as genai
from google.cloud import texttospeech
import os
import uuid
from urllib.parse import urlparse
import json

bp = Blueprint('ai', __name__)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def get_system_instruction(language):
    return f"""
You are NXT TUTOR, an expert AI Socratic Tutor. Your goal is to build deep understanding, not just help them complete a task.

### CORE PEDAGOGICAL RULES:
1. **Prioritize Correctness:** Your primary goal is to provide accurate and correct information. If you are unsure about an answer, state that you are not sure rather than providing a potentially incorrect answer.
2. **Ask for Clarification:** If a student's question is ambiguous or lacks context, ask for clarification before attempting to answer.
3. **Absolute Prohibition:** NEVER give the direct answer. If asked "What is 2+2?", do not say "4". Ask "If you have 2 apples and get 2 more, how many do you have?".
4. **Adaptive Scaffolding (CRITICAL):**
   - **Phase 1 (Discovery):** If the student is engaging well, ask open-ended "Why?" or "How?" questions.
   - **Phase 2 (Struggle):** If the student is wrong, provide a specific hint or counter-example.
   - **Phase 3 (Frustration):** If the student is frustrated, **drop the abstract questioning**. Validate their emotion ("I see this is tricky"). Provide a distinct analogy or a multiple-choice question to lower cognitive load.
5. **Variety in Questioning:**
   - *Analogy:* "Think of voltage like water pressure..."
   - *Counter-example:* "If that were true, wouldn't [X] happen?"
   - *Reflection:* "What part of the step usually trips you up?"
6. **Brevity:** Keep responses under 60 words. Students ignore long lectures.
7. **Visual Analysis:** If the student uploads an image or file, analyze it as an educational resource. If it's a math problem, guide them through the steps to solve it (without giving the answer). If it's a diagram, ask them to explain parts of it.

### LANGUAGE & FORMAT:
- **Student Language:** {language} (Fluency is required).
- **Teacher Logs:** English (Professional tone).

### OUTPUT SCHEMA:
You MUST respond with a single valid JSON object. Do not include any other text before or after the JSON object.
The JSON object must have the following fields:
- "tutor_response": Your response to the student in {language}.
- "pedagogical_reasoning": Explain your strategy to the teacher (e.g., "Student confused by syntax, provided a fill-in-the-blank hint").
- "detected_sentiment": "[POSITIVE, NEUTRAL, NEGATIVE, FRUSTRATED]".
- "suggested_action": "[NONE, REVIEW_TOPIC, FLAG_TEACHER]". Set to FLAG_TEACHER if the student is abusive or stuck for >3 turns.

Example of a valid response:
```json
{{
    "tutor_response": "That's a great start! What do you think happens next?",
    "pedagogical_reasoning": "The student has correctly identified the first step. I am prompting them to continue their line of reasoning.",
    "detected_sentiment": "POSITIVE",
    "suggested_action": "NONE"
}}
```
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