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
    const isSwahili = data.targetLanguage === 'Swahili';

    const applicantAddress = formatAddressLines(data.personalInfo.address);
    const companyBlock = formatCompanyBlock(
      data.jobInfo.companyName,
      data.jobInfo.companyAddress || ''
    );

    // ─── BUILD LETTER TEMPLATE (English or Swahili) ─────
    const letterTemplate = isSwahili
      ? `<!-- SECTION_APPLICANT -->
${fullName}
${applicantAddress}
${data.personalInfo.phone} | ${data.personalInfo.email}

<!-- SECTION_DATE -->
${today}

<!-- SECTION_EMPLOYER -->
${companyBlock}

<!-- SECTION_SUBJECT -->
KUH: MAOMBI YA NAFASI YA ${data.jobInfo.jobTitle.toUpperCase()}

<!-- SECTION_SALUTATION -->
Ndugu Meneja wa Utumishi,

<!-- SECTION_BODY -->
[ANDIKA MWILI WA BARUA HAPA KWA KISWAHILI]

<!-- SECTION_CLOSING -->
Wako mtiifu,

<!-- SECTION_SIGNATURE -->
${fullName}`
      : `<!-- SECTION_APPLICANT -->
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
    const appSystemPrompt = isSwahili
      ? `Wewe ni mtaalamu wa HR na uandishi wa barua za maombi ya kazi kwa Kiswahili sanifu cha kiofisi cha Tanzania.

SHERIA MUHIMU:
1. Jaza SEHEMU YA MWILI tu ya barua
2. Rudisha template YOTE ikiwa imejazwa
3. Usiongeze simu, barua pepe, wala anwani katika sehemu ya saini
4. Usiandike jina baada ya "Wako mtiifu,"
5. Andika aya 3-4 fupi (maneno 200 upeo)
6. ANDIKA KWA KISWAHILI tu - hata kama maelezo ya kazi ni kwa Kiingereza
7. Tumia lugha sanifu ya kiofisi inayokubalika Tanzania
8. Usirudie barua yote mara mbili`
      : `You fill in ONLY the body of a job application letter template.

RULES:
1. Output the ENTIRE template with the body filled in
2. Do NOT add phone, email, or address in the signature section
3. Do NOT write the name after the closing
4. Keep the body to 3 short paragraphs (200 words max)
5. Do NOT repeat the entire letter twice`;

    const appUserPrompt = isSwahili
      ? `Jaza MWILI wa barua hii kwa KISWAHILI sanifu. Rudisha template YOTE.

TAARIFA ZA MWOMBAJI:
Jina: ${fullName}
Elimu: ${data.professionalInfo.highestEducation}
Uzoefu: Miaka ${data.professionalInfo.yearsOfExperience} kama ${data.professionalInfo.currentPosition}
Ujuzi: ${data.professionalInfo.keySkills || 'Ujuzi wa kitaaluma'}

TAARIFA ZA KAZI:
Nafasi: ${data.jobInfo.jobTitle}
Kampuni: ${data.jobInfo.companyName}
Maelezo ya Kazi: ${data.jobInfo.jobDescription}

Nchi: ${data.targetCountry}

TEMPLATE YA KUJAZA:
${letterTemplate}

Badilisha [ANDIKA MWILI WA BARUA HAPA KWA KISWAHILI] na aya 3-4 za Kiswahili sanifu. Rudisha template YOTE.`
      : `Fill in the SECTION_BODY of this letter template. Return the COMPLETE template with body filled.

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

Replace [WRITE BODY HERE] with 3 short paragraphs. Return the COMPLETE template.`;

    const appResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: appSystemPrompt },
        { role: 'user', content: appUserPrompt }
      ],
      temperature: 0.7,
      max_tokens: isSwahili ? 2048 : 1536,
    });

    const applicationLetter = appResult.choices[0]?.message?.content || '';

    // ─── Step 2: Generate Cover Letter ─────────────────
    const coverTemplate = isSwahili
      ? `<!-- SECTION_BODY -->
