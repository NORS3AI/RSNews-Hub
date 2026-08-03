import { NextResponse } from 'next/server';
import { getUserByEmail, verifyPassword } from '@/lib/users';
import { createSession } from '@/lib/auth';

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  let email = '';
  let password = '';
  let wantsJson = contentType.includes('application/json');

  if (wantsJson) {
    const body = await req.json().catch(() => ({}));
    email = body.email || '';
    password = body.password || '';
  } else {
    const form = await req.formData();
    email = String(form.get('email') || '');
    password = String(form.get('password') || '');
  }

  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password)) {
    return fail(wantsJson, req, 'Invalid email or password.');
  }
  if (user.status === 'banned') {
    return fail(wantsJson, req, 'This account has been banned.');
  }

  await createSession(user.id);

  if (wantsJson) {
    return NextResponse.json({ ok: true, role: user.role });
  }
  const dest = user.role === 'admin' || user.role === 'editor' ? '/admin' : '/dashboard';
  return NextResponse.redirect(new URL(dest, req.url), 303);
}

function fail(wantsJson: boolean, req: Request, message: string) {
  if (wantsJson) {
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
  const url = new URL('/login', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}
