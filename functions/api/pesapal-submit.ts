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

    // OAuth 1.0 parameters
    const oauthCallback = callbackUrl;
    const oauthConsumerKey = PESAPAL_CONSUMER_KEY;
    const oauthSignatureMethod = 'HMAC-SHA1';
    const oauthTimestamp = Math.floor(Date.now() / 1000).toString();
    const oauthNonce = Math.random().toString(36).substring(2, 15) + Date.now();
    const oauthVersion = '1.0';

    // Build signature base string
    const httpMethod = 'GET';
    const baseUrl = 'https://www.pesapal.com/api/PostPesapalDirectOrderV4';

    // Collect all parameters for signature
    const allParams: Record<string, string> = {
      oauth_callback: oauthCallback,
      oauth_consumer_key: oauthConsumerKey,
      oauth_nonce: oauthNonce,
      oauth_signature_method: oauthSignatureMethod,
      oauth_timestamp: oauthTimestamp,
      oauth_version: oauthVersion,
      pesapal_request_data: xml,
    };

    // Sort and encode for signature
    const sortedParams = Object.keys(allParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
      .join('&');

    const signatureBaseString = `${httpMethod}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(PESAPAL_CONSUMER_SECRET)}&`;

    // Create HMAC-SHA1 signature
    const encoder = new TextEncoder();
    const key = encoder.encode(signingKey);
    const message = encoder.encode(signatureBaseString);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));

    // Build final URL with all OAuth params
    const urlParams = new URLSearchParams();
    urlParams.append('oauth_callback', oauthCallback);
    urlParams.append('oauth_consumer_key', oauthConsumerKey);
    urlParams.append('oauth_nonce', oauthNonce);
    urlParams.append('oauth_signature_method', oauthSignatureMethod);
    urlParams.append('oauth_timestamp', oauthTimestamp);
    urlParams.append('oauth_version', oauthVersion);
    urlParams.append('oauth_signature', base64Signature);
    urlParams.append('pesapal_request_data', xml);

    const fullUrl = `${baseUrl}?${urlParams.toString()}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' },
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
