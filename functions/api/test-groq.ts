import { PagesFunction } from '@cloudflare/workers-types';
import { Groq } from 'groq-sdk';

type Env = {
  GROQ_API_KEY: string;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { GROQ_API_KEY } = context.env;

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'GROQ_API_KEY is NOT set',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'Reply with just: OK' }],
      max_tokens: 10,
    });

    return new Response(JSON.stringify({
      status: 'success',
      message: 'Groq API key works!',
      response: completion.choices[0]?.message?.content,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Groq API call failed',
      details: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
