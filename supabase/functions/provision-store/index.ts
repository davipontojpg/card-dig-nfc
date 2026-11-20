import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { requireActivePlatformAdmin } from '../_shared/auth.ts';
import { validateProvisionPayload } from '../_shared/validation.ts';

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

  const validation = validateProvisionPayload(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const payload = validation.data;
  const { adminClient, operatorUserId } = auth.context;

  // 1. Verificar duplicidade de slug antes de criar registros
  const { data: existingSlug } = await adminClient
    .from('stores')
    .select('id')
    .eq('slug', payload.slug)
    .maybeSingle();

  if (existingSlug) {
    return jsonResponse(
      { error: `O slug "${payload.slug}" já está em uso por outro estabelecimento.` },
      409
    );
  }

  // 2. Buscar plano ativo e seus recursos no banco (nunca confiar em preço vindo do cliente)
  const { data: plan, error: planError } = await adminClient
    .from('plans')
    .select('id, code, name, monthly_price, setup_fee, is_active')
    .eq('id', payload.plan_id)
    .eq('is_active', true)
    .maybeSingle();

  if (planError || !plan) {
    return jsonResponse({ error: 'Plano selecionado não encontrado ou inativo.' }, 400);
  }

  const { data: planFeatures } = await adminClient
    .from('plan_features')
    .select('feature_key')
    .eq('plan_id', plan.id);

  const hasNfcFeature = (planFeatures ?? []).some((pf) => pf.feature_key === 'nfc_access');

  // 3. Criar estabelecimento (inicialmente em pending_setup)
  const { data: store, error: storeError } = await adminClient
    .from('stores')
    .insert({
      name: payload.name,
      slug: payload.slug,
      business_type: payload.business_type,
      description: payload.description,
      public_phone: payload.public_phone,
      public_address: payload.public_address,
      primary_color: payload.primary_color,
      timezone: payload.timezone,
      is_published: false,
      lifecycle_status: 'pending_setup',
      onboarding_status: payload.onboarding_status,
      created_by_platform_admin: operatorUserId,
    })
    .select('id, slug')
    .single();

  if (storeError || !store) {
    return jsonResponse(
      { error: storeError?.message || 'Erro ao criar registro do estabelecimento.' },
      500
    );
  }

  try {
    // 4. Criar registro interno comercial (isolado de clientes)
    const { error: internalErr } = await adminClient.from('store_internal_records').insert({
      store_id: store.id,
      contact_name: payload.contact_name,
      contact_email: payload.contact_email,
      contact_phone: payload.contact_phone,
      internal_notes: payload.internal_notes,
      owner_invite_status: 'not_sent',
    });
    if (internalErr) throw internalErr;

    // 5. Criar assinatura com snapshots comerciais do plano
    const { data: sub, error: subErr } = await adminClient
      .from('store_subscriptions')
      .insert({
        store_id: store.id,
        plan_id: plan.id,
        status: payload.subscription_status,
        monthly_price_snapshot: plan.monthly_price,
        setup_fee_snapshot: plan.setup_fee,
        setup_fee_status: payload.setup_fee_status,
        started_at: payload.started_at ?? new Date().toISOString(),
        current_period_start: payload.current_period_start,
        current_period_end: payload.current_period_end,
        next_billing_at: payload.next_billing_at,
        updated_by: operatorUserId,
      })
      .select('id')
      .single();
    if (subErr || !sub) throw subErr ?? new Error('Falha ao criar assinatura.');

    // 6. Registrar evento inicial de assinatura
    const { error: eventErr } = await adminClient.from('subscription_events').insert({
      store_id: store.id,
      subscription_id: sub.id,
      actor_user_id: operatorUserId,
      event_type: 'created',
      new_values: {
        plan_code: plan.code,
        status: payload.subscription_status,
        monthly_price_snapshot: plan.monthly_price,
        setup_fee_snapshot: plan.setup_fee,
        setup_fee_status: payload.setup_fee_status,
      },
      reason: 'Provisionamento inicial do estabelecimento.',
    });
    if (eventErr) throw eventErr;

    // 7. Criar checklist inicial de onboarding
    const tasks = [
      { task_key: 'receive_logo', title: 'Receber logotipo do estabelecimento', sort_order: 1 },
      { task_key: 'receive_catalog', title: 'Receber lista inicial de produtos e preços', sort_order: 2 },
      { task_key: 'configure_identity', title: 'Configurar identidade visual e slug', sort_order: 3 },
      { task_key: 'validate_menu', title: 'Revisar categorias, adicionais e valores', sort_order: 4 },
      { task_key: 'generate_qr', title: 'Gerar QR Code de acesso público', sort_order: 5 },
      ...(hasNfcFeature
        ? [{ task_key: 'setup_nfc', title: 'Gravar e testar etiquetas NFC no material final', sort_order: 6 }]
        : []),
      { task_key: 'invite_owner', title: 'Convidar proprietário e validar primeiro login', sort_order: 7 },
      { task_key: 'publish_store', title: 'Ativar estabelecimento e publicar cardápio', sort_order: 8 },
    ].map((task) => ({
      store_id: store.id,
      task_key: task.task_key,
      title: task.title,
      status: 'pending',
      sort_order: task.sort_order,
      updated_by: operatorUserId,
    }));

    const { error: tasksErr } = await adminClient.from('store_onboarding_tasks').insert(tasks);
    if (tasksErr) throw tasksErr;
  } catch (setupError) {
    // Reverter estrutura inicial se falhar antes do convite (sem deixar resíduos parciais)
    await adminClient
      .from('stores')
      .update({ lifecycle_status: 'archived' })
      .eq('id', store.id);
    return jsonResponse(
      {
        error:
          setupError instanceof Error
            ? setupError.message
            : 'Falha ao inicializar assinatura e onboarding.',
      },
      500
    );
  }

  // 8. Verificar se o e-mail já possui conta existente (não vincular silenciosamente!)
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, email')
    .ilike('email', payload.contact_email)
    .maybeSingle();

  if (existingProfile) {
    await adminClient
      .from('store_internal_records')
      .update({
        owner_invite_status: 'not_sent',
        owner_invite_error:
          'E-mail já possui conta cadastrada na plataforma. Confirme manualmente a vinculação na aba Acesso.',
      })
      .eq('store_id', store.id);

    await adminClient.from('platform_audit_logs').insert({
      actor_user_id: operatorUserId,
      store_id: store.id,
      action: 'store.provisioned_existing_email_pending',
      entity_type: 'stores',
      entity_id: store.id,
      metadata: { plan_code: plan.code },
    });

    return jsonResponse(
      {
        store_id: store.id,
        slug: store.slug,
        owner_invite_status: 'not_sent',
        requires_existing_user_confirmation: true,
        message:
          'Estabelecimento criado em implantação. O e-mail informado já possui conta existente e aguarda confirmação explícita de vínculo na aba Acesso.',
      },
      201
    );
  }

  // 9. Enviar convite de acesso via Auth Admin (somente servidor)
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(payload.contact_email, {
      data: { full_name: payload.contact_name },
      ...(payload.redirect_to ? { redirectTo: payload.redirect_to } : {}),
    });

  if (inviteError || !inviteData.user) {
    const safeError = inviteError?.message
      ? inviteError.message.slice(0, 240)
      : 'Falha ao enviar convite de acesso (verifique a configuração SMTP).';

    await adminClient
      .from('store_internal_records')
      .update({
        owner_invite_status: 'failed',
        owner_invite_error: safeError,
      })
      .eq('store_id', store.id);

    await adminClient.from('platform_audit_logs').insert({
      actor_user_id: operatorUserId,
      store_id: store.id,
      action: 'store.provisioned_invite_failed',
      entity_type: 'stores',
      entity_id: store.id,
      metadata: { plan_code: plan.code, reason: safeError },
    });

    return jsonResponse(
      {
        store_id: store.id,
        slug: store.slug,
        owner_invite_status: 'failed',
        requires_existing_user_confirmation: false,
        message:
          'Estabelecimento criado em pending_setup, porém o envio do convite falhou. É possível reenviar na aba Acesso sem duplicar registros.',
      },
      201
    );
  }

  // 10. Garantir perfil e vincular membership como proprietário (owner)
  await adminClient.from('profiles').upsert(
    {
      id: inviteData.user.id,
      email: payload.contact_email,
      full_name: payload.contact_name,
    },
    { onConflict: 'id' }
  );

  await adminClient.from('store_memberships').upsert(
    {
      store_id: store.id,
      user_id: inviteData.user.id,
      role: 'owner',
    },
    { onConflict: 'store_id,user_id' }
  );

  await adminClient
    .from('store_internal_records')
    .update({
      owner_invite_status: 'sent',
      owner_invited_at: new Date().toISOString(),
      owner_invite_error: null,
    })
    .eq('store_id', store.id);

  await adminClient.from('platform_audit_logs').insert({
    actor_user_id: operatorUserId,
    store_id: store.id,
    action: 'store.provisioned_and_invited',
    entity_type: 'stores',
    entity_id: store.id,
    metadata: { plan_code: plan.code },
  });

  return jsonResponse(
    {
      store_id: store.id,
      slug: store.slug,
      owner_invite_status: 'sent',
      requires_existing_user_confirmation: false,
      message: 'Estabelecimento provisionado e convite enviado ao proprietário.',
    },
    201
  );
});

