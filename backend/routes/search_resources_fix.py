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
        return jsonify({"error": "An unexpected error occurred with the AI service."}), 500