export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url);
  const orderTrackingId = url.searchParams.get('OrderTrackingId');
  const orderMerchantReference = url.searchParams.get('OrderMerchantReference');

  const origin = 'https://coverletter.jobsreport.online';

  if (!orderTrackingId) {
    return Response.redirect(`${origin}?payment=failed`, 302);
  }

  try {
    const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET } = context.env;

    // Get token
    const authRes = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONSUMER_KEY,
        consumer_secret: PESAPAL_CONSUMER_SECRET,
      }),
    });

    const authData: any = await authRes.json();

    // Check status
    const statusRes = await fetch(
      `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authData.token}`,
        },
      }
    );

    const statusData: any = await statusRes.json();

    if (statusData.payment_status_description === 'COMPLETED') {
      return Response.redirect(`${origin}?payment=success&ref=${orderMerchantReference}`, 302);
    } else {
      return Response.redirect(`${origin}?payment=failed`, 302);
    }

  } catch (error: any) {
    return Response.redirect(`${origin}?payment=error`, 302);
  }
};
