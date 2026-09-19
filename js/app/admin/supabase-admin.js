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

const currentInvitationState = { id: null, list: [], draft: false };

const setShareUrl = (slug) => {
    const input = document.getElementById('invitation-share-url');
    const button = document.getElementById('invitation-share-copy');
    const shareUrl = slug
        ? `https://hotizjscshmmabyojhhx.supabase.co/functions/v1/share?slug=${encodeURIComponent(slug)}&v=${Date.now()}`
        : '';
    if (input) {
        input.value = shareUrl;
    }
    if (button) {
        button.setAttribute('data-copy', shareUrl);
    }
};

const getInvitations = async (ownerId) => {
    const query = new URLSearchParams({
        select: '*',
        owner_id: `eq.${ownerId}`,
        order: 'created_at.desc',
    });
    let response = await request(`/rest/v1/invitations?${query}`, { headers: tokenHeaders() });
    if (response.status === 401 && await refreshSession()) {
        response = await request(`/rest/v1/invitations?${query}`, { headers: tokenHeaders() });
    }
    if (!response.ok) {
        throw new Error(`Tidak dapat mengambil data undangan (HTTP ${response.status}). Silakan login ulang jika sesi sudah kedaluwarsa.`);
    }

    return await response.json();
};

const getInvitation = async (ownerId, id = currentInvitationState.id) => {
    const query = new URLSearchParams({
        select: '*',
        owner_id: `eq.${ownerId}`,
    });
    if (id) {
        query.set('id', `eq.${id}`);
    } else {
        query.set('limit', '1');
    }

    let response = await request(`/rest/v1/invitations?${query}`, { headers: tokenHeaders() });
    if (response.status === 401 && await refreshSession()) {
        response = await request(`/rest/v1/invitations?${query}`, { headers: tokenHeaders() });
    }
    if (!response.ok) {
        throw new Error(`Tidak dapat mengambil data undangan (HTTP ${response.status}). Silakan login ulang jika sesi sudah kedaluwarsa.`);
    }

    const rows = await response.json();
    return rows[0] ?? rows ?? null;
};

const renderInvitationList = (invitations) => {
    currentInvitationState.list = invitations ?? [];
    const container = document.getElementById('invitation-list');
    if (!container) return;

    if (!currentInvitationState.list.length) {
        container.innerHTML = '<div class="text-secondary small">Belum ada undangan</div>';
        return;
    }

    container.innerHTML = currentInvitationState.list.map((invitation) => {
        const title = invitation.groom_name && invitation.bride_name
            ? `${invitation.groom_name} & ${invitation.bride_name}`
            : invitation.slug || 'Undangan baru';
        const activeClass = currentInvitationState.id === invitation.id ? 'border-primary bg-primary-subtle' : 'border-light-subtle';
        return `
            <div class="list-group-item rounded-4 border ${activeClass} mb-2 p-2">
                <div class="d-flex align-items-center justify-content-between gap-2">
                    <button type="button" class="btn btn-link text-start p-0 text-decoration-none text-body-emphasis flex-grow-1" data-invitation-select="${invitation.id}">
                        <span class="fw-semibold small">${title}</span>
                        <span class="d-block text-secondary small">${invitation.slug || 'tanpa-slug'}</span>
                    </button>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-secondary" data-invitation-edit="${invitation.id}" aria-label="Edit undangan"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="btn btn-outline-primary" data-invitation-copy="${invitation.id}" aria-label="Copy link undangan"><i class="fa-solid fa-copy"></i></button>
                        <button type="button" class="btn btn-outline-danger" data-invitation-delete="${invitation.id}" aria-label="Hapus undangan"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

const bindInvitationList = () => {
    const container = document.getElementById('invitation-list');
    if (!container) return;

    container.onclick = async (event) => {
        const target = event.target.closest('[data-invitation-select]');
        if (target) {
            const id = target.dataset.invitationSelect;
            if (id) {
                currentInvitationState.id = id;
                const session = getSession();
                if (session?.user?.id) {
                    const invitation = await getInvitation(session.user.id, id);
                    if (invitation) {
                        loadForm(invitation, session.user.email);
                    }
                }
            }
            return;
        }

        const editTrigger = event.target.closest('[data-invitation-edit]');
        if (editTrigger) {
            const id = editTrigger.dataset.invitationEdit;
            const session = getSession();
            const invitation = currentInvitationState.list.find((item) => String(item.id) === id) ?? null;
            if (id && invitation && session?.user?.email) {
                currentInvitationState.id = id;
                loadForm(invitation, session.user.email);
            }
            return;
        }

        const copyTrigger = event.target.closest('[data-invitation-copy]');
        if (copyTrigger) {
            const id = copyTrigger.dataset.invitationCopy;
            const invitation = currentInvitationState.list.find((item) => String(item.id) === id) ?? null;
            if (!invitation) return;
            const url = `https://hotizjscshmmabyojhhx.supabase.co/functions/v1/share?slug=${encodeURIComponent(invitation.slug ?? '')}&v=${Date.now()}`;
            await navigator.clipboard.writeText(url);
            notify('Link undangan berhasil disalin.');
            return;
        }

        const deleteTrigger = event.target.closest('[data-invitation-delete]');
        if (deleteTrigger) {
            const id = deleteTrigger.dataset.invitationDelete;
            if (id && window.confirm('Hapus undangan ini? Data akan terhapus dari daftar dan link tidak bisa dipakai lagi.')) {
                try {
                    const response = await request(`/rest/v1/invitations?id=eq.${id}`, {
                        method: 'DELETE',
                        headers: tokenHeaders(),
                    });
                    if (!response.ok) {
                        throw new Error('Hapus undangan gagal.');
                    }
                    const session = getSession();
                    if (session?.user?.id) {
                        const invitations = await getInvitations(session.user.id);
                        if (invitations.length) {
                            currentInvitationState.id = invitations[0].id;
                            loadForm(invitations[0], session.user.email);
                        } else {
                            currentInvitationState.id = null;
                            document.getElementById('invitation-slug').value = '';
                        }
                        renderInvitationList(invitations);
                    }
                    notify('Undangan berhasil dihapus.');
                } catch (error) {
                    notify(error.message, 'warning');
                }
            }
        }
    };
};

