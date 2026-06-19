import { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  PESAPAL_CONSUMER_KEY: string;
  PESAPAL_CONSUMER_SECRET: string;
  PESAPAL_BASE_URL: string;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_BASE_URL } = context.env;
  const url = new URL(context.request.url);
  const orderTrackingId = url.searchParams.get('OrderTrackingId');
  const orderMerchantReference = url.searchParams.get('OrderMerchantReference');

  if (!orderTrackingId) {
    return Response.redirect(`${url.origin}?payment=failed&reason=no_tracking_id`, 302);
  }

  try {
    const baseUrl = PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3';

    // Get auth token
    const authResponse = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONSUMER_KEY,
        consumer_secret: PESAPAL_CONSUMER_SECRET,
      }),
    });

    const authData: any = await authResponse.json();
    const token = authData.token;

    // Check transaction status
    const statusResponse = await fetch(
      `${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const statusData: any = await statusResponse.json();

    if (statusData.payment_status_description === 'COMPLETED') {
      // Payment successful - redirect back with success
      return Response.redirect(
        `${url.origin}?payment=success&ref=${orderMerchantReference}&tracking=${orderTrackingId}`,
        302
      );
    } else {
      return Response.redirect(
        `${url.origin}?payment=failed&reason=${statusData.payment_status_description}`,
        302
      );
    }

  } catch (error: any) {
    return Response.redirect(`${url.origin}?payment=error&reason=${encodeURIComponent(error.message)}`, 302);
  }
};
