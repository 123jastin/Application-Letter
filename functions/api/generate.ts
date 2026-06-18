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

NAMNA ZA KUANZA BARUA (Chagua mojawapo inayofaa zaidi):
1. "Tafadhali rejea somo tajwa la barua hapo juu. Mimi ni [Jina], kijana Mtanzania..."
2. "Husika na Kichwa cha habari hapo juu. Mimi ni [Jina]..."
3. "Kwa heshima na taadhima, ninaomba nafasi ya kazi ya..."
4. "Ninapenda kuwasilisha maombi yangu ya kazi kwa heshima kubwa, kwa ajili ya nafasi ya..."

MUUNDO SAHIHI WA AYA (Andika aya 4):
Aya 1 - REJEA NA KUTAMBULISHA:
"Tafadhali rejea somo tajwa la barua hapo juu. Mimi ni [Jina], kijana Mtanzania mwenye umri wa miaka [X]. Nimehitimu masomo yangu ya [Shahada/Stashahada] katika [Chuo] mwaka [Mwaka] na kutunukiwa [Stashahada/Shahada]."

Aya 2 - UWEZO NA UZOEFU:
"Kwa mujibu wa tangazo lililotolewa na [Taasisi/Kampuni], ninaomba nafasi ya kazi ya [Nafasi]. Nina uwezo wa kufanya kazi hii kwa ufasaha/ufanisi/uweledi na kwa kuzingatia miiko ya kazi yangu. Nina uelewa mpana wa..."

Aya 3 - NYARAKA NA MAHITAJI:
"Pamoja na barua hii nimeambatanisha vivuli vya vyeti vyangu vya taaluma na mahitaji mengine yote kwa mujibu wa tangazo. Vitu vyote vimeambatanishwa kwenye mfumo."

Aya 4 - MATARAJIO:
"Natumai ombi langu litapokelewa na kujibiwa."
AU "Natumaini ombi langu litakubaliwa."
AU "Nina imani ombi langu litakubaliwa."
AU "Ninategemea majibu mazuri kutoka kwako na nipo tayari kwa usaili siku yoyote nitakayohitajika."

MANENO YALIYOKATAZWA KABISA (USIYATUMIE):
❌ Nina shauku kubwa
❌ Ningefurahi / Nina furaha
❌ Nina hamasa / Nina hamu
❌ Nimevutiwa sana
❌ Napenda
❌ Asante kwa kuangalia maombi yangu
❌ Natumai kusikia kutoka kwako hivi karibuni
❌ Kwa heshima kubwa (kama closing)
❌ elimu ya msingi na sekondari
❌ mhitimu wa shule ya msingi
❌ mhitimu wa elimu ya msingi

MANENO SAHIHI YA KUTUMIA:
✓ Tafadhali rejea somo tajwa la barua hapo juu
✓ Husika na Kichwa cha habari hapo juu
✓ Kwa mujibu wa tangazo lililotolewa na...
✓ Mimi ni kijana Mtanzania mwenye umri wa miaka...
✓ Nimehitimu masomo yangu ya...
✓ na kutunukiwa stashahada/shahada ya...
✓ Nina uwezo wa kufanya kazi hii kwa ufasaha
✓ Nina uwezo wa kufanya kazi kwa uweledi
✓ Ninauwezo wa kufanya kazi kwa ufanisi
✓ nimeambatanisha vivuli vya vyeti vyangu vya taaluma
✓ Nimeambatanisha nakala za vyeti vyangu na CV
✓ Vitu vyote vimeambatanishwa kwenye mfumo
✓ Natumai ombi langu litapokelewa na kujibiwa
✓ Natumaini ombi langu litakubaliwa
✓ Nina imani ombi langu litakubaliwa
✓ Ninategemea majibu mazuri kutoka kwako
✓ nipo tayari kwa usaili
✓ Wako mwaminifu,
✓ Wako katika ujenzi wa Taifa

KUHUSU ELIMU (Sheria Muhimu Sana):
1. Ikiwa mwombaji HAJAWEKA elimu yake — USITAJIE elimu kabisa, taja uzoefu na ujuzi badala yake
2. Ikiwa elimu ya mwombaji HAIENDANI na kazi anayoomba — USITAJIE elimu
3. Ikiwa elimu inaendana na kazi — taja kwa kifupi: "Nimehitimu [Shahada] katika [Chuo] mwaka [Mwaka]"
4. USISEME kamwe "mhitimu wa elimu ya msingi na sekondari" au "nimehitimu kidato cha nne"

