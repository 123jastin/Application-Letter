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

    const companyName = data.jobInfo?.companyName || '';
    const companyAddress = data.jobInfo?.companyAddress || '';
    const jobTitle = data.jobInfo?.jobTitle || '';
    const jobDescription = data.jobInfo?.jobDescription || '';
    const education = data.professionalInfo?.highestEducation || '';
    const experience = data.professionalInfo?.yearsOfExperience || '0';
    const skills = data.professionalInfo?.keySkills || '';

    // ─── English Template ──────────────────────────────
    if (!isSwahili) {
      const prompt = `Write a job application letter. Fill in the body only.

APPLICANT: ${fullName} | ${education} | ${experience} years | ${skills}
JOB: ${jobTitle} at ${companyName} | ${jobDescription}
COUNTRY: ${data.targetCountry}
DATE: ${today}

TEMPLATE:
<!-- SECTION_DATE -->
${today}

<!-- SECTION_EMPLOYER -->
${companyName}
${companyAddress}

<!-- SECTION_SUBJECT -->
REF: APPLICATION FOR ${jobTitle.toUpperCase()}

<!-- SECTION_SALUTATION -->
Dear Hiring Manager,

<!-- SECTION_BODY -->
[Write 3 short paragraphs here]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}

RULES: Fill body only. Return complete template. No name in closing. No phone/email in signature.`;

      const result = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a professional HR consultant. Fill in only the body section of a letter template.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1536,
      });

      const applicationLetter = result.choices[0]?.message?.content || '';

      return new Response(JSON.stringify({
        id: `letter-${Date.now()}`,
        createdAt: new Date().toISOString(),
        applicationLetter,
        coverLetter: '',
        atsAnalysis: { matchScore: 70, matchingSkills: [], missingSkills: [], recommendations: [], cvImprovements: [] },
        employerCountry: data.targetCountry || 'Tanzania',
        regionalStandard: getRegionalStandard(data.targetCountry || 'Tanzania'),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // ─── Swahili Template ──────────────────────────────
    const swahiliPrompt = `Andika barua ya maombi ya kazi kwa Kiswahili sanifu cha Tanzania.

MWOMBAJI: ${fullName} | ${education || 'Haijatajwa'} | Miaka ${experience} | ${skills || 'Haijatajwa'}
KAZI: ${jobTitle} katika ${companyName} | ${jobDescription}
NCHI: ${data.targetCountry}
TAREHE: ${today}

TEMPLATE:
<!-- SECTION_DATE -->
${today}

<!-- SECTION_EMPLOYER -->
${companyName}
${companyAddress}

<!-- SECTION_SUBJECT -->
YAH: MAOMBI YA NAFASI YA ${jobTitle.toUpperCase()}

<!-- SECTION_BODY -->
[Andika mwili wa barua hapa kwa Kiswahili]

<!-- SECTION_CLOSING -->
Wako mwaminifu,

<!-- SECTION_SIGNATURE -->
${fullName}

SHERIA:
1. Jaza mwili tu, rudisha template yote
2. Anza kwa "Tafadhali rejea somo tajwa la barua hapo juu"
3. Andika aya 4-5 kwa Kiswahili sanifu
4. USITUMIE: shauku, furahi, hamasa, Ninafurahishwa, ninajua kwamba
5. USIRUDIE: kufanya kazi (max mara 2), kufikia malengo (max mara 1)
6. TUMIA: Ninafuraha, Nina uwezo, Kupitia uzoefu, Nitaweza kuchangia, nimeambatanisha vivuli vya vyeti
7. Malizia kwa sentensi moja tu ya matarajio
8. USIVUMBUE: umri, elimu, chuo, mwaka isipokuwa vimetajwa`;

    const swahiliResult = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Wewe ni mtaalamu wa kuandika barua za maombi ya kazi Tanzania. Andika kwa Kiswahili sanifu cha kiofisi.' },
        { role: 'user', content: swahiliPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const applicationLetter = swahiliResult.choices[0]?.message?.content || '';

    return new Response(JSON.stringify({
      id: `letter-${Date.now()}`,
      createdAt: new Date().toISOString(),
      applicationLetter,
      coverLetter: '',
      atsAnalysis: { matchScore: 70, matchingSkills: [], missingSkills: [], recommendations: [], cvImprovements: [] },
      employerCountry: data.targetCountry || 'Tanzania',
      regionalStandard: getRegionalStandard(data.targetCountry || 'Tanzania'),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
