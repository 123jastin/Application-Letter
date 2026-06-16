import { PagesFunction } from '@cloudflare/workers-types';
import { Groq } from 'groq-sdk';

type Env = {
  DB: D1Database;
  GROQ_API_KEY: string;
};

// ─── HELPERS ─────────────────────────────────────────

function generateId(): string {
  return `letter-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
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

// ─── GROQ PROMPT BUILDERS ────────────────────────────

function buildApplicationPrompt(data: any): string {
  return `You are an expert professional application letter writer for JobsReport.online, specializing in ${data.targetCountry} hiring standards.

Write a professional job application letter for the following candidate and position.

## CANDIDATE PROFILE
- Name: ${data.personalInfo.fullName}
- Email: ${data.personalInfo.email}
- Phone: ${data.personalInfo.phone}
- Address: ${data.personalInfo.address}
- Education: ${data.professionalInfo.highestEducation}
- Experience: ${data.professionalInfo.yearsOfExperience} years
- Current Position: ${data.professionalInfo.currentPosition}
- Key Skills: ${data.professionalInfo.keySkills || 'Match to job requirements'}

## TARGET JOB
- Job Title: ${data.jobInfo.jobTitle}
- Company: ${data.jobInfo.companyName}
- Company Address: ${data.jobInfo.companyAddress || 'Not provided'}
- Job Description: ${data.jobInfo.jobDescription}

## FORMAT REQUIREMENTS
- Target Country: ${data.targetCountry}
- Language: ${data.targetLanguage || 'English'}
- Use professional business letter format
- Match the tone to ${data.targetCountry} hiring standards
- Highlight relevant skills matching the job description
- Be specific — avoid generic phrases
- Keep concise but impactful (350-500 words)

## OUTPUT FORMAT
Wrap each section with HTML comments exactly as shown:
<!-- SECTION_APPLICANT -->
[Applicant's full name and contact details]
<!-- SECTION_DATE -->
[Current date]
<!-- SECTION_EMPLOYER -->
[Employer's name and address]
<!-- SECTION_SUBJECT -->
[Subject: REF: APPLICATION FOR ${data.jobInfo.jobTitle.toUpperCase()}]
<!-- SECTION_SALUTATION -->
[Appropriate salutation for ${data.targetCountry}]
<!-- SECTION_BODY -->
[Body paragraphs with experience, skills match, and closing statement]
<!-- SECTION_CLOSING -->
[Formal closing like "Sincerely,"]
<!-- SECTION_SIGNATURE -->
[Applicant's full name]`;
}

function buildCoverPrompt(data: any): string {
  return `You are an expert career coach for JobsReport.online. Write a compelling cover letter.

## CANDIDATE
- Name: ${data.personalInfo.fullName}
- Education: ${data.professionalInfo.highestEducation}
- Experience: ${data.professionalInfo.yearsOfExperience} years
- Current: ${data.professionalInfo.currentPosition}
- Skills: ${data.professionalInfo.keySkills || 'Match to job'}

## TARGET
- Job: ${data.jobInfo.jobTitle}
- Company: ${data.jobInfo.companyName}
- Description: ${data.jobInfo.jobDescription}

## REQUIREMENTS
- Country: ${data.targetCountry}
- Language: ${data.targetLanguage || 'English'}
- Tell a career story connecting background to this role
- Express genuine interest in the company
- Highlight 2-3 key achievements
- Keep warm but professional (250-400 words)

## OUTPUT FORMAT
<!-- SECTION_BODY -->
[Cover letter with storytelling approach]
<!-- SECTION_CLOSING -->
[Warm professional closing]
<!-- SECTION_SIGNATURE -->
[Applicant name]`;
}

function buildATSPrompt(data: any, applicationLetter: string): string {
  const skills = extractSkills(data.jobInfo.jobDescription);

  return `You are an ATS (Applicant Tracking System) expert. Analyze this application letter.

## JOB
Title: ${data.jobInfo.jobTitle}
Description: ${data.jobInfo.jobDescription}
Required Skills: ${skills.join(', ')}

## CANDIDATE
Skills: ${data.professionalInfo.keySkills || 'From letter'}
Experience: ${data.professionalInfo.yearsOfExperience} years

## LETTER
${applicationLetter}

## RESPOND WITH ONLY THIS JSON (no markdown, no extra text):
{
  "matchScore": number 0-100,
  "matchingSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3"],
  "recommendations": ["tip1", "tip2", "tip3"],
  "cvImprovements": ["improvement1", "improvement2", "improvement3"]
}`;
}

function extractSkills(description: string): string[] {
  const commonSkills = [
    'JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Project Management',
    'Leadership', 'Communication', 'Team Management', 'Data Analysis',
    'Customer Service', 'Sales', 'Marketing', 'Accounting', 'Teaching',
    'Research', 'Problem Solving', 'Critical Thinking', 'Microsoft Office',
    'Excel', 'Strategic Planning', 'Budget Management', 'Negotiation',
    'TypeScript', 'AWS', 'Docker', 'Git', 'Agile', 'Scrum',
  ];

  return commonSkills.filter(skill =>
    description.toLowerCase().includes(skill.toLowerCase())
  );
}

// ─── MAIN HANDLER ────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB, GROQ_API_KEY } = context.env;

  try {
    const data: any = await context.request.json();

    // Initialize Groq
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    const letterId = generateId();
    const candidateId = generateId();
    const jobId = generateId();

    // ─── 1. Generate Application Letter ───────────────
    const appCompletion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a professional HR consultant for JobsReport.online. Always wrap sections with the specified HTML comments.'
        },
        { role: 'user', content: buildApplicationPrompt(data) }
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });
    const applicationLetter = appCompletion.choices[0]?.message?.content || '';

    // ─── 2. Generate Cover Letter ─────────────────────
    const coverCompletion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a professional career coach for JobsReport.online.'
        },
        { role: 'user', content: buildCoverPrompt(data) }
      ],
      temperature: 0.7,
      max_tokens: 1536,
    });
    const coverLetter = coverCompletion.choices[0]?.message?.content || '';

    // ─── 3. ATS Analysis ──────────────────────────────
    const atsCompletion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an ATS expert. Respond ONLY with valid JSON. No markdown, no code blocks, no extra text.'
        },
        { role: 'user', content: buildATSPrompt(data, applicationLetter) }
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    let atsAnalysis;
    try {
      const atsText = atsCompletion.choices[0]?.message?.content || '{}';
      const cleanJson = atsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      atsAnalysis = JSON.parse(cleanJson);
    } catch {
      atsAnalysis = {
        matchScore: 70,
        matchingSkills: [],
        missingSkills: [],
        recommendations: ['Unable to parse ATS analysis'],
        cvImprovements: ['Review application manually'],
      };
    }

    // ─── 4. Save to D1 ────────────────────────────────
    const keySkills = data.professionalInfo.keySkills
      ? data.professionalInfo.keySkills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    // Upsert candidate
    await DB.prepare(`
      INSERT INTO candidates (id, email, full_name, phone, address, highest_education,
        years_of_experience, current_position, key_skills, signature_text, signature_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        full_name = excluded.full_name,
        phone = excluded.phone,
        address = excluded.address,
        highest_education = excluded.highest_education,
        years_of_experience = excluded.years_of_experience,
        current_position = excluded.current_position,
        key_skills = excluded.key_skills,
        signature_text = excluded.signature_text,
        signature_image = excluded.signature_image,
        updated_at = datetime('now')
    `).bind(
      candidateId,
      data.personalInfo.email,
      data.personalInfo.fullName,
      data.personalInfo.phone,
      data.personalInfo.address,
      data.professionalInfo.highestEducation,
      parseInt(data.professionalInfo.yearsOfExperience) || 0,
      data.professionalInfo.currentPosition,
      JSON.stringify(keySkills),
      data.personalInfo.signatureText || null,
      data.personalInfo.signatureImage || null
    ).run();

    // Save job snapshot
    await DB.prepare(`
      INSERT INTO jobs (id, title, description, company_name, location, country, apply_url, skills)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jobId,
      data.jobInfo.jobTitle,
      data.jobInfo.jobDescription,
      data.jobInfo.companyName,
      data.jobInfo.companyAddress || '',
      data.targetCountry,
      data.jobInfo.jobUrl || '',
      JSON.stringify(atsAnalysis.matchingSkills || [])
    ).run();

    // Save letter
    await DB.prepare(`
      INSERT INTO letters (id, candidate_id, job_id, target_country, target_language,
        regional_standard, employer_country, application_letter_text, cover_letter_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      letterId,
      candidateId,
      jobId,
      data.targetCountry,
      data.targetLanguage || 'English',
      getRegionalStandard(data.targetCountry),
      data.targetCountry,
      applicationLetter,
      coverLetter
    ).run();

    // Save ATS analysis
    await DB.prepare(`
      INSERT INTO ats_analyses (id, letter_id, match_score, matching_skills,
        missing_skills, recommendations, cv_improvements)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      letterId,
      atsAnalysis.matchScore || 0,
      JSON.stringify(atsAnalysis.matchingSkills || []),
      JSON.stringify(atsAnalysis.missingSkills || []),
      JSON.stringify(atsAnalysis.recommendations || []),
      JSON.stringify(atsAnalysis.cvImprovements || [])
    ).run();

    // ─── 5. Return Response ───────────────────────────
    return new Response(JSON.stringify({
      id: letterId,
      createdAt: new Date().toISOString(),
      request: {
        personalInfo: data.personalInfo,
        professionalInfo: data.professionalInfo,
        jobInfo: data.jobInfo,
        targetCountry: data.targetCountry,
      },
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
    console.error('Generation Error:', error);
    return new Response(JSON.stringify({
      error: 'AI generation failed',
      details: error.message || 'Unknown error',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

// OPTIONS - CORS
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};
