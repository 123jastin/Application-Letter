import { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  PESAPAL_CONSUMER_KEY: string;
  PESAPAL_CONSUMER_SECRET: string;
  PESAPAL_BASE_URL: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_BASE_URL } = context.env;

  try {
    const { amount, currency, description, email, phone, country } = await context.request.json() as {
      amount: number;
      currency: string;
      description: string;
      email: string;
      phone: string;
      country: string;
    };

    const baseUrl = PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3';

    // Step 1: Get auth token
    const authResponse = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
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

    if (!authResponse.ok) {
      throw new Error(`Auth failed: ${authResponse.status}`);
    }

    const authData: any = await authResponse.json();
    const token = authData.token;

    // Step 2: Submit order
    const callbackUrl = `${context.request.headers.get('origin')}/api/pesapal-callback`;
    const merchantReference = `JR-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const orderResponse = await fetch(`${baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: merchantReference,
        currency: currency,
        amount: amount,
        description: description,
        callback_url: callbackUrl,
        notification_id: 'ALL',
        billing_address: {
          email_address: email,
          phone_number: phone,
          country_code: country === 'Tanzania' ? 'TZ' : 'US',
        },
      }),
    });

    if (!orderResponse.ok) {
      const errText = await orderResponse.text();
      throw new Error(`Order failed: ${errText}`);
    }

    const orderData: any = await orderResponse.json();

    return new Response(JSON.stringify({
      success: true,
      redirect_url: orderData.redirect_url,
      order_tracking_id: orderData.order_tracking_id,
      merchant_reference: orderData.merchant_reference,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Payment initiation failed',
      details: error.message,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
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
