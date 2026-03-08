import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateReplySuggestions(conversationHistory: { content: string; senderType: string }[]) {
  const model = "gemini-3-flash-preview";
  
  const historyString = conversationHistory
    .map((msg) => `${msg.senderType}: ${msg.content}`)
    .join("\n");

  const prompt = `
    You are an AI assistant helping a customer support agent.
    Based on the following conversation history, suggest 3 concise and professional reply options for the agent.
    The business is based in the UAE.
    
    Conversation History:
    ${historyString}
    
    Return only a JSON array of strings.
    Example: ["Sure, I can help with that.", "What is your order number?", "Our office is in Dubai."]
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return [];
  }
}
