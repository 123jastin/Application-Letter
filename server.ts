import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON body parsing
  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini AI Client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      hasApiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // 1-Click pre-fill simulator
  app.get('/api/simulate-job', (req, res) => {
    const jobs = [
      {
        jobTitle: 'Senior Software Engineer',
        companyName: 'NMB Bank Plc',
        companyAddress: 'Ohio Street, P.O. Box 9213, Dar es Salaam, Tanzania',
        jobDescription: 'Required: 5+ years of software development experience with React and Node.js. Knowledge of microservice architectures, financial systems, and secure application integrations. Must hold a Bachelor’s degree in Computer Science or IT. Key skills include React, TypeScript, Express, PostgreSQL, AWS, and secure banking APIs.',
        jobUrl: 'https://jobsreport.online/view/nmb-bank-senior-dev-82391'
      },
      {
        jobTitle: 'HR Specialist',
        companyName: 'Bakhresa Group',
        companyAddress: 'Vingunguti Industrial Area, Dar es Salaam, Tanzania',
        jobDescription: 'Seeking an HR Specialist to manage employee relations, recruitment pipeline, and performance management schemes. Candidate must communicate perfectly, understand labor relations act, and possess high emotional intelligence. Skills: Recruitment, HR planning, Tanzanian Labor Laws, employee engagement.',
        jobUrl: 'https://jobsreport.online/view/bakhresa-hr-specialist-73285'
      },
      {
        jobTitle: 'Data Analyst',
        companyName: 'Safaricom PLC',
        companyAddress: 'Safaricom House, Waiyaki Way, Nairobi, Kenya',
        jobDescription: 'Join the commercial analytics business unit. Responsibilities: process big mobile data using Python/SQL, build charts and dashboards in PowerBI, deliver actionable growth metrics. Requirements: 2+ years analytics, advanced SQL, Python pandas/numpy, visualization systems, and strong business communication.',
        jobUrl: 'https://jobsreport.online/view/safaricom-data-analyst-11102'
      }
    ];
    res.json({ jobs });
  });

  // Crawl and Analyze Job Listing URL using Gemini Intelligence
  app.post('/api/scrape-url', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
      }

      let parsedHtmlText = "";
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
          }
        });
        if (response.ok) {
          const rawContent = await response.text();
          // Strip out heavy content elements to focus on text content
          parsedHtmlText = rawContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ') 
            .replace(/\s+/g, ' ')
            .substring(0, 15000); // safety cap
        }
      } catch (fetchErr: any) {
        console.warn("Outward fetch restricted or link requires dynamic parsing:", fetchErr.message);
      }

      const prompt = `
        You are a smart recruitment intelligence agent.
        Analyze the following target job description posting webpage or web URL:
        URL: ${url}
        Extracted Raw Page Text:
        """
        ${parsedHtmlText || '(The raw web scrape failed. Please make an intelligent deduction of the job description based entirely on the URL keywords or domain structure.)'}
        """

        Extract the following fields into correct clean, human-readable structured details:
        1. jobTitle: The title of the job listing.
        2. companyName: The name of the hiring organization.
        3. companyAddress: The local workspace/headquarters address of the company if mentioned, otherwise make a logical estimate or keep as simple.
        4. jobDescription: A robust summary of the role, key responsibilities, requirements, technical skills, and academic qualifications.

        Always reply with a valid JSON document conforming to the schema.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: "You are a recruitment crawler. Parse website contents and URL structures into a clean structured job description JSON.",
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              jobTitle: { type: Type.STRING },
              companyName: { type: Type.STRING },
              companyAddress: { type: Type.STRING },
              jobDescription: { type: Type.STRING }
            },
            required: ['jobTitle', 'companyName', 'companyAddress', 'jobDescription']
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No parsed content returned from model.");
      }

      const parsedJSON = JSON.parse(text.trim());
      res.json(parsedJSON);

    } catch (err: any) {
      console.error("URL Scraper backend error:", err);
      res.status(500).json({ 
        error: "Failed to load and analyze content from url. Please enter job description text manually if needed.",
        details: err.message
      });
    }
  });

  // AI-Powered Letter & Cover Letter Generator Endpoint
  app.post('/api/generate-letter', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY environment variable is not configured. Please add it via the Settings > Secrets menu.'
        });
      }

      const { personalInfo, professionalInfo, jobInfo, targetCountry, targetLanguage = 'English' } = req.body;

      if (!personalInfo || !professionalInfo || !jobInfo || !targetCountry) {
        return res.status(400).json({ error: 'Missing required parameters inside body' });
      }

      // Format current date with clean display format
      const dateString = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Handle optional or missing skills by instructing AI to infer them
      const skillsToUse = professionalInfo.keySkills && professionalInfo.keySkills.trim()
        ? professionalInfo.keySkills
        : `[Candidate skills not specified. Identify matching competencies from the Job Description and write the letters showcasing these skills based on the candidate's ${professionalInfo.yearsOfExperience} years of experience and education]`;

      const languageInstruction = targetLanguage === 'Swahili'
        ? `CRITICAL LANGUAGE CONSTRAINT: You MUST write both the Application Letter and the Cover Letter in highly professional, polite, and elegant Swahili (specifically Tanzania-standard Kiswahili ya Kiofisi / Kiswahili cha Maandishi Rasmi). Use standard Tanzanian formal greetings (e.g. "Ndugu Mkurugenzi," or "Mheshimiwa,") and official subject formatting starting with "YAH: MAOMBI YA KAZI YA [JOB_TITLE]". Do NOT use informal words or generic auto-translations. Translate all technical terms and candidates histories into correct, fluent Tanzanian business Swahili.`
        : `CRITICAL LANGUAGE CONSTRAINT: You MUST write both the Application Letter and the Cover Letter in flawless, highly refined professional business English suitable for the hiring destination.`;

      const systemInstruction = 
        `You are a premium recruitment expert, hiring manager, and expert ATS optimization consultant. ` +
        `Your task is to analyze the company info and target country to determine the correct target employer country and apply the appropriate regional application letter standard. ` +
        `Select the correct regional standard from the list:
        - "East African Formal" (for Tanzania, Kenya, Uganda, Rwanda, Zambia, Malawi)
        - "UK Professional" (for United Kingdom, Australia)
        - "North American ATS" (for United States, Canada)
        - "Gulf Professional" (for United Arab Emirates)
        - "European Corporate" (for South Africa, and generic European contexts)
        
        Deliver letters that strictly adhere to formatting and hiring standards of that specific region, avoiding AI-clichés and generic phrases, using direct, metrics-focused professional storytelling.`;

      const prompt = `
        You are writing tailored letters for:
        Candidate: ${personalInfo.fullName}
        Current/Previous Job Title: ${professionalInfo.currentPosition}
        Highest Education: ${professionalInfo.highestEducation}
        Years of Experience: ${professionalInfo.yearsOfExperience} years
        Key Skills: ${skillsToUse}

        Contact Info to place in Applicant section:
        Phone: ${personalInfo.phone}
        Email: ${personalInfo.email}
        Address: ${personalInfo.address}

        Target Recruiter Position Details:
        Company Name: ${jobInfo.companyName}
        Job Title: ${jobInfo.jobTitle}
        Company Address: ${jobInfo.companyAddress || 'Hiring Department'}
        Job URL (if helpful): ${jobInfo.jobUrl || 'N/A'}
        Job Description:
        """
        ${jobInfo.jobDescription}
        """

        ${languageInstruction}

        Employer Country Identification:
        1. Parse the Company Name, Address (${jobInfo.companyAddress}), Job Description, and userselected Target Country (${targetCountry}).
        2. Resolve the final actual Employer Country (e.g. Tanzania, Zambia, Malawi, United Kingdom, United States, United Arab Emirates, Canada, etc.).
        3. Match it to its specific regional format standard:
           - East African Formal:
             Applicant details aligned top-right, date below applicant address, employer address left, bold and underlined subject reference line (e.g., **<u>REF: APPLICATION FOR...</u>**), formal greeting, respectful formal closing. No bold text on applicant address rows, do not use "* *" or "> >" characters on margins.
           - UK Professional:
             Modern layout, professional greeting, max 1 page, concise style on achievements, direct and confident, polite business standard closing.
           - North American ATS:
             ATS-friendly, clear linear header, achievement-driven action verbs, results-oriented metrics, modern corporate layout.
           - Gulf Professional:
             Highly formal corporate standard, bold subject line, high-status respectfully polite, robust phrasing.
           - European Corporate:
             Clean structure, minimalistic elegant spacing, highly professional tone, balanced business standard layout.

        IMPORTANT MARKDOWN SECTION MARKERS DIRECTIVE:
        To protect dynamic high-fidelity paper rendering on A4 layouts, you MUST wrap sections within "applicationLetter" and "coverLetter" using the following EXACT HTML comment markers on their own lines. Do NOT combine them, and always output content between them:
        
        <!-- SECTION_APPLICANT -->
        [Applicant name, title, address, phone, email details]
        
        <!-- SECTION_DATE -->
        [The formal date, styled correctly, e.g. ${dateString}]
        
        <!-- SECTION_EMPLOYER -->
        [Employer company name, contact manager name/title if known, address block]
        
        <!-- SECTION_SUBJECT -->
        [Subject of the letter, e.g. REF: ... or Subject: ... structured to match the standard. Use bold/underlined for East African or Gulf styles.]
        
        <!-- SECTION_SALUTATION -->
        [Greeting, e.g. Dear Sir/Madam, or Dear Mr. Smith,]
        
        <!-- SECTION_BODY -->
        [The core letter paragraphs. No generic fillers. Include dynamic intro, experience matching, skill highlights, highest education mention: ${professionalInfo.highestEducation}, and strong call to action.]
        
        <!-- SECTION_CLOSING -->
        [Sign-off, e.g. Yours faithfully, or Yours sincerely, or Kind regards,]
        
        <!-- SECTION_SIGNATURE -->
        [Signature text name, e.g. ${personalInfo.fullName}]

        Write both letters in highly refined markdown using the above exact blocks. Do NOT wrap these HTML comments in code fences or add backslashes. Ensure the letters are clean and do not contain raw asterisks/formatting noise in the headers.
        
        Analyze the correlation between candidate experience/skills and the Job Description to calculate the ATS metrics:
        - Match Score: 0 to 100 percentage.
        - Matching Skills: List core technical or soft skills that match.
        - Missing Skills: Key skills mentioned in the job description that the candidate might lack or should emphasize.
        - Recommendations: Concrete professional advice to tailor their application.
        - CV Improvements: 2-3 specific ways they can update their CV elements to get noticed by the recruiters for this role.
      `;

      // Request structured output from Gemini using Schema structure
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              employerCountry: {
                type: Type.STRING,
                description: 'The final resolved country of the employer (e.g., Tanzania, United Kingdom, United States, United Arab Emirates, etc.) based on address, company context, and selected target recruiting country.'
              },
              regionalStandard: {
                type: Type.STRING,
                description: 'The selected regional standard applied to the letter. Must be exactly one of: "East African Formal", "UK Professional", "North American ATS", "Gulf Professional", "European Corporate".'
              },
              applicationLetter: { 
                type: Type.STRING, 
                description: 'The complete formal application letter formatted in professional markdown. Include the special HTML comments separators EXACTLY as requested (<!-- SECTION_APPLICANT -->, <!-- SECTION_DATE -->, <!-- SECTION_EMPLOYER -->, <!-- SECTION_SUBJECT -->, <!-- SECTION_SALUTATION -->, <!-- SECTION_BODY -->, <!-- SECTION_CLOSING -->, <!-- SECTION_SIGNATURE -->) so the frontend can isolate and render sections dynamically.'
              },
              coverLetter: { 
                type: Type.STRING,
                description: 'The cohesive cover letter formatted in professional markdown. Include the exact same HTML comment separators (<!-- SECTION_APPLICANT -->, <!-- SECTION_DATE -->, <!-- SECTION_EMPLOYER -->, <!-- SECTION_SUBJECT -->, <!-- SECTION_SALUTATION -->, <!-- SECTION_BODY -->, <!-- SECTION_CLOSING -->, <!-- SECTION_SIGNATURE -->).' 
              },
              atsAnalysis: {
                type: Type.OBJECT,
                description: 'Detailed job alignment and ATS feedback analysis.',
                properties: {
                  matchScore: { 
                    type: Type.INTEGER, 
                    description: 'A computed correlation percentage (0-100) representing how well the candidate matches the job description.' 
                  },
                  matchingSkills: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: 'Array of candidate skills that correspond directly with what the job description requires.'
                  },
                  missingSkills: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: 'Important skills from the job description not clearly stated in candidate summary.'
                  },
                  recommendations: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: 'Strategic actionable recommendations to stand out.' 
                  },
                  cvImprovements: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Specific resume wording adjustments, structural edits, or section upgrades to optimize ATS compatibility.'
                  }
                },
                required: ['matchScore', 'matchingSkills', 'missingSkills', 'recommendations', 'cvImprovements']
              }
            },
            required: ['employerCountry', 'regionalStandard', 'applicationLetter', 'coverLetter', 'atsAnalysis']
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Emply response received from Gemini.');
      }

      const result = JSON.parse(responseText.trim());
      res.json(result);

    } catch (error: any) {
      console.error('API Error details:', error);
      res.status(500).json({
        error: 'An error occurred during letter generation.',
        details: error.message || error
      });
    }
  });

  // Serve static assets in production, otherwise mount Vite
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Always use port 3000 and bind to 0.0.0.0
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Dev/Prod Server:', err);
  process.exit(1);
});
