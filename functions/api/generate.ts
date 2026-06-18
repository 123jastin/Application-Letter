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

    const MODEL = isSwahili ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

    const applicantAddress = formatAddressLines(data.personalInfo.address);
    const companyBlock = formatCompanyBlock(
      data.jobInfo.companyName,
      data.jobInfo.companyAddress || ''
    );

    // ─── BUILD THE EXACT LETTER TEMPLATE ───────────────
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
YAH: MAOMBI YA NAFASI YA ${data.jobInfo.jobTitle.toUpperCase()}

<!-- SECTION_BODY -->
[ANDIKA MWILI WA BARUA HAPA]

<!-- SECTION_CLOSING -->
Wako mwaminifu,

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
      ? `WEWE NI MTAALAMU WA KUANDIKA BARUA ZA MAOMBI YA KAZI TANZANIA.

Andika kwa mtindo unaotumika katika:
- Sekretarieti ya Ajira katika Utumishi wa Umma
- TAMISEMI
- Ofisi za Serikali za Mitaa
- Ofisi ya Bunge
- Jeshi la Zimamoto na Polisi
- Mashirika ya Umma na Kampuni Binafsi Tanzania

LUGHA: Kiswahili rasmi cha Tanzania, Kiswahili cha kitaaluma, Kiswahili cha serikali.

SHERIA MUHIMU - USIVUMBUE DATA:
1. USITAJIE umri wa mwombaji — isipokuwa umetolewa kwenye taarifa
2. USITAJIE elimu — isipokuwa imetolewa na mwombaji NA inaendana na kazi
3. USITAJIE mwaka wa kuhitimu — isipokuwa umetolewa
4. USITAJIE jina la chuo — isipokuwa limetolewa
5. USITAJIE uzoefu ambao haujatajwa
6. TUMIA TU taarifa ulizopewa

NAMNA YA KUANZA:
"Tafadhali rejea somo tajwa la barua hapo juu."

MUUNDO WA AYA (Andika aya 4-5 ndefu):
Aya 1: Rejea na kutambulisha — sentensi 3-4. Tambulisha jina, eleza unachoomba, na sababu ya maombi.
Aya 2: Uwezo na uzoefu — sentensi 4-5. Eleza kwa kina ujuzi na uzoefu unaolingana na kazi.
Aya 3: Sifa binafsi na mchango — sentensi 3-4. Eleza sifa zako na jinsi utakavyochangia.
Aya 4: Nyaraka — "Pamoja na barua hii nimeambatanisha vivuli vya vyeti vyangu vya taaluma na mahitaji mengine yote kwa mujibu wa tangazo."
Aya 5: Matarajio — "Natumai ombi langu litapokelewa na kujibiwa. Ninategemea majibu mazuri kutoka kwako na nipo tayari kwa usaili."

MANENO YALIYOKATAZWA:
❌ shauku, furahi, hamasa, hamu, vutiwa sana, napenda
❌ Asante kwa kuangalia, Natumai kusikia, Kwa heshima kubwa (closing)
❌ elimu ya msingi, mhitimu wa shule

MANENO SAHIHI:
✓ Tafadhali rejea somo tajwa la barua hapo juu
✓ Kwa mujibu wa tangazo
✓ Nina uwezo wa kufanya kazi kwa ufasaha/uweledi/ufanisi
✓ nimeambatanisha vivuli vya vyeti vyangu
✓ Natumai ombi langu litapokelewa na kujibiwa
✓ Wako mwaminifu, / Wako katika ujenzi wa Taifa

SHERIA ZA JUMLA:
1. Jaza SEHEMU YA MWILI tu
2. Rudisha template YOTE
3. USIVUMBUE data
4. USIRUDIE maneno yaleyale
5. Usiunganishe YAH na mwili — anza mwili kwa aya mpya
6. Usirudie barua mara mbili`
      : `You fill in ONLY the <!-- SECTION_BODY --> of a job application letter template.

RULES:
1. Output the ENTIRE template with the body filled in
2. Do NOT add phone, email, or address in the signature section
3. Do NOT write the name after the closing
4. Keep the body to 3 short paragraphs (200 words max)
5. Do NOT repeat the entire letter twice`;

    const appUserPrompt = isSwahili
      ? `Andika barua ya maombi ya kazi kwa Kiswahili cha Mtanzania halisi.

TAARIFA ZA MWOMBAJI (TUMIA HIZI TU):
Jina: ${fullName}
Simu: ${data.personalInfo.phone}
Barua Pepe: ${data.personalInfo.email}
Anwani: ${data.personalInfo.address}
Elimu: ${data.professionalInfo.highestEducation || 'Haijatajwa'}
Uzoefu: Miaka ${data.professionalInfo.yearsOfExperience}
Nafasi ya Sasa: ${data.professionalInfo.currentPosition}
Ujuzi: ${data.professionalInfo.keySkills || 'Haijatajwa'}

TAARIFA ZA KAZI:
Nafasi: ${data.jobInfo.jobTitle}
Kampuni: ${data.jobInfo.companyName}
Anwani ya Kampuni: ${data.jobInfo.companyAddress || 'Dar es Salaam, Tanzania'}
Maelezo ya Kazi: ${data.jobInfo.jobDescription}

Nchi: ${data.targetCountry}

TEMPLATE:
${letterTemplate}

Badilisha [ANDIKA MWILI WA BARUA HAPA] na aya 4-5 ndefu kwa Kiswahili sanifu.
USITAJIE umri, elimu, chuo, au mwaka isipokuwa vimetolewa kwenye taarifa hapo juu.
USIRUDIE maneno yaleyale.
Anza mwili kwa aya mpya — usiunganishe na YAH.
Rudisha template YOTE mara MOJA.`
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
      model: MODEL,
      messages: [
        { role: 'system', content: appSystemPrompt },
        { role: 'user', content: appUserPrompt }
      ],
      temperature: isSwahili ? 0.3 : 0.7,
      max_tokens: isSwahili ? 2048 : 1536,
    });

    let applicationLetter = appResult.choices[0]?.message?.content || '';

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
      ? `Andika barua ya kuambatana kwa Kiswahili cha Mtanzania. Aya 2-3 ndefu. USIVUMBUE data. Usitumie "shauku", "furahi", "hamasa".`
      : `Fill in ONLY the body of a cover letter template. Return the COMPLETE template. Keep it short - 150 words max. Do NOT repeat the name in the closing.`;

    const coverUserPrompt = isSwahili
      ? `Andika barua ya kuambatana kwa Kiswahili cha Mtanzania.

MWOMBAJI: ${fullName} | ${data.professionalInfo.highestEducation || 'Haijatajwa'} | Miaka ${data.professionalInfo.yearsOfExperience}
UJUZI: ${data.professionalInfo.keySkills || 'Haijatajwa'}
KAZI: ${data.jobInfo.jobTitle} katika ${data.jobInfo.companyName}
MAELEZO: ${data.jobInfo.jobDescription.substring(0, 300)}
NCHI: ${data.targetCountry}

TEMPLATE:
${coverTemplate}

Badilisha [ANDIKA MWILI WA BARUA YA KUAMBATANA HAPA] na aya 2-3. Rudisha template YOTE.`
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

Analyze this and return similar JSON:
Job: ${data.jobInfo.jobTitle} - ${data.jobInfo.jobDescription.substring(0, 200)}
Candidate: ${data.professionalInfo.keySkills || 'Professional'} | ${data.professionalInfo.yearsOfExperience} years`
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
