import { Link } from 'react-router';
import {
  ArrowRight,
  Check,
  Flame,
  Nfc,
  QrCode,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

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
    subtitle: 'Acesso por aproximação nas mesas e no balcão com etiquetas NFC',
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

const SEGMENTS = [
  'Hamburguerias',
  'Pizzarias',
  'Adegas',
  'Lanchonetes',
  'Distribuidoras',
  'Bares & Petiscarias',
];

const PILLARS = [
  {
    icon: QrCode,
    title: 'QR Code pronto para imprimir',
    description:
      'Gere e baixe QR Codes em PNG e SVG em alta definição para colocar nos displays de mesa, balcão ou adesivos.',
  },
  {
    icon: Smartphone,
    title: 'Encostou, abriu no celular',
    description:
      'Cardápio leve e instantâneo no 4G. O cliente acessa por toque NFC ou câmera, sem login e sem instalar aplicativo.',
  },
  {
    icon: ShieldCheck,
    title: 'Controle total da sua loja',
    description:
      'Atualize preços, fotos, combos e promoções de happy hour em segundos, com painel exclusivo para sua equipe.',
  },
];

const PREVIEW_ITEMS = [
  {
    name: 'Smash Duplo na Brasa',
    desc: 'Dois blends 100g, cheddar derretido, cebola caramelizada e maionese defumada no brioche',
    price: 'R$ 38,00',
    promoPrice: 'R$ 32,30',
    badge: '-15%',
  },
  {
    name: 'Fritas Rústicas com Páprica',
    desc: 'Porção generosa de batatas crocantes com alho confitado e molho da casa',
    price: 'R$ 26,00',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-brand">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-display text-base font-extrabold tracking-tight text-white shadow-xs">
              T
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-brand">
              Tápio
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-muted md:flex">
            <a href="#recursos" className="transition-colors hover:text-brand">
              Recursos
            </a>
            <a href="#planos" className="transition-colors hover:text-brand">
              Planos
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button
                variant="outline"
                size="sm"
                className="border-line bg-white text-brand hover:border-brand/30 hover:bg-canvas-deep/50"
              >
                Sou estabelecimento
              </Button>
            </Link>
            <Link to="/platform">
              <Button size="sm" className="bg-brand text-canvas hover:bg-brand-hover">
                Operador
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line bg-canvas">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-mustard/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-22">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-mustard/40 bg-mustard-soft px-3.5 py-1 text-xs font-semibold text-[#8A5A00]">
                <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                Encostou, abriu · Cardápio Digital via NFC &amp; QR Code
              </div>

              <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-brand sm:text-5xl lg:text-[3.35rem] lg:leading-[1.06]">
                Cardápio digital na mesa e no balcão — sem papel rasgado nem app.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
                Feito para a correria de hamburguerias, pizzarias, adegas, lanchonetes e
                distribuidoras. Atualize preços, fotos e promoções no seu painel e deixe o cliente
                abrir o cardápio com um toque no celular.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to="/login">
                  <Button
                    size="lg"
                    className="w-full bg-accent font-semibold text-white hover:bg-accent-hover focus-visible:ring-accent sm:w-auto"
                  >
                    Acessar Painel do Estabelecimento
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/platform">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full border-line bg-white text-brand hover:border-brand/30 hover:bg-canvas-deep/60 sm:w-auto"
                  >
                    Console Central do Operador
                  </Button>
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6 text-xs font-medium text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-accent" />
                  Sem app para instalar
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-accent" />
                  Compatível com tags NTAG213
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-accent" />
                  Com a identidade do seu negócio
                </span>
              </div>
            </div>

            {/* Mobile Menu Preview */}
            <div className="lg:col-span-5">
              <div className="mx-auto max-w-sm rounded-3xl border border-brand/15 bg-brand p-3 shadow-2xl shadow-brand/15">
                <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
                  {/* Mockup Top Bar */}
                  <div className="flex items-center justify-between border-b border-line bg-brand px-4 py-3 text-canvas">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
                        <Flame className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-display text-xs font-bold text-white">
                          Brasa Burger &amp; Adega
                        </p>
                        <p className="font-mono text-[10px] text-canvas-deep/75">
                          /m/brasa-burger
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-mustard/40 bg-mustard/15 px-2 py-0.5 text-[10px] font-semibold text-mustard">
                      <Nfc className="h-3 w-3 text-mustard" />
                      NFC · Mesa 04
                    </span>
                  </div>

                  {/* Mockup Categories */}
                  <div className="flex gap-1.5 border-b border-line bg-white px-4 py-2.5">
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
                      Burgers
                    </span>
                    <span className="rounded-full bg-canvas-deep/70 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                      Porções
                    </span>
                    <span className="rounded-full bg-canvas-deep/70 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                      Bebidas
                    </span>
                  </div>

                  {/* Mockup Items */}
                  <div className="space-y-2.5 p-3.5">
                    {PREVIEW_ITEMS.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-xl border border-line bg-white p-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display text-xs font-bold text-brand">{item.name}</p>
                          {item.badge ? (
                            <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {item.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-ink-muted">{item.desc}</p>
                        <div className="mt-2.5 flex items-baseline gap-2">
                          {item.promoPrice ? (
                            <>
                              <span className="text-xs font-extrabold text-brand">
                                {item.promoPrice}
                              </span>
                              <span className="text-[10px] text-ink-muted/70 line-through">
                                {item.price}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-extrabold text-brand">{item.price}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Segment strip */}
          <div className="border-t border-line bg-canvas-deep/60">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-3.5 text-xs font-semibold tracking-wide text-ink-muted uppercase sm:px-6">
              {SEGMENTS.map((segment) => (
                <span key={segment} className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent/70" aria-hidden="true" />
                  {segment}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section id="recursos" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-wider text-accent uppercase">
                Simples no balcão, forte na operação
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
                Feito para girar mesa com zero atrito.
              </h2>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className="rounded-2xl border border-line bg-canvas/70 p-6 transition-colors hover:border-accent/40"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-accent shadow-2xs">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-base font-bold text-brand">
                      {pillar.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                      {pillar.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Plans */}
        <section id="planos" className="border-t border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold tracking-wider text-accent uppercase">
                Planos comerciais
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
                Preço direto ao ponto por estabelecimento
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                Contratação gerenciada pelo operador da plataforma. Etiquetas e materiais físicos
                NFC orçados separadamente.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => {
                const isFeatured = Boolean(plan.highlighted);
                return (
                  <div
                    key={plan.name}
                    className={`flex flex-col justify-between rounded-2xl border p-7 ${
                      isFeatured
                        ? 'border-brand bg-brand text-canvas shadow-xl shadow-brand/15 ring-1 ring-brand'
                        : 'border-line bg-white text-brand shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className={`font-display text-lg font-bold tracking-tight ${
                            isFeatured ? 'text-white' : 'text-brand'
                          }`}
                        >
                          {plan.name}
                        </h3>
                        {isFeatured ? (
                          <span className="shrink-0 rounded-full bg-mustard px-2.5 py-0.5 text-[11px] font-bold text-brand">
                            Mais completo
                          </span>
                        ) : null}
                      </div>

                      <p
                        className={`mt-1.5 text-xs ${
                          isFeatured ? 'text-canvas-deep/75' : 'text-ink-muted'
                        }`}
                      >
                        {plan.subtitle}
                      </p>

                      <div className="mt-5 flex items-baseline gap-1">
                        <span
                          className={`font-display text-3xl font-extrabold tracking-tight ${
                            isFeatured ? 'text-white' : 'text-brand'
                          }`}
                        >
                          {plan.price}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            isFeatured ? 'text-canvas-deep/70' : 'text-ink-muted'
                          }`}
                        >
                          {plan.period}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div
                          className={`rounded-xl border px-3 py-2.5 ${
                            isFeatured
                              ? 'border-accent/40 bg-brand-hover'
                              : 'border-accent/25 bg-mustard-soft/55'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[11px] font-semibold tracking-wide uppercase ${
                                isFeatured ? 'text-canvas-deep' : 'text-brand/80'
                              }`}
                            >
                              Implantação promocional
                            </span>
                            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                              {plan.setupFeeDiscount}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                            <span
                              className={`text-xs ${
                                isFeatured ? 'text-canvas-deep/70' : 'text-ink-muted'
                              }`}
                            >
                              de
                            </span>
                            <span
                              className={`text-xs line-through ${
                                isFeatured ? 'text-canvas-deep/50' : 'text-ink-muted/70'
                              }`}
                            >
                              {plan.setupFeeOriginal}
                            </span>
                            <span
                              className={`text-xs ${
                                isFeatured ? 'text-canvas-deep/70' : 'text-ink-muted'
                              }`}
                            >
                              por
                            </span>
                            <span
                              className={`text-sm font-extrabold ${
                                isFeatured ? 'text-white' : 'text-brand'
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
                            ? 'border-white/10 text-canvas-deep'
                            : 'border-line text-ink-muted'
                        }`}
                      >
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5">
                            <Check
                              className={`mt-0.5 h-4 w-4 shrink-0 ${
                                isFeatured ? 'text-mustard' : 'text-accent'
                              }`}
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-brand bg-brand text-canvas-deep">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent font-display text-xs font-extrabold text-white">
              T
            </span>
            <span className="font-display text-sm font-bold text-white">Tápio</span>
            <span className="text-canvas-deep/70">· Cardápios Digitais QR Code &amp; NFC</span>
          </div>
          <div className="flex items-center gap-4 text-canvas-deep/80">
            <Link to="/login" className="transition-colors hover:text-white">
              Painel do Estabelecimento
            </Link>
            <Link to="/platform" className="transition-colors hover:text-white">
              Console do Operador
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
