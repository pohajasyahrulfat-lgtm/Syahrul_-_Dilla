const SUPABASE_URL = 'https://hotizjscshmmabyojhhx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7lwxKeKavEOl8vS-syIqEQ_-NCebh-a';

/**
 * Fetch the published invitation without exposing a service-role secret.
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export const getInvitation = (slug) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/invitations`);
    url.searchParams.set('select', 'slug,groom_name,bride_name,event_date,location,description,timezone,is_published,groom_photo_url,bride_photo_url,audio_url');
    url.searchParams.set('slug', `eq.${slug}`);
    url.searchParams.set('is_published', 'eq.true');
    url.searchParams.set('limit', '1');

    return fetch(url, {
        headers: {
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
    }).then((response) => {
        if (!response.ok) {
            throw new Error(`Supabase request failed: ${response.status}`);
        }

        return response.json();
    }).then((rows) => rows[0] ?? null);
};
