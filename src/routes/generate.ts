import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { groq, GROQ_MODEL } from '../config/groq';
import { generateId } from '../utils/uuid';

export const generateRoutes = Router();

// ─── GROQ PROMPT TEMPLATES ─────────────────────────────────

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
- Key Skills: ${data.professionalInfo.keySkills || 'To be extracted from job match'}

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
Wrap each section with HTML comments for parsing:
<!-- SECTION_APPLICANT -->
[Applicant's full name and contact details]
<!-- SECTION_DATE -->
[Current date]
<!-- SECTION_EMPLOYER -->
[Employer's name and address]
<!-- SECTION_SUBJECT -->
[Subject line: REF: APPLICATION FOR POSITION OF ${data.jobInfo.jobTitle.toUpperCase()}]
<!-- SECTION_SALUTATION -->
[Appropriate salutation for ${data.targetCountry}]
<!-- SECTION_BODY -->
[Body paragraphs with professional experience, skills match, and closing statement]
<!-- SECTION_CLOSING -->
[Formal closing]
<!-- SECTION_SIGNATURE -->
[Applicant's full name]`;
}

function buildCoverPrompt(data: any): string {
  return `You are an expert career coach for JobsReport.online. Write a compelling cover letter that complements the application letter.

## CANDIDATE PROFILE
- Name: ${data.personalInfo.fullName}
- Education: ${data.professionalInfo.highestEducation}
- Experience: ${data.professionalInfo.yearsOfExperience} years
- Current Position: ${data.professionalInfo.currentPosition}
- Key Skills: ${data.professionalInfo.keySkills || 'Match to job requirements'}

## TARGET JOB
- Job Title: ${data.jobInfo.jobTitle}
- Company: ${data.jobInfo.companyName}
- Job Description: ${data.jobInfo.jobDescription}

## REQUIREMENTS
- Target Country: ${data.targetCountry}
- Language: ${data.targetLanguage || 'English'}
- Tell a compelling career story connecting the candidate's background to this role
- Express genuine interest in the company and position
- Highlight 2-3 key achievements relevant to the role
- Keep it warm but professional (250-400 words)

## OUTPUT FORMAT
<!-- SECTION_BODY -->
[Cover letter content with storytelling approach]
<!-- SECTION_CLOSING -->
[Warm professional closing]
<!-- SECTION_SIGNATURE -->
[Applicant's name]`;
}

function buildATSPrompt(data: any, applicationLetter: string): string {
  const requiredSkills = extractSkillsFromDescription(data.jobInfo.jobDescription);
  
  return `You are an ATS (Applicant Tracking System) expert. Analyze the following job application letter against the job requirements.

## JOB REQUIREMENTS
Title: ${data.jobInfo.jobTitle}
Description: ${data.jobInfo.jobDescription}
Required Skills Detected: ${requiredSkills.join(', ')}

## CANDIDATE SKILLS
${data.professionalInfo.keySkills || 'To be extracted from letter'}
Years of Experience: ${data.professionalInfo.yearsOfExperience}

## APPLICATION LETTER
${applicationLetter}

## ANALYSIS REQUIRED
Provide a JSON response with:
1. matchScore: Number 0-100 indicating how well the candidate matches
2. matchingSkills: Array of skills from the job that the candidate demonstrates
3. missingSkills: Array of skills from the job that the candidate lacks
4. recommendations: Array of 3-5 specific suggestions to improve the application
5. cvImprovements: Array of 3-5 suggestions to strengthen the CV for this role

Respond ONLY with valid JSON, no other text.`;
}

function extractSkillsFromDescription(description: string): string[] {
  const commonSkills = [
    'JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Project Management',
    'Leadership', 'Communication', 'Team Management', 'Data Analysis',
    'Customer Service', 'Sales', 'Marketing', 'Accounting', 'Teaching',
    'Research', 'Problem Solving', 'Critical Thinking', 'Microsoft Office',
    'Excel', 'Strategic Planning', 'Budget Management', 'Negotiation',
  ];
  
  return commonSkills.filter(skill => 
    description.toLowerCase().includes(skill.toLowerCase())
  );
}

// ─── MAIN GENERATION ENDPOINT ─────────────────────────────

generateRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const candidateId = generateId();
    const jobId = generateId();
    const letterId = generateId();

    // Step 1: Generate Application Letter
    console.log('🔄 Generating application letter...');
    const appCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a professional HR consultant and application letter writer for JobsReport.online. Always wrap sections with the specified HTML comments.' },
        { role: 'user', content: buildApplicationPrompt(data) }
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });
    const applicationLetter = appCompletion.choices[0]?.message?.content || '';

    // Step 2: Generate Cover Letter
    console.log('🔄 Generating cover letter...');
    const coverCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a professional career coach for JobsReport.online. Write compelling cover letters that complement application letters.' },
        { role: 'user', content: buildCoverPrompt(data) }
      ],
      temperature: 0.7,
      max_tokens: 1536,
    });
    const coverLetter = coverCompletion.choices[0]?.message?.content || '';

    // Step 3: ATS Analysis
    console.log('🔄 Running ATS analysis...');
    const atsCompletion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are an ATS analysis expert. Respond ONLY with valid JSON, no markdown or other text.' },
        { role: 'user', content: buildATSPrompt(data, applicationLetter) }
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });
    
    let atsAnalysis;
    try {
      const atsText = atsCompletion.choices[0]?.message?.content || '{}';
      // Clean any markdown code block wrappers
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

    // Step 4: Save everything to database
    console.log('💾 Saving to database...');

    // Save candidate
    db.prepare(`
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
    `).run(
      candidateId,
      data.personalInfo.email,
      data.personalInfo.fullName,
      data.personalInfo.phone,
      data.personalInfo.address,
      data.professionalInfo.highestEducation,
      parseInt(data.professionalInfo.yearsOfExperience) || 0,
      data.professionalInfo.currentPosition,
      JSON.stringify(data.professionalInfo.keySkills?.split(',').map((s: string) => s.trim()).filter(Boolean) || []),
      data.personalInfo.signatureText || null,
      data.personalInfo.signatureImage || null
    );

    // Save job
    db.prepare(`
      INSERT INTO jobs (id, title, description, company_name, location, country, apply_url, skills)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      data.jobInfo.jobTitle,
      data.jobInfo.jobDescription,
      data.jobInfo.companyName,
      data.jobInfo.companyAddress || '',
      data.targetCountry,
      data.jobInfo.jobUrl || '',
      JSON.stringify(atsAnalysis.matchingSkills || [])
    );

    // Save letter
    db.prepare(`
      INSERT INTO letters (id, candidate_id, job_id, target_country, target_language,
        regional_standard, employer_country, application_letter_text, cover_letter_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      letterId,
      candidateId,
      jobId,
      data.targetCountry,
      data.targetLanguage || 'English',
      getRegionalStandard(data.targetCountry),
      data.targetCountry,
      applicationLetter,
      coverLetter
    );

    // Save ATS analysis
    db.prepare(`
      INSERT INTO ats_analyses (id, letter_id, match_score, matching_skills, 
        missing_skills, recommendations, cv_improvements)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      letterId,
      atsAnalysis.matchScore || 0,
      JSON.stringify(atsAnalysis.matchingSkills || []),
      JSON.stringify(atsAnalysis.missingSkills || []),
      JSON.stringify(atsAnalysis.recommendations || []),
      JSON.stringify(atsAnalysis.cvImprovements || [])
    );

    // Step 5: Return response
    res.json({
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
    });

    console.log('✅ Letter generation complete!');
  } catch (error: any) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

// Helper: Regional standard mapping
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
