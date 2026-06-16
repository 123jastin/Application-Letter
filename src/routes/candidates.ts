import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { z } from 'zod';

export const candidateRoutes = Router();

const candidateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  highestEducation: z.string().default("Bachelor's Degree"),
  yearsOfExperience: z.number().min(0).default(0),
  currentPosition: z.string().default('Jobseeker'),
  keySkills: z.array(z.string()).default([]),
  signatureText: z.string().optional(),
  signatureImage: z.string().optional(),
});

// UPSERT candidate (so it auto-saves from your React form)
candidateRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const data = candidateSchema.parse(req.body);
    
    const result = await pool.query(
      `INSERT INTO candidates (email, full_name, phone, address, highest_education, 
       years_of_experience, current_position, key_skills, signature_text, signature_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (email) 
       DO UPDATE SET 
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         address = EXCLUDED.address,
         highest_education = EXCLUDED.highest_education,
         years_of_experience = EXCLUDED.years_of_experience,
         current_position = EXCLUDED.current_position,
         key_skills = EXCLUDED.key_skills,
         signature_text = EXCLUDED.signature_text,
         signature_image = EXCLUDED.signature_image,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [data.email, data.fullName, data.phone, data.address, data.highestEducation,
       data.yearsOfExperience, data.currentPosition, data.keySkills,
       data.signatureText, data.signatureImage]
    );
    
    res.json({ candidate: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET by email
candidateRoutes.get('/:email', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM candidates WHERE email = $1',
      [req.params.email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json({ candidate: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
