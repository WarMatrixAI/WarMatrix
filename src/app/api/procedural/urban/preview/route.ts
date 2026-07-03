import { NextResponse } from 'next/server';

const SIM_SERVER_BASE = process.env.SIM_SERVER_BASE_URL || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/backend` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/backend` : 'http://127.0.0.1:8001'));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${SIM_SERVER_BASE}/api/procedural/urban/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'simulation_backend_offline', details: err.message },
      { status: 503 }
    );
  }
}
