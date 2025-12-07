import { Message, AIResponseSchema, Sentiment, SupportedLanguage, StudyResource, QuizQuestion, PredictedQuestion, MindmapData, InfographicData } from "../types";

// Note: In a real production app, this would live in the Python Backend.
// We are implementing it here to simulate the AI Core.

const API_URL = 'http://localhost:5000';

export const getSocraticResponse = async (
  history: Message[],
  currentMessage: string,
  language: SupportedLanguage = SupportedLanguage.ENGLISH
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

export const getSpeechForText = async (text: string, voiceName: string = 'Kore'): Promise<Uint8Array | null> => {
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
    const binaryString = atob(data.audio_content);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("TTS Error", e);
    return null;
  }
};

export interface ResearchResult {
  summary: string;
  resources: StudyResource[];
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

    // The backend now returns the summary and resources, so we just return the data
    return data;

  } catch (error) {
    console.error("Research Error:", error);
    return { 
      summary: "Sorry, I couldn't connect to the research database at the moment.", 
      resources: [] 
    };
  }
};

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
        return "Transcription failed.";
    }
};

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
    console.error("Exam Analysis Error", error);
    return [];
  }
}

// --- Visual Studio Generators ---

export const generateMindmap = async (input: string, imageBase64?: string): Promise<MindmapData | null> => {
  try {
    const response = await fetch(`${API_URL}/mindmap/generate-mindmap`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: input, imageBase64 }),
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Mindmap Gen Error", error);
    return null;
  }
};

export const generateInfographic = async (input: string, imageBase64?: string): Promise<InfographicData | null> => {
  try {
    const response = await fetch(`${API_URL}/infographic/generate-infographic`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: input, imageBase64 }),
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("Infographic Gen Error", error);
    return null;
  }
};
