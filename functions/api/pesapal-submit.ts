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

    const xml = `<?xml version="1.0" encoding="utf-8"?><PesapalDirectOrderInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" Amount="${amount}" Description="Application Letter" Type="MERCHANT" Reference="${merchantRef}" FirstName="" LastName="" Email="${email}" PhoneNumber="${phone}" Currency="${currency}" xmlns="http://www.pesapal.com" />`;

    // Generate OAuth 1.0 parameters
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Build the signature base string for POST
    const httpMethod = 'POST';
    const baseUrl = 'https://www.pesapal.com/api/PostPesapalDirectOrderV4';

    // All parameters for signature
    const signatureParams: Record<string, string> = {
      oauth_consumer_key: PESAPAL_CONSUMER_KEY,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      oauth_callback: callbackUrl,
      pesapal_request_data: xml,
    };

    // Sort and encode
    const sortedKeys = Object.keys(signatureParams).sort();
    const paramString = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(signatureParams[k])}`)
      .join('&');

    const signatureBaseString = `${httpMethod}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(PESAPAL_CONSUMER_SECRET)}&`;

    // Create HMAC-SHA1 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingKey);
    const messageData = encoder.encode(signatureBaseString);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const oauthSignature = btoa(String.fromCharCode(...new Uint8Array(sig)));

    // Build POST body with ALL OAuth parameters
    const formBody = new URLSearchParams();
    formBody.append('oauth_consumer_key', PESAPAL_CONSUMER_KEY);
    formBody.append('oauth_signature_method', 'HMAC-SHA1');
    formBody.append('oauth_signature', oauthSignature);
    formBody.append('oauth_timestamp', timestamp);
    formBody.append('oauth_nonce', nonce);
    formBody.append('oauth_version', '1.0');
    formBody.append('oauth_callback', callbackUrl);
    formBody.append('pesapal_request_data', xml);

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
      },
      body: formBody.toString(),
    });

    const text = await res.text();

    if (text.startsWith('http')) {
      return new Response(JSON.stringify({
        success: true,
        redirect_url: text,
        merchant_reference: merchantRef,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      response: text.substring(0, 1000),
      merchant_reference: merchantRef,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
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
