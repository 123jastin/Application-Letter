import { PagesFunction } from '@cloudflare/workers-types';
import { Groq } from 'groq-sdk';

type Env = {
  DB: D1Database;
  GROQ_API_KEY: string;
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

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

function parseJsonSafe(text: string): any {
  try {
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── MAIN HANDLER ────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB, GROQ_API_KEY } = context.env;

  try {
    const data: any = await context.request.json();

    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500,
        headers: corsHeaders(),
      });
    }

    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const MODEL = 'llama-3.1-70b-versatile';
    const today = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // ─── 1. Application Letter ────────────────────────
    const appResult = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a professional HR consultant writing for JobsReport.online in ${data.targetCountry}. Follow formatting rules EXACTLY. Do not repeat the applicant name in the signature section. Use "Yours sincerely," only once as closing. Put addresses on separate lines.`,
        },
        {
          role: 'user',
          content: `Write a professional job application letter.

CANDIDATE:
Name: ${data.personalInfo.fullName}
Phone: ${data.personalInfo.phone}
Email: ${data.personalInfo.email}
Address: ${data.personalInfo.address}
Education: ${data.professionalInfo.highestEducation}
Experience: ${data.professionalInfo.yearsOfExperience} years
Current: ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'Match to job requirements'}

JOB:
Position: ${data.jobInfo.jobTitle}
Company: ${data.jobInfo.companyName}
Company Address: ${data.jobInfo.companyAddress || 'Dar es Salaam, Tanzania'}
Description: ${data.jobInfo.jobDescription}

COUNTRY: ${data.targetCountry}
LANGUAGE: ${data.targetLanguage || 'English'}

FORMAT EXACTLY LIKE THIS (each section separated by the marker):

<!-- SECTION_APPLICANT -->
${data.personalInfo.fullName}
${data.personalInfo.address}
${data.personalInfo.phone} | ${data.personalInfo.email}

<!-- SECTION_DATE -->
${today}

<!-- SECTION_EMPLOYER -->
${data.jobInfo.companyName}
${data.jobInfo.companyAddress || 'Dar es Salaam, Tanzania'}

<!-- SECTION_SUBJECT -->
REF: APPLICATION FOR ${data.jobInfo.jobTitle.toUpperCase()}

<!-- SECTION_SALUTATION -->
Dear Hiring Manager,

<!-- SECTION_BODY -->
[Write professional paragraphs: introduction, relevant experience matching the job description, specific skills and achievements, why this company, confident closing]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${data.personalInfo.fullName}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });
    const applicationLetter = appResult.choices[0]?.message?.content || '';

    // ─── 2. Cover Letter ──────────────────────────────
    const coverResult = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a career coach. Write engaging cover letters. Do not repeat the candidate name at the bottom.',
        },
        {
          role: 'user',
          content: `Write a compelling cover letter.

CANDIDATE: ${data.personalInfo.fullName}
Background: ${data.professionalInfo.highestEducation}, ${data.professionalInfo.yearsOfExperience} years as ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'Professional expertise'}

TARGET: ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}
Job Info: ${data.jobInfo.jobDescription.substring(0, 500)}

Country: ${data.targetCountry}

FORMAT:
<!-- SECTION_BODY -->
[Storytelling approach: why this role excites you, 2-3 specific achievements matching the job, genuine interest in the company, call to action]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${data.personalInfo.fullName}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1536,
    });
    const coverLetter = coverResult.choices[0]?.message?.content || '';

    // ─── 3. ATS Analysis ──────────────────────────────
    const atsResult = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Respond ONLY with valid JSON. No markdown, no code blocks, no extra text.',
        },
        {
          role: 'user',
          content: `ATS Analysis:

JOB: ${data.jobInfo.jobTitle}
Description: ${data.jobInfo.jobDescription.substring(0, 400)}

CANDIDATE SKILLS: ${data.professionalInfo.keySkills || 'General professional'}
EXPERIENCE: ${data.professionalInfo.yearsOfExperience} years

LETTER:
${applicationLetter.substring(0, 1500)}

JSON RESPONSE:
{
  "matchScore": number 0-100,
  "matchingSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill4"],
  "recommendations": ["tip1", "tip2", "tip3"],
  "cvImprovements": ["cv1", "cv2", "cv3"]
}`,
        },
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

    const atsText = atsResult.choices[0]?.message?.content || '{}';
    const parsed = parseJsonSafe(atsText);
    if (parsed && typeof parsed.matchScore === 'number') {
      atsAnalysis = parsed;
    }

    // ─── 4. Save to D1 (non-blocking) ─────────────────
    const keySkills = data.professionalInfo.keySkills
      ? data.professionalInfo.keySkills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    context.waitUntil(
      (async () => {
        try {
          const exists = await DB.prepare('SELECT id FROM candidates WHERE email = ?')
            .bind(data.personalInfo.email).first();
          if (exists) {
            await DB.prepare(
              `UPDATE candidates SET full_name=?, phone=?, address=?, highest_education=?, years_of_experience=?, current_position=?, key_skills=?, signature_text=?, signature_image=?, updated_at=datetime('now') WHERE email=?`
            ).bind(
              data.personalInfo.fullName, data.personalInfo.phone, data.personalInfo.address,
              data.professionalInfo.highestEducation, parseInt(data.professionalInfo.yearsOfExperience) || 0,
              data.professionalInfo.currentPosition, JSON.stringify(keySkills),
              data.personalInfo.signatureText || null, data.personalInfo.signatureImage || null,
              data.personalInfo.email
            ).run();
          } else {
            await DB.prepare(
              `INSERT INTO candidates (id,email,full_name,phone,address,highest_education,years_of_experience,current_position,key_skills,signature_text,signature_image) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
            ).bind(
              generateId(), data.personalInfo.email, data.personalInfo.fullName,
              data.personalInfo.phone, data.personalInfo.address,
              data.professionalInfo.highestEducation, parseInt(data.professionalInfo.yearsOfExperience) || 0,
              data.professionalInfo.currentPosition, JSON.stringify(keySkills),
              data.personalInfo.signatureText || null, data.personalInfo.signatureImage || null
            ).run();
          }
        } catch (e: any) {
          console.error('DB save error:', e.message);
        }
      })()
    );

    // ─── 5. Return ────────────────────────────────────
    return new Response(
      JSON.stringify({
        id: generateId(),
        createdAt: new Date().toISOString(),
        applicationLetter,
        coverLetter,
        atsAnalysis,
        employerCountry: data.targetCountry,
        regionalStandard: getRegionalStandard(data.targetCountry),
      }),
      {
        status: 200,
        headers: corsHeaders(),
      }
    );
  } catch (error: any) {
    console.error('Generation error:', error.message);
    return new Response(
      JSON.stringify({
        error: 'AI generation failed',
        details: error.message,
      }),
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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
