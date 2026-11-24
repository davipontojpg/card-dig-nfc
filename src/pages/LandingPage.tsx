import { Link } from 'react-router';
import {
  ArrowRight,
  Check,
  Nfc,
  QrCode,
  ShieldCheck,
  Smartphone,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Badge';

const PLANS = [
  {
    name: 'Cardápio Digital',
    subtitle: 'Essencial para começar com QR Code e promoções comuns',
    price: 'R$ 19,90',
    period: '/mês',
    setupFeeOriginal: 'R$ 200,00',
    setupFeePromo: 'R$ 100,00',
    setupFeeDiscount: '-50%',
    features: [
      'Cardápio público responsivo (/m/seu-slug)',
      'Painel de gestão de categorias, produtos, variantes e fotos',
      'Promoções comuns (ative e pause ofertas a qualquer momento)',
      'Grupos de adicionais orientativos',
      'Gerador de QR Code para mesas (modelo personalizado, PNG e SVG)',
    ],
  },
  {
    name: 'Cardápio + NFC',
    subtitle: 'Acesso por aproximação nas mesas com etiquetas NFC',
    price: 'R$ 49,90',
    period: '/mês',
    setupFeeOriginal: 'R$ 250,00',
    setupFeePromo: 'R$ 150,00',
    setupFeeDiscount: '-40%',
    features: [
      'Tudo do plano Cardápio Digital (inclui promoções comuns)',
      'Módulo e guia técnico para etiquetas NFC',
      'URL estável pronta para gravação NTAG213',
      'Suporte à implantação (mídia física orçada à parte)',
    ],
  },
  {
    name: 'Cardápio + NFC + Promoções',
    subtitle: 'Operação completa com campanhas agendadas e recorrentes',
    price: 'R$ 59,90',
    period: '/mês',
    setupFeeOriginal: 'R$ 300,00',
    setupFeePromo: 'R$ 100,00',
    setupFeeDiscount: '-67%',
    highlighted: true,
    features: [
      'Tudo do plano Cardápio + NFC (inclui promoções comuns)',
      'Promoções agendadas por data e hora',
      'Promoções recorrentes semanais (ex.: toda segunda, toda terça)',
      'Elegibilidade prioritária para novos recursos especiais',
    ],
  },
];

const PILLARS = [
  {
    icon: QrCode,
    title: 'QR Code em todos os planos',
    description:
      'Gere e baixe QR Codes em PNG e SVG em alta definição, prontos para impressão em displays de mesa.',
  },
  {
    icon: Smartphone,
    title: 'Experiência Mobile-First',
    description:
      'Catálogo limpo, leve e instantâneo. O cliente acessa por toque NFC ou câmera, sem login e sem instalar app.',
  },
  {
    icon: ShieldCheck,
    title: 'Isolamento por Tenant',
    description:
      'Provisionamento seguro, controle comercial centralizado e permissões por plano garantidas no banco de dados.',
  },
];

const PREVIEW_ITEMS = [
  {
    name: 'Steak Tartare da Casa',
    desc: 'Filé mignon na ponta da faca, gema curada e brioche tostado',
    price: 'R$ 54,00',
    promoPrice: 'R$ 43,20',
    badge: '-20%',
  },
  {
    name: 'Burrata com Tomates Confit',
    desc: 'Pesto de manjericão fresco, azeite extravirgem e focaccia',
    price: 'R$ 48,00',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-xs font-bold tracking-tight text-white">
              MF
            </span>
            <span className="text-base font-bold tracking-tight text-zinc-950">MenuFlow</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-stone-600 md:flex">
            <a href="#recursos" className="transition-colors hover:text-zinc-950">
              Recursos
            </a>
            <a href="#planos" className="transition-colors hover:text-zinc-950">
              Planos
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="outline" size="sm">
                Sou estabelecimento
              </Button>
            </Link>
            <Link to="/platform">
              <Button size="sm">Operador</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-stone-200 bg-stone-50/70">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" aria-hidden="true" />
                Plataforma Multi-Tenant B2B · QR Code &amp; NFC
              </div>

              <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
                Cardápios digitais rápidos via QR Code e NFC para qualquer estabelecimento.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
                Cada restaurante administra suas categorias, produtos, fotos, adicionais e
                promoções agendadas em seu próprio painel. O consumidor acessa no celular sem login
                e sem instalar aplicativo.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to="/login">
                  <Button size="lg" className="w-full sm:w-auto">
                    Acessar Painel do Estabelecimento
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/platform">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Console Central do Operador
                  </Button>
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stone-200 pt-6 text-xs font-medium text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-zinc-900" />
                  Sem app para instalar
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-zinc-900" />
                  Compatível com tags NTAG213
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-zinc-900" />
                  White-label por estabelecimento
                </span>
              </div>
            </div>

            {/* Minimal Mobile Menu Preview */}
            <div className="lg:col-span-5">
              <div className="mx-auto max-w-sm rounded-3xl border border-stone-200 bg-white p-3 shadow-xl shadow-stone-900/5">
                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                  {/* Mockup Top Bar */}
                  <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white">
                        <UtensilsCrossed className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-zinc-950">Bistrô Paulista</p>
                        <p className="font-mono text-[10px] text-stone-500">/m/bistro-paulista</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-800">
                      <Nfc className="h-3 w-3 text-rose-600" />
                      NFC · Mesa 04
                    </span>
                  </div>

                  {/* Mockup Categories */}
                  <div className="flex gap-1.5 border-b border-stone-200 bg-white px-4 py-2.5">
                    <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-white">
                      Entradas
                    </span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                      Principais
                    </span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
                      Drinks
                    </span>
                  </div>

                  {/* Mockup Items */}
                  <div className="space-y-2.5 p-3.5">
                    {PREVIEW_ITEMS.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-xl border border-stone-200 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-950">{item.name}</p>
                          {item.badge ? (
                            <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {item.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-stone-500">{item.desc}</p>
                        <div className="mt-2.5 flex items-baseline gap-2">
                          {item.promoPrice ? (
                            <>
                              <span className="text-xs font-bold text-zinc-950">
                                {item.promoPrice}
                              </span>
                              <span className="text-[10px] text-stone-400 line-through">
                                {item.price}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-bold text-zinc-950">{item.price}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section id="recursos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider text-rose-600 uppercase">
              Infraestrutura enxuta
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              Feito para operar na mesa com zero atrito.
            </h2>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card key={pillar.title} className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-zinc-950">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-zinc-950">{pillar.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                    {pillar.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Plans */}
        <section id="planos" className="border-t border-stone-200 bg-stone-50/70">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold tracking-wider text-rose-600 uppercase">
                Planos comerciais
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
                Transparência por estabelecimento
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Contratação gerenciada pelo operador da plataforma. Etiquetas e materiais físicos
                NFC orçados separadamente.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => {
                const isFeatured = Boolean(plan.highlighted);
                return (
                  <Card
                    key={plan.name}
                    variant={isFeatured ? 'featured' : 'default'}
                    className="flex flex-col justify-between p-7"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className={`text-lg font-bold tracking-tight ${
                            isFeatured ? 'text-white' : 'text-zinc-950'
                          }`}
                        >
                          {plan.name}
                        </h3>
                        {isFeatured ? (
                          <span className="shrink-0 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            Mais completo
                          </span>
                        ) : null}
                      </div>

                      <p
                        className={`mt-1.5 text-xs ${
                          isFeatured ? 'text-zinc-400' : 'text-stone-500'
                        }`}
                      >
                        {plan.subtitle}
                      </p>

                      <div className="mt-5 flex items-baseline gap-1">
                        <span
                          className={`text-3xl font-extrabold tracking-tight ${
                            isFeatured ? 'text-white' : 'text-zinc-950'
                          }`}
                        >
                          {plan.price}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            isFeatured ? 'text-zinc-400' : 'text-stone-500'
                          }`}
                        >
                          {plan.period}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div
                          className={`rounded-xl border px-3 py-2.5 ${
                            isFeatured
                              ? 'border-rose-500/30 bg-zinc-900/90'
                              : 'border-rose-200 bg-rose-50/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[11px] font-semibold tracking-wide uppercase ${
                                isFeatured ? 'text-zinc-300' : 'text-stone-600'
                              }`}
                            >
                              Implantação promocional
                            </span>
                            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              {plan.setupFeeDiscount}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                            <span
                              className={`text-xs ${
                                isFeatured ? 'text-zinc-400' : 'text-stone-500'
                              }`}
                            >
                              de
                            </span>
                            <span
                              className={`text-xs line-through ${
                                isFeatured ? 'text-zinc-500' : 'text-stone-400'
                              }`}
                            >
                              {plan.setupFeeOriginal}
                            </span>
                            <span
                              className={`text-xs ${
                                isFeatured ? 'text-zinc-400' : 'text-stone-500'
                              }`}
                            >
                              por
                            </span>
                            <span
                              className={`text-sm font-extrabold ${
                                isFeatured ? 'text-white' : 'text-zinc-950'
                              }`}
                            >
                              {plan.setupFeePromo}
                            </span>
                          </div>
                        </div>
                      </div>

                      <ul
                        className={`mt-6 space-y-3 border-t pt-6 text-sm ${
                          isFeatured
                            ? 'border-zinc-800 text-zinc-200'
                            : 'border-stone-200 text-stone-700'
                        }`}
                      >
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5">
                            <Check
                              className={`mt-0.5 h-4 w-4 shrink-0 ${
                                isFeatured ? 'text-rose-400' : 'text-zinc-950'
                              }`}
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-stone-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-950 text-[10px] font-bold text-white">
              MF
            </span>
            <span className="font-semibold text-zinc-950">MenuFlow SaaS</span>
            <span>· Cardápios Digitais QR Code &amp; NFC</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-zinc-950">
              Painel do Estabelecimento
            </Link>
            <Link to="/platform" className="hover:text-zinc-950">
              Console do Operador
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
