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

function formatCompanyAddress(companyName: string, companyAddress: string): string {
  if (!companyAddress) return companyName;
  
  const addressParts = companyAddress
    .split(/[,\n]/)
    .map((part: string) => part.trim())
    .filter(Boolean);
  
  return [companyName, ...addressParts].join('\n');
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

    // Format addresses on separate lines
    const applicantAddressLines = data.personalInfo.address
      .split(/[,\n]/)
      .map((p: string) => p.trim())
      .filter(Boolean)
      .join('\n');

    const companyBlock = formatCompanyAddress(
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
1. The <!-- SECTION_CLOSING --> must contain ONLY "Yours sincerely," — do NOT add the applicant name here
2. The <!-- SECTION_SIGNATURE --> must contain ONLY the applicant's full name — no phone, no email, no address
3. NEVER repeat the applicant name twice
4. Keep all addresses EXACTLY as provided — each part on its own line
5. Keep the letter professional and clean

Example of CORRECT format:
<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
Jastin Beda

Example of WRONG format (DO NOT DO THIS):
<!-- SECTION_CLOSING -->
Yours sincerely, Jastin Beda

<!-- SECTION_SIGNATURE -->
Jastin Beda
Phone: +255...`
        },
        {
          role: 'user',
          content: `Write a professional job application letter.

APPLICANT DETAILS:
Full Name: ${fullName}
Phone: ${data.personalInfo.phone}
Email: ${data.personalInfo.email}
Address:
${applicantAddressLines}

Education: ${data.professionalInfo.highestEducation}
Experience: ${data.professionalInfo.yearsOfExperience} years
Current Position: ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'Relevant professional skills'}

JOB DETAILS:
Position: ${data.jobInfo.jobTitle}
Company Address (each part on its own line):
${companyBlock}

Job Description: ${data.jobInfo.jobDescription}

TARGET COUNTRY: ${data.targetCountry}
TODAY'S DATE: ${today}

FORMAT EXACTLY WITH THESE SECTION MARKERS:

<!-- SECTION_APPLICANT -->
${fullName}
${applicantAddressLines}
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
[Write 3-4 professional paragraphs: introduction, relevant experience matching the job, skills and achievements, why this company, confident closing]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const applicationLetter = appResult.choices[0]?.message?.content || '';

    // ─── Step 2: Generate Cover Letter ─────────────────
    const coverResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a career coach writing cover letters.

CRITICAL RULES:
1. <!-- SECTION_CLOSING --> must be ONLY "Yours sincerely," — no name here
2. <!-- SECTION_SIGNATURE --> must be ONLY the applicant's full name
3. NEVER repeat the name twice`
        },
        {
          role: 'user',
          content: `Write a compelling cover letter.

APPLICANT: ${fullName}
Background: ${data.professionalInfo.highestEducation}, ${data.professionalInfo.yearsOfExperience} years as ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'Professional expertise'}
Target: ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}
Job Description: ${data.jobInfo.jobDescription.substring(0, 500)}
Country: ${data.targetCountry}

FORMAT:

<!-- SECTION_BODY -->
[Engaging cover letter: opening hook, 2-3 achievements matching the role, interest in company, call to action]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1536,
    });

    const coverLetter = coverResult.choices[0]?.message?.content || '';

    // ─── Step 3: ATS Analysis ──────────────────────────
    const atsResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Respond with ONLY valid JSON inside curly braces. No markdown, no code blocks, no extra text.'
        },
        {
          role: 'user',
          content: `Analyze this application for ATS compatibility.

JOB TITLE: ${data.jobInfo.jobTitle}
JOB DESCRIPTION: ${data.jobInfo.jobDescription.substring(0, 400)}
CANDIDATE SKILLS: ${data.professionalInfo.keySkills || 'General professional'}
EXPERIENCE: ${data.professionalInfo.yearsOfExperience} years

APPLICATION LETTER:
${applicationLetter.substring(0, 1500)}

Return ONLY this JSON:
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

    // ─── Step 4: Return Response ──────────────────────
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
