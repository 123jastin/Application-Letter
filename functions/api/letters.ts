import { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

// GET /api/letters?candidateId=xxx
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const candidateId = url.searchParams.get('candidateId');
  const letterId = url.searchParams.get('id');

  try {
    if (letterId) {
      // Get single letter
      const letter = await DB.prepare(`
        SELECT l.*, a.match_score, a.matching_skills, a.missing_skills, 
               a.recommendations, a.cv_improvements
        FROM letters l
        LEFT JOIN ats_analyses a ON a.letter_id = l.id
        WHERE l.id = ?
      `).bind(letterId).first();

      if (!letter) {
        return new Response(JSON.stringify({ error: 'Letter not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response(JSON.stringify({ letter: formatLetter(letter) }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (candidateId) {
      // Get all letters for candidate
      const { results } = await DB.prepare(`
        SELECT l.*, a.match_score, a.matching_skills, a.missing_skills,
               a.recommendations, a.cv_improvements
        FROM letters l
        LEFT JOIN ats_analyses a ON a.letter_id = l.id
        WHERE l.candidate_id = ?
        ORDER BY l.created_at DESC
        LIMIT 50
      `).bind(candidateId).all();

      return new Response(JSON.stringify({
        letters: results.map(formatLetter),
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ error: 'Provide candidateId or id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

// DELETE /api/letters?id=xxx
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const letterId = url.searchParams.get('id');

  if (!letterId) {
    return new Response(JSON.stringify({ error: 'Letter ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    await DB.prepare('DELETE FROM letters WHERE id = ?').bind(letterId).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

function formatLetter(row: any) {
  return {
    ...row,
    matching_skills: JSON.parse(row.matching_skills || '[]'),
    missing_skills: JSON.parse(row.missing_skills || '[]'),
    recommendations: JSON.parse(row.recommendations || '[]'),
    cv_improvements: JSON.parse(row.cv_improvements || '[]'),
  };
}
