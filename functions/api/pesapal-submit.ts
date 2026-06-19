// functions/api/pesapal-submit.ts
export const onRequestPost = async (context: any) => {
  try {
    const data = await context.request.json();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Endpoint working',
      received: data,
      hasKey: !!context.env?.PESAPAL_CONSUMER_KEY,
      hasSecret: !!context.env?.PESAPAL_CONSUMER_SECRET,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const onRequestOptions = async () => {
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
