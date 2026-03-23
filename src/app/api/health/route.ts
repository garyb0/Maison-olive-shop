export async function GET() {
  return Response.json({ ok: true, service: "maison-olive-shop" }, { status: 200 });
}
