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
  let cleaned = address.trim();
  cleaned = cleaned.replace(/(P\.?[oO]\.?\s*Box\s*\d+)\s+([A-Z])/, '$1\n$2');
  const parts = cleaned.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
  return parts.join('\n');
}

function formatCompanyBlock(companyName: string, companyAddress: string): string {
  if (!companyAddress) return companyName;
  let address = companyAddress.trim();
  address = address.replace(/(P\.?[oO]\.?\s*Box\s*\d+)\s+([A-Z])/, '$1\n$2');
  const parts = address.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
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

    const applicantAddress = formatAddressLines(data.personalInfo.address);
    const companyBlock = formatCompanyBlock(
      data.jobInfo.companyName,
      data.jobInfo.companyAddress || ''
    );

    // ─── BUILD THE EXACT LETTER TEMPLATE ───────────────
    const letterTemplate = `<!-- SECTION_APPLICANT -->
${fullName}
${applicantAddress}
${data.personalInfo.phone} | ${data.personalInfo.email}

<!-- SECTION_DATE -->
${today}

<!-- SECTION_EMPLOYER -->
${companyBlock}

<!-- SECTION_SUBJECT -->
REF: APPLICATION FOR ${data.jobInfo.jobTitle.toUpperCase()}

<!-- SECTION_SALUTATION -->
Dear Hiring Manager,

<!-- SECTION_BODY -->
[WRITE BODY HERE]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`;

    // ─── Step 1: Generate Application Letter ───────────
    const appResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You fill in ONLY the <!-- SECTION_BODY --> of a job application letter template.

RULES:
1. Output the ENTIRE template with the body filled in
2. Do NOT add phone, email, or address in the signature section
3. Do NOT write the name after "Yours sincerely,"
4. Keep the body to 3 short paragraphs (200 words max)
5. Do NOT repeat the entire letter twice`
        },
        {
          role: 'user',
          content: `Fill in the SECTION_BODY of this letter template. Return the COMPLETE template with body filled.

APPLICANT INFO:
Name: ${fullName}
Education: ${data.professionalInfo.highestEducation}
Experience: ${data.professionalInfo.yearsOfExperience} years as ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'Professional skills'}

JOB INFO:
Title: ${data.jobInfo.jobTitle}
Company: ${data.jobInfo.companyName}
Description: ${data.jobInfo.jobDescription}

Country: ${data.targetCountry}

TEMPLATE TO FILL:
${letterTemplate}

Replace [WRITE BODY HERE] with 3 short paragraphs. Return the COMPLETE template.`
        }
      ],
      temperature: 0.7,
      max_tokens: 1536,
    });

    const applicationLetter = appResult.choices[0]?.message?.content || '';

    // ─── Step 2: Generate Cover Letter ─────────────────
    const coverTemplate = `<!-- SECTION_BODY -->
[WRITE COVER LETTER BODY HERE]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`;

    const coverResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `Fill in ONLY the body of a cover letter template. Return the COMPLETE template. Keep it short - 150 words max. Do NOT repeat the name in the closing.`
        },
        {
          role: 'user',
          content: `Fill in this cover letter template:

APPLICANT: ${fullName}
Background: ${data.professionalInfo.highestEducation}, ${data.professionalInfo.yearsOfExperience} years
Skills: ${data.professionalInfo.keySkills || 'Professional'}
Target: ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}
Job: ${data.jobInfo.jobDescription.substring(0, 300)}
Country: ${data.targetCountry}

TEMPLATE:
${coverTemplate}

Replace [WRITE COVER LETTER BODY HERE]. Return COMPLETE template.`
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
        { role: 'system', content: 'Return ONLY a JSON object. No other text.' },
        {
          role: 'user',
          content: `{"matchScore":75,"matchingSkills":["skill1"],"missingSkills":[],"recommendations":["tip1"],"cvImprovements":["cv1"]}

Analyze this and return similar JSON:
Job: ${data.jobInfo.jobTitle} - ${data.jobInfo.jobDescription.substring(0, 200)}
Candidate: ${data.professionalInfo.keySkills || 'Professional'} | ${data.professionalInfo.yearsOfExperience} years`
        }
      ],
      temperature: 0.3,
      max_tokens: 512,
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
      if (parsed && typeof parsed.matchScore === 'number') atsAnalysis = parsed;
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
