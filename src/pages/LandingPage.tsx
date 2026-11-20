import { Link } from 'react-router';
import { Check, QrCode, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Badge';

const PLANS = [
  {
    name: 'Cardápio Digital',
    price: 'R$ 19,90/mês',
    setupFee: 'Taxa de implantação: R$ 100,00',
    features: [
      'Cardápio público responsivo (/m/seu-slug)',
      'Painel de gestão de categorias, produtos e fotos',
      'Grupos de adicionais orientativos',
      'Gerador de QR Code para mesas (PNG e SVG)',
    ],
  },
  {
    name: 'Cardápio + NFC',
    price: 'R$ 49,90/mês',
    setupFee: 'Taxa de implantação: R$ 150,00',
    features: [
      'Tudo do plano Cardápio Digital',
      'Módulo e guia técnico para etiquetas NFC',
      'URL estável pronta para gravação NTAG213',
      'Suporte à implantação (mídia física orçada à parte)',
    ],
  },
  {
    name: 'Cardápio + NFC + Promoções',
    price: 'R$ 59,90/mês',
    setupFee: 'Taxa de implantação: R$ 100,00',
    highlighted: true,
    features: [
      'Tudo do plano Cardápio + NFC',
      'Promoções pontuais por data e hora',
      'Promoções recorrentes semanais (ex.: toda segunda)',
      'Elegibilidade prioritária para novos recursos especiais',
    ],
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
              MF
            </span>
            <span className="text-base font-bold tracking-tight text-white">MenuFlow SaaS</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="outline" size="sm" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                Sou estabelecimento
              </Button>
            </Link>
            <Link to="/platform">
              <Button size="sm">Operador</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma Multi-Tenant B2B de Cardápios Digitais
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Cardápios digitais rápidos via QR Code e NFC para qualquer estabelecimento
          </h1>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            Cada restaurante administra suas categorias, produtos, fotos, adicionais e promoções
            agendadas em seu próprio painel. O consumidor acessa no celular sem login e sem instalar
            aplicativo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/login">
              <Button size="lg" className="w-full sm:w-auto">
                Acessar Painel do Estabelecimento
              </Button>
            </Link>
            <Link to="/platform">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-slate-700 bg-slate-900 text-white hover:bg-slate-800 sm:w-auto"
              >
                Console Central do Operador
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900/90 p-5 text-slate-100">
            <QrCode className="h-6 w-6 text-indigo-400" />
            <h2 className="mt-3 text-base font-semibold">QR Code em todos os planos</h2>
            <p className="mt-1 text-sm text-slate-400">
              Gere e baixe QR Codes em PNG e SVG prontos para impressão nas mesas.
            </p>
          </Card>
          <Card className="border-slate-800 bg-slate-900/90 p-5 text-slate-100">
            <Smartphone className="h-6 w-6 text-emerald-400" />
            <h2 className="mt-3 text-base font-semibold">Experiência Mobile-First</h2>
            <p className="mt-1 text-sm text-slate-400">
              Catálogo de consulta limpo, rápido e acessível por toque NFC ou câmera do celular.
            </p>
          </Card>
          <Card className="border-slate-800 bg-slate-900/90 p-5 text-slate-100">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <h2 className="mt-3 text-base font-semibold">Isolamento por Tenant</h2>
            <p className="mt-1 text-sm text-slate-400">
              Provisionamento seguro, controle comercial manual centralizado e regras por plano no
              banco.
            </p>
          </Card>
        </div>

        <section className="mt-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Planos Comerciais</h2>
            <p className="mt-2 text-sm text-slate-400">
              Contratação gerenciada pelo operador da plataforma. Etiquetas e materiais físicos NFC
              orçados separadamente.
            </p>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={`flex flex-col justify-between p-6 ${
                  plan.highlighted
                    ? 'border-indigo-500 bg-slate-900 text-white ring-1 ring-indigo-500'
                    : 'border-slate-800 bg-slate-900/70 text-slate-100'
                }`}
              >
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-extrabold text-white">{plan.price}</p>
                  <p className="mt-1 text-xs font-medium text-indigo-300">{plan.setupFee}</p>
                  <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