MFANO SAHIHI WA BARUA KAMILI (Fuata mtindo huu kwa ukaribu):
"Tafadhali rejea somo tajwa la barua hapo juu. Mimi ni Juma Shabani, kijana Mtanzania mwenye umri wa miaka 28. Nimehitimu masomo yangu ya Shahada ya Kwanza ya Ualimu katika Chuo Kikuu cha Dar es Salaam mwaka 2020 na kutunukiwa Shahada ya Elimu.
Kwa mujibu wa tangazo lililotolewa na Wizara ya Elimu, ninaomba nafasi ya kazi ya Mwalimu wa Hisabati. Nina uwezo wa kufanya kazi hii kwa ufasaha na kwa kuzingatia miiko ya kazi yangu. Nina uelewa mpana wa mbinu za ufundishaji na usimamizi wa darasa.
Pamoja na barua hii nimeambatanisha vivuli vya vyeti vyangu vya taaluma na mahitaji mengine yote kwa mujibu wa tangazo.
Natumai ombi langu litapokelewa na kujibiwa.
Wako katika ujenzi wa Taifa."

SHERIA ZA JUMLA:
1. Jaza SEHEMU YA MWILI tu — usibadilishe anwani, tarehe, wala sehemu ya sahihi
2. Rudisha template YOTE ikiwa imejazwa
3. Usiongeze simu wala barua pepe kwenye saini
4. Barua ionekane imeandikwa na Mtanzania halisi
5. USITUMIE maneno ya tafsiri ya Kiingereza
6. Usirudie barua mara mbili
7. Malizia kwa "Wako mwaminifu," au "Wako katika ujenzi wa Taifa"`
      : `You fill in ONLY the <!-- SECTION_BODY --> of a job application letter template.

RULES:
1. Output the ENTIRE template with the body filled in
2. Do NOT add phone, email, or address in the signature section
3. Do NOT write the name after the closing
4. Keep the body to 3 short paragraphs (200 words max)
5. Do NOT repeat the entire letter twice`;

    const appUserPrompt = isSwahili
      ? `Andika barua ya maombi ya kazi kwa Kiswahili cha Mtanzania halisi.

TAARIFA ZA MWOMBAJI:
Jina Kamili: ${fullName}
Simu: ${data.personalInfo.phone}
Barua Pepe: ${data.personalInfo.email}
Anwani: ${data.personalInfo.address}
Elimu: ${data.professionalInfo.highestEducation || 'Haijabainishwa'}
Uzoefu: Miaka ${data.professionalInfo.yearsOfExperience}
Nafasi ya Sasa: ${data.professionalInfo.currentPosition}
Ujuzi: ${data.professionalInfo.keySkills || 'Ujuzi wa kitaaluma'}

TAARIFA ZA KAZI:
Nafasi: ${data.jobInfo.jobTitle}
Kampuni: ${data.jobInfo.companyName}
Anwani ya Kampuni: ${data.jobInfo.companyAddress || 'Dar es Salaam, Tanzania'}
Maelezo ya Kazi: ${data.jobInfo.jobDescription}

Nchi: ${data.targetCountry}

TEMPLATE YA KUJAZA:
${letterTemplate}

Badilisha [ANDIKA MWILI WA BARUA HAPA] na aya 4 kwa Kiswahili sanifu cha Mtanzania.
KUMBUKA: Tumia "Tafadhali rejea..." au "Kwa heshima na taadhima..." kuanza.
USITAJIE elimu kama haijawekwa au haiendani na kazi.
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
      ? `Andika barua ya kuambatana kwa Kiswahili cha Mtanzania. Tumia mtindo wa UTUMISHI. Weka fupi - aya 2-3. Anza kwa "Tafadhali rejea..." au "Kwa heshima...". Usitumie "shauku", "furahi", "hamasa", "asante kwa kuangalia", "natamai kusikia". Usitajie elimu kama haijawekwa.`
      : `Fill in ONLY the body of a cover letter template. Return the COMPLETE template. Keep it short - 150 words max. Do NOT repeat the name in the closing.`;

    const coverUserPrompt = isSwahili
      ? `Andika barua fupi ya kuambatana kwa Kiswahili cha Mtanzania:

MWOMBAJI: ${fullName} | ${data.professionalInfo.highestEducation || 'Elimu haijabainishwa'} | Miaka ${data.professionalInfo.yearsOfExperience}
UJUZI: ${data.professionalInfo.keySkills || 'Utaalamu wa kitaaluma'}
KAZI: ${data.jobInfo.jobTitle} katika ${data.jobInfo.companyName}
MAELEZO YA KAZI: ${data.jobInfo.jobDescription.substring(0, 300)}
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
