const SUPABASE_URL = 'https://hotizjscshmmabyojhhx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7lwxKeKavEOl8vS-syIqEQ_-NCebh-a';
const API_HEADERS = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
};
const SESSION_KEY = 'supabase-admin-session';

const request = (path, options = {}) => fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
        ...API_HEADERS,
        ...(options.headers ?? {}),
    },
});

const getSession = () => {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    } catch {
        return null;
    }
};

const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
const clearSession = () => localStorage.removeItem(SESSION_KEY);
const tokenHeaders = () => ({ Authorization: `Bearer ${getSession()?.access_token ?? ''}` });

const notify = (message, type = 'success') => {
    if (window.undangan?.util?.notify) {
        window.undangan.util.notify(message)[type]();
        return;
    }

    window.alert(message);
};

const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
        element.value = value ?? '';
    }
};

const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value ?? '';
    }
};

const getInvitation = async (ownerId) => {
    const query = new URLSearchParams({
        select: '*',
        owner_id: `eq.${ownerId}`,
        limit: '1',
    });
    const response = await request(`/rest/v1/invitations?${query}`, { headers: tokenHeaders() });
    if (!response.ok) {
        throw new Error('Tidak dapat mengambil data undangan.');
    }

    return (await response.json())[0] ?? null;
};

const updateInvitation = async (id, values) => {
    const response = await request(`/rest/v1/invitations?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...tokenHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify(values),
    });
    if (!response.ok) {
        throw new Error('Data undangan gagal disimpan.');
    }
};

const uploadAsset = async (file, ownerId, type) => {
    if (!file) {
        return '';
    }

    const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${ownerId}/${type}-${Date.now()}.${extension}`;
    const response = await request(`/storage/v1/object/invitation-assets/${path}`, {
        method: 'POST',
        headers: { ...tokenHeaders(), 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
        body: file,
    });
    if (!response.ok) {
        throw new Error(`Upload ${type} gagal.`);
    }

    return `${SUPABASE_URL}/storage/v1/object/public/invitation-assets/${path}`;
};

const loadForm = (invitation, email) => {
    setText('dashboard-email', email);
    setText('dashboard-name', invitation.groom_name && invitation.bride_name
        ? `${invitation.groom_name} & ${invitation.bride_name}`
        : invitation.slug);
    setValue('invitation-slug', invitation.slug);
    setValue('invitation-groom-name', invitation.groom_name);
    setValue('invitation-bride-name', invitation.bride_name);
    setValue('invitation-date', invitation.event_date ? invitation.event_date.slice(0, 16) : '');
    setValue('invitation-location', invitation.location);
    setValue('invitation-description', invitation.description);
    setValue('invitation-timezone', invitation.timezone);
    setText('invitation-groom-photo-current', invitation.groom_photo_url ? 'Foto tersimpan' : 'Belum ada foto');
    setText('invitation-bride-photo-current', invitation.bride_photo_url ? 'Foto tersimpan' : 'Belum ada foto');
    setText('invitation-audio-current', invitation.audio_url ? 'Musik tersimpan' : 'Belum ada musik');
};

const login = async (button) => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    button.disabled = true;

    try {
        const response = await request('/auth/v1/token?grant_type=password', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
            throw new Error('Email atau password salah.');
        }

        saveSession(await response.json());
        window.location.reload();
    } catch (error) {
        notify(error.message, 'warning');
        button.disabled = false;
    }
};

const saveInvitation = async (button) => {
    const session = getSession();
    if (!session?.user?.id) {
        clearSession();
        window.location.reload();
        return;
    }

    button.disabled = true;
    try {
        const invitation = await getInvitation(session.user.id);
        if (!invitation) {
            throw new Error('Data undangan belum dibuat di tabel invitations.');
        }

        const values = {
            slug: document.getElementById('invitation-slug').value.trim(),
            groom_name: document.getElementById('invitation-groom-name').value.trim(),
            bride_name: document.getElementById('invitation-bride-name').value.trim(),
            event_date: document.getElementById('invitation-date').value || null,
            location: document.getElementById('invitation-location').value.trim(),
            description: document.getElementById('invitation-description').value.trim(),
            timezone: document.getElementById('invitation-timezone').value.trim() || 'Asia/Jakarta',
        };
        const groomPhoto = await uploadAsset(document.getElementById('invitation-groom-photo').files[0], session.user.id, 'groom');
        const bridePhoto = await uploadAsset(document.getElementById('invitation-bride-photo').files[0], session.user.id, 'bride');
        const audio = await uploadAsset(document.getElementById('invitation-audio').files[0], session.user.id, 'audio');

        if (groomPhoto) values.groom_photo_url = groomPhoto;
        if (bridePhoto) values.bride_photo_url = bridePhoto;
        if (audio) values.audio_url = audio;

        await updateInvitation(invitation.id, values);
        notify('Data undangan berhasil disimpan.');
        window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
        notify(error.message, 'warning');
        button.disabled = false;
    }
};

const logout = () => {
    clearSession();
    window.location.reload();
};

const init = () => {
    const session = getSession();
    const modalElement = document.getElementById('mainModal');
    const modal = modalElement && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(modalElement) : null;

    window.addEventListener('load', () => {
        const loginModal = window.bootstrap && modalElement
            ? window.bootstrap.Modal.getOrCreateInstance(modalElement)
            : null;
        if (!session?.access_token || !session?.user?.id) {
            loginModal?.show();
        }
    }, { once: true });

    if (!session?.access_token || !session?.user?.id) {
        modal?.show();
    } else {
        getInvitation(session.user.id).then((invitation) => {
            if (invitation) {
                loadForm(invitation, session.user.email);
            } else {
                notify('Buat satu data undangan di tabel invitations terlebih dahulu.', 'warning');
            }
        }).catch((error) => notify(error.message, 'warning'));
    }

    return {
        util: window.undangan?.util,
        theme: window.undangan?.theme,
        admin: {
            auth: { login },
            logout,
            saveInvitation,
            changeName: saveInvitation,
            enableButtonName: () => {},
            enableButtonPassword: () => {},
            navbar: { buttonNavHome: () => {}, buttonNavSetting: () => {} },
        },
    };
};

export { init };
