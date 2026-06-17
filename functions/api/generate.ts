import { PagesFunction } from '@cloudflare/workers-types';
import { Groq } from 'groq-sdk';

type Env = {
  DB: D1Database;
  GROQ_API_KEY: string;
};

// ─── HELPERS ─────────────────────────────────────────

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
    // Remove markdown code blocks if present
    let cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();
    
    // Try to find JSON object if there's extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── PROMPT BUILDERS ─────────────────────────────────

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
- Use proper business letter format with date, addresses, subject line, salutation, body paragraphs, and closing
- Match the tone to ${data.targetCountry} professional standards
- Highlight relevant skills and experience that match the job description
- Be specific and avoid generic phrases
- Keep the letter concise but impactful (350-500 words)

## OUTPUT FORMAT
Wrap each section with HTML comments exactly as shown:

<!-- SECTION_APPLICANT -->
[Applicant's full name and contact details]
<!-- SECTION_DATE -->
[Current date]
<!-- SECTION_EMPLOYER -->
[Employer's name and address]
<!-- SECTION_SUBJECT -->
[Subject: REF: APPLICATION FOR POSITION OF ${data.jobInfo.jobTitle.toUpperCase()}]
<!-- SECTION_SALUTATION -->
[Appropriate salutation for ${data.targetCountry}]
<!-- SECTION_BODY -->
[Body paragraphs with professional experience, skills match, and closing statement]
<!-- SECTION_CLOSING -->
[Formal closing like "Sincerely," or "Yours faithfully,"]
<!-- SECTION_SIGNATURE -->
[Applicant's full name]`;
}

function buildCoverPrompt(data: any): string {
  return `You are an expert career coach for JobsReport.online. Write a compelling cover letter.

## CANDIDATE
- Name: ${data.personalInfo.fullName}
- Education: ${data.professionalInfo.highestEducation}
- Experience: ${data.professionalInfo.yearsOfExperience} years
- Current Position: ${data.professionalInfo.currentPosition}
- Key Skills: ${data.professionalInfo.keySkills || 'Match to job requirements'}

## TARGET JOB
- Job Title: ${data.jobInfo.jobTitle}
- Company: ${data.jobInfo.companyName}
- Description: ${data.jobInfo.jobDescription}

## REQUIREMENTS
- Country: ${data.targetCountry}
- Language: ${data.targetLanguage || 'English'}
- Tell a compelling career story connecting the candidate's background to this role
- Express genuine interest in the company and position
- Highlight 2-3 key achievements relevant to the role
- Keep it warm but professional (250-400 words)

## OUTPUT FORMAT
Wrap sections with HTML comments:

<!-- SECTION_BODY -->
[Cover letter content with storytelling approach]
<!-- SECTION_CLOSING -->
[Warm professional closing]
<!-- SECTION_SIGNATURE -->
[Applicant's name]`;
}

function buildATSPrompt(data: any, applicationLetter: string): string {
  const skills = extractSkills(data.jobInfo.jobDescription);

  return `You are an ATS (Applicant Tracking System) expert. Analyze this job application letter.

## JOB REQUIREMENTS
Title: ${data.jobInfo.jobTitle}
Description: ${data.jobInfo.jobDescription}
Required Skills Detected: ${skills.join(', ') || 'General professional skills'}

## CANDIDATE SKILLS
${data.professionalInfo.keySkills || 'To be extracted from the letter'}
Years of Experience: ${data.professionalInfo.yearsOfExperience}

## APPLICATION LETTER
${applicationLetter.substring(0, 3000)}

## RESPOND WITH ONLY VALID JSON (no markdown, no code blocks, no extra text):
{
  "matchScore": number between 0-100,
  "matchingSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill4", "skill5"],
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"],
  "cvImprovements": ["CV improvement 1", "CV improvement 2", "CV improvement 3"]
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
    'Java', 'C++', 'PHP', 'Ruby', 'HTML', 'CSS', 'REST API',
    'DevOps', 'Machine Learning', 'AI', 'Blockchain',
  ];

  return commonSkills.filter(skill =>
    description.toLowerCase().includes(skill.toLowerCase())
  );
}

// ─── DATABASE HELPERS ────────────────────────────────

async function saveCandidate(DB: D1Database, id: string, data: any, keySkills: string[]) {
  try {
    // Check if candidate exists
    const existing = await DB.prepare(
      'SELECT id FROM candidates WHERE email = ?'
    ).bind(data.personalInfo.email).first();

    if (existing) {
      // Update
      await DB.prepare(`
        UPDATE candidates SET
          full_name = ?, phone = ?, address = ?,
          highest_education = ?, years_of_experience = ?,
          current_position = ?, key_skills = ?,
          signature_text = ?, signature_image = ?,
          updated_at = datetime('now')
        WHERE email = ?
      `).bind(
        data.personalInfo.fullName,
        data.personalInfo.phone,
        data.personalInfo.address,
        data.professionalInfo.highestEducation,
        parseInt(data.professionalInfo.yearsOfExperience) || 0,
        data.professionalInfo.currentPosition,
        JSON.stringify(keySkills),
        data.personalInfo.signatureText || null,
        data.personalInfo.signatureImage || null,
        data.personalInfo.email
      ).run();
    } else {
      // Insert
      await DB.prepare(`
        INSERT INTO candidates (id, email, full_name, phone, address, highest_education,
          years_of_experience, current_position, key_skills, signature_text, signature_image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
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
    }
    return true;
  } catch (err) {
    console.error('Save candidate error:', err);
    return false;
  }
}

async function saveJobSnapshot(DB: D1Database, id: string, data: any, skills: string[]) {
  try {
    await DB.prepare(`
      INSERT INTO jobs (id, title, description, company_id, location, country, apply_url, skills, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      id,
      data.jobInfo.jobTitle,
      data.jobInfo.jobDescription,
      'snapshot', // Placeholder company_id for snapshots
      data.jobInfo.companyAddress || '',
      data.targetCountry,
      data.jobInfo.jobUrl || '',
      JSON.stringify(skills)
    ).run();
    return true;
  } catch (err) {
    console.error('Save job error:', err);
    return false;
  }
}

async function saveLetter(DB: D1Database, id: string, candidateId: string, jobId: string, data: any, applicationLetter: string, coverLetter: string) {
  try {
    await DB.prepare(`
      INSERT INTO letters (id, candidate_id, job_id, target_country, target_language,
        regional_standard, employer_country, application_letter_text, cover_letter_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      candidateId,
      jobId,
      data.targetCountry,
      data.targetLanguage || 'English',
      getRegionalStandard(data.targetCountry),
      data.targetCountry,
      applicationLetter,
      coverLetter
    ).run();
    return true;
  } catch (err) {
    console.error('Save letter error:', err);
    return false;
  }
}

async function saveATSAnalysis(DB: D1Database, letterId: string, atsAnalysis: any) {
  try {
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
    return true;
  } catch (err) {
    console.error('Save ATS error:', err);
    return false;
  }
}

// ─── MAIN HANDLER ────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB, GROQ_API_KEY } = context.env;
  
  // Track timing for debugging
  const startTime = Date.now();

  try {
    const data: any = await context.request.json();
    
    // Validate required fields early
    if (!data.personalInfo?.email || !data.jobInfo?.jobTitle) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        details: 'Email and Job Title are required',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Check API key
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        details: 'GROQ_API_KEY is not set in environment variables',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const letterId = generateId();
    const candidateId = generateId();
    const jobId = generateId();
    
    const errors: string[] = [];
    let applicationLetter = '';
    let coverLetter = '';
    let atsAnalysis = {
      matchScore: 50,
      matchingSkills: [] as string[],
      missingSkills: [] as string[],
      recommendations: [] as string[],
      cvImprovements: [] as string[],
    };

    // ─── 1. Generate Application Letter ───────────────
    try {
      console.log('Generating application letter...');
      const appCompletion = await groq.chat.completions.create({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a professional HR consultant for JobsReport.online. Always wrap sections with the specified HTML comments exactly as requested.'
          },
          { role: 'user', content: buildApplicationPrompt(data) }
        ],
        temperature: 0.7,
        max_tokens: 2048,
      });
      applicationLetter = appCompletion.choices[0]?.message?.content || '';
      console.log('Application letter generated:', applicationLetter.length, 'chars');
    } catch (err: any) {
      errors.push(`Application letter: ${err.message}`);
      console.error('App letter error:', err);
    }

    // ─── 2. Generate Cover Letter ─────────────────────
    try {
      console.log('Generating cover letter...');
      const coverCompletion = await groq.chat.completions.create({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a professional career coach for JobsReport.online. Write compelling cover letters.'
          },
          { role: 'user', content: buildCoverPrompt(data) }
        ],
        temperature: 0.7,
        max_tokens: 1536,
      });
      coverLetter = coverCompletion.choices[0]?.message?.content || '';
      console.log('Cover letter generated:', coverLetter.length, 'chars');
    } catch (err: any) {
      errors.push(`Cover letter: ${err.message}`);
      console.error('Cover letter error:', err);
    }

    // ─── 3. ATS Analysis ──────────────────────────────
    try {
      console.log('Running ATS analysis...');
      const atsCompletion = await groq.chat.completions.create({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an ATS analysis expert. Respond ONLY with valid JSON. No markdown, no code blocks, no explanations.'
          },
          { role: 'user', content: buildATSPrompt(data, applicationLetter) }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const atsText = atsCompletion.choices[0]?.message?.content || '{}';
      const parsed = parseJsonSafe(atsText);
      
      if (parsed && typeof parsed.matchScore === 'number') {
        atsAnalysis = {
          matchScore: parsed.matchScore,
          matchingSkills: parsed.matchingSkills || [],
          missingSkills: parsed.missingSkills || [],
          recommendations: parsed.recommendations || [],
          cvImprovements: parsed.cvImprovements || [],
        };
        console.log('ATS analysis complete. Score:', atsAnalysis.matchScore);
      } else {
        errors.push('ATS analysis: Invalid JSON response');
        console.error('ATS parse failed. Raw:', atsText.substring(0, 200));
      }
    } catch (err: any) {
      errors.push(`ATS analysis: ${err.message}`);
      console.error('ATS error:', err);
    }

    // ─── 4. Save to D1 (non-blocking, errors logged) ──
    const keySkills = data.professionalInfo.keySkills
      ? data.professionalInfo.keySkills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    // Run saves in parallel
    const saveResults = await Promise.allSettled([
      saveCandidate(DB, candidateId, data, keySkills),
      saveJobSnapshot(DB, jobId, data, atsAnalysis.matchingSkills),
      saveLetter(DB, letterId, candidateId, jobId, data, applicationLetter, coverLetter),
    ]);

    // Save ATS after letter exists
    if (saveResults[2].status === 'fulfilled' && saveResults[2].value) {
      await saveATSAnalysis(DB, letterId, atsAnalysis).catch(err => {
        console.error('ATS save failed:', err);
      });
    }

    // ─── 5. Check if we have anything useful ──────────
    if (!applicationLetter && !coverLetter) {
      return new Response(JSON.stringify({
        error: 'AI generation completely failed',
        details: errors.join('; ') || 'Unknown error',
        errors,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // ─── 6. Return Response ───────────────────────────
    const elapsed = Date.now() - startTime;
    console.log(`Generation complete in ${elapsed}ms`);

    return new Response(JSON.stringify({
      id: letterId,
      createdAt: new Date().toISOString(),
      request: {
        personalInfo: data.personalInfo,
        professionalInfo: data.professionalInfo,
        jobInfo: data.jobInfo,
        targetCountry: data.targetCountry,
      },
      applicationLetter: applicationLetter || 'Application letter generation failed. Please try again.',
      coverLetter: coverLetter || 'Cover letter generation failed. Please try again.',
      atsAnalysis,
      employerCountry: data.targetCountry,
      regionalStandard: getRegionalStandard(data.targetCountry),
      warnings: errors.length > 0 ? errors : undefined,
      generationTimeMs: elapsed,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`Fatal generation error after ${elapsed}ms:`, error);
    
    return new Response(JSON.stringify({
      error: 'AI generation failed',
      details: error.message || 'Unknown error',
      stack: error.stack?.substring(0, 500) || '',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

// OPTIONS - CORS preflight
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
