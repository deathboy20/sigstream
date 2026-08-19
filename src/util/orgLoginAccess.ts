export interface OrgLoginAccess {
  twoStepOrganizationalTeam: boolean;
  threeStepPersonnelFeature: boolean;
}

export const DEFAULT_ORG_LOGIN_ACCESS: OrgLoginAccess = {
  twoStepOrganizationalTeam: false,
  threeStepPersonnelFeature: true,
};

export const ORG_LOGIN_ACCESS_STORAGE_KEY = 'organizationLoginAccess';

export function normalizeLoginAccess(raw: unknown): OrgLoginAccess {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ORG_LOGIN_ACCESS };
  const value = raw as Record<string, unknown>;
  const two = value.twoStepOrganizationalTeam === true;
  const three = value.threeStepPersonnelFeature === true;
  if (three && !two) return { twoStepOrganizationalTeam: false, threeStepPersonnelFeature: true };
  if (two && !three) return { twoStepOrganizationalTeam: true, threeStepPersonnelFeature: false };
  if (three) return { twoStepOrganizationalTeam: false, threeStepPersonnelFeature: true };
  if (two) return { twoStepOrganizationalTeam: true, threeStepPersonnelFeature: false };
  return { ...DEFAULT_ORG_LOGIN_ACCESS };
}

export function extractLoginAccess(data: Record<string, unknown> | null | undefined): OrgLoginAccess {
  if (!data) return { ...DEFAULT_ORG_LOGIN_ACCESS };
  if (data.loginAccess) return normalizeLoginAccess(data.loginAccess);
  const config = data.config;
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config) as { loginAccess?: unknown };
      if (parsed?.loginAccess) return normalizeLoginAccess(parsed.loginAccess);
    } catch {
      /* ignore */
    }
  } else if (config && typeof config === 'object' && 'loginAccess' in config) {
    return normalizeLoginAccess((config as { loginAccess?: unknown }).loginAccess);
  }
  return { ...DEFAULT_ORG_LOGIN_ACCESS };
}

export function persistOrgLoginAccess(access: OrgLoginAccess): void {
  if (typeof window === 'undefined') return;
  const json = JSON.stringify(normalizeLoginAccess(access));
  try {
    localStorage.setItem(ORG_LOGIN_ACCESS_STORAGE_KEY, json);
    sessionStorage.setItem(ORG_LOGIN_ACCESS_STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
}

export function readOrgLoginAccess(): OrgLoginAccess {
  if (typeof window === 'undefined') return { ...DEFAULT_ORG_LOGIN_ACCESS };
  try {
    const raw =
      sessionStorage.getItem(ORG_LOGIN_ACCESS_STORAGE_KEY) ||
      localStorage.getItem(ORG_LOGIN_ACCESS_STORAGE_KEY);
    if (raw) return normalizeLoginAccess(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_ORG_LOGIN_ACCESS };
}

export function requiresPersonnelFeatureLogin(
  loginAccess?: OrgLoginAccess | null,
  userType?: string | null
): boolean {
  const type =
    userType ??
    (typeof window !== 'undefined'
      ? sessionStorage.getItem('userType') ?? localStorage.getItem('userType')
      : null);
  if (String(type || '').toLowerCase() === 'admin') return false;
  const access = loginAccess ?? readOrgLoginAccess();
  return access.threeStepPersonnelFeature === true;
}

export function isFeatureAccessAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('featureAccessAuth') === 'true' && !!sessionStorage.getItem('featureAccessUser');
}
