import axios from 'axios';

export async function generateReplySuggestions(conversationHistory: { content: string; senderType: string }[]) {
  const response = await axios.post('/api/ai/reply-suggestions', {
    history: conversationHistory,
  });

  return Array.isArray(response.data?.suggestions) ? response.data.suggestions : [];
}

export async function summarizeConversation(conversationHistory: { content: string; senderType: string }[]) {
  const response = await axios.post('/api/ai/summarize', {
    history: conversationHistory,
  });

  return response.data?.summary || 'No summary available.';
}
