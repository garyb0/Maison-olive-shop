export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "maison-olive-shop",
      version: process.env.npm_package_version ?? "0.0.0",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
