import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { requireActivePlatformAdmin } from '../_shared/auth.ts';
import { validateResendInvitePayload } from '../_shared/validation.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  const auth = await requireActivePlatformAdmin(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Corpo JSON inválido.' }, 400);
  }

  const validation = validateResendInvitePayload(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const { store_id, mode, email, full_name, redirect_to } = validation.data;
  const { adminClient, operatorUserId } = auth.context;

  const { data: store } = await adminClient
    .from('stores')
    .select('id, name')
    .eq('id', store_id)
    .maybeSingle();

  if (!store) {
    return jsonResponse({ error: 'Estabelecimento não encontrado.' }, 404);
  }

  const { data: internal } = await adminClient
    .from('store_internal_records')
    .select('contact_name, contact_email')
    .eq('store_id', store_id)
    .maybeSingle();

  const targetEmail = (email ?? internal?.contact_email ?? '').trim().toLowerCase();
  if (!targetEmail) {
    return jsonResponse({ error: 'Nenhum e-mail de contato informado para envio.' }, 400);
  }

  if (mode === 'link_existing_confirmed') {
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .ilike('email', targetEmail)
      .maybeSingle();

    if (!existingProfile) {
      return jsonResponse(
        { error: 'Nenhuma conta existente encontrada para o e-mail informado.' },
        404
      );
    }

    const { error: memberError } = await adminClient.from('store_memberships').upsert(
      {
        store_id,
        user_id: existingProfile.id,
        role: 'owner',
      },
      { onConflict: 'store_id,user_id' }
    );

    if (memberError) {
      return jsonResponse({ error: memberError.message }, 500);
    }

    await adminClient.from('store_internal_records').upsert(
      {
        store_id,
        contact_email: targetEmail,
        owner_invite_status: 'linked_existing',
        owner_invited_at: new Date().toISOString(),
        owner_invite_error: null,
      },
      { onConflict: 'store_id' }
    );

    await adminClient.from('platform_audit_logs').insert({
      actor_user_id: operatorUserId,
      store_id,
      action: 'store.existing_owner_linked',
      entity_type: 'store_memberships',
      entity_id: existingProfile.id,
      metadata: { mode },
    });

    return jsonResponse({
      status: 'linked',
      owner_invite_status: 'linked_existing',
      message: 'Conta existente vinculada como proprietária do estabelecimento.',
    });
  }

  if (mode === 'invite_editor') {
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', targetEmail)
      .maybeSingle();

    let editorUserId = existingProfile?.id ?? null;

    if (!editorUserId) {
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(targetEmail, {
          data: { full_name: full_name ?? 'Editor do Cardápio' },
          ...(redirect_to ? { redirectTo: redirect_to } : {}),
        });

      if (inviteError || !inviteData.user) {
        return jsonResponse(
          { error: inviteError?.message || 'Falha ao enviar convite ao editor.' },
          500
        );
      }

      editorUserId = inviteData.user.id;
      await adminClient.from('profiles').upsert(
        {
          id: editorUserId,
          email: targetEmail,
          full_name: full_name ?? 'Editor do Cardápio',
        },
        { onConflict: 'id' }
      );
    }

    const { error: memberErr } = await adminClient.from('store_memberships').upsert(
      {
        store_id,
        user_id: editorUserId,
        role: 'editor',
      },
      { onConflict: 'store_id,user_id' }
    );
    if (memberErr) {
      return jsonResponse({ error: memberErr.message }, 500);
    }

    await adminClient.from('platform_audit_logs').insert({
      actor_user_id: operatorUserId,
      store_id,
      action: 'store.editor_invited',
      entity_type: 'store_memberships',
      entity_id: editorUserId,
      metadata: { existing_account: Boolean(existingProfile) },
    });

    return jsonResponse({
      status: 'ok',
      message: existingProfile
        ? 'Editor já possuía conta e recebeu acesso ao estabelecimento.'
        : 'Convite de editor enviado com sucesso.',
    });
  }

  // mode === 'resend_owner_invite'
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id')
    .ilike('email', targetEmail)
    .maybeSingle();

  if (existingProfile) {
    const { data: existingMember } = await adminClient
      .from('store_memberships')
      .select('id')
      .eq('store_id', store_id)
      .eq('user_id', existingProfile.id)
      .maybeSingle();

    if (!existingMember) {
      return jsonResponse(
        {
          error:
            'Este e-mail já pertence a uma conta existente sem vínculo com a loja. Utilize a confirmação explícita de vinculação.',
        },
        409
      );
    }

    // Se o proprietário já confirmou conta anteriormente, reenviar via resetPasswordForEmail
    const { data: authUserRes } = await adminClient.auth.admin.getUserById(existingProfile.id);
    if (authUserRes?.user?.email_confirmed_at) {
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(targetEmail, {
        ...(redirect_to ? { redirectTo: redirect_to } : {}),
      });
      if (resetError) {
        const safeError = resetError.message.slice(0, 240);
        await adminClient.from('store_internal_records').upsert(
          {
            store_id,
            contact_email: targetEmail,
            owner_invite_status: 'failed',
            owner_invite_error: safeError,
          },
          { onConflict: 'store_id' }
        );
        return jsonResponse({ error: safeError }, 500);
      }

      await adminClient.from('store_internal_records').upsert(
        {
          store_id,
          contact_email: targetEmail,
          owner_invite_status: 'sent',
          owner_invited_at: new Date().toISOString(),
          owner_invite_error: null,
        },
        { onConflict: 'store_id' }
      );

      await adminClient.from('platform_audit_logs').insert({
        actor_user_id: operatorUserId,
        store_id,
        action: 'store.owner_recovery_resent',
        entity_type: 'stores',
        entity_id: store_id,
        metadata: { mode },
      });

      return jsonResponse({
        status: 'sent',
        owner_invite_status: 'sent',
        message: 'Link de redefinição de senha enviado ao proprietário já cadastrado.',
      });
    }
  }

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(targetEmail, {
      data: { full_name: full_name ?? internal?.contact_name ?? store.name },
      ...(redirect_to ? { redirectTo: redirect_to } : {}),
    });

  if (inviteError) {
    const safeError = inviteError.message.slice(0, 240);
    await adminClient.from('store_internal_records').upsert(
      {
        store_id,
        contact_email: targetEmail,
        owner_invite_status: 'failed',
        owner_invite_error: safeError,
      },
      { onConflict: 'store_id' }
    );

    return jsonResponse({ error: safeError }, 500);
  }

  if (inviteData.user) {
    await adminClient.from('profiles').upsert(
      {
        id: inviteData.user.id,
        email: targetEmail,
        full_name: full_name ?? internal?.contact_name ?? store.name,
      },
      { onConflict: 'id' }
    );

    await adminClient.from('store_memberships').upsert(
      {
        store_id,
        user_id: inviteData.user.id,
        role: 'owner',
      },
      { onConflict: 'store_id,user_id' }
    );
  }

  await adminClient.from('store_internal_records').upsert(
    {
      store_id,
      contact_email: targetEmail,
      owner_invite_status: 'sent',
      owner_invited_at: new Date().toISOString(),
      owner_invite_error: null,
    },
    { onConflict: 'store_id' }
  );

  await adminClient.from('platform_audit_logs').insert({
    actor_user_id: operatorUserId,
    store_id,
    action: 'store.owner_invite_resent',
    entity_type: 'stores',
    entity_id: store_id,
    metadata: { mode },
  });

  return jsonResponse({
    status: 'sent',
    owner_invite_status: 'sent',
    message: 'Convite reenviado para o e-mail do proprietário.',
  });
});
