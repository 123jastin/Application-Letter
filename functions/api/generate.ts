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

function formatCompanyAddress(name: string, address: string): string {
  if (!address) return name;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  return [name, ...parts].join('\n');
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

    // Format employer block with each part on separate line
    const employerBlock = formatCompanyAddress(companyName, companyAddress);

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
${employerBlock}

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

      let applicationLetter = result.choices[0]?.message?.content || '';

      // Remove duplicate if exists
      const marker = '<!-- SECTION_DATE -->';
      const first = applicationLetter.indexOf(marker);
      const second = applicationLetter.indexOf(marker, first + 1);
      if (second !== -1) {
        applicationLetter = applicationLetter.substring(0, second).trim();
      }

      // Generate cover letter
      const coverPrompt = `Write a short cover letter.

APPLICANT: ${fullName} | ${education} | ${experience} years | ${skills}
TARGET: ${jobTitle} at ${companyName}
JOB: ${jobDescription.substring(0, 300)}
COUNTRY: ${data.targetCountry}

TEMPLATE:
<!-- SECTION_BODY -->
[Write 2 short paragraphs]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}

Return COMPLETE template.`;

      const coverResult = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Fill in only the body. Return complete template.' },
          { role: 'user', content: coverPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      });

      let coverLetter = coverResult.choices[0]?.message?.content || '';

      const coverMarker = '<!-- SECTION_BODY -->';
      const coverFirst = coverLetter.indexOf(coverMarker);
      const coverSecond = coverLetter.indexOf(coverMarker, coverFirst + 1);
      if (coverSecond !== -1) {
        coverLetter = coverLetter.substring(0, coverSecond).trim();
      }

      // ATS Analysis
      const atsResult = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Return ONLY a JSON object.' },
          { role: 'user', content: `{"matchScore":75,"matchingSkills":["skill1"],"missingSkills":[],"recommendations":["tip1"],"cvImprovements":["cv1"]}\n\nAnalyze: ${jobTitle} | ${skills}` }
        ],
        temperature: 0.3,
        max_tokens: 512,
      });

      let atsAnalysis = { matchScore: 70, matchingSkills: [] as string[], missingSkills: [] as string[], recommendations: [] as string[], cvImprovements: [] as string[] };
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
${employerBlock}

<!-- SECTION_SUBJECT -->
YAH: MAOMBI YA NAFASI YA ${jobTitle.toUpperCase()}

<!-- SECTION_BODY -->
[Andika mwili wa barua hapa kwa Kiswahili]

<!-- SECTION_CLOSING -->
Wako mwaminifu,

<!-- SECTION_SIGNATURE -->
${fullName}

SHERIA ZA KUANDIKA:
1. Jaza mwili tu, rudisha template yote
2. Anza kwa "Tafadhali rejea somo tajwa la barua hapo juu"
3. Andika aya 4-5 kwa Kiswahili sanifu
4. USITUMIE: shauku, furahi, hamasa, Ninafurahishwa, ninajua kwamba, kufikia malengo (zaidi ya mara 1)
5. USIRUDIE: kufanya kazi (max mara 2)
6. TUMIA: Ninafuraha, Nina uwezo, Kupitia uzoefu, Nitaweza kuchangia, nimeambatanisha vivuli vya vyeti
7. Kila aya iwe na maneno tofauti, usirudie wazo lilelile
8. Malizia kwa sentensi moja tu ya matarajio
9. USIVUMBUE: umri, elimu, chuo, mwaka isipokuwa vimetajwa
10. Barua ionekane imeandikwa na Mtanzania halisi`;

    const swahiliResult = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Wewe ni mtaalamu wa kuandika barua za maombi ya kazi Tanzania. Andika kwa Kiswahili sanifu cha kiofisi. Fuata sheria zote ulizopewa.' },
        { role: 'user', content: swahiliPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    let applicationLetter = swahiliResult.choices[0]?.message?.content || '';

    // Remove duplicate
    const swMarker = '<!-- SECTION_DATE -->';
    const swFirst = applicationLetter.indexOf(swMarker);
    const swSecond = applicationLetter.indexOf(swMarker, swFirst + 1);
    if (swSecond !== -1) {
      applicationLetter = applicationLetter.substring(0, swSecond).trim();
    }

    // Swahili cover letter
    const swCoverPrompt = `Andika barua ya kuambatana kwa Kiswahili sanifu.

MWOMBAJI: ${fullName} | ${education || 'Haijatajwa'} | Miaka ${experience} | ${skills || 'Haijatajwa'}
KAZI: ${jobTitle} katika ${companyName}
MAELEZO: ${jobDescription.substring(0, 300)}
NCHI: ${data.targetCountry}

TEMPLATE:
<!-- SECTION_BODY -->
[Andika aya 2-3 kwa Kiswahili]

<!-- SECTION_CLOSING -->
Wako mwaminifu,

<!-- SECTION_SIGNATURE -->
${fullName}

Rudisha template YOTE. USITUMIE: shauku, furahi, hamasa, Ninafurahishwa, ninajua kwamba.`;

    const swCoverResult = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Andika barua ya kuambatana kwa Kiswahili cha Tanzania.' },
        { role: 'user', content: swCoverPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    let coverLetter = swCoverResult.choices[0]?.message?.content || '';

    const swCoverMarker = '<!-- SECTION_BODY -->';
    const swCoverFirst = coverLetter.indexOf(swCoverMarker);
    const swCoverSecond = coverLetter.indexOf(swCoverMarker, swCoverFirst + 1);
    if (swCoverSecond !== -1) {
      coverLetter = coverLetter.substring(0, swCoverSecond).trim();
    }

    // ATS Analysis
    const atsResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Return ONLY a JSON object.' },
        { role: 'user', content: `{"matchScore":75,"matchingSkills":["skill1"],"missingSkills":[],"recommendations":["tip1"],"cvImprovements":["cv1"]}\n\nAnalyze: ${jobTitle} | ${skills}` }
      ],
      temperature: 0.3,
      max_tokens: 512,
    });

    let atsAnalysis = { matchScore: 70, matchingSkills: [] as string[], missingSkills: [] as string[], recommendations: [] as string[], cvImprovements: [] as string[] };
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
