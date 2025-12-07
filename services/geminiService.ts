import { Message, AIResponseSchema, Sentiment, SupportedLanguage, StudyResource, QuizQuestion, MindmapData, InfographicData } from "../types";

const API_URL = 'http://localhost:5000';

export const getSocraticResponse = async (
  history: Message[],
  currentMessage: string,
  language: SupportedLanguage = SupportedLanguage.ENGLISH,
  currentAttachment?: { mimeType: string; data: string }
): Promise<AIResponseSchema> => {
  try {
    const response = await fetch(`${API_URL}/ai/socratic-chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            history,
            currentMessage,
            language,
            attachment: currentAttachment,
        }),
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback for demo stability
    return {
      tutor_response: language === SupportedLanguage.ENGLISH 
        ? "I'm having trouble connecting to my knowledge base right now. Can you try asking that again?"
        : "System is experiencing high traffic. Please try again in English or wait a moment.", // Simple fallback
      pedagogical_reasoning: "System error fallback triggered.",
      detected_sentiment: Sentiment.NEUTRAL,
      suggested_action: 'NONE'
    };
  }
};

export const generateChatTitle = async (message: string): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/ai/generate-title`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data.title || "New Chat";
  } catch (e) {
    return "New Conversation";
  }
};

export const getAudioOverview = async (text: string): Promise<string> => {
    try {
        const response = await fetch(`${API_URL}/ai/text-to-speech`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const audioBlob = new Blob([new Uint8Array(atob(data.audio_content).split('').map(char => char.charCodeAt(0)))], { type: 'audio/mpeg' });
        return URL.createObjectURL(audioBlob);
    } catch (e) {
        console.error("TTS Error", e);
        return '';
    }
};

export interface ResearchResult {
  summary: string;
  resources: StudyResource[];
  search_terms: string[];
}

export const searchStudyResources = async (query: string): Promise<ResearchResult> => {
    try {
        const response = await fetch(`${API_URL}/ai/search-resources`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return { ...data, resources: [] }; // Return the summary and search_terms, with an empty resources array.
    } catch (error) {
        console.error("Research Error:", error);
        return { 
            summary: "Sorry, I couldn't connect to the research database at the moment.", 
            resources: [],
            search_terms: []
        };
    }
};

export const generateQuizQuestions = async (topic: string, difficulty: 'Easy' | 'Medium' | 'Hard', moduleId: string): Promise<QuizQuestion[]> => {
    try {
        const response = await fetch(`${API_URL}/ai/generate-quiz`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic, difficulty, moduleId }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error("Quiz Gen Error", error);
        return [];
    }
}

export const transcribeAudio = async (audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> => {
    try {
        const response = await fetch(`${API_URL}/ai/transcribe-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ audioBase64, mimeType }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.text || "No transcription available.";
    } catch (error) {
        console.error("Transcription error:", error);
    }
};

export const findResources = async (searchTerm: string): Promise<StudyResource[]> => {
    const searchResults = await window.google.search(searchTerm);
    return searchResults.map((result: any, index: number) => ({
        id: `${index}`,
        title: result.title,
        type: result.mimeType === 'application/pdf' ? 'PDF' : 'WEBSITE',
        uri: result.link,
        source: result.displayLink,
    }));
}

export const analyzeAndFixCode = async (imageBase64: string, language: string): Promise<{ fixedCode: string, explanation: string }> => {
  try {
    const response = await fetch(`${API_URL}/ai/analyze-code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64, language }),
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Code analysis error:", error);
    return { 
        fixedCode: "// Error analyzing code.", 
        explanation: "Could not connect to the AI to analyze the code. Please check your network and the backend server." 
    };
  }
};

export const analyzeExamTrends = async (topic: string): Promise<PredictedQuestion[]> => {
    try {
        const response = await fetch(`${API_URL}/ai/analyze-exam-trends`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error("Exam trend analysis error:", error);
        return [];
    }
};

export const generateMindmap = async (prompt: string, imageBase64?: string): Promise<MindmapData> => {
    try {
        const response = await fetch(`${API_URL}/mindmap/generate-mindmap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, imageBase64 }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error("Mindmap generation error:", error);
        return { title: "Error", nodes: [{ id: "1", label: "Failed to generate Mindmap", theme: "rose" }] };
    }
};

export const generateInfographic = async (prompt: string, imageBase64?: string): Promise<InfographicData> => {
    try {
        const response = await fetch(`${API_URL}/infographic/generate-infographic`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, imageBase64 }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error("Infographic generation error:", error);
        return { title: "Error", sections: [{ heading: "Failed to generate Infographic", content_type: "list", items: [] }] };
    }
};