const clearInvitationForm = () => {
    currentInvitationState.id = null;
    currentInvitationState.draft = true;
    document.querySelectorAll('[id^="invitation-"]').forEach((element) => {
        if (element.type === 'checkbox') {
            element.checked = true;
        } else {
            element.value = '';
        }
    });
    setText('dashboard-name', 'Undangan baru');
    setText('invitation-groom-photo-current', 'Belum ada foto');
    setText('invitation-bride-photo-current', 'Belum ada foto');
    setText('invitation-audio-current', 'Belum ada musik');
    setText('invitation-gallery-current', 'Belum ada foto');
    setText('invitation-cover-current', 'Belum ada cover');
    setText('invitation-qris-current', 'Belum ada QRIS');
    setText('invitation-share-image-current', 'Belum ada thumbnail');
    setShareUrl('');
};

const createInvitation = () => {
    const session = getSession();
    if (!session?.user?.id) {
        clearSession();
        window.location.reload();
        return;
    }

    clearInvitationForm();
    notify('Form undangan baru sudah dikosongkan. Isi data lalu tekan Save invitation.');
};

const insertInvitation = async (ownerId, values) => {
    const response = await request('/rest/v1/invitations', {
        method: 'POST',
        headers: { ...tokenHeaders(), Prefer: 'return=representation' },
        body: JSON.stringify({ owner_id: ownerId, is_published: true, ...values }),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Gagal membuat undangan baru: ${message || response.status}`);
    }
    return (await response.json())[0];
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
    currentInvitationState.id = invitation.id ?? currentInvitationState.id;
    currentInvitationState.draft = false;
    const content = invitation.content ?? {};
    setText('dashboard-email', email);
    setText('dashboard-name', invitation.groom_name && invitation.bride_name
        ? `${invitation.groom_name} & ${invitation.bride_name}`
        : invitation.slug);
    setValue('invitation-slug', invitation.slug);
    setShareUrl(invitation.slug);
    setValue('invitation-groom-name', invitation.groom_name);
    setValue('invitation-bride-name', invitation.bride_name);
    setValue('invitation-date', invitation.event_date ? invitation.event_date.slice(0, 16) : '');
    setValue('invitation-location', invitation.location);
    setValue('invitation-description', invitation.description);
    setValue('invitation-share-description', content.share_description ?? invitation.description);
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
    setText('invitation-share-image-current', content.share_image_url ? 'Thumbnail tersimpan' : 'Belum ada thumbnail');
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
        const invitation = currentInvitationState.draft
            ? {
                id: null,
                slug: '',
                groom_name: '',
                bride_name: '',
                description: '',
                location: '',
                timezone: 'Asia/Jakarta',
                content: {},
            }
            : await getInvitation(session.user.id, currentInvitationState.id ?? undefined);
        if (!invitation) {
            throw new Error('Data undangan belum dibuat di tabel invitations.');
        }

        const readValue = (id, fallback = '') => document.getElementById(id)?.value.trim() ?? fallback;
        const readChecked = (id, fallback = false) => document.getElementById(id)?.checked ?? fallback;
        const readFiles = (id) => document.getElementById(id)?.files ?? [];
        const shareDescription = readValue('invitation-share-description', invitation.description)
            || invitation.description;

        const values = {
            slug: readValue('invitation-slug', invitation.slug),
            groom_name: readValue('invitation-groom-name', invitation.groom_name),
            bride_name: readValue('invitation-bride-name', invitation.bride_name),
            event_date: readValue('invitation-date') || null,
            location: readValue('invitation-location', invitation.location),
            description: readValue('invitation-description', invitation.description),
            timezone: readValue('invitation-timezone', invitation.timezone || 'Asia/Jakarta'),
            content: {
                ...((invitation.content ?? {})),
                welcome_title: readValue('invitation-welcome-title'),
                groom_nickname: readValue('invitation-groom-nickname'),
                bride_nickname: readValue('invitation-bride-nickname'),
                groom_child_order: readValue('invitation-groom-child-order'),
                bride_child_order: readValue('invitation-bride-child-order'),
                groom_parents: readValue('invitation-groom-parents'),
                bride_parents: readValue('invitation-bride-parents'),
                akad_date: readValue('invitation-akad-date'),
                akad_time: readValue('invitation-akad-time'),
                reception_date: readValue('invitation-reception-date'),
                reception_time: readValue('invitation-reception-time'),
                maps_url: readValue('invitation-maps-url'),
                story_description: readValue('invitation-story-description'),
                story_video_url: readValue('invitation-story-video-url'),
                gift_bank_name: readValue('invitation-gift-bank-name'),
                gift_account: readValue('invitation-gift-account'),
                gift_owner: readValue('invitation-gift-owner'),
                gift_phone: readValue('invitation-gift-phone'),
                gift_address: readValue('invitation-gift-address'),
                show_story: readChecked('invitation-show-story', true),
                show_qris: readChecked('invitation-show-qris', true),
                show_gift: readChecked('invitation-show-gift', true),
                share_description: shareDescription,
            },
        };
        if (!values.slug || !values.groom_name || !values.bride_name) {
            throw new Error('Slug, nama pengantin pria, dan nama pengantin wanita wajib diisi.');
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) {
            throw new Error('Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.');
        }
        const groomPhoto = await uploadAsset(readFiles('invitation-groom-photo')[0], session.user.id, 'groom');
        const bridePhoto = await uploadAsset(readFiles('invitation-bride-photo')[0], session.user.id, 'bride');
        const audio = await uploadAsset(readFiles('invitation-audio')[0], session.user.id, 'audio');
        const covers = await uploadAssets(readFiles('invitation-covers'), session.user.id, 'cover');
        const gallery = await uploadAssets(readFiles('invitation-gallery'), session.user.id, 'gallery');
        const qris = await uploadAsset(readFiles('invitation-qris')[0], session.user.id, 'qris');
        const shareImage = await uploadAsset(readFiles('invitation-share-image')[0], session.user.id, 'share');

        if (groomPhoto) values.groom_photo_url = groomPhoto;
        if (bridePhoto) values.bride_photo_url = bridePhoto;
        if (audio) values.audio_url = audio;
        if (covers.length) values.cover_urls = covers;
        if (gallery.length) values.gallery_urls = gallery;
        if (qris) values.content.qris_url = qris;
        if (shareImage) values.content.share_image_url = shareImage;

        const savedInvitation = currentInvitationState.draft
            ? await insertInvitation(session.user.id, values)
            : (await updateInvitation(invitation.id, values), { ...invitation, ...values });
        const invitations = await getInvitations(session.user.id);
        const refreshedInvitation = invitations.find((item) => item.id === savedInvitation.id) ?? savedInvitation;
        currentInvitationState.id = refreshedInvitation.id;
        currentInvitationState.draft = false;
        renderInvitationList(invitations);
        bindInvitationList();
        loadForm(refreshedInvitation, session.user.email);
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
        const invitation = await getInvitation(session.user.id, currentInvitationState.id ?? undefined);
        const content = { ...(invitation.content ?? {}) };
        const current = field === 'qris_url' || field === 'share_image_url' ? content[field] : invitation[field];
        const urls = Array.isArray(current) ? current : [current];
        await removeStorageFiles(urls);

        const values = field === 'qris_url' || field === 'share_image_url'
            ? { content: { ...content, [field]: '' } }
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
        getInvitations(session.user.id).then((invitations) => {
            if (invitations.length) {
                currentInvitationState.id = invitations[0].id;
                renderInvitationList(invitations);
                bindInvitationList();
                loadForm(invitations[0], session.user.email);
            } else {
                renderInvitationList([]);
                bindInvitationList();
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
            createInvitation,
        },
    };
};

export { init };
