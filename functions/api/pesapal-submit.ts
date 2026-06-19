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
    const phone = data.phone;
    const email = data.email;

    // Step 1: Get Auth Token
    const authRes = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONSUMER_KEY,
        consumer_secret: PESAPAL_CONSUMER_SECRET,
      }),
    });

    const authData: any = await authRes.json();

    if (!authData.token) {
      return new Response(JSON.stringify({
        error: 'Auth failed',
        details: JSON.stringify(authData),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const token = authData.token;
    const merchantRef = `JR-${Date.now()}`;
    const callbackUrl = `https://coverletter.jobsreport.online/api/pesapal-callback`;
    const origin = 'https://coverletter.jobsreport.online';

    // Step 2: Submit Order
    const orderRes = await fetch('https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: merchantRef,
        currency: currency,
        amount: Number(amount),
        description: 'Application Letter Generation',
        callback_url: callbackUrl,
        cancellation_url: origin,
        notification_id: 'ALL',
        redirect_mode: 'TOP_WINDOW',
        billing_address: {
          email_address: email || 'customer@jobsreport.online',
          phone_number: phone,
        },
      }),
    });

    const orderData: any = await orderRes.json();

    if (orderData.error) {
      return new Response(JSON.stringify({
        error: 'Order failed',
        details: JSON.stringify(orderData),
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
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Payment initiation failed',
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
