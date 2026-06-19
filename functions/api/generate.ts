import { PagesFunction } from '@cloudflare/workers-types';
import { Groq } from 'groq-sdk';

type Env = {
  DB: D1Database;
  GROQ_API_KEY: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { GROQ_API_KEY } = context.env;

  try {
    const data: any = await context.request.json();

    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const fullName = data.personalInfo?.fullName || 'Candidate';

    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Reply with only: OK' },
        { role: 'user', content: 'Test' }
      ],
      max_tokens: 10,
    });

    return new Response(JSON.stringify({
      success: true,
      response: result.choices[0]?.message?.content,
      applicationLetter: `<!-- SECTION_DATE -->\n19 June 2026\n\n<!-- SECTION_EMPLOYER -->\nTest Company\nTest Address\n\n<!-- SECTION_SUBJECT -->\nREF: APPLICATION FOR TEST\n\n<!-- SECTION_SALUTATION -->\nDear Hiring Manager,\n\n<!-- SECTION_BODY -->\nTest body content.\n\n<!-- SECTION_CLOSING -->\nYours sincerely,\n\n<!-- SECTION_SIGNATURE -->\n${fullName}`,
      coverLetter: '',
      atsAnalysis: { matchScore: 70, matchingSkills: [], missingSkills: [], recommendations: [], cvImprovements: [] },
      employerCountry: 'Tanzania',
      regionalStandard: 'East African Formal',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack?.substring(0, 500),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};
