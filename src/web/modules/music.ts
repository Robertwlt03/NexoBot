// Music: read-only player state plus 24/7, skip and stop. Nothing is persisted; state resets on restart.

import express from 'express';
import type { Response } from 'express';
import type { DashboardModule } from './index.js';
import type { MusicState } from '../dto/music.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, bool } from '../http.js';
import { getGuildMusicData } from '../../services/music/playerStore.js';
import { destroyPlayerSession, getPlayer } from '../../services/music/musicActions.js';
import { canControlMusic, VOICE_CHANNEL_DENIAL } from '../../services/music/permissions.js';
import type { NexoClient } from '../../types/index.js';

function readState(client: NexoClient, res: Response): MusicState {
  const { guild, member } = locals(res);
  const player = getPlayer(client, guild.id);
  const current = player?.current;
  return {
    available: Boolean(client.riffy),
    active: Boolean(player),
    nowPlaying: current ? {
      title: current.info?.title || 'Unbekannt',
      author: current.info?.author || '',
      uri: current.info?.uri || null,
      lengthMs: current.info?.length ?? 0,
    } : null,
    positionMs: player?.position ?? 0,
    paused: player?.paused ?? false,
    queueLength: player?.queue?.length ?? 0,
    volume: player?.volume ?? getGuildMusicData(guild.id).volume,
    loop: player?.loop ?? 'none',
    voiceChannelId: player?.voiceChannel ?? null,
    twentyFourSeven: getGuildMusicData(guild.id).twentyFourSeven,
    canControl: canControlMusic(member, player),
  };
}

/** Same rule as /music: only someone in Nexo's voice channel may control playback. */
function controllablePlayer(client: NexoClient, res: Response) {
  const { guild, member } = locals(res);
  const player = getPlayer(client, guild.id);
  if (!player) throw badRequest('Kein aktiver Musik-Player.');
  if (!canControlMusic(member, player)) throw new HttpError(403, VOICE_CHANNEL_DENIAL);
  return player;
}

export const musicModule: DashboardModule = {
  id: 'music',
  router: (client) => {
    const router = express.Router();

    router.get('/', (_req, res) => {
      res.json(readState(client, res));
    });

    // Same as /music 247: an in-memory flag, no voice channel needed.
    router.post('/twentyfourseven', (req, res) => {
      getGuildMusicData(locals(res).guild.id).twentyFourSeven = bool(body(req.body).enabled, '24/7');
      res.json(readState(client, res));
    });

    // Same as skipTrack(): clear track-loop so stop() advances to the next track.
    router.post('/skip', (_req, res) => {
      const player = controllablePlayer(client, res);
      if (!player.current) throw badRequest('Gerade läuft nichts.');
      if (player.loop === 'track') player.setLoop('none');
      player.stop();
      res.json(readState(client, res));
    });

    // Same as stopPlayback() after confirmation (the dashboard asks in a modal instead of a second command).
    router.post('/stop', async (_req, res) => {
      const player = controllablePlayer(client, res);
      const guildData = getGuildMusicData(locals(res).guild.id);
      guildData.stopConfirmPending = null;
      await destroyPlayerSession(client, locals(res).guild.id, player, guildData);
      res.json(readState(client, res));
    });

    return router;
  },
};
