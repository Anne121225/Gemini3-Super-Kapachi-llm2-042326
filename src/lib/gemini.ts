import { GoogleGenAI, Part } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function streamGemini(
  prompt: string | Part[],
  model: string,
  systemInstruction: string,
  signal: AbortSignal,
  onChunk: (text: string) => void
) {
  try {
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    for await (const chunk of responseStream) {
      if (signal.aborted) {
        break;
      }
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || signal.aborted) {
      console.log('Stream aborted by user.');
      return;
    }
    console.error("Gemini API Error:", error);
    throw error;
  }
}

