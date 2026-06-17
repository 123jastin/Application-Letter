
import { PagesFunction } from '@cloudflare/workers-types';
import { Groq } from 'groq-sdk';

type Env = {
  DB: D1Database;
  GROQ_API_KEY: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { GROQ_API_KEY } = context.env;

  const debugLog: string[] = [];

  try {
    // Step 0: Parse request
    debugLog.push('0. Parsing request body...');
    const data: any = await context.request.json();
    debugLog.push(`0. Done. Has email: ${!!data.personalInfo?.email}, has jobTitle: ${!!data.jobInfo?.jobTitle}`);

    // Step 1: Check API key
    debugLog.push('1. Checking GROQ_API_KEY...');
    if (!GROQ_API_KEY) {
      return respond({ error: 'GROQ_API_KEY not set', debug: debugLog }, 500);
    }
    debugLog.push(`1. Key exists, starts with: ${GROQ_API_KEY.substring(0, 8)}...`);

    // Step 2: Initialize Groq
    debugLog.push('2. Initializing Groq SDK...');
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    debugLog.push('2. SDK initialized');

    // Step 3: Simple test call
    debugLog.push('3. Making test Groq call...');
    const testResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Reply with only the word: WORKING' },
        { role: 'user', content: 'Test connection' }
      ],
      max_tokens: 20,
    });
    debugLog.push(`3. Test response: "${testResult.choices[0]?.message?.content}"`);

    // Step 4: Generate application letter
    debugLog.push('4. Generating application letter...');
    const appResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a professional HR consultant. Write a job application letter with the EXACT section markers provided.' },
        { 
          role: 'user', 
          content: `Write a short application letter for ${data.personalInfo?.fullName || 'Candidate'} applying for ${data.jobInfo?.jobTitle || 'a position'} at ${data.jobInfo?.companyName || 'a company'}.

Include these markers:
<!-- SECTION_APPLICANT -->
<!-- SECTION_DATE -->
<!-- SECTION_EMPLOYER -->
<!-- SECTION_SUBJECT -->
<!-- SECTION_SALUTATION -->
<!-- SECTION_BODY -->
<!-- SECTION_CLOSING -->
<!-- SECTION_SIGNATURE -->`
        }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });
    const appLetter = appResult.choices[0]?.message?.content || '';
    debugLog.push(`4. App letter generated: ${appLetter.length} characters`);

    // Step 5: Return success
    debugLog.push('5. All done!');
    return respond({
      success: true,
      applicationLetter: appLetter,
      coverLetter: 'Cover letter placeholder - generation successful',
      atsAnalysis: {
        matchScore: 80,
        matchingSkills: ['Test Skill'],
        missingSkills: [],
        recommendations: ['Test recommendation'],
        cvImprovements: ['Test improvement'],
      },
      debug: debugLog,
    });

  } catch (error: any) {
    debugLog.push(`ERROR: ${error.message}`);
    debugLog.push(`Stack: ${error.stack?.substring(0, 300)}`);
    debugLog.push(`Type: ${error.constructor?.name}`);
    
    return respond({
      error: 'AI generation failed',
      details: error.message,
      type: error.constructor?.name,
      debug: debugLog,
    }, 500);
  }
};

function respond(body: any, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

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
