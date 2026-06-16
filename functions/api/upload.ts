import { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
};

// POST /api/upload - Upload image
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB, MEDIA_BUCKET } = context.env;

  try {
    const contentType = context.request.headers.get('content-type') || '';

    // Handle FormData upload (actual files)
    if (contentType.includes('multipart/form-data')) {
      const formData = await context.request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const altText = (formData.get('altText') as string) || '';
      const name = (formData.get('name') as string) || file.name;
      
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const extension = file.name.split('.').pop() || 'png';
      const filename = `${timestamp}-${randomString}.${extension}`;
      const id = `media-${timestamp}-${randomString}`;

      const arrayBuffer = await file.arrayBuffer();
      
      // Upload to R2
      await MEDIA_BUCKET.put(filename, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        }
      });

      const publicUrl = `https://media.jobsreport.online/${filename}`;
      const sizeInKB = Math.round(file.size / 1024);
      const size = sizeInKB > 1024 ? `${Math.round(sizeInKB / 1024)}MB` : `${sizeInKB}KB`;

      // Save metadata to D1
      await DB.prepare(`
        INSERT INTO media (id, name, type, url, size, alt_text, storage_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'r2', ?)
      `).bind(
        id, 
        name, 
        file.type, 
        publicUrl, 
        size, 
        altText || name, 
        new Date().toISOString()
      ).run();

      return new Response(JSON.stringify({
        id,
        name,
        type: file.type,
        dataUrl: publicUrl,
        url: publicUrl,
        size,
        altText: altText || name,
        storageType: 'r2',
        uploadedAt: new Date().toISOString().split('T')[0]
      }), {
        status: 201,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Handle JSON upload (base64 fallback)
    const body: any = await context.request.json();
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const id = `media-${timestamp}-${randomString}`;
    const filename = `${timestamp}-${randomString}.png`;
    
    let publicUrl = body.dataUrl;
    
    // Try to upload to R2 if available
    if (MEDIA_BUCKET && body.dataUrl && body.dataUrl.includes('base64')) {
      try {
        const base64Data = body.dataUrl.split(',')[1] || body.dataUrl;
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        await MEDIA_BUCKET.put(filename, binaryData, {
          httpMetadata: { contentType: 'image/png' }
        });
        publicUrl = `https://media.jobsreport.online/${filename}`;
      } catch (r2Err) {
        console.log('R2 upload failed, using base64 fallback');
      }
    }

    await DB.prepare(`
      INSERT INTO media (id, name, type, url, size, alt_text, storage_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name || 'image.png',
      body.type || 'image/png',
      publicUrl,
      body.size || 'Unknown',
      body.altText || body.name || 'Image',
      MEDIA_BUCKET ? 'r2' : 'base64',
      new Date().toISOString()
    ).run();

    return new Response(JSON.stringify({
      id,
      name: body.name,
      type: body.type || 'image/png',
      dataUrl: publicUrl,
      url: publicUrl,
      size: body.size || 'Unknown',
      altText: body.altText || body.name,
      storageType: MEDIA_BUCKET ? 'r2' : 'base64',
      uploadedAt: new Date().toISOString().split('T')[0]
    }), {
      status: 201,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error('Upload Error:', err);
    return new Response(JSON.stringify({ 
      error: 'Failed to upload file',
      details: err instanceof Error ? err.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

// GET /api/upload - List all media
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const result = await DB.prepare(`
      SELECT * FROM media 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all();

    const media = result.results.map((m: any) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      dataUrl: m.url,
      url: m.url,
      size: m.size,
      altText: m.alt_text,
      storageType: m.storage_type,
      uploadedAt: m.created_at?.split('T')[0] || 'Unknown'
    }));

    return new Response(JSON.stringify(media), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error('Media List Error:', err);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

// DELETE /api/upload/[id] - Delete media
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { DB, MEDIA_BUCKET } = context.env;
  const url = new URL(context.request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  if (!id || id === 'upload') {
    return new Response(JSON.stringify({ error: 'No media ID provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const media = await DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
    
    if (!media) {
      return new Response(JSON.stringify({ error: 'Media not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Delete from R2 if stored there
    if (media.storage_type === 'r2') {
      const filename = media.url.split('/').pop();
      if (filename) {
        try {
          await MEDIA_BUCKET.delete(filename);
        } catch (r2Err) {
          console.error('R2 delete error:', r2Err);
        }
      }
    }

    // Delete from database
    await DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true, deleted: id }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error('Media Delete Error:', err);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete media',
      details: err instanceof Error ? err.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
};
