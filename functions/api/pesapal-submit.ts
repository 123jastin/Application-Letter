
export const onRequestPost = async (context: any) => {
  try {
    const data = await context.request.json();
    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = context.env;

    const amount = data.amount || 1000;
    const currency = data.currency || 'TZS';
    const phone = data.phone || '255000000000';
    const email = data.email || 'test@test.com';

    const merchantRef = `JR-${Date.now()}`;
    const callbackUrl = `https://coverletter.jobsreport.online/api/pesapal-callback`;

    // OAuth parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: PESAPAL_CONSUMER_KEY,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_signature: PESAPAL_CONSUMER_SECRET + '&',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: Math.random().toString(36).substring(2, 15),
      oauth_version: '1.0',
      oauth_callback: callbackUrl,
    };

    // Build XML
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<PesapalDirectOrderInfo 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
  Amount="${amount}" 
  Description="Application Letter" 
  Type="MERCHANT" 
  Reference="${merchantRef}" 
  FirstName="" 
  LastName="" 
  Email="${email}" 
  PhoneNumber="${phone}" 
  Currency="${currency}"
  xmlns="http://www.pesapal.com" />`;

    // Build URL with OAuth params
    const baseUrl = 'https://www.pesapal.com/api/PostPesapalDirectOrderV4';
    const oauthString = Object.entries(oauthParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const fullUrl = `${baseUrl}?${oauthString}&pesapal_request_data=${encodeURIComponent(xml)}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
      },
    });

    const responseText = await response.text();

    if (responseText.startsWith('http')) {
      return new Response(JSON.stringify({
        success: true,
        redirect_url: responseText,
        merchant_reference: merchantRef,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Unexpected response',
      details: responseText.substring(0, 500),
    }), {
      status: 500,
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};
