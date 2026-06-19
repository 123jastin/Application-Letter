
export const onRequestPost = async (context: any) => {
  return new Response(JSON.stringify({
    success: true,
    message: 'PesaPal endpoint is working',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
