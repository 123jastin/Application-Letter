import { PagesFunction } from '@cloudflare/workers-types';
import { Groq } from 'groq-sdk';

type Env = {
  GROQ_API_KEY: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { GROQ_API_KEY } = context.env;

  try {
    const { url } = await context.request.json() as { url: string };

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Fetch the webpage content
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JobsReportBot/1.0)',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      html = await response.text();
    } catch (fetchErr: any) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch the URL',
        details: fetchErr.message 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Strip HTML tags and scripts, keep text content
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 6000);

    if (!textContent || textContent.length < 50) {
      return new Response(JSON.stringify({ 
        error: 'Could not extract meaningful content from this URL' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Use Groq to extract job details
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You extract job listing details from web page text. Respond ONLY with valid JSON. No markdown, no code blocks, no extra text.

Format:
{"jobTitle":"...", "companyName":"...", "companyAddress":"...", "jobDescription":"..."}

If you can't find a field, use empty string "".`
        },
        {
          role: 'user',
          content: `Extract the job listing details from this web page content:

${textContent}`
        }
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const resultText = completion.choices[0]?.message?.content || '{}';
    
    // Parse the JSON response
    let jobData;
    try {
      const cleanJson = resultText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();
      jobData = JSON.parse(cleanJson);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jobData = JSON.parse(jsonMatch[0]);
      } else {
        jobData = {};
      }
    }

    return new Response(JSON.stringify({
      jobTitle: jobData.jobTitle || '',
      companyName: jobData.companyName || '',
      companyAddress: jobData.companyAddress || '',
      jobDescription: jobData.jobDescription || textContent.substring(0, 500),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Failed to analyze job listing',
      details: error.message,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
