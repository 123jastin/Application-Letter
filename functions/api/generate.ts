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
    const fullName = data.personalInfo?.fullName || 'Candidate';
    const today = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const isSwahili = data.targetLanguage === 'Swahili';
    const MODEL = isSwahili ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

    const applicantAddress = formatAddressLines(data.personalInfo?.address || '');
    const companyName = data.jobInfo?.companyName || '';
    const companyAddress = data.jobInfo?.companyAddress || '';
    const employerBlock = formatCompanyBlock(companyName, companyAddress);
    const jobTitle = data.jobInfo?.jobTitle || '';
    const jobDescription = data.jobInfo?.jobDescription || '';
    const education = data.professionalInfo?.highestEducation || '';
    const experience = data.professionalInfo?.yearsOfExperience || '0';
    const skills = data.professionalInfo?.keySkills || '';

    // ─── BUILD THE EXACT LETTER TEMPLATE ───────────────
    const letterTemplate = isSwahili
      ? `<!-- SECTION_APPLICANT -->
${fullName}
${applicantAddress}
${data.personalInfo?.phone || ''} | ${data.personalInfo?.email || ''}

<!-- SECTION_DATE -->
${today}

<!-- SECTION_EMPLOYER -->
${employerBlock}

<!-- SECTION_SUBJECT -->
YAH: MAOMBI YA NAFASI YA ${jobTitle.toUpperCase()}

<!-- SECTION_BODY -->
[ANDIKA MWILI WA BARUA HAPA]

<!-- SECTION_CLOSING -->
Wako mwaminifu,

<!-- SECTION_SIGNATURE -->
${fullName}`
      : `<!-- SECTION_APPLICANT -->
${fullName}
${applicantAddress}
${data.personalInfo?.phone || ''} | ${data.personalInfo?.email || ''}

<!-- SECTION_DATE -->
${today}

<!-- SECTION_EMPLOYER -->
${employerBlock}

<!-- SECTION_SUBJECT -->
REF: APPLICATION FOR ${jobTitle.toUpperCase()}

<!-- SECTION_SALUTATION -->
Dear Hiring Manager,

<!-- SECTION_BODY -->
[WRITE BODY HERE]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`;

    // ─── Step 1: Generate Application Letter ───────────
    const appSystemPrompt = isSwahili
      ? `Wewe ni mtaalamu wa kuandika barua za maombi ya kazi Tanzania. Jaza MWILI tu wa template. Rudisha template YOTE.

SHERIA:
1. Anza kwa "Tafadhali rejea somo tajwa la barua hapo juu"
2. Andika aya 4-5 kwa Kiswahili sanifu
3. USITUMIE: shauku, furahi, hamasa, Ninafurahishwa, ninajua kwamba
4. USIRUDIE: kufanya kazi (max mara 2), kufikia malengo (max mara 1)
5. TUMIA: Ninafuraha, Nina uwezo, Kupitia uzoefu, Nitaweza kuchangia, nimeambatanisha vivuli vya vyeti
6. Malizia kwa sentensi moja tu ya matarajio
7. USIVUMBUE: umri, elimu, chuo, mwaka isipokuwa vimetajwa
8. Usirudie template mara mbili`
      : `You fill in ONLY the <!-- SECTION_BODY --> of a job application letter template.

RULES:
1. Output the ENTIRE template with the body filled in
2. Do NOT add phone, email, or address in the signature section
3. Do NOT write the name after the closing
4. Keep the body to 3 short paragraphs (200 words max)
5. Do NOT repeat the entire letter twice`;

    const appUserPrompt = isSwahili
      ? `Jaza MWILI wa template hii kwa Kiswahili sanifu. Rudisha template YOTE.

MWOMBAJI: ${fullName} | ${education || 'Haijatajwa'} | Miaka ${experience} | ${skills || 'Haijatajwa'}
KAZI: ${jobTitle} katika ${companyName} | ${jobDescription}
NCHI: ${data.targetCountry}

TEMPLATE:
${letterTemplate}

Badilisha [ANDIKA MWILI WA BARUA HAPA] na aya 4-5. Rudisha YOTE mara MOJA.`
      : `Fill in the SECTION_BODY of this letter template. Return the COMPLETE template.

APPLICANT: ${fullName} | ${education} | ${experience} years | ${skills}
JOB: ${jobTitle} at ${companyName} | ${jobDescription}
COUNTRY: ${data.targetCountry}

TEMPLATE:
${letterTemplate}

Replace [WRITE BODY HERE] with 3 short paragraphs. Return COMPLETE template.`;

    const appResult = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: appSystemPrompt },
        { role: 'user', content: appUserPrompt }
      ],
      temperature: isSwahili ? 0.3 : 0.7,
      max_tokens: isSwahili ? 2048 : 1536,
    });

    let applicationLetter = appResult.choices[0]?.message?.content || '';

    // Remove duplicate
    const marker = '<!-- SECTION_APPLICANT -->';
    const first = applicationLetter.indexOf(marker);
    const second = applicationLetter.indexOf(marker, first + 1);
    if (second !== -1) {
      applicationLetter = applicationLetter.substring(0, second).trim();
    }

    // ─── Step 2: Generate Cover Letter ─────────────────
    const coverTemplate = isSwahili
      ? `<!-- SECTION_BODY -->
[ANDIKA MWILI WA BARUA YA KUAMBATANA HAPA]

<!-- SECTION_CLOSING -->
Wako mwaminifu,

<!-- SECTION_SIGNATURE -->
${fullName}`
      : `<!-- SECTION_BODY -->
[WRITE COVER LETTER BODY HERE]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`;

    const coverSystemPrompt = isSwahili
      ? `Andika barua ya kuambatana kwa Kiswahili. Aya 2-3. USIVUMBUE data. USITUMIE: shauku, furahi, hamasa, Ninafurahishwa, ninajua kwamba.`
      : `Fill in ONLY the body of a cover letter template. Return the COMPLETE template. Keep it short - 150 words max. Do NOT repeat the name in the closing.`;

    const coverUserPrompt = isSwahili
      ? `Andika barua ya kuambatana kwa Kiswahili.

MWOMBAJI: ${fullName} | ${education || 'Haijatajwa'} | Miaka ${experience} | ${skills || 'Haijatajwa'}
KAZI: ${jobTitle} katika ${companyName} | ${jobDescription.substring(0, 300)}
NCHI: ${data.targetCountry}

TEMPLATE:
${coverTemplate}

Badilisha [ANDIKA MWILI WA BARUA YA KUAMBATANA HAPA] na aya 2-3. Rudisha YOTE.`
      : `Fill in this cover letter template:

APPLICANT: ${fullName} | ${education} | ${experience} years | ${skills}
TARGET: ${jobTitle} at ${companyName} | ${jobDescription.substring(0, 300)}
COUNTRY: ${data.targetCountry}

TEMPLATE:
${coverTemplate}

Replace [WRITE COVER LETTER BODY HERE]. Return COMPLETE template.`;

    const coverResult = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: coverSystemPrompt },
        { role: 'user', content: coverUserPrompt }
      ],
      temperature: isSwahili ? 0.3 : 0.7,
      max_tokens: isSwahili ? 1536 : 1024,
    });

    let coverLetter = coverResult.choices[0]?.message?.content || '';

    const coverMarker = '<!-- SECTION_BODY -->';
    const coverFirst = coverLetter.indexOf(coverMarker);
    const coverSecond = coverLetter.indexOf(coverMarker, coverFirst + 1);
    if (coverSecond !== -1) {
      coverLetter = coverLetter.substring(0, coverSecond).trim();
    }

    // ─── Step 3: ATS Analysis ──────────────────────────
    const atsResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Return ONLY a JSON object. No other text.' },
        {
          role: 'user',
          content: `{"matchScore":75,"matchingSkills":["skill1"],"missingSkills":[],"recommendations":["tip1"],"cvImprovements":["cv1"]}

Analyze: ${jobTitle} | ${skills} | ${experience} years`
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
    } catch (e) {}

    return new Response(JSON.stringify({
      id: `letter-${Date.now()}`,
      createdAt: new Date().toISOString(),
      applicationLetter,
      coverLetter,
      atsAnalysis,
      employerCountry: data.targetCountry || 'Tanzania',
      regionalStandard: getRegionalStandard(data.targetCountry || 'Tanzania'),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
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
