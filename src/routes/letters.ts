import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { generateId } from '../utils/uuid';

export const letterRoutes = Router();

// GET all letters for a candidate
letterRoutes.get('/candidate/:candidateId', (req: Request, res: Response) => {
  try {
    const letters = db.prepare(`
      SELECT 
        l.*,
        j.title as job_title,
        j.description as job_description,
        a.match_score,
        a.matching_skills,
        a.missing_skills,
        a.recommendations,
        a.cv_improvements
      FROM letters l
      LEFT JOIN jobs j ON l.job_id = j.id
      LEFT JOIN ats_analyses a ON a.letter_id = l.id
      WHERE l.candidate_id = ?
      ORDER BY l.created_at DESC
    `).all(req.params.candidateId);

    // Parse JSON fields
    const parsed = letters.map((letter: any) => ({
      ...letter,
      matching_skills: JSON.parse(letter.matching_skills || '[]'),
      missing_skills: JSON.parse(letter.missing_skills || '[]'),
      recommendations: JSON.parse(letter.recommendations || '[]'),
      cv_improvements: JSON.parse(letter.cv_improvements || '[]'),
    }));

    res.json({ letters: parsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single letter by ID
letterRoutes.get('/:id', (req: Request, res: Response) => {
  try {
    const letter = db.prepare(`
      SELECT 
        l.*,
        j.title as job_title,
        j.description as job_description,
        a.match_score,
        a.matching_skills,
        a.missing_skills,
        a.recommendations,
        a.cv_improvements
      FROM letters l
      LEFT JOIN jobs j ON l.job_id = j.id
      LEFT JOIN ats_analyses a ON a.letter_id = l.id
      WHERE l.id = ?
    `).get(req.params.id);

    if (!letter) {
      return res.status(404).json({ error: 'Letter not found' });
    }

    const l = letter as any;
    res.json({
      letter: {
        ...l,
        matching_skills: JSON.parse(l.matching_skills || '[]'),
        missing_skills: JSON.parse(l.missing_skills || '[]'),
        recommendations: JSON.parse(l.recommendations || '[]'),
        cv_improvements: JSON.parse(l.cv_improvements || '[]'),
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE letter
letterRoutes.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM letters WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Letter not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
