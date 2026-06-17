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
      return new Response(JSON.stringify({
        error: 'GROQ_API_KEY not configured',
      }), { status: 500, headers: corsHeaders() });
    }

    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const letterId = generateId();
    const MODEL = 'llama-3.1-70b-versatile';

    // ─── 1. Application Letter ────────────────────────
    const appPrompt = `Write a professional job application letter.

CANDIDATE: ${data.personalInfo.fullName}
Email: ${data.personalInfo.email} | Phone: ${data.personalInfo.phone}
Address: ${data.personalInfo.address}
Education: ${data.professionalInfo.highestEducation}
Experience: ${data.professionalInfo.yearsOfExperience} years as ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'General professional skills'}

JOB: ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}
Company Address: ${data.jobInfo.companyAddress || 'Not provided'}
Description: ${data.jobInfo.jobDescription}

TARGET COUNTRY: ${data.targetCountry}
LANGUAGE: ${data.targetLanguage || 'English'}

Format with these EXACT section markers:
<!-- SECTION_APPLICANT -->
[Full name and contact details]
<!-- SECTION_DATE -->
[Current date like ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}]
<!-- SECTION_EMPLOYER -->
[Employer name and address]
<!-- SECTION_SUBJECT -->
REF: APPLICATION FOR ${data.jobInfo.jobTitle.toUpperCase()}
<!-- SECTION_SALUTATION -->
[Appropriate greeting for ${data.targetCountry}]
<!-- SECTION_BODY -->
[3-4 paragraphs covering introduction, experience match, skills alignment, and closing]
<!-- SECTION_CLOSING -->
[Formal closing]
<!-- SECTION_SIGNATURE -->
${data.personalInfo.fullName}`;

    const appResult = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: `You are a professional HR consultant. Write application letters for ${data.targetCountry} job market. Use the EXACT section markers provided.` },
        { role: 'user', content: appPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });
    const applicationLetter = appResult.choices[0]?.message?.content || '';

    // ─── 2. Cover Letter ──────────────────────────────
    const coverPrompt = `Write a compelling cover letter.

CANDIDATE: ${data.personalInfo.fullName}
Background: ${data.professionalInfo.highestEducation}, ${data.professionalInfo.yearsOfExperience} years experience
Current: ${data.professionalInfo.currentPosition}
Skills: ${data.professionalInfo.keySkills || 'Professional expertise'}

TARGET: ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}
Job Description: ${data.jobInfo.jobDescription.substring(0, 500)}

Country: ${data.targetCountry} | Language: ${data.targetLanguage || 'English'}

Format with these markers:
<!-- SECTION_BODY -->
[Cover letter with storytelling approach, genuine interest, 2-3 key achievements]
<!-- SECTION_CLOSING -->
[Warm professional closing]
<!-- SECTION_SIGNATURE -->
${data.personalInfo.fullName}`;

    const coverResult = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a career coach. Write engaging cover letters.' },
        { role: 'user', content: coverPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1536,
    });
    const coverLetter = coverResult.choices[0]?.message?.content || '';

    // ─── 3. ATS Analysis ──────────────────────────────
    const atsPrompt = `Analyze this application letter for ATS compatibility.

JOB: ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}
Description: ${data.jobInfo.jobDescription.substring(0, 500)}

LETTER:
${applicationLetter.substring(0, 1500)}

Respond ONLY with valid JSON:
{
  "matchScore": number 0-100,
  "matchingSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3"],
  "recommendations": ["tip1", "tip2", "tip3"],
  "cvImprovements": ["cv1", "cv2", "cv3"]
}`;

    const atsResult = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Respond ONLY with valid JSON. No markdown, no text.' },
        { role: 'user', content: atsPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    let atsAnalysis = {
      matchScore: 70,
      matchingSkills: [],
      missingSkills: [],
      recommendations: [],
      cvImprovements: [],
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

    // Save candidate (upsert)
    try {
      const exists = await DB.prepare('SELECT id FROM candidates WHERE email = ?')
        .bind(data.personalInfo.email).first();
      
      if (exists) {
        await DB.prepare(`UPDATE candidates SET full_name=?, phone=?, address=?, highest_education=?, years_of_experience=?, current_position=?, key_skills=?, signature_text=?, signature_image=?, updated_at=datetime('now') WHERE email=?`)
          .bind(data.personalInfo.fullName, data.personalInfo.phone, data.personalInfo.address, data.professionalInfo.highestEducation, parseInt(data.professionalInfo.yearsOfExperience)||0, data.professionalInfo.currentPosition, JSON.stringify(keySkills), data.personalInfo.signatureText||null, data.personalInfo.signatureImage||null, data.personalInfo.email).run();
      } else {
        await DB.prepare(`INSERT INTO candidates (id,email,full_name,phone,address,highest_education,years_of_experience,current_position,key_skills,signature_text,signature_image) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(generateId(), data.personalInfo.email, data.personalInfo.fullName, data.personalInfo.phone, data.personalInfo.address, data.professionalInfo.highestEducation, parseInt(data.professionalInfo.yearsOfExperience)||0, data.professionalInfo.currentPosition, JSON.stringify(keySkills), data.personalInfo.signatureText||null, data.personalInfo.signatureImage||null).run();
      }
    } catch (e: any) { console.error('Save candidate:', e.message); }

    // Save letter
    try {
      await DB.prepare(`INSERT INTO letters (id,candidate_id,job_id,target_country,target_language,regional_standard,employer_country,application_letter_text,cover_letter_text) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(letterId, generateId(), generateId(), data.targetCountry, data.targetLanguage||'English', getRegionalStandard(data.targetCountry), data.targetCountry, applicationLetter, coverLetter).run();
    } catch (e: any) { console.error('Save letter:', e.message); }

    // ─── 5. Return ────────────────────────────────────
    return new Response(JSON.stringify({
      id: letterId,
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
    console.error('Generation error:', error.message);
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
