export const onRequestPost = async (context: any) => {
  try {
    const body = await context.request.text();
    console.log('IPN Received:', body);

    // Parse the URL-encoded body
    const params = new URLSearchParams(body);
    const orderTrackingId = params.get('OrderTrackingId');
    const orderMerchantReference = params.get('OrderMerchantReference');

    if (!orderTrackingId) {
      return new Response('Missing OrderTrackingId', { status: 400 });
    }

    // Verify payment with PesaPal
    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = context.env;

    // Generate OAuth signature for status check
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15);

    const baseUrl = 'https://www.pesapal.com/api/querypaymentstatus';
    const signatureParams: Record<string, string> = {
      oauth_consumer_key: PESAPAL_CONSUMER_KEY,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
      pesapal_merchant_reference: orderMerchantReference || '',
      pesapal_transaction_tracking_id: orderTrackingId,
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

    // Build query URL
    const queryParams = new URLSearchParams();
    queryParams.append('oauth_consumer_key', PESAPAL_CONSUMER_KEY);
    queryParams.append('oauth_signature_method', 'HMAC-SHA1');
    queryParams.append('oauth_signature', oauthSignature);
    queryParams.append('oauth_timestamp', timestamp);
    queryParams.append('oauth_nonce', nonce);
    queryParams.append('oauth_version', '1.0');
    queryParams.append('pesapal_merchant_reference', orderMerchantReference || '');
    queryParams.append('pesapal_transaction_tracking_id', orderTrackingId);

    const statusUrl = `${baseUrl}?${queryParams.toString()}`;
    const statusRes = await fetch(statusUrl);
    const statusText = await statusRes.text();

    console.log('Payment Status:', statusText);

    // pesapal_response_data contains the status
    if (statusText.includes('COMPLETED')) {
      // Payment successful - update D1 database
      if (context.env.DB) {
        await context.env.DB.prepare(`
          UPDATE payments SET status = 'paid', tracking_id = ?, updated_at = datetime('now')
          WHERE merchant_ref = ?
        `).bind(orderTrackingId, orderMerchantReference).run();
      }
    }

    // Always return 200 to PesaPal
    return new Response('OK', { status: 200 });

  } catch (error: any) {
    console.error('IPN Error:', error.message);
    return new Response('OK', { status: 200 }); // Always return OK to PesaPal
  }
};
