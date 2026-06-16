import { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

// POST /api/candidates - Create/Update candidate
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const data: any = await context.request.json();

    const id = `candidate-${Date.now()}`;

    await DB.prepare(`
      INSERT INTO candidates (id, email, full_name, phone, address, highest_education,
        years_of_experience, current_position, key_skills, signature_text, signature_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        full_name = excluded.full_name,
        phone = excluded.phone,
        address = excluded.address,
        highest_education = excluded.highest_education,
        years_of_experience = excluded.years_of_experience,
        current_position = excluded.current_position,
        key_skills = excluded.key_skills,
        signature_text = excluded.signature_text,
        signature_image = excluded.signature_image,
        updated_at = datetime('now')
    `).bind(
      id,
      data.email,
      data.fullName,
      data.phone,
      data.address,
      data.highestEducation,
      data.yearsOfExperience || 0,
      data.currentPosition,
      JSON.stringify(data.keySkills || []),
      data.signatureText || null,
      data.signatureImage || null
    ).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

// GET /api/candidates?email=xxx
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const candidate = await DB.prepare(
      'SELECT * FROM candidates WHERE email = ?'
    ).bind(email).first();

    if (!candidate) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ candidate }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
