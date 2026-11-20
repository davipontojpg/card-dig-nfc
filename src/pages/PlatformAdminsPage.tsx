import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { platformService } from '../services/platform.service';
import type { PlatformAdminRole } from '../types/database';
import { formatDateTimeInTz } from '../lib/formatters';
import { Badge, Card } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ErrorState, LoadingSpinner } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';

export function PlatformAdminsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformAdminRole>('operator');

  const { data: admins = [], isLoading, error, refetch } = useQuery({
    queryKey: ['platform-admins'],
    queryFn: () => platformService.listPlatformAdmins(),
  });

  const manageMutation = useMutation({
    mutationFn: async (input: { userId: string; role: PlatformAdminRole; isActive: boolean }) =>
      platformService.managePlatformAdmin(input.userId, input.role, input.isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      toast.success('Permissão administrativa atualizada.');
    },
    onError: (err) => {
      toast.error(
        'Não foi possível atualizar operador',
        err instanceof Error ? err.message : 'Erro desconhecido'
      );
    },
  });

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault();
    try {
      const profile = await platformService.findProfileByEmail(email);
      if (!profile) {
        toast.error(
          'Usuário não encontrado',
          'O usuário precisa existir primeiro no Supabase Auth / profiles antes de receber papel de operador.'
        );
        return;
      }
      await manageMutation.mutateAsync({ userId: profile.id, role, isActive: true });
      setEmail('');
    } catch (err) {
      toast.error(
        'Falha ao buscar usuário',
        err instanceof Error ? err.message : 'Erro desconhecido'
      );
    }
  }

  if (isLoading) return <LoadingSpinner label="Carregando operadores..." />;
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao listar operadores.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Operadores da Plataforma</h1>
        <p className="text-sm text-slate-600">
          Gestão exclusiva de super administradores. Não há cadastro público de operadores.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <UserPlus className="h-4 w-4 text-zinc-900" />
          Autorizar operador existente
        </h2>
        <form onSubmit={(e) => void handleAddAdmin(e)} className="mt-4 grid gap-3 sm:grid-cols-3">
          <Input
            label="E-mail da conta Auth"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operador@empresa.com.br"
          />
          <Select
            label="Papel"
            value={role}
            onChange={(e) => setRole(e.target.value as PlatformAdminRole)}
            options={[
              { value: 'operator', label: 'Operador' },
              { value: 'super_admin', label: 'Super Admin' },
            ]}
          />
          <div className="flex items-end">
            <Button type="submit" isLoading={manageMutation.isPending} className="w-full">
              Conceder acesso
            </Button>
          </div>
        </form>
      </Card>

      <Card className="divide-y divide-slate-100">
        {admins.map((admin) => (
          <div
            key={admin.user_id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-zinc-900" />
                <p className="font-semibold text-slate-900">
                  {admin.profile?.full_name || admin.profile?.email || admin.user_id}
                </p>
                <Badge tone={admin.role === 'super_admin' ? 'info' : 'neutral'}>
                  {admin.role}
                </Badge>
                <Badge tone={admin.is_active ? 'success' : 'danger'}>
                  {admin.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {admin.profile?.email} • Desde {formatDateTimeInTz(admin.created_at)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  manageMutation.mutate({
                    userId: admin.user_id,
                    role: admin.role === 'super_admin' ? 'operator' : 'super_admin',
                    isActive: admin.is_active,
                  })
                }
              >
                {admin.role === 'super_admin' ? 'Tornar operador' : 'Promover a super_admin'}
              </Button>
              <Button
                variant={admin.is_active ? 'danger' : 'primary'}
                size="sm"
                onClick={() =>
                  manageMutation.mutate({
                    userId: admin.user_id,
                    role: admin.role,
                    isActive: !admin.is_active,
                  })
                }
              >
                {admin.is_active ? 'Desativar' : 'Reativar'}
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

