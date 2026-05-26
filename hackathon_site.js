import { motion } from "framer-motion";
import {
    AlertTriangle,
    ArrowRight,
    BadgeCheck,
    Bot,
    CheckCircle2,
    CreditCard,
    ExternalLink,
    FileSearch,
    LockKeyhole,
    MessageCircle,
    Network,
    ReceiptText,
    ShieldCheck,
    UserCheck,
} from "lucide-react";

const badges = [
  { label: "Built on ClawUp", icon: Bot },
  { label: "ERC-8004 Registered", icon: BadgeCheck },
  { label: "x402 Payments", icon: CreditCard },
  { label: "Human-in-the-Loop Guardrails", icon: UserCheck },
];

const workflow = [
  {
    step: "01",
    title: "Submit supplier details",
    text: "The buyer sends the supplier name, website, and purchase context through Telegram.",
    icon: MessageCircle,
  },
  {
    step: "02",
    title: "Receive free preview",
    text: "ProofDesk returns a short initial risk preview without charging the user.",
    icon: FileSearch,
  },
  {
    step: "03",
    title: "Confirm paid report",
    text: "The agent asks for explicit user confirmation before starting the paid report flow.",
    icon: CheckCircle2,
  },
  {
    step: "04",
    title: "Pay with x402",
    text: "A $0.10 USDC payment is triggered and verified before the full report is released.",
    icon: CreditCard,
  },
  {
    step: "05",
    title: "Get structured report",
    text: "The buyer receives a clear vendor risk report with findings, flags, questions, and recommendation.",
    icon: ReceiptText,
  },
];

const reportSections = [
  {
    title: "Business Summary",
    body: "NorthBridge Industrial Components appears to be a small industrial parts supplier focused on components for lighting, electrical, and manufacturing buyers.",
  },
  {
    title: "Evidence-backed Findings",
    body: "Public-facing information suggests the company presents itself as a supplier of industrial LED fixture components. Available evidence is limited and should be independently verified before placing a material order.",
  },
  {
    title: "Risk Flags",
    body: "Limited third-party verification found. No visible certifications provided. No clear return or warranty policy shown. Website claims require human review.",
    alert: true,
  },
  {
    title: "Missing Information",
    body: "No independently verified customer references, fulfillment history, compliance certificates, or sample commercial documents were available in the demo review.",
  },
  {
    title: "Buyer Questions",
    body: "Ask for trade references, certificate documents, sample invoice, warranty terms, delivery timelines, and proof of prior fulfillment history.",
  },
  {
    title: "Recommendation",
    body: "Proceed with caution. Ask for references, certificate documents, sample invoice, warranty terms, and proof of fulfillment history before placing a $5,000 order.",
    alert: true,
  },
  {
    title: "Confidence Level",
    body: "Medium — based on limited public information.",
  },
  {
    title: "Human Review Items",
    body: "Certificate authenticity, website ownership, business registration, product quality claims, and fulfillment capacity should be reviewed by a human before payment.",
  },
];

const safetyItems = [
  "No private keys exposed",
  "No hardcoded secrets",
  "User confirmation required before payments",
  "User confirmation required before mainnet writes",
  "Abort route available",
  "Payment verification shown before final output",
  "Uncertain claims flagged for human review",
];

const proofPlaceholders = [
  { label: "Agent Name", value: "ProofDesk VendorVerify Agent" },
  { label: "Network", value: "GOAT Mainnet" },
  { label: "Chain ID", value: "2345" },
  {
    label: "Registry Contract",
    value: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  },
  { label: "Agent Wallet", value: "[to be added]" },
  { label: "Transaction Hash", value: "[to be added]" },
  { label: "8004scan Link", value: "[to be added]" },
];

const demoFlow = [
  "Ask the Telegram bot: “What do you do?”",
  "Submit supplier verification request",
  "Receive free preview",
  "Confirm paid report",
  "x402 payment verifies",
  "Full report appears",
  "Try risky command and show guardrail",
];

const paymentFlow = [
  {
    title: "Free Preview",
    text: "Agent gives an initial supplier risk signal at no cost.",
    status: "$0",
  },
  {
    title: "User Confirms",
    text: "The buyer explicitly approves the paid full report.",
    status: "Required",
  },
  {
    title: "x402 Payment",
    text: "$0.10 USDC payment request is triggered.",
    status: "Pending",
  },
  {
    title: "Verify Payment",
    text: "The report unlocks only after real verification.",
    status: "Verified only",
  },
];

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
      {children}
    </div>
  );
}

