// /fun spiel: challenge another member to Vier gewinnt, Tic-Tac-Toe or a quiz duel, played with buttons on one
// message (collector, no global handler). An optional stake moves from the loser to the winner at the end – nothing
// is held during the game, so a restart can never swallow Bernis. The winner gets the usual mini-game reward.

import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, SlashCommandBuilder,
  type ButtonInteraction, type ChatInputCommandInteraction, type Message, type User,
} from 'discord.js';
import type { Command } from '../../../types/index.js';
import { ACCENTS, nexoCard, nexoMessage } from '../../../utils/nexoMessage.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import { formatCoins } from '../../../shared/coins.js';
import { SEASON_POINTS } from '../../../shared/season.js';
import { rewardMinigame } from '../../../services/cosmetics/hooks.js';
import { addSeasonPoints } from '../../../services/cosmetics/season.js';
import { getBalance } from '../../../services/cosmetics/store.js';
import { cosmeticsPool, withTx } from '../../../services/cosmetics/db.js';
import { earnTx, lockWallet, spendTx } from '../../../services/cosmetics/wallet.js';
import {
  C4_COLUMNS, DISC, connectFourResult, dropDisc, emptyConnectFour, renderConnectFour, ticTacToeResult, type Cell,
} from '../../../services/games/boards.js';
import { pickQuestions } from '../../../services/games/quiz.js';

const GAME_NAMES: Record<GameKind, string> = { viergewinnt: 'Vier gewinnt', tictactoe: 'Tic-Tac-Toe', quiz: 'Quiz-Duell' };
const QUIZ_ROUNDS = 5;
const QUESTION_MS = 20_000;
const IDLE_MS = 120_000;

const button = (customId: string, label: string, style = ButtonStyle.Secondary, disabled = false) =>
  new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style).setDisabled(disabled);
const rows = (buttons: ButtonBuilder[], perRow: number) => {
  const out: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += perRow) out.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + perRow)));
  return out;
};

/** Moves up to `stake` from the loser to the winner (what the loser still has). */
async function payStake(loser: User, winner: User, stake: number, game: string, guildId: string | null): Promise<number> {
  if (stake <= 0 || !cosmeticsPool()) return 0;
  return withTx(async (tx) => {
    const wallet = await lockWallet(tx, loser.id);
    const amount = Math.min(stake, Number(wallet.balance));
    if (amount <= 0) return 0;
    await spendTx(tx, loser.id, amount, 'duel_lost', `${game} verloren gegen ${winner.username}`);
    await earnTx(tx, winner.id, amount, 'duel_won', `${game} gewonnen gegen ${loser.username}`, guildId);
    return amount;
  });
}

export type GameKind = 'viergewinnt' | 'tictactoe' | 'quiz';
export interface Challenge { kind: GameKind; p1: User; p2: User; stake: number; guildId: string | null; seed: string }
export type GamePayload = ReturnType<typeof nexoMessage> & { allowedMentions?: { users: string[] } };

const card = (name: string, text: string, accent?: number) => nexoCard({ kicker: 'Spiel gegen andere', title: `🎲 ${name}`, accent, blocks: [{ text }] });

/** Why this challenge cannot start (German, for the challenger), or null. */
export async function challengeProblem(p1: User, p2: User, stake: number): Promise<string | null> {
  if (p2.id === p1.id) return 'Gegen dich selbst macht das keinen Spaß – fordere jemand anderen heraus.';
  if (p2.bot) return 'Bots spielen nicht mit. Fordere eine echte Person heraus.';
  if (stake > 0) {
    const [mine, theirs] = await Promise.all([getBalance(p1.id), getBalance(p2.id)]);
    if (mine < stake) return `Für den Einsatz fehlen dir Bernis: du hast ${formatCoins(mine)}.`;
    if (theirs < stake) return `${p2.username} hat nicht genug Bernis für diesen Einsatz.`;
  }
  return null;
}

/** A warning card for a refused challenge (ephemeral). */
export const refusalMessage = (kind: GameKind, text: string) => nexoMessage(card(GAME_NAMES[kind], text, ACCENTS.warn), { ephemeral: true });

