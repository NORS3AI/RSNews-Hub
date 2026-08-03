import { NextResponse } from 'next/server';
import { createUser, emailExists } from '@/lib/users';
import { createSession } from '@/lib/auth';

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json');

  let name = '';
  let email = '';
  let password = '';
  if (wantsJson) {
    const body = await req.json().catch(() => ({}));
    name = body.name || '';
    email = body.email || '';
    password = body.password || '';
  } else {
    const form = await req.formData();
    name = String(form.get('name') || '');
    email = String(form.get('email') || '');
    password = String(form.get('password') || '');
  }

  name = name.trim();
  email = email.trim().toLowerCase();

  if (!name || !email || password.length < 6) {
    return fail(wantsJson, req, 'Name, email and a password of at least 6 characters are required.');
  }
  if (emailExists(email)) {
    return fail(wantsJson, req, 'An account with that email already exists.');
  }

  const user = createUser({ name, email, password, role: 'user' });
  await createSession(user.id);

  if (wantsJson) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL('/dashboard', req.url), 303);
}

function fail(wantsJson: boolean, req: Request, message: string) {
  if (wantsJson) return NextResponse.json({ ok: false, error: message }, { status: 400 });
  const url = new URL('/register', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}
