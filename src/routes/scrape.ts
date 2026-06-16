import { Router, Request, Response } from 'express';
import { groq, GROQ_MODEL } from '../config/groq';

export const scrapeRoutes = Router();

scrapeRoutes.post('/url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the page content
    const response = await fetch(url);
    const html = await response.text();
    
    // Extract text content (basic — remove HTML tags)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000);

    // Use Groq to extract structured job data
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Extract job listing details from web page content. Respond ONLY with valid JSON: {"jobTitle":"...", "companyName":"...", "companyAddress":"...", "jobDescription":"..."}'
        },
        { role: 'user', content: textContent }
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const resultText = completion.choices[0]?.message?.content || '{}';
    const cleanJson = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jobData = JSON.parse(cleanJson);

    res.json(jobData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to scrape URL' });
  }
});
