export const onRequestPost = async (context: any) => {
  try {
    const data = await context.request.json();
    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = context.env;

    const amount = data.amount;
    const currency = data.currency;
    const phone = data.phone;
    const email = data.email;

    // Try SANDBOX first
    const baseUrl = 'https://cybqa.pesapal.com/v3';

    // Step 1: Get Auth Token
    const authRes = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
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
        error: 'Auth failed - check if keys are sandbox or live',
        details: JSON.stringify(authData),
        baseUrlUsed: baseUrl,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const token = authData.token;
    const merchantRef = `JR-${Date.now()}`;
    const callbackUrl = `https://coverletter.jobsreport.online/api/pesapal-callback`;

    const orderRes = await fetch(`${baseUrl}/api/Transactions/SubmitOrderRequest`, {
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
        notification_id: 'ALL',
        redirect_mode: 'TOP_WINDOW',
        billing_address: {
          email_address: email || 'customer@jobsreport.online',
          phone_number: phone,
        },
      }),
    });

    const orderData: any = await orderRes.json();

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
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
