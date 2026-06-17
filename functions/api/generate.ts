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

    // Step 1: Generate application letter
    const appResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Write a professional job application letter with section markers.' },
        { role: 'user', content: `Write an application letter for ${data.personalInfo.fullName} applying for ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}. 

Company address: ${data.jobInfo.companyAddress || ''}
Candidate address: ${data.personalInfo.address}
Candidate email: ${data.personalInfo.email}
Candidate phone: ${data.personalInfo.phone}
Education: ${data.professionalInfo.highestEducation}
Experience: ${data.professionalInfo.yearsOfExperience} years as ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'Relevant professional skills'}
Job description: ${data.jobInfo.jobDescription}
Country: ${data.targetCountry}

Use these section markers:
<!-- SECTION_APPLICANT -->
<!-- SECTION_DATE -->
<!-- SECTION_EMPLOYER -->
<!-- SECTION_SUBJECT -->
<!-- SECTION_SALUTATION -->
<!-- SECTION_BODY -->
<!-- SECTION_CLOSING -->
<!-- SECTION_SIGNATURE -->` }
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const applicationLetter = appResult.choices[0]?.message?.content || '';

    // Step 2: Generate cover letter
    const coverResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Write a compelling cover letter with section markers.' },
        { role: 'user', content: `Write a cover letter for ${data.personalInfo.fullName} for ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}. 
Background: ${data.professionalInfo.highestEducation}, ${data.professionalInfo.yearsOfExperience} years experience.
Skills: ${data.professionalInfo.keySkills || 'Professional expertise'}.
Job: ${data.jobInfo.jobDescription.substring(0, 400)}.
Country: ${data.targetCountry}.

Use these markers:
<!-- SECTION_BODY -->
<!-- SECTION_CLOSING -->
<!-- SECTION_SIGNATURE -->` }
      ],
      temperature: 0.7,
      max_tokens: 1536,
    });

    const coverLetter = coverResult.choices[0]?.message?.content || '';

    // Step 3: ATS Analysis
    const atsResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Respond with ONLY valid JSON. No other text.' },
        { role: 'user', content: `Analyze this for ATS. Respond with JSON only:
Job: ${data.jobInfo.jobTitle}
Description: ${data.jobInfo.jobDescription.substring(0, 300)}
Letter: ${applicationLetter.substring(0, 1000)}

{
  "matchScore": 75,
  "matchingSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3"],
  "recommendations": ["tip1", "tip2", "tip3"],
  "cvImprovements": ["cv1", "cv2", "cv3"]
}` }
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    let atsAnalysis = {
      matchScore: 70,
      matchingSkills: [] as string[],
      missingSkills: [] as string[],
      recommendations: [] as string[],
      cvImprovements: [] as string[],
    };

    try {
      const atsText = atsResult.choices[0]?.message?.content || '{}';
      const clean = atsText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.matchScore) atsAnalysis = parsed;
    } catch (e) {
      // Use defaults
    }

    return new Response(JSON.stringify({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      applicationLetter,
      coverLetter,
      atsAnalysis,
      employerCountry: data.targetCountry,
      regionalStandard: 'East African Formal',
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'AI generation failed',
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
