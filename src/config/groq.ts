import { Groq } from 'groq-sdk';

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export const GROQ_MODEL = 'llama-3.1-70b-versatile';
