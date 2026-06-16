import { Router, Request, Response } from 'express';
import { db } from '../config/database';

export const jobRoutes = Router();

// GET simulated jobs for prefill (from your existing jobs table)
jobRoutes.get('/simulate', (_req: Request, res: Response) => {
  try {
    const jobs = db.prepare(`
      SELECT 
        j.id,
        j.title as jobTitle,
        c.name as companyName,
        j.location as companyAddress,
        j.description as jobDescription,
        j.canonical_url as jobUrl,
        j.country
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE j.is_active = 1
      ORDER BY j.posted_at DESC
      LIMIT 6
    `).all();

    res.json({ jobs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single job for prefill
jobRoutes.get('/:id', (req: Request, res: Response) => {
  try {
    const job = db.prepare(`
      SELECT 
        j.id,
        j.title as jobTitle,
        c.name as companyName,
        j.location as companyAddress,
        j.description as jobDescription,
        j.canonical_url as jobUrl,
        j.country,
        j.skills,
        j.industry
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE j.id = ?
    `).get(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
