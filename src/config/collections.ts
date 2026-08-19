type DataTag = 'staging' | 'prod';

const rawTag = String(import.meta.env.VITE_DATA_TAG || import.meta.env.VITE_ENV || '').toLowerCase();
const TAG: DataTag = rawTag === 'prod' ? 'prod' : 'staging';

export const TEAMS_COLLECTION = `${TAG}-teams`;
export const CONFIG_COLLECTION = `${TAG}-config`;
export const FEATURE_ACCESS_LOGIN_COLLECTION = `${TAG}-featureAccessLogin`;
export const TELE_MEET_COLLECTION = import.meta.env.VITE_MEETINGS_COLLECTION || 'tele-meet-sandbox';
