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

const refreshSession = async () => {
    const refreshToken = getSession()?.refresh_token;
    if (!refreshToken) {
        return false;
    }

    const response = await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
        clearSession();
        return false;
    }

    saveSession(await response.json());
    return true;
};

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
    let response = await request(`/rest/v1/invitations?${query}`, { headers: tokenHeaders() });
    if (response.status === 401 && await refreshSession()) {
        response = await request(`/rest/v1/invitations?${query}`, { headers: tokenHeaders() });
    }
    if (!response.ok) {
        throw new Error(`Tidak dapat mengambil data undangan (HTTP ${response.status}). Silakan login ulang jika sesi sudah kedaluwarsa.`);
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

const uploadAssets = async (files, ownerId, type) => Promise.all(Array.from(files ?? []).map((file) => uploadAsset(file, ownerId, type)));

const storagePath = (url) => {
    const marker = '/storage/v1/object/public/invitation-assets/';
    return url?.includes(marker) ? url.split(marker)[1] : null;
};

const removeStorageFiles = async (urls) => {
    const prefixes = urls.map(storagePath).filter(Boolean);
    if (!prefixes.length) return;

    const response = await request('/storage/v1/object/invitation-assets', {
        method: 'DELETE',
        headers: tokenHeaders(),
        body: JSON.stringify({ prefixes }),
    });
    if (!response.ok) {
        throw new Error(`Penghapusan file gagal (HTTP ${response.status}).`);
    }
};

const loadForm = (invitation, email) => {
    const content = invitation.content ?? {};
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
    setValue('invitation-welcome-title', content.welcome_title);
    setValue('invitation-groom-nickname', content.groom_nickname);
    setValue('invitation-bride-nickname', content.bride_nickname);
    setValue('invitation-groom-child-order', content.groom_child_order);
    setValue('invitation-bride-child-order', content.bride_child_order);
    setValue('invitation-groom-parents', content.groom_parents);
    setValue('invitation-bride-parents', content.bride_parents);
    setValue('invitation-akad-date', content.akad_date);
    setValue('invitation-akad-time', content.akad_time);
    setValue('invitation-reception-date', content.reception_date);
    setValue('invitation-reception-time', content.reception_time);
    setValue('invitation-maps-url', content.maps_url);
    setValue('invitation-story-description', content.story_description);
    setValue('invitation-story-video-url', content.story_video_url);
    setValue('invitation-gift-bank-name', content.gift_bank_name);
    setValue('invitation-gift-account', content.gift_account);
    setValue('invitation-gift-owner', content.gift_owner);
    setValue('invitation-gift-phone', content.gift_phone);
    setValue('invitation-gift-address', content.gift_address);
    const setChecked = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.checked = value !== false;
    };
    setChecked('invitation-show-story', content.show_story);
    setChecked('invitation-show-qris', content.show_qris);
    setChecked('invitation-show-gift', content.show_gift);
    setText('invitation-gallery-current', `${(invitation.gallery_urls ?? []).length} foto tersimpan`);
    setText('invitation-cover-current', `${(invitation.cover_urls ?? []).length} cover tersimpan`);
    setText('invitation-qris-current', content.qris_url ? 'QRIS tersimpan' : 'Belum ada QRIS');
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
            content: {
                welcome_title: document.getElementById('invitation-welcome-title').value.trim(),
                groom_nickname: document.getElementById('invitation-groom-nickname').value.trim(),
                bride_nickname: document.getElementById('invitation-bride-nickname').value.trim(),
                groom_child_order: document.getElementById('invitation-groom-child-order').value.trim(),
                bride_child_order: document.getElementById('invitation-bride-child-order').value.trim(),
                groom_parents: document.getElementById('invitation-groom-parents').value.trim(),
                bride_parents: document.getElementById('invitation-bride-parents').value.trim(),
                akad_date: document.getElementById('invitation-akad-date').value,
                akad_time: document.getElementById('invitation-akad-time').value.trim(),
                reception_date: document.getElementById('invitation-reception-date').value,
                reception_time: document.getElementById('invitation-reception-time').value.trim(),
                maps_url: document.getElementById('invitation-maps-url').value.trim(),
                story_description: document.getElementById('invitation-story-description').value.trim(),
                story_video_url: document.getElementById('invitation-story-video-url').value.trim(),
                gift_bank_name: document.getElementById('invitation-gift-bank-name').value.trim(),
                gift_account: document.getElementById('invitation-gift-account').value.trim(),
                gift_owner: document.getElementById('invitation-gift-owner').value.trim(),
                gift_phone: document.getElementById('invitation-gift-phone').value.trim(),
                gift_address: document.getElementById('invitation-gift-address').value.trim(),
                show_story: document.getElementById('invitation-show-story').checked,
                show_qris: document.getElementById('invitation-show-qris').checked,
                show_gift: document.getElementById('invitation-show-gift').checked,
            },
        };
        const groomPhoto = await uploadAsset(document.getElementById('invitation-groom-photo').files[0], session.user.id, 'groom');
        const bridePhoto = await uploadAsset(document.getElementById('invitation-bride-photo').files[0], session.user.id, 'bride');
        const audio = await uploadAsset(document.getElementById('invitation-audio').files[0], session.user.id, 'audio');
        const covers = await uploadAssets(document.getElementById('invitation-covers').files, session.user.id, 'cover');
        const gallery = await uploadAssets(document.getElementById('invitation-gallery').files, session.user.id, 'gallery');
        const qris = await uploadAsset(document.getElementById('invitation-qris').files[0], session.user.id, 'qris');

        if (groomPhoto) values.groom_photo_url = groomPhoto;
        if (bridePhoto) values.bride_photo_url = bridePhoto;
        if (audio) values.audio_url = audio;
        if (covers.length) values.cover_urls = covers;
        if (gallery.length) values.gallery_urls = gallery;
        if (qris) values.content.qris_url = qris;

        await updateInvitation(invitation.id, values);
        loadForm({ ...invitation, ...values }, session.user.email);
        notify('Data undangan berhasil disimpan.');
    } catch (error) {
        notify(error.message, 'warning');
        button.disabled = false;
    }
};

const deleteAsset = async (field, button) => {
    if (!window.confirm('Hapus media ini dari undangan?')) return;

    const session = getSession();
    if (!session?.user?.id) return;
    button.disabled = true;

    try {
        const invitation = await getInvitation(session.user.id);
        const content = { ...(invitation.content ?? {}) };
        const current = field === 'qris_url' ? content.qris_url : invitation[field];
        const urls = Array.isArray(current) ? current : [current];
        await removeStorageFiles(urls);

        const values = field === 'qris_url'
            ? { content: { ...content, qris_url: '' } }
            : { [field]: Array.isArray(current) ? [] : '' };
        await updateInvitation(invitation.id, values);
        loadForm({ ...invitation, ...values, content: values.content ?? invitation.content }, session.user.email);
        notify('Media berhasil dihapus.');
    } catch (error) {
        notify(error.message, 'warning');
    } finally {
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
            deleteAsset,
            changeName: saveInvitation,
            enableButtonName: () => {},
            enableButtonPassword: () => {},
            navbar: { buttonNavHome: () => {}, buttonNavSetting: () => {} },
        },
    };
};

export { init };