function Card({ children, className = "", id }) {
  return (
    <div id={id} className={`rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function Button({ children, className = "", variant = "default", onClick }) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold transition";
  const styles =
    variant === "outline"
      ? "border border-white/20 bg-white/5 text-white hover:bg-white/10"
      : "bg-cyan-400 text-slate-950 hover:bg-cyan-300";

  return (
    <button onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-80 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <nav className="mb-12 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">ProofDesk</p>
              <p className="text-xs text-slate-400">VendorVerify Agent</p>
            </div>
          </div>

          <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#workflow" className="hover:text-white">
              Workflow
            </a>
            <a href="#report" className="hover:text-white">
              Demo Report
            </a>
            <a href="#trust" className="hover:text-white">
              Trust
            </a>
          </div>
        </nav>

        <section className="grid gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              <Network className="h-4 w-4" />
              GOAT Network + OpenClaw Hackathon Demo
            </div>

            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
              ProofDesk VendorVerify
            </h1>

            <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-300">
              A verified AI agent that helps businesses check suppliers before
              they spend money.
            </p>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
              A small business is about to place a $5,000 order with an
              unfamiliar supplier. Instead of manually researching the company,
              they message ProofDesk on Telegram and receive a structured,
              demo-labeled risk report after verified x402 payment.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button className="h-12">
                Try Telegram Agent <ExternalLink className="ml-2 h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="h-12"
                onClick={() =>
                  document
                    .getElementById("report")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                View Demo Report <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {badges.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                >
                  <Icon className="h-4 w-4 text-cyan-300" />
                  {label}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
          >
            <Card className="overflow-hidden border border-white/10 bg-white/10 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur">
              <CardContent className="p-0">
                <div className="border-b border-white/10 bg-slate-900/80 p-5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-400" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400" />
                    <span className="h-3 w-3 rounded-full bg-green-400" />
                    <span className="ml-3 text-xs text-slate-400">
                      Telegram Agent Preview
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div className="max-w-[82%] rounded-2xl bg-slate-800 p-4 text-sm text-slate-200">
                    Verify supplier: NorthBridge Industrial Components.
                    Website: northbridge-industrial.example. Context: $5,000
                    industrial LED fixture order.
                  </div>

                  <div className="ml-auto max-w-[88%] rounded-2xl bg-cyan-400 p-4 text-sm font-medium text-slate-950">
                    Free preview: Medium risk. Limited public verification,
                    missing certifications, and unclear warranty policy. Full
                    report available for $0.10 USDC via x402.
                  </div>

                  <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-cyan-100">
                      <CreditCard className="h-4 w-4" />
                      Payment verification required
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      Full report unlocks only after real x402 verification.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 text-slate-900">
                    <p className="text-sm font-bold">Recommendation</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Proceed with caution. Request references, certificate
                      documents, invoice sample, warranty terms, and fulfillment
                      proof.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        <section className="py-14">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border border-white/10 bg-white text-slate-950 lg:col-span-1">
              <CardContent className="p-8">
                <SectionLabel>Problem</SectionLabel>
                <h2 className="mt-5 text-3xl font-black tracking-tight">
                  Supplier checks are still too manual.
                </h2>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:col-span-2">
              {[
                "Businesses waste time manually checking suppliers across search engines, websites, emails, and scattered documents.",
                "Bad supplier decisions can lead to fraud, shipment delays, poor quality, refund disputes, or lost money.",
                "Most verification tools are expensive, slow, or disconnected from the actual buying workflow.",
              ].map((item) => (
                <Card
                  key={item}
                  className="border border-white/10 bg-white/10 text-white backdrop-blur"
                >
                  <CardContent className="flex gap-4 p-6">
                    <AlertTriangle className="mt-1 h-5 w-5 flex-none text-amber-300" />
                    <p className="text-base leading-7 text-slate-200">
                      {item}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="py-14">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <SectionLabel>Workflow</SectionLabel>
              <h2 className="mt-5 text-4xl font-black tracking-tight text-white">
                From Telegram message to verified report.
              </h2>
            </div>

            <p className="max-w-xl text-slate-400">
              The demo focuses on agentic workflow, payment confirmation, and
              safe decision support — not replacing human judgment.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {workflow.map(({ step, title, text, icon: Icon }) => (
              <Card
                key={step}
                className="border border-white/10 bg-white/10 text-white backdrop-blur"
              >
                <CardContent className="p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-300">
                      {step}
                    </span>
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>

                  <h3 className="text-lg font-bold">{title}</h3>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="report" className="py-14">
          <div className="mb-8 text-center">
            <SectionLabel>Demo Supplier Card</SectionLabel>
            <h2 className="mt-5 text-4xl font-black tracking-tight text-white">
              NorthBridge Industrial Components
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Evaluating a $5,000 order for industrial LED fixture components.
            </p>
          </div>

          <Card className="overflow-hidden border border-white/10 bg-white text-slate-950 shadow-2xl">
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="bg-slate-100 p-8">
                  <div className="mb-4 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Demo Data
                  </div>

                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    Company
                  </p>

                  <h3 className="mt-3 text-3xl font-black">
                    NorthBridge Industrial Components
                  </h3>

                  <div className="mt-6 space-y-4 text-sm text-slate-600">
                    <div>
                      <p className="font-bold text-slate-900">Website</p>
                      <p>https://northbridge-industrial.example</p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900">
                        Purchase Context
                      </p>
                      <p>
                        Evaluating a $5,000 order for industrial LED fixture
                        components.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="font-bold text-amber-900">Risk posture</p>
                      <p className="mt-1 text-amber-800">
                        Proceed with caution
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  {reportSections.map((section) => (
                    <div
                      key={section.title}
                      className={`rounded-3xl border p-5 ${
                        section.alert
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {section.alert ? (
                          <AlertTriangle className="mt-1 h-5 w-5 flex-none text-amber-600" />
                        ) : (
                          <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-emerald-600" />
                        )}

                        <div>
                          <h4 className="font-black text-slate-950">
                            {section.title}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {section.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 py-14 lg:grid-cols-2">
          <Card className="border border-white/10 bg-white/10 text-white backdrop-blur">
            <CardContent className="p-8">
              <SectionLabel>Payment Flow</SectionLabel>

              <h2 className="mt-5 text-4xl font-black tracking-tight">
                Paid reports unlock only after verification.
              </h2>

              <div className="mt-8 grid gap-4">
                {paymentFlow.map((item, index) => (
                  <div
                    key={item.title}
                    className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400 font-black text-slate-950">
                      {index + 1}
                    </div>

                    <div>
                      <h3 className="font-black text-white">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.text}
                      </p>
                    </div>

                    <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100">
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-white p-6 text-slate-950">
                  <p className="text-sm font-bold text-slate-500">
                    Free Preview
                  </p>
                  <p className="mt-3 text-4xl font-black">$0</p>
                  <p className="mt-3 text-sm text-slate-600">
                    Initial risk signal and next step prompt.
                  </p>
                </div>

                <div className="rounded-3xl bg-cyan-400 p-6 text-slate-950">
                  <p className="text-sm font-bold text-slate-700">
                    Full Vendor Report
                  </p>
                  <p className="mt-3 text-4xl font-black">$0.10</p>
                  <p className="mt-3 text-sm font-medium text-slate-800">
                    USDC via x402
                  </p>
                </div>
              </div>

              <p className="mt-6 text-sm leading-6 text-slate-400">
                Demo note: payment status must remain a placeholder until your
                real x402 verification flow confirms it. Do not show fake
                transaction success.
              </p>
            </CardContent>
          </Card>

          <Card
            id="trust"
            className="border border-white/10 bg-white text-slate-950"
          >
            <CardContent className="p-8">
              <SectionLabel>Trust & Safety</SectionLabel>

              <h2 className="mt-5 text-4xl font-black tracking-tight">
                Built for safe demo execution.
              </h2>

              <div className="mt-7 grid gap-3">
                {safetyItems.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    <LockKeyhole className="h-4 w-4 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 py-14 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border border-cyan-300/20 bg-cyan-300/10 text-white backdrop-blur">
            <CardContent className="p-8">
              <SectionLabel>ERC-8004 Proof</SectionLabel>

              <h2 className="mt-5 text-4xl font-black tracking-tight">
                Verifiable agent identity on GOAT Network Mainnet.
              </h2>

              <p className="mt-5 text-lg leading-8 text-cyan-50">
                ProofDesk is registered as an ERC-8004 agent on GOAT Network
                Mainnet, giving it a verifiable agent identity. During the demo,
                replace the placeholders below with the real wallet, transaction
                hash, and 8004scan link once registration is complete.
              </p>

              <div className="mt-7 grid gap-3">
                {proofPlaceholders.map((item) => (
                  <div
                    key={item.label}
                    className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:grid-cols-[170px_1fr]"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                      {item.label}
                    </p>
                    <p className="break-all font-mono text-sm text-slate-100">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-white text-slate-950">
            <CardContent className="p-8">
              <SectionLabel>Live Demo Flow</SectionLabel>

              <h2 className="mt-5 text-4xl font-black tracking-tight">
                A tight 2-minute script for judges.
              </h2>

              <div className="mt-7 space-y-3">
                {demoFlow.map((item, index) => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
                      {index + 1}
                    </div>

                    <p className="text-sm font-medium leading-6 text-slate-700">
                      {item}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Demo data only. Do not include private keys, bot tokens,
                merchant secrets, or unverified payment claims on this page.
              </div>
            </CardContent>
          </Card>
        </section>

        <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
          ProofDesk VendorVerify Agent · Demo data only · GOAT Network +
          OpenClaw Hackathon
        </footer>
      </main>
    </div>
  );
}