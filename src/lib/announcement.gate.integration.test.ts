// Integration test for the announcement bar's audience gate. A message gated to
// an audience (e.g. PackageHub) must be filtered server-side in getLiveAnnouncement
// so it's never sent to a viewer who isn't in that audience. Hits the real dev/CI
// DB; the created row and the two announcement settings are restored afterwards.

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { prisma } from './db';
import {
  upsertAnnouncement, deleteAnnouncement, setLiveAnnouncement, setAnnouncementEnabled,
  getLiveAnnouncement, getAnnouncementState,
} from './announcement';
import type { AccountLike } from './entitlements';

let priorEnabled = false;
let priorLiveId = '';
const made: string[] = [];

beforeAll(async () => {
  const s = await getAnnouncementState();
  priorEnabled = s.enabled; priorLiveId = s.liveId;
});
afterAll(async () => {
  if (made.length) await prisma.announcement.deleteMany({ where: { id: { in: made } } });
  await setAnnouncementEnabled(priorEnabled);
  await setLiveAnnouncement(priorLiveId);
});

async function liveGatedTo(audience: string): Promise<string> {
  const id = await upsertAnnouncement({ message: `gate ${audience || 'all'}`, audience });
  made.push(id);
  await setLiveAnnouncement(id);
  await setAnnouncementEnabled(true);
  return id;
}

describe('announcement audience gate', () => {
  it('a PackageHub-only bar is hidden from a signed-out visitor and a basic member', async () => {
    await liveGatedTo('packagehub');
    expect(await getLiveAnnouncement(null)).toBeNull();
    const basic: AccountLike = { accountType: 'MEMBER', tier: 'basic', affiliations: '' };
    expect(await getLiveAnnouncement(basic)).toBeNull();
  });

  it('a PackageHub member sees the PackageHub-only bar', async () => {
    const id = await liveGatedTo('packagehub');
    const member: AccountLike = { accountType: 'MEMBER', affiliations: 'packagehub' };
    const live = await getLiveAnnouncement(member);
    expect(live?.id).toBe(id);
    expect(live?.audience).toBe('packagehub');
  });

  it('an ungated bar shows to everyone, including signed-out', async () => {
    const id = await liveGatedTo('');
    expect((await getLiveAnnouncement(null))?.id).toBe(id);
  });

  it('turning the bar off hides even an ungated live message', async () => {
    await liveGatedTo('');
    await setAnnouncementEnabled(false);
    expect(await getLiveAnnouncement(null)).toBeNull();
  });
});
