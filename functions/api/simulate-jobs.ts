import { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

// GET /api/simulate-jobs
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const { results } = await DB.prepare(`
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

    return new Response(JSON.stringify({ jobs: results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ jobs: [], error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
