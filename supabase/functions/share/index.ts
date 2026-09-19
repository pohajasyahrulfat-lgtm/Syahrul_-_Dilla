import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicSite = 'https://pohajasyahrulfat-lgtm.github.io/Syahrul_-_Dilla';
const supabase = createClient(supabaseUrl, supabaseKey);

const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

Deno.serve(async (request) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug')?.trim();
    if (!slug) {
        return new Response('Slug undangan wajib diisi.', { status: 400 });
    }

    const { data: invitation, error } = await supabase
        .from('invitations')
        .select('slug,groom_name,bride_name,description,cover_urls,content,is_published')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

    if (error || !invitation) {
        return new Response('Undangan tidak ditemukan.', { status: 404 });
    }

    const content = invitation.content ?? {};
    const title = `${invitation.groom_name} & ${invitation.bride_name}`;
    const description = content.share_description || invitation.description || title;
    const image = content.share_image_url || invitation.cover_urls?.[0] || `${publicSite}/assets/images/thumbanil.png`;
    const invitationUrl = `${publicSite}/?slug=${encodeURIComponent(invitation.slug)}&v=${Date.now()}`;
    const userAgent = request.headers.get('user-agent')?.toLowerCase() ?? '';
    const isSocialCrawler = /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot/.test(userAgent);

    if (!isSocialCrawler) {
        return Response.redirect(invitationUrl, 302);
    }

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeImage = escapeHtml(image);
    const safeInvitationUrl = escapeHtml(invitationUrl);

    return new Response(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:secure_url" content="${safeImage}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${safeImage}">
<meta property="og:type" content="website">
<meta property="og:url" content="${safeInvitationUrl}">
<meta http-equiv="refresh" content="0;url=${safeInvitationUrl}">
</head>
<body><p>Membuka undangan...</p><a href="${safeInvitationUrl}">Buka undangan</a></body>
</html>`, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
});
