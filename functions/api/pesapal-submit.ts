export const onRequestGet = async (context: any) => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const onRequestPost = async (context: any) => {
  try {
    const data = await context.request.json();
    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = context.env;
    
    const amount = data.amount;
    const currency = data.currency;
    const email = data.email;
    const phone = data.phone;
    const description = data.description;

    // For now, return a simulated success to test the flow
    // We'll add real PesaPal integration once the flow works
    const redirectUrl = `https://coverletter.jobsreport.online/?payment=success&ref=test-${Date.now()}&tracking=test-${Date.now()}`;

    return new Response(JSON.stringify({
      success: true,
      redirect_url: redirectUrl,
      order_tracking_id: `test-${Date.now()}`,
      merchant_reference: `test-${Date.now()}`,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

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
