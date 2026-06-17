import { PagesFunction } from '@cloudflare/workers-types';
import { Groq } from 'groq-sdk';

type Env = {
  DB: D1Database;
  GROQ_API_KEY: string;
};

function getRegionalStandard(country: string): string {
  if (['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Zambia', 'Malawi'].includes(country)) {
    return 'East African Formal';
  }
  if (['United Kingdom', 'Australia'].includes(country)) {
    return 'UK Professional';
  }
  if (['United States', 'Canada'].includes(country)) {
    return 'North American ATS';
  }
  if (['United Arab Emirates'].includes(country)) {
    return 'Gulf Professional';
  }
  return 'European Corporate';
}

function formatAddressLines(address: string): string {
  if (!address) return '';
  
  // Split by comma OR "P.o.Box" pattern OR newlines
  let cleaned = address.trim();
  
  // If there's "P.o.Box" or "P.O.Box" followed by text, split it
  cleaned = cleaned.replace(/(P\.?[oO]\.?\s*Box\s*\d+)\s+([A-Z])/, '$1\n$2');
  
  // Split remaining by commas and newlines
  const parts = cleaned
    .split(/[,\n]/)
    .map((p: string) => p.trim())
    .filter(Boolean);
  
  return parts.join('\n');
}

function formatCompanyBlock(companyName: string, companyAddress: string): string {
  if (!companyAddress) return companyName;
  
  let address = companyAddress.trim();
  
  // Split P.o.Box from location
  address = address.replace(/(P\.?[oO]\.?\s*Box\s*\d+)\s+([A-Z])/, '$1\n$2');
  
  const parts = address
    .split(/[,\n]/)
    .map((p: string) => p.trim())
    .filter(Boolean);
  
  return [companyName, ...parts].join('\n');
}

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
    const fullName = data.personalInfo.fullName;
    const today = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const applicantBlock = [
      fullName,
      formatAddressLines(data.personalInfo.address),
      `${data.personalInfo.phone} | ${data.personalInfo.email}`
    ].filter(Boolean).join('\n');

    const companyBlock = formatCompanyBlock(
      data.jobInfo.companyName,
      data.jobInfo.companyAddress || ''
    );

    // ─── Step 1: Generate Application Letter ───────────
    const appResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a professional HR consultant writing job application letters.

CRITICAL FORMATTING RULES:
1. The <!-- SECTION_CLOSING --> must contain ONLY "Yours sincerely," — no name here
2. The <!-- SECTION_SIGNATURE --> must contain ONLY the applicant's full name — no phone, no email, no address
3. NEVER repeat the applicant name twice
4. Keep all addresses on SEPARATE lines exactly as provided
5. Keep the letter CONCISE — maximum 250-300 words total so it fits on one A4 page
6. Use SHORT paragraphs (3-4 sentences each)
7. No fluff or filler — every sentence must add value
8. The letter must be COMPACT — minimal spacing between sections

Example of CORRECT closing:
<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
Jastin Beda

WRONG (do not do):
<!-- SECTION_CLOSING -->
Yours sincerely, Jastin Beda

<!-- SECTION_SIGNATURE -->
Jastin Beda
Phone: +255...`
        },
        {
          role: 'user',
          content: `Write a COMPACT professional job application letter that fits on ONE PAGE.

APPLICANT:
${applicantBlock}

Education: ${data.professionalInfo.highestEducation}
Experience: ${data.professionalInfo.yearsOfExperience} years as ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'Relevant professional skills'}

JOB:
Position: ${data.jobInfo.jobTitle}
Company:
${companyBlock}

Description: ${data.jobInfo.jobDescription}

Country: ${data.targetCountry}
Date: ${today}

KEEP IT SHORT — 250 words maximum. Use EXACT markers:

<!-- SECTION_APPLICANT -->
${applicantBlock}

<!-- SECTION_DATE -->
${today}

<!-- SECTION_EMPLOYER -->
${companyBlock}

<!-- SECTION_SUBJECT -->
REF: APPLICATION FOR ${data.jobInfo.jobTitle.toUpperCase()}

<!-- SECTION_SALUTATION -->
Dear Hiring Manager,

<!-- SECTION_BODY -->
[3 short paragraphs: intro + 1 key qualification match + closing]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1536,
    });

    const applicationLetter = appResult.choices[0]?.message?.content || '';

    // ─── Step 2: Generate Cover Letter ─────────────────
    const coverResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `Write a COMPACT cover letter. 

RULES:
1. <!-- SECTION_CLOSING --> only "Yours sincerely," — no name
2. <!-- SECTION_SIGNATURE --> only applicant name
3. Keep it SHORT — 150-200 words max
4. Fit on one page`
        },
        {
          role: 'user',
          content: `Write a short cover letter.

APPLICANT: ${fullName}
Background: ${data.professionalInfo.highestEducation}, ${data.professionalInfo.yearsOfExperience} years
Skills: ${data.professionalInfo.keySkills || 'Professional'}
Target: ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}
Job: ${data.jobInfo.jobDescription.substring(0, 300)}
Country: ${data.targetCountry}

FORMAT:
<!-- SECTION_BODY -->
[Short cover: hook + 1 achievement + interest + call to action - 150 words max]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const coverLetter = coverResult.choices[0]?.message?.content || '';

    // ─── Step 3: ATS Analysis ──────────────────────────
    const atsResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Respond with ONLY valid JSON. No markdown, no code blocks, no extra text.'
        },
        {
          role: 'user',
          content: `ATS Analysis:

Job: ${data.jobInfo.jobTitle}
Description: ${data.jobInfo.jobDescription.substring(0, 400)}
Skills: ${data.professionalInfo.keySkills || 'General'}
Experience: ${data.professionalInfo.yearsOfExperience} years

Letter:
${applicationLetter.substring(0, 1500)}

Return ONLY:
{"matchScore":75,"matchingSkills":["skill1","skill2"],"missingSkills":["skill3"],"recommendations":["tip1","tip2","tip3"],"cvImprovements":["cv1","cv2","cv3"]}`
        }
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
      id: `letter-${Date.now()}`,
      createdAt: new Date().toISOString(),
      applicationLetter,
      coverLetter,
      atsAnalysis,
      employerCountry: data.targetCountry,
      regionalStandard: getRegionalStandard(data.targetCountry),
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
