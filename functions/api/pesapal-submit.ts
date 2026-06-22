export const onRequestPost = async (context: any) => {
  try {
    const data = await context.request.json();
    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = context.env;

    const amount = data.amount || 1000;
    const currency = data.currency || 'TZS';
    const phone = data.phone || '';
    const email = data.email || '';

    const merchantRef = `JR-${Date.now()}`;
    const callbackUrl = `https://coverletter.jobsreport.online/?payment=callback`;

    // Build XML
    const xml = `<?xml version="1.0" encoding="utf-8"?><PesapalDirectOrderInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" Amount="${amount}" Currency="${currency}" Description="Application Letter Generation" Type="MERCHANT" Reference="${merchantRef}" FirstName="" LastName="" Email="${email}" PhoneNumber="${phone}" xmlns="http://www.pesapal.com" />`;

    // Generate OAuth parameters
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const baseUrl = 'https://www.pesapal.com/api/PostPesapalDirectOrderV4';

    const signatureParams: Record<string, string> = {
      oauth_callback: callbackUrl,
      oauth_consumer_key: PESAPAL_CONSUMER_KEY,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
      pesapal_request_data: xml,
    };

    const sortedKeys = Object.keys(signatureParams).sort();
    const paramString = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(signatureParams[k])}`)
      .join('&');

    const signatureBaseString = `GET&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(PESAPAL_CONSUMER_SECRET)}&`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingKey);
    const messageData = encoder.encode(signatureBaseString);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const oauthSignature = btoa(String.fromCharCode(...new Uint8Array(sig)));

    // Build the full URL for browser redirect
    const redirectParams = new URLSearchParams();
    redirectParams.append('oauth_callback', callbackUrl);
    redirectParams.append('oauth_consumer_key', PESAPAL_CONSUMER_KEY);
    redirectParams.append('oauth_signature_method', 'HMAC-SHA1');
    redirectParams.append('oauth_signature', oauthSignature);
    redirectParams.append('oauth_timestamp', timestamp);
    redirectParams.append('oauth_nonce', nonce);
    redirectParams.append('oauth_version', '1.0');
    redirectParams.append('pesapal_request_data', xml);

    const pesapalUrl = `${baseUrl}?${redirectParams.toString()}`;

    return new Response(JSON.stringify({
      success: true,
      redirect_url: pesapalUrl,
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
