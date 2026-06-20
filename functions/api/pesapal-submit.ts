export const onRequestPost = async (context: any) => {
  try {
    const data = await context.request.json();
    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = context.env;

    const amount = data.amount || 1000;
    const currency = data.currency || 'TZS';
    const phone = data.phone || '255750000000';
    const email = data.email || 'chapchapuhr@gmail.com';

    const merchantRef = `JR-${Date.now()}`;
    const callbackUrl = `https://coverletter.jobsreport.online/api/pesapal-callback`;

    const xml = `<PesapalDirectOrderInfo xmlns="http://www.pesapal.com" Amount="${amount}" Description="Letter" Type="MERCHANT" Reference="${merchantRef}" Email="${email}" PhoneNumber="${phone}" Currency="${currency}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" />`;

    // Try POST method with form data
    const formBody = new URLSearchParams();
    formBody.append('oauth_consumer_key', PESAPAL_CONSUMER_KEY);
    formBody.append('oauth_callback', callbackUrl);
    formBody.append('pesapal_request_data', xml);

    const res = await fetch('https://www.pesapal.com/api/PostPesapalDirectOrderV4', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
      },
      body: formBody.toString(),
    });

    const text = await res.text();

    return new Response(JSON.stringify({
      success: true,
      response: text.substring(0, 1000),
      status: res.status,
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
