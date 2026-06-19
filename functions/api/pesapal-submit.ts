// Handle GET requests (browser direct access)
export const onRequestGet = async (context: any) => {
  return new Response(JSON.stringify({
    success: true,
    message: 'PesaPal endpoint is working (GET)',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

// Handle POST requests (from the app)
export const onRequestPost = async (context: any) => {
  return new Response(JSON.stringify({
    success: true,
    message: 'PesaPal endpoint is working (POST)',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

// Handle OPTIONS (CORS preflight)
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};
