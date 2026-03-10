import { GoogleGenAI } from "@google/genai";

// The platform injects GEMINI_API_KEY into the environment.
// In the frontend, this is typically available via process.env.GEMINI_API_KEY
// if the build system is configured to define it.
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }
  return new GoogleGenAI({ apiKey });
};

export async function generateReplySuggestions(conversationHistory: { content: string; senderType: string }[]) {
  const ai = getAI();
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
    
    try {
      return JSON.parse(text) as string[];
    } catch (e) {
      console.error("Failed to parse AI suggestions JSON:", text);
      return [];
    }
  } catch (error) {
    console.error("Error generating suggestions:", error);
    throw error; // Let the caller handle it
  }
}

export async function summarizeConversation(conversationHistory: { content: string; senderType: string }[]) {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const historyString = conversationHistory
    .map((msg) => `${msg.senderType}: ${msg.content}`)
    .join("\n");

  const prompt = `
    Summarize the following conversation history between a customer and a business in the UAE.
    Highlight the main intent, key issues, and any next steps for the agent.
    Keep it concise (max 3 sentences).
    
    Conversation History:
    ${historyString}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "No summary available.";
  } catch (error) {
    console.error("Error generating summary:", error);
    throw error;
  }
}
