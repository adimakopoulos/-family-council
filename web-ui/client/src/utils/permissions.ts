import type { Proposal, You } from '../types';

export const isPending = (p: Proposal) =>
  p.status === 'pending' || p.status === 'open';

export const isArchived = (p: Proposal) => !isPending(p);

// “Admin (alex)” — allow either the app’s admin flag or the literal name.
export const isAdminAlex = (you: You) =>
  Boolean(you?.isAdmin) || (you?.name ?? '').toLowerCase() === 'alex';

export const canEditPending = (p: Proposal, you: You) =>
  isPending(p) && p.author === you.name;

export const canDeletePending = canEditPending;

export const canEditArchive = (p: Proposal, you: You) =>
  isArchived(p) && isAdminAlex(you);

export const canDeleteArchive = canEditArchive;
