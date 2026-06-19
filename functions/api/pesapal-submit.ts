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

    // Build XML for V1
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

    // Post to V1 endpoint
    const formData = new URLSearchParams();
    formData.append('oauth_consumer_key', PESAPAL_CONSUMER_KEY);
    formData.append('oauth_callback', callbackUrl);
    formData.append('pesapal_request_data', xml);

    const response = await fetch('https://www.pesapal.com/api/PostPesapalDirectOrderV4', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const responseText = await response.text();

    // V1 returns a URL directly
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
      error: 'Unexpected response from PesaPal',
      details: responseText,
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