[ANDIKA MWILI WA BARUA YA KUAMBATANA HAPA KWA KISWAHILI]

<!-- SECTION_CLOSING -->
Wako mtiifu,

<!-- SECTION_SIGNATURE -->
${fullName}`
      : `<!-- SECTION_BODY -->
[WRITE COVER LETTER BODY HERE]

<!-- SECTION_CLOSING -->
Yours sincerely,

<!-- SECTION_SIGNATURE -->
${fullName}`;

    const coverSystemPrompt = isSwahili
      ? `Jaza MWILI wa barua ya kuambatana kwa KISWAHILI sanifu. Rudisha template YOTE. Weka fupi - maneno 150 upeo. Usirudie jina kwenye saini. ANDIKA KWA KISWAHILI TU.`
      : `Fill in ONLY the body of a cover letter template. Return the COMPLETE template. Keep it short - 150 words max. Do NOT repeat the name in the closing.`;

    const coverUserPrompt = isSwahili
      ? `Jaza barua hii ya kuambatana kwa KISWAHILI:

MWOMBAJI: ${fullName}
Historia: ${data.professionalInfo.highestEducation}, miaka ${data.professionalInfo.yearsOfExperience}
Ujuzi: ${data.professionalInfo.keySkills || 'Utaalamu'}
Kazi: ${data.jobInfo.jobTitle} katika ${data.jobInfo.companyName}
Maelezo: ${data.jobInfo.jobDescription.substring(0, 300)}
Nchi: ${data.targetCountry}

TEMPLATE:
${coverTemplate}

Badilisha [ANDIKA MWILI WA BARUA YA KUAMBATANA HAPA KWA KISWAHILI]. Rudisha template YOTE kwa Kiswahili.`
      : `Fill in this cover letter template:

APPLICANT: ${fullName}
Background: ${data.professionalInfo.highestEducation}, ${data.professionalInfo.yearsOfExperience} years
Skills: ${data.professionalInfo.keySkills || 'Professional'}
Target: ${data.jobInfo.jobTitle} at ${data.jobInfo.companyName}
Job: ${data.jobInfo.jobDescription.substring(0, 300)}
Country: ${data.targetCountry}

TEMPLATE:
${coverTemplate}

Replace [WRITE COVER LETTER BODY HERE]. Return COMPLETE template.`;

    const coverResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: coverSystemPrompt },
        { role: 'user', content: coverUserPrompt }
      ],
      temperature: 0.7,
      max_tokens: isSwahili ? 1536 : 1024,
    });

    const coverLetter = coverResult.choices[0]?.message?.content || '';

    // ─── Step 3: ATS Analysis ──────────────────────────
    const atsSystemPrompt = isSwahili
      ? 'Chambua barua hii kwa ajili ya ATS. Jibu kwa JSON tu. Hakuna maandishi mengine.'
      : 'Return ONLY a JSON object. No other text.';

    const atsUserPrompt = isSwahili
      ? `Chambua barua hii kwa mfumo wa ATS:

Kazi: ${data.jobInfo.jobTitle}
Maelezo: ${data.jobInfo.jobDescription.substring(0, 200)}
Mwombaji: ${data.professionalInfo.keySkills || 'Utaalamu'} | Miaka ${data.professionalInfo.yearsOfExperience}

Jibu kwa JSON pekee:
{"matchScore":75,"matchingSkills":["ujuzi1"],"missingSkills":[],"recommendations":["pendekezo1"],"cvImprovements":["boresha1"]}`
      : `{"matchScore":75,"matchingSkills":["skill1"],"missingSkills":[],"recommendations":["tip1"],"cvImprovements":["cv1"]}

Analyze this and return similar JSON:
Job: ${data.jobInfo.jobTitle} - ${data.jobInfo.jobDescription.substring(0, 200)}
Candidate: ${data.professionalInfo.keySkills || 'Professional'} | ${data.professionalInfo.yearsOfExperience} years`;

    const atsResult = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: atsSystemPrompt },
        { role: 'user', content: atsUserPrompt }
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