/** Posts the challenge with `send` and runs the whole game on that message (from /fun spiel or the context menu). */
export async function playGame(c: Challenge, send: (payload: GamePayload) => Promise<Message>): Promise<void> {
  const { kind, p1, p2, stake } = c;
  const name = GAME_NAMES[kind];
  const id = `spiel_${c.seed}`;
  const stakeText = stake > 0 ? `\nEinsatz: **${formatCoins(stake)}** – der Verlierer zahlt ihn dem Gewinner.` : '';
  const message = await send({
    ...nexoMessage(card(name, `<@${p2.id}>, **${p1.username}** fordert dich heraus!${stakeText}\n\nNimmst du an?`), {
      rows: rows([button(`${id}_accept`, 'Annehmen', ButtonStyle.Success), button(`${id}_decline`, 'Ablehnen', ButtonStyle.Danger)], 2),
    }),
    allowedMentions: { users: [p2.id] },
  });
  const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, idle: IDLE_MS, time: 20 * 60_000 });

  let started = false;
  let finished = false;
  // Game state.
  let turn: 1 | 2 = Math.random() < 0.5 ? 1 : 2;
  const players = { 1: p1, 2: p2 } as const;
  const tic: Cell[] = Array(9).fill(0);
  const c4 = emptyConnectFour();
  const questions = pickQuestions(QUIZ_ROUNDS);
  let round = 0;
  const score = { 1: 0, 2: 0 };
  let answered = new Set<string>();
  let roundWinner: User | null = null;
  let timer: NodeJS.Timeout | null = null;

  const playerOf = (user: User): 1 | 2 | null => (user.id === p1.id ? 1 : user.id === p2.id ? 2 : null);

  const boardView = () => {
    if (kind === 'tictactoe') {
      const components = rows(tic.map((cell, i) => button(`${id}_t${i}`, cell === 1 ? '❌' : cell === 2 ? '⭕' : '·', cell ? ButtonStyle.Primary : ButtonStyle.Secondary, Boolean(cell) || finished)), 3);
      return { description: `❌ ${p1.username}  ·  ⭕ ${p2.username}`, components };
    }
    if (kind === 'viergewinnt') {
      const components = rows(Array.from({ length: C4_COLUMNS }, (_, c) => button(`${id}_c${c}`, String(c + 1), ButtonStyle.Secondary, c4[0][c] !== 0 || finished)), 4);
      return { description: `${renderConnectFour(c4)}\n\n${DISC[1]} ${p1.username}  ·  ${DISC[2]} ${p2.username}`, components };
    }
    if (round >= questions.length) return { description: `${p1.username}: **${score[1]}** · ${p2.username}: **${score[2]}**`, components: [] };
    const question = questions[round];
    const components = rows(question.answers.map((answer, i) => button(`${id}_q${round}_${i}`, answer.slice(0, 80), ButtonStyle.Secondary, finished)), 2);
    return {
      description: `**Frage ${round + 1} von ${questions.length}:** ${question.q}\n\n${p1.username}: **${score[1]}** · ${p2.username}: **${score[2]}**\n-# Wer zuerst richtig antwortet, bekommt den Punkt.`,
      components,
    };
  };

  const view = (status: string) => {
    const board = boardView();
    return nexoMessage(nexoCard({
      kicker: 'Spiel gegen andere', title: `🎲 ${name}`, accent: finished ? ACCENTS.gold : undefined,
      blocks: [{ text: board.description }, { separator: true }, { text: `${status}${stakeText}` }],
    }), { rows: board.components });
  };
  const turnText = () => `Am Zug: **${players[turn].username}**`;

  const finish = async (result: 1 | 2 | 'draw', reason = '') => {
    finished = true;
    if (timer) clearTimeout(timer);
    collector.stop('finished');
    const winner = result === 'draw' ? null : players[result];
    let status = winner ? `🏆 **${winner.username}** gewinnt!${reason}` : `🤝 Unentschieden!${reason}`;
    if (winner) {
      const loser = players[result === 1 ? 2 : 1];
      try {
        const paid = await payStake(loser, winner, stake, name, c.guildId);
        if (paid > 0) status += `\n${loser.username} zahlt ${formatCoins(paid)} an ${winner.username}.`;
      } catch (error) {
        logger.warn('Spiel-Einsatz konnte nicht überwiesen werden:', (error as Error).message);
      }
    }
    if (winner) {
      const granted = await rewardMinigame(null, winner, c.guildId, 'duel');
      if (granted > 0) status += `\n+ ${formatCoins(granted)} für ${winner.username}`;
      void addSeasonPoints(winner.id, SEASON_POINTS.duelWin);
    }
    await message.edit(view(status)).catch(() => undefined);
  };

  const nextQuestion = async (i: ButtonInteraction | null) => {
    if (timer) clearTimeout(timer);
    const last = questions[round];
    const solved = `Richtig war: **${last.answers[last.correct]}**${roundWinner ? ` – Punkt für ${roundWinner.username}` : ' – kein Punkt'}.`;
    round += 1;
    answered = new Set();
    roundWinner = null;
    if (round >= questions.length) {
      if (i) await i.deferUpdate().catch(() => undefined);
      await finish(score[1] === score[2] ? 'draw' : score[1] > score[2] ? 1 : 2, `\n${solved}\nEndstand ${score[1]}:${score[2]}`);
      return;
    }
    const payload = view(solved);
    if (i) await i.update(payload).catch(() => undefined);
    else await message.edit(payload).catch(() => undefined);
    timer = setTimeout(() => { void nextQuestion(null); }, QUESTION_MS);
  };

  collector.on('collect', async (i) => {
    try {
      const action = i.customId.slice(id.length + 1);
      const player = playerOf(i.user);
      if (!started) {
        if (action === 'decline' && player) {
          finished = true;
          collector.stop('declined');
          await i.update(nexoMessage(card(name, player === 2 ? `${p2.username} hat abgelehnt.` : `${p1.username} hat die Herausforderung zurückgezogen.`, ACCENTS.calm)));
          return;
        }
        if (action !== 'accept' || player !== 2) {
          await i.reply({ content: `Nur ${p2.username} kann die Herausforderung annehmen.`, flags: MessageFlags.Ephemeral });
          return;
        }
        if (stake > 0 && await getBalance(p2.id) < stake) {
          await i.reply({ content: 'Dafür reichen deine Bernis gerade nicht.', flags: MessageFlags.Ephemeral });
          return;
        }
        started = true;
        if (kind === 'quiz') {
          await i.update(view('Los geht’s!'));
          timer = setTimeout(() => { void nextQuestion(null); }, QUESTION_MS);
        } else {
          await i.update(view(turnText()));
        }
        return;
      }
      if (!player) {
        await i.reply({ content: 'Du spielst hier nicht mit – fordere selbst jemanden heraus mit /fun spiel.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (kind === 'quiz') {
        const [, q, a] = /^q(\d+)_(\d)$/.exec(action) ?? [];
        if (Number(q) !== round || answered.has(i.user.id) || roundWinner) {
          await i.reply({ content: answered.has(i.user.id) ? 'Du hast schon geantwortet.' : 'Die Frage ist schon vorbei.', flags: MessageFlags.Ephemeral });
          return;
        }
        answered.add(i.user.id);
        if (Number(a) === questions[round].correct) {
          roundWinner = i.user;
          score[player] += 1;
          await nextQuestion(i);
        } else if (answered.size === 2) {
          await nextQuestion(i);
        } else {
          await i.reply({ content: 'Leider falsch – jetzt kann nur noch dein Gegner punkten.', flags: MessageFlags.Ephemeral });
        }
        return;
      }

      if (player !== turn) {
        await i.reply({ content: `${players[turn].username} ist am Zug.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (kind === 'tictactoe') {
        const cell = Number(action.slice(1));
        if (tic[cell]) return void await i.deferUpdate();
        tic[cell] = player;
        const result = ticTacToeResult(tic);
        if (result) {
          await i.deferUpdate();
          await finish(result);
          return;
        }
      } else {
        if (dropDisc(c4, Number(action.slice(1)), player) < 0) return void await i.deferUpdate();
        const result = connectFourResult(c4);
        if (result) {
          await i.deferUpdate();
          await finish(result);
          return;
        }
      }
      turn = turn === 1 ? 2 : 1;
      await i.update(view(turnText()));
    } catch (error) {
      logger.warn('Spielzug fehlgeschlagen:', (error as Error).message);
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (timer) clearTimeout(timer);
    if (finished || reason === 'finished' || reason === 'declined') return;
    finished = true;
    const text = started ? '⏱️ Zu lange keine Antwort – das Spiel ist beendet, niemand zahlt etwas.' : '⏱️ Die Herausforderung ist abgelaufen.';
    await message.edit(nexoMessage(card(name, text, ACCENTS.calm))).catch(() => undefined);
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('spiel')
    .setDescription('Fordere jemanden zu Vier gewinnt, Tic-Tac-Toe oder einem Quiz-Duell heraus')
    .addStringOption((option) => option
      .setName('spiel').setDescription('Welches Spiel').setRequired(true)
      .addChoices({ name: 'Vier gewinnt', value: 'viergewinnt' }, { name: 'Tic-Tac-Toe', value: 'tictactoe' }, { name: 'Quiz-Duell', value: 'quiz' }))
    .addUserOption((option) => option.setName('gegner').setDescription('Wen du herausforderst').setRequired(true))
    .addIntegerOption((option) => option
      .setName('einsatz').setDescription('Bernis in Bronze, die der Verlierer dem Gewinner zahlt (optional)').setMinValue(0).setMaxValue(1000)),
  category: 'Fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const kind = interaction.options.getString('spiel', true) as GameKind;
    const p2 = interaction.options.getUser('gegner', true);
    const stake = cosmeticsPool() ? interaction.options.getInteger('einsatz') ?? 0 : 0;
    const problem = await challengeProblem(interaction.user, p2, stake);
    if (problem) return void await InteractionHelper.safeReply(interaction, refusalMessage(kind, problem));
    await playGame({ kind, p1: interaction.user, p2, stake, guildId: interaction.guildId, seed: interaction.id }, async (payload) => {
      await InteractionHelper.safeReply(interaction, payload);
      return await interaction.fetchReply() as Message;
    });
  },
} satisfies Command;
