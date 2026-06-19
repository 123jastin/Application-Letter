export const onRequestGet = async (context: any) => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const onRequestPost = async (context: any) => {
  const steps: string[] = [];

  try {
    const data = await context.request.json();
    steps.push('1. Received data');

    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = context.env;

    // Check keys exist
    steps.push(`2. Key exists: ${!!PESAPAL_CONSUMER_KEY}`);
    steps.push(`3. Secret exists: ${!!PESAPAL_CONSUMER_SECRET}`);

    if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
      return new Response(JSON.stringify({
        error: 'Missing PesaPal credentials in environment',
        steps: steps,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Try LIVE
    steps.push('4. Trying LIVE: pay.pesapal.com/v3');
    const baseUrl = 'https://pay.pesapal.com/v3';

    const authRes = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONSUMER_KEY,
        consumer_secret: PESAPAL_CONSUMER_SECRET,
      }),
    });

    steps.push(`5. Auth status: ${authRes.status}`);
    const authText = await authRes.text();
    steps.push(`6. Auth response: ${authText.substring(0, 200)}`);

    let authData: any;
    try {
      authData = JSON.parse(authText);
    } catch {
      return new Response(JSON.stringify({
        error: 'Auth response not JSON',
        response: authText.substring(0, 500),
        steps: steps,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // If LIVE fails, try SANDBOX
    if (!authData.token) {
      steps.push('7. LIVE failed. Trying SANDBOX: cybqa.pesapal.com/v3');
      const sandboxUrl = 'https://cybqa.pesapal.com/v3';
      
      const sandboxAuthRes = await fetch(`${sandboxUrl}/api/Auth/RequestToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          consumer_key: PESAPAL_CONSUMER_KEY,
          consumer_secret: PESAPAL_CONSUMER_SECRET,
        }),
      });

      steps.push(`8. Sandbox auth status: ${sandboxAuthRes.status}`);
      const sandboxAuthText = await sandboxAuthRes.text();
      steps.push(`9. Sandbox auth response: ${sandboxAuthText.substring(0, 200)}`);

      try {
        authData = JSON.parse(sandboxAuthText);
      } catch {
        return new Response(JSON.stringify({
          error: 'Both LIVE and SANDBOX auth failed',
          liveResponse: authText.substring(0, 300),
          sandboxResponse: sandboxAuthText.substring(0, 300),
          steps: steps,
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (!authData.token) {
        return new Response(JSON.stringify({
          error: 'Auth failed on both LIVE and SANDBOX',
          details: authData,
          steps: steps,
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    steps.push('10. Auth success! Creating order...');
    const token = authData.token;

    // Submit order
    const orderRes = await fetch(`${authData.token ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/v3'}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: `JR-${Date.now()}`,
        currency: data.currency || 'TZS',
        amount: Number(data.amount) || 1000,
        description: 'Application Letter',
        callback_url: 'https://coverletter.jobsreport.online/api/pesapal-callback',
        notification_id: 'ALL',
        redirect_mode: 'TOP_WINDOW',
        billing_address: {
          email_address: data.email || 'test@test.com',
          phone_number: data.phone || '255000000000',
        },
      }),
    });

    steps.push(`11. Order status: ${orderRes.status}`);
    const orderText = await orderRes.text();
    steps.push(`12. Order response: ${orderText.substring(0, 300)}`);

    const orderData = JSON.parse(orderText);

    if (orderData.error) {
      return new Response(JSON.stringify({
        error: 'Order creation failed',
        details: orderData,
        steps: steps,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      redirect_url: orderData.redirect_url,
      order_tracking_id: orderData.order_tracking_id,
      merchant_reference: orderData.merchant_reference,
      steps: steps,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
      steps: steps,
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
