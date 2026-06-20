import chalk from 'chalk';

const C = {
  accent: chalk.hex('#f59e0b'),
  glow: chalk.hex('#fbbf24').bold,
  soft: chalk.hex('#d4b178'),
  dim: chalk.hex('#8a6a2f'),
  ring: chalk.hex('#b45309'),
  ok: chalk.hex('#84cc16'),
};

/** Block ASCII logo — Orlix-style hero in the terminal. */
export const MORV_BLOCK = [
  '███╗   ███╗ ██████╗ ██████╗ ██╗   ██╗',
  '████╗ ████║██╔═══██╗██╔══██╗██║   ██║',
  '██╔████╔██║██║   ██║██████╔╝██║   ██║',
  '██║╚██╔╝██║██║   ██║██╔══██╗╚██╗ ██╔╝',
  '██║ ╚═╝ ██║╚██████╔╝██║  ██║ ╚████╔╝ ',
  '╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝  ╚═══╝  ',
];

const RING_TOP = [
  '              ╭────────────────────────────────────────╮',
  '           ╭──┤                                        ├──╮',
  '        ╭──┤  │                                        │  ├──╮',
];

const RING_BOTTOM = [
  '        ╰──┤  │                                        │  ├──╯',
  '           ╰──┤                                        ├──╯',
  '              ╰────────────────────────────────────────╯',
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function printMorvBanner(opts?: {
  subtitle?: string;
  animate?: boolean;
  boot?: boolean;
}) {
  const subtitle = opts?.subtitle ?? 'BASE AGENT TERMINAL';
  const animate = opts?.animate ?? false;

  console.log('');
  for (const line of RING_TOP) {
    console.log(C.ring(line));
    if (animate) await sleep(30);
  }

  for (const line of MORV_BLOCK) {
    console.log(C.glow(`        ${line}`));
    if (animate) await sleep(35);
  }

  for (const line of RING_BOTTOM) {
    console.log(C.ring(line));
    if (animate) await sleep(30);
  }

  console.log('');
  console.log(C.accent.bold(`  MORV LABS  //  ${subtitle}`));
  console.log(C.soft('  wallet · mcp · x402 · agentguard · Base 8453'));
  console.log(C.dim(`  ${'─'.repeat(56)}`));

  if (opts?.boot) {
    const bootLines = [
      [C.dim, '  ▸ booting agent runtime...'],
      [C.ok, '  ✓ morv.run gateway online'],
      [C.ok, '  ✓ AgentGuard policies loaded'],
      [C.dim, ''],
    ] as const;
    for (const [color, text] of bootLines) {
      console.log(color(text));
      if (animate) await sleep(60);
    }
  }

  console.log('');
}

export function printRunningHeader(agentId: string, prompt: string) {
  const preview = prompt.length > 52 ? `${prompt.slice(0, 52)}…` : prompt;
  console.log(C.dim('  ◉ agent  ') + C.accent.bold(agentId));
  console.log(C.dim('  ◉ prompt ') + C.soft(`"${preview}"`));
  console.log(C.dim(`  ${'─'.repeat(56)}`));
  console.log('');
}